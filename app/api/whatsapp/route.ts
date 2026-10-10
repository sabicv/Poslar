import { after } from 'next/server';
import { logError } from '@/lib/errors';
import { randomId } from '@/lib/ids';
import { openRouterChat, whatsappModel } from '@/lib/openrouter';
import { createAdminClient } from '@/lib/supabase/admin';
import { graphBase, graphHeaders, validSignature } from '@/lib/whatsapp';

// Meta's webhook for the shared Poslar WhatsApp number (docs/WHATSAPP.md).
// GET: Meta checks the address once. POST: delivery receipts, and what a
// customer writes back. A reply belongs to the workshop that wrote to that
// number last (within 30 days) and lands on that job: text in the job's
// log, photos and documents among its files. An unknown sender is not kept.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Admin = ReturnType<typeof createAdminClient>;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (token && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === token) {
    return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  image?: { id: string; caption?: string; mime_type?: string };
  document?: { id: string; caption?: string; filename?: string; mime_type?: string };
}

const MAX_BYTES = 15 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

async function saveMedia(admin: Admin, tenantId: string, jobId: string, mediaId: string, caption: string | undefined): Promise<boolean> {
  const meta = await fetch(`${graphBase()}/${mediaId}`, { headers: graphHeaders(), signal: AbortSignal.timeout(8000) });
  if (!meta.ok) return false;
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url || (info.file_size ?? 0) > MAX_BYTES) return false;
  const file = await fetch(info.url, { headers: graphHeaders(), signal: AbortSignal.timeout(20000) });
  if (!file.ok) return false;
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return false;
  const mime = (info.mime_type ?? 'application/octet-stream').split(';')[0];
  const path = `${tenantId}/${jobId}/${randomId()}.${EXT[mime] ?? 'bin'}`;
  const { error } = await admin.storage.from('job-files').upload(path, bytes, { contentType: mime, upsert: false });
  if (error) return false;
  await admin.from('attachments').insert({ tenant_id: tenantId, job_id: jobId, path, mime, size_bytes: bytes.byteLength, caption: caption ? `Mušterija (WhatsApp): ${caption}`.slice(0, 500) : 'Mušterija poslala na WhatsApp', has_thumb: false });
  return true;
}

async function incoming(admin: Admin, m: WaMessage) {
  const { data: seen } = await admin.from('whatsapp_messages').select('id').eq('wa_id', m.id).maybeSingle();
  if (seen) return;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: last } = await admin.from('whatsapp_messages').select('tenant_id, job_id').eq('phone', m.from).eq('direction', 'out').gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!last) return;
  const tenantId = last.tenant_id as string;
  const jobId = (last.job_id as string | null) ?? null;
  const media = m.image ?? m.document;
  const body = m.text?.body ?? media?.caption ?? null;
  await admin.from('whatsapp_messages').insert({ tenant_id: tenantId, job_id: jobId, phone: m.from, direction: 'in', kind: m.type, body: body?.slice(0, 4000) ?? null, wa_id: m.id, status: 'received' });
  if (!jobId) return;
  let message: string;
  if (media) {
    const saved = await saveMedia(admin, tenantId, jobId, media.id, media.caption).catch(() => false);
    message = saved ? `Mušterija poslala ${m.image ? 'sliku' : 'dokument'} na WhatsApp${media.caption ? `: ${media.caption}` : ''}` : 'Mušterija poslala datoteku na WhatsApp (nije spremljena, prevelika ili nedostupna).';
  } else if (m.type === 'text') {
    message = `Mušterija na WhatsApp: ${body ?? ''}`;
  } else {
    message = 'Mušterija poslala poruku na WhatsApp (glasovna ili druga vrsta, ovdje se ne prikazuje).';
  }
  await admin.from('job_events').insert({ tenant_id: tenantId, job_id: jobId, event_type: 'whatsapp', message: message.slice(0, 2000) });
  if (m.type === 'text' && body?.trim()) {
    const customerText = body.trim();
    after(async () => {
      try {
        const { data: tenant } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
        const draft = await openRouterChat({
          model: whatsappModel(),
          maxTokens: 220,
          messages: [
            {
              role: 'system',
              content: `Ti pomažeš radionici ${tenant?.name ?? 'Poslar'}. Mušterija je napisala na WhatsApp. Napiši kratak prijedlog odgovora na hrvatskom, s "Vi", najviše dvije rečenice. Ne izmišljaj cijene, rokove ni dijagnozu. Ako treba majstor, reci da će se javiti. Samo tekst odgovora.`,
            },
            { role: 'user', content: customerText.slice(0, 2000) },
          ],
        });
        if (!draft) return;
        await admin.from('job_events').insert({ tenant_id: tenantId, job_id: jobId, event_type: 'whatsapp', message: `Prijedlog odgovora na WhatsApp (nije poslano): ${draft}`.slice(0, 2000) });
      } catch {
        // A missing draft never blocks the customer's message.
      }
    });
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) return new Response('Unauthorized', { status: 401 });
  const admin = createAdminClient();
  try {
    const payload = JSON.parse(raw) as { entry?: { changes?: { value?: { messages?: WaMessage[]; statuses?: { id: string; status: string }[] } }[] }[] };
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const s of change.value?.statuses ?? []) await admin.from('whatsapp_messages').update({ status: s.status }).eq('wa_id', s.id);
        for (const m of change.value?.messages ?? []) await incoming(admin, m);
      }
    }
  } catch (error) {
    await logError({ source: 'server', message: `WhatsApp webhook: ${error instanceof Error ? error.message : String(error)}`, stack: error instanceof Error ? error.stack : null, url: '/api/whatsapp' });
  }
  // Meta retries anything but a 200.
  return new Response('ok', { status: 200 });
}
