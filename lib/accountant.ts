import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { invoiceTotals } from '@/components/invoice/InvoiceDocument';
import { invoiceBookCsv, invoiceFileName, invoiceUbl } from '@/lib/accounting';
import { formatEuro, plural } from '@/lib/format';
import { loadIssuedInvoices } from '@/lib/invoice';
import { sendMail } from '@/lib/mail';
import { createAdminClient } from '@/lib/supabase/admin';
import { addMonths, todayInZagreb } from '@/lib/time';
import { canMessage } from '@/lib/whatsapp';
import { zip } from '@/lib/zip';
import type { Tenant } from '@/types/db';

// Paket za knjigovođu e-mailom: the month's invoice book (CSV) and every
// invoice as e-Račun (XML) in one ZIP, to the address the owner keeps in
// Poslovanje. On demand, and by itself on the 2nd of every month for the
// month before. The accountant's reply goes to the workshop.

type Admin = ReturnType<typeof createAdminClient>;

const MONTHS = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
export const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}.`;

export interface AccountantSettings {
  email: string | null;
  auto: boolean;
  lastSent: string | null;
}

export function accountantOf(settings: unknown): AccountantSettings {
  const s = (settings as { accountant?: { email?: unknown; auto?: unknown; last_sent?: unknown } } | null)?.accountant ?? {};
  return { email: typeof s.email === 'string' && s.email ? s.email : null, auto: s.auto !== false, lastSent: typeof s.last_sent === 'string' ? s.last_sent : null };
}

// db: the owner's session, or the service role with tenant.id.
export async function sendAccountantPackage(db: SupabaseClient, tenant: Tenant, month: string, to: string, replyTo: string | null, withTenantFilter = false): Promise<{ ok: true; count: number } | { ok: false; error: string; count: number }> {
  const invoices = await loadIssuedInvoices(db, month, withTenantFilter ? tenant.id : undefined);
  if (!invoices.length) return { ok: false, error: `Za ${monthLabel(month)} nema izdanih računa.`, count: 0 };
  const sum = invoices.reduce(
    (s, inv) => {
      const t = invoiceTotals(inv.lines, inv.billing.vatRegistered);
      return { net: s.net + t.net, vat: s.vat + t.vat, gross: s.gross + t.gross };
    },
    { net: 0, vat: 0, gross: 0 }
  );
  const base = `racuni-${month}`;
  const archive = zip([{ name: `${base}/knjiga-racuna-${month}.csv`, data: invoiceBookCsv(invoices) }, ...invoices.map((inv) => ({ name: `${base}/${invoiceFileName(inv)}`, data: invoiceUbl(inv) }))]);
  const n = invoices.length;
  const text = [
    'Poštovani,',
    '',
    `u prilogu su izdani računi radionice ${tenant.name}${tenant.oib ? ` (OIB ${tenant.oib})` : ''} za ${monthLabel(month)}:`,
    `${n} ${plural(n, 'račun', 'računa', 'računa')}, ukupno ${formatEuro(sum.gross)} (osnovica ${formatEuro(sum.net)}, PDV ${formatEuro(sum.vat)}).`,
    '',
    'Paket sadrži knjigu računa za Excel (CSV) i svaki račun kao e-Račun (XML, UBL 2.1).',
    '',
    `Poslano iz aplikacije Poslar u ime radionice ${tenant.name}.${replyTo ? ' Odgovor ide izravno radionici.' : ''}`,
  ].join('\n');
  const sent = await sendMail(to, `Računi za ${monthLabel(month)}: ${tenant.name}`, text, { attachments: [{ name: `${base}.zip`, data: archive }], replyTo });
  return sent ? { ok: true, count: n } : { ok: false, error: 'E-mail se trenutno ne može poslati. Pokušajte kasnije ili preuzmite paket.', count: n };
}

// The 2nd of the month: last month's package for every workshop that set
// an accountant and did not switch it off. Once per month (last_sent).
export async function sendMonthlyPackages(admin: Admin, today = todayInZagreb(), onlyTenant?: string): Promise<{ sent: number; empty: number } | 'not today'> {
  if (today.slice(8, 10) !== '02') return 'not today';
  const month = addMonths(`${today.slice(0, 7)}-15`, -1).slice(0, 7);
  let q = admin.from('tenants').select('*').not('settings->accountant->>email', 'is', null);
  if (onlyTenant) q = q.eq('id', onlyTenant);
  const { data } = await q.limit(5000);
  let sent = 0;
  let empty = 0;
  for (const t of (data ?? []) as Tenant[]) {
    const acc = accountantOf(t.settings);
    if (!acc.email || !acc.auto || acc.lastSent === month || !canMessage(t)) continue;
    const { data: owner } = await admin.from('profiles').select('id').eq('tenant_id', t.id).eq('role', 'owner').order('created_at').limit(1).maybeSingle();
    const replyTo = owner ? ((await admin.auth.admin.getUserById(owner.id as string)).data.user?.email ?? null) : null;
    const r = await sendAccountantPackage(admin, t, month, acc.email, t.email || replyTo, true);
    if (r.ok) {
      sent++;
      const settings = (t.settings as Record<string, unknown> | null) ?? {};
      await admin.from('tenants').update({ settings: { ...settings, accountant: { ...(settings.accountant as object), last_sent: month } } }).eq('id', t.id);
    } else if (!r.count) empty++;
  }
  return { sent, empty };
}
