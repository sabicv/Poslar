import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// The first payment of a workshop that came through a referral gives the
// one who sent it a month free: a month more of "paid until", a month more
// of trial, or (no date to move) a note for the tower. Once per workshop.
// Called after a payment recorded in the tower or paid by card.
export async function rewardReferrer(tenantId: string) {
  const admin = createAdminClient();
  const { data: t } = await admin.from('tenants').select('name, referred_by, referral_rewarded_at').eq('id', tenantId).single();
  if (!t?.referred_by || t.referral_rewarded_at) return;
  const { data: r } = await admin.from('tenants').select('id, status, paid_until, trial_ends_at, admin_notes').eq('id', t.referred_by).maybeSingle();
  if (!r) return;
  const today = new Date().toISOString().slice(0, 10);
  const plusMonth = (day: string) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 10);
  };
  const note = `Mjesec gratis za preporuku: ${t.name} (${today}).`;
  const patch: Record<string, unknown> =
    r.paid_until
      ? { paid_until: plusMonth(r.paid_until > today ? r.paid_until : today) }
      : r.status === 'trial' && r.trial_ends_at
        ? { trial_ends_at: new Date(new Date(r.trial_ends_at).getTime() + 30 * 86400000).toISOString() }
        : {};
  await admin.from('tenants').update({ ...patch, admin_notes: [r.admin_notes, note].filter(Boolean).join('\n') }).eq('id', r.id);
  await admin.from('tenants').update({ referral_rewarded_at: new Date().toISOString() }).eq('id', tenantId);
}
