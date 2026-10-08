import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPackage } from '@/config/tenant.config';
import { WA_LANGUAGE, WA_TEMPLATES, waEnabled, type WaKind } from '@/config/whatsapp';
import { subscription } from '@/lib/billing';
import { spokenSlot } from '@/lib/calendar';
import { internationalDigits } from '@/lib/contact';
import { assetTitle } from '@/lib/format';
import { isGuestTenant } from '@/lib/guest';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatTime } from '@/lib/time';
import type { Tenant } from '@/types/db';

// Automatske poruke (WhatsApp Business, Meta Cloud API): one shared Poslar
// number writes to customers in a workshop's name with approved templates.
// Off until WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are set; until then the
// owner sends the same text with one tap from their own WhatsApp.

type Admin = ReturnType<typeof createAdminClient>;

export function whatsappReady(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_ID?.trim());
}

// The Graph API; a test can point it elsewhere.
export function graphBase(): string {
  return (process.env.WHATSAPP_API_BASE?.trim() || 'https://graph.facebook.com/v21.0').replace(/\/$/, '');
}

export const graphHeaders = () => ({ Authorization: `Bearer ${process.env.WHATSAPP_TOKEN?.trim()}` });

// Real workshops that work: never from the demos or sample data.
export function canMessage(t: Tenant): boolean {
  const s = (t.settings as { demo?: unknown } | null) ?? {};
  if (isGuestTenant(t) || s.demo === true || t.sample_until || t.status === 'suspended') return false;
  if (t.status === 'trial' && t.trial_ends_at && new Date(t.trial_ends_at) < new Date()) return false;
  return subscription(t).status !== 'overdue';
}

const fill = (body: string, params: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? '');

export type WaResult = { ok: true } | { ok: false; reason: 'off' | 'no_phone' | 'disabled' | 'failed'; message: string };

async function sendTemplate(admin: Admin, args: { tenantId: string; jobId: string | null; phone: string | null; kind: WaKind; params: string[] }): Promise<WaResult> {
  const to = internationalDigits(args.phone);
  if (!to) return { ok: false, reason: 'no_phone', message: 'Mušterija nema broj mobitela.' };
  const template = WA_TEMPLATES[args.kind];
  const params = args.params.map((p) => p.replace(/\s+/g, ' ').trim().slice(0, 200) || '-');
  let waId: string | null = null;
  let ok = false;
  try {
    const res = await fetch(`${graphBase()}/${process.env.WHATSAPP_PHONE_ID?.trim()}/messages`, {
      method: 'POST',
      headers: { ...graphHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: template.name, language: { code: WA_LANGUAGE }, components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] },
      }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
    waId = body.messages?.[0]?.id ?? null;
    ok = res.ok;
  } catch {
    ok = false;
  }
  await admin.from('whatsapp_messages').insert({ tenant_id: args.tenantId, job_id: args.jobId, phone: to, direction: 'out', kind: args.kind, body: fill(template.body, params), wa_id: waId, status: ok ? 'sent' : 'failed' });
  return ok ? { ok: true } : { ok: false, reason: 'failed', message: 'WhatsApp poruka nije poslana. Pošaljite je sami iz naloga.' };
}

// The job's message of this kind, with what the customer needs to read.
export async function notifyJob(admin: Admin, jobId: string, kind: WaKind, extra: { stage?: string; actorId?: string | null } = {}): Promise<WaResult> {
  if (!whatsappReady()) return { ok: false, reason: 'off', message: 'Automatske poruke još nisu uključene.' };
  const { data: job } = await admin
    .from('jobs')
    .select('id, tenant_id, scheduled_start, work_mode, client:clients(phone), asset:assets(identifier, make, model, asset_type), site:sites(address, city), tenant:tenants(*)')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return { ok: false, reason: 'failed', message: 'Nalog nije pronađen.' };
  const t = job.tenant as unknown as Tenant;
  if (!canMessage(t) || !waEnabled(t.settings, kind)) return { ok: false, reason: 'disabled', message: 'Ova poruka je isključena u Postavkama.' };
  const client = job.client as unknown as { phone: string | null } | null;
  const asset = job.asset as unknown as { identifier: string | null; make: string | null; model: string | null; asset_type: string } | null;
  const site = job.site as unknown as { address: string | null; city: string | null } | null;
  const field = job.work_mode === 'field' || getPackage(t.package).sector === 'field';
  const place = (field ? [site?.address, site?.city] : [t.address, t.city]).filter(Boolean).join(', ') || t.name;
  const what = [assetTitle(asset as never), asset?.identifier].filter(Boolean).join(' ');
  const start = job.scheduled_start as string | null;
  if ((kind === 'confirm' || kind === 'reminder') && !start) return { ok: false, reason: 'failed', message: 'Nalog nema termin.' };
  const params =
    kind === 'confirm'
      ? [t.name, spokenSlot(new Date(start!)), place]
      : kind === 'reminder'
        ? [formatTime(start), t.name, place]
        : kind === 'ready'
          ? [t.name, what || 'Vaš nalog']
          : [t.name, asset?.identifier || what || 'Vašeg vozila', extra.stage ?? ''];
  const result = await sendTemplate(admin, { tenantId: t.id, jobId, phone: client?.phone ?? null, kind, params });
  if (result.ok) {
    await admin.from('job_events').insert({ tenant_id: t.id, job_id: jobId, event_type: 'whatsapp', actor_id: extra.actorId ?? null, message: `WhatsApp mušteriji: ${WA_TEMPLATES[kind].label.toLowerCase()}` });
  }
  return result;
}

// The evening run: tomorrow's appointments get their reminder, once.
export async function sendAppointmentReminders(admin: Admin, from: string, to: string, onlyTenant?: string): Promise<{ sent: number; skipped: number }> {
  if (!whatsappReady()) return { sent: 0, skipped: 0 };
  let q = admin.from('jobs').select('id').gte('scheduled_start', from).lt('scheduled_start', to).is('reminder_sent_at', null).neq('phase', 'collected');
  if (onlyTenant) q = q.eq('tenant_id', onlyTenant);
  const { data: jobs } = await q.limit(2000);
  let sent = 0;
  let skipped = 0;
  for (const j of jobs ?? []) {
    const r = await notifyJob(admin, j.id as string, 'reminder');
    if (r.ok) {
      sent++;
      await admin.from('jobs').update({ reminder_sent_at: new Date().toISOString() }).eq('id', j.id);
    } else skipped++;
  }
  return { sent, skipped };
}

// Meta signs every webhook call with the app secret.
export function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
