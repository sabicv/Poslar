'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { PACKAGE_IDS, type PackageId } from '@/config/tenant.config';
import { fail, type ActionResult } from '@/lib/action-result';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------
// Self-registration: a workshop signs up and gets a free trial.
// ---------------------------------------------------------------------
const registerSchema = z.object({
  package: z.enum(PACKAGE_IDS as [PackageId, ...PackageId[]]),
  workshopName: z.string().trim().min(2, 'Upišite naziv radionice.').max(120),
  fullName: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  email: z.string().trim().toLowerCase().email('Neispravan e-mail.'),
  password: z.string().min(8, 'Lozinka mora imati barem 8 znakova.').max(72),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  oib: z.string().trim().regex(/^\d{11}$/, 'OIB ima 11 znamenki.').optional().or(z.literal('')),
  // Honeypot: people never see this field, bots fill it.
  website: z.string().max(0).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Potvrdite uvjete korištenja.' }) }),
});

export async function registerWorkshop(values: z.input<typeof registerSchema>): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
  const v = parsed.data;
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.fullName },
  });
  if (error || !created.user) {
    return fail(/already|registered|exists/i.test(error?.message ?? '') ? 'Taj e-mail već ima račun — prijavite se.' : 'Registracija nije uspjela. Pokušajte ponovno.');
  }

  const trialDays = Math.max(1, Number(process.env.TRIAL_DAYS ?? 30) || 30);
  const { error: rpcError } = await admin.rpc('register_workshop', {
    p_user_id: created.user.id,
    p_full_name: v.fullName,
    p_workshop_name: v.workshopName,
    p_package: v.package,
    p_oib: v.oib || null,
    p_phone: v.phone || null,
    p_city: v.city || null,
    p_status: 'trial',
    p_trial_days: trialDays,
  });
  if (rpcError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail('Radionica nije stvorena. Pokušajte ponovno.');
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Customer approval by link (no account). Runs with the service role, so
// every check the database would do for a user is repeated here.
// ---------------------------------------------------------------------
const decisionSchema = z.object({
  signerName: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  decisions: z.array(z.object({ lineId: z.string().uuid(), decision: z.enum(['approved', 'declined']) })).min(1).max(200),
});

export async function submitApproval(token: string, values: z.input<typeof decisionSchema>): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return fail('Neispravna poveznica.');
  const parsed = decisionSchema.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite odabir.');
  const admin = createAdminClient();

  const { data: approval } = await admin.from('approvals').select('id, tenant_id, job_id, status, expires_at').eq('token', token).maybeSingle();
  if (!approval) return fail('Poveznica ne postoji.');
  if (approval.status === 'decided') return fail('Odluka je već poslana. Hvala!');
  if (approval.status === 'expired' || new Date(approval.expires_at) < new Date()) return fail('Poveznica je istekla. Javite se servisu.');

  const { data: job } = await admin.from('jobs').select('locked_at').eq('id', approval.job_id).single();
  if (job?.locked_at) return fail('Nalog je zaključan. Javite se servisu.');

  const { data: lines } = await admin.from('job_lines').select('id').eq('job_id', approval.job_id).eq('approval', 'proposed');
  const allowed = new Set((lines ?? []).map((l) => l.id as string));
  const decisions = parsed.data.decisions.filter((d) => allowed.has(d.lineId));
  if (decisions.length === 0) return fail('Nema stavki za odluku.');

  for (const d of decisions) {
    await admin.from('job_lines').update({ approval: d.decision }).eq('id', d.lineId).eq('job_id', approval.job_id);
  }

  const h = await headers();
  await admin
    .from('approvals')
    .update({
      status: 'decided',
      decided_at: new Date().toISOString(),
      decisions,
      signer_name: parsed.data.signerName,
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: h.get('user-agent')?.slice(0, 300) ?? null,
    })
    .eq('id', approval.id);

  const approvedCount = decisions.filter((d) => d.decision === 'approved').length;
  await admin.from('job_events').insert({
    tenant_id: approval.tenant_id,
    job_id: approval.job_id,
    event_type: 'approval',
    message: `${parsed.data.signerName} odobrio/la ${approvedCount} od ${decisions.length} stavki`,
    metadata: { decisions },
  });
  if (approvedCount > 0) {
    await admin.from('jobs').update({ phase: 'in_progress' }).eq('id', approval.job_id).eq('phase', 'awaiting_approval');
  }
  return { ok: true };
}
