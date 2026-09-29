import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { accentStyle, getPackage } from '@/config/tenant.config';
import { assetTitle, formatDateTime, formatEuro } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApprovalForm } from './ApprovalForm';

export const metadata: Metadata = { title: 'Odobrenje radova', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Public page for the customer: no account, just the unguessable token.
// Everything is read with the service role and filtered to this one job.
export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();

  const { data: approval } = await admin.from('approvals').select('*').eq('token', token).maybeSingle();
  if (!approval) notFound();

  const [{ data: job }, { data: tenant }, { data: lines }, { data: files }] = await Promise.all([
    admin.from('jobs').select('number, complaint, locked_at, asset:assets(identifier, make, model, asset_type), client:clients(first_name, last_name, company_name, kind)').eq('id', approval.job_id).single(),
    admin.from('tenants').select('name, phone, email, address, city, logo_url, package').eq('id', approval.tenant_id).single(),
    admin.from('job_lines').select('id, description, qty, unit, kind, priority, approval').eq('job_id', approval.job_id).in('approval', ['approved', 'proposed']).order('sort'),
    admin.from('attachments').select('id, path, caption').eq('job_id', approval.job_id).eq('visibility', 'customer').limit(24),
  ]);
  if (!job || !tenant) notFound();

  if (approval.status === 'sent') {
    await admin.from('approvals').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', approval.id);
  }

  const ids = (lines ?? []).map((l) => l.id as string);
  const { data: prices } = ids.length ? await admin.from('job_line_prices').select('job_line_id, unit_price, discount_pct, vat_rate').in('job_line_id', ids) : { data: [] };
  const priceOf = new Map(
    (prices ?? []).map((p) => [p.job_line_id as string, Number(p.unit_price) * (1 - Number(p.discount_pct) / 100) * (1 + Number(p.vat_rate) / 100)])
  );
  const signed = files?.length ? (await admin.storage.from('job-files').createSignedUrls(files.map((f) => f.path as string), 3600)).data ?? [] : [];

  const pkg = getPackage(tenant.package as string);
  const expired = approval.status === 'expired' || new Date(approval.expires_at as string) < new Date();
  const asset = job.asset as unknown as { identifier: string | null; make: string | null; model: string | null; asset_type: never };
  const approvedLines = (lines ?? []).filter((l) => l.approval === 'approved');
  const proposedLines = (lines ?? []).filter((l) => l.approval === 'proposed');

  return (
    <main className="accent-scope mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-safe" style={accentStyle(pkg)}>
      <header className="flex items-center gap-3 py-6">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url as string} alt="" className="size-12 rounded-xl object-contain" />
        ) : null}
        <div>
          <p className="text-lg font-semibold">{tenant.name as string}</p>
          <p className="text-sm text-muted">{[tenant.address, tenant.city, tenant.phone].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Radni nalog #{job.number as number}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {assetTitle(asset)} {asset?.identifier ? <span className="font-mono text-lg text-muted">· {asset.identifier}</span> : null}
        </h1>
        {job.complaint ? <p className="mt-2 text-sm text-muted">Vaš zahtjev: {job.complaint as string}</p> : null}
      </section>

      {signed.length ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold">Fotografije iz radionice</h2>
          <div className="grid grid-cols-3 gap-2">
            {signed.map((s) =>
              s.signedUrl ? (
                <a key={s.path} href={s.signedUrl} target="_blank" rel="noopener noreferrer" className="aspect-square overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.signedUrl} alt="" className="h-full w-full object-cover" />
                </a>
              ) : null
            )}
          </div>
        </section>
      ) : null}

      {approvedLines.length ? (
        <section className="mt-5 rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Već dogovoreno</h2>
          <ul className="divide-y divide-line">
            {approvedLines.map((l) => (
              <li key={l.id as string} className="flex justify-between gap-4 px-5 py-3 text-sm">
                <span>{l.description as string}</span>
                <span className="shrink-0 tabular text-muted">{formatEuro(Number(l.qty) * (priceOf.get(l.id as string) ?? 0))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {approval.status === 'decided' ? (
        <section className="mt-5 rounded-2xl border border-ok/40 bg-ok/10 p-5 text-sm">
          Odluka je zaprimljena {formatDateTime(approval.decided_at as string)} ({approval.signer_name as string}). Hvala — servis je obaviješten.
        </section>
      ) : expired || job.locked_at ? (
        <section className="mt-5 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Poveznica više nije aktivna. Za pitanja nazovite servis{tenant.phone ? ` na ${tenant.phone}` : ''}.</section>
      ) : (
        <ApprovalForm
          token={token}
          lines={proposedLines.map((l) => ({
            id: l.id as string,
            description: l.description as string,
            qty: Number(l.qty),
            unit: l.unit as string,
            priority: l.priority as 'urgent' | 'recommended' | 'optional' | null,
            total: Number(l.qty) * (priceOf.get(l.id as string) ?? 0),
          }))}
          alreadyApproved={approvedLines.reduce((s, l) => s + Number(l.qty) * (priceOf.get(l.id as string) ?? 0), 0)}
        />
      )}
      <p className="mt-8 text-center text-xs text-faint">Cijene su s PDV-om. Poveznica vrijedi do {formatDateTime(approval.expires_at as string)}.</p>
    </main>
  );
}
