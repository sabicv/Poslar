import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, MapPin, ShieldCheck } from 'lucide-react';
import { FGAS_ACTIONS } from '@/components/modules/air/AirModule';
import { accentStyle, getPackage } from '@/config/tenant.config';
import { assetTitle, formatDate } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatTime } from '@/lib/time';

export const metadata: Metadata = { title: 'Izvještaj o obavljenom poslu', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Public work report for a customer who wasn't there: when the technician
// arrived and left (with GPS), photos before/after, findings and the
// refrigerant record. Opened by an unguessable token; no prices.
export default async function WorkReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();

  const { data: job } = await admin
    .from('jobs')
    .select(
      'id, tenant_id, number, phase, complaint, work_summary, created_at, finished_at, arrived_at, left_at, arrived_lat, arrived_lng, asset:assets(asset_type, make, model), site:sites(label, address, city), assignee:profiles(full_name)'
    )
    .eq('report_token', token)
    .maybeSingle();
  if (!job) notFound();

  const { data: tenant } = await admin.from('tenants').select('name, phone, email, address, city, logo_url, package').eq('id', job.tenant_id).single();
  if (!tenant) notFound();
  const pkg = getPackage(tenant.package as string);
  const done = job.phase === 'ready' || job.phase === 'collected' || Boolean(job.left_at);

  const header = (
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
  );

  if (!done) {
    return (
      <main className="accent-scope mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-safe" style={accentStyle(pkg)}>
        {header}
        <section className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Izvještaj će biti dostupan kad posao bude završen.</section>
      </main>
    );
  }

  const [{ data: files }, { data: inspections }, { data: gas }] = await Promise.all([
    admin
      .from('attachments')
      .select('path, tag, caption, taken_at, created_at, sha256')
      .eq('job_id', job.id)
      .or('visibility.eq.customer,tag.in.(before,after)')
      .order('taken_at', { ascending: true, nullsFirst: false })
      .limit(40),
    admin.from('inspections').select('title, template_code, results:inspection_results(item_code, status, measure_value, measure_unit, note)').eq('job_id', job.id).not('completed_at', 'is', null),
    admin.from('air_fgas_log').select('refrigerant, action, quantity_kg, leak_found, leak_location, technician_cert, performed_at').eq('job_id', job.id).order('performed_at'),
  ]);
  const signed = files?.length ? (await admin.storage.from('job-files').createSignedUrls(files.map((f) => f.path as string), 3600)).data ?? [] : [];
  const urlOf = new Map(signed.filter((s) => s.path && s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]));
  const labels = new Map(pkg.inspections.flatMap((t) => t.sections.flatMap((sec) => sec.items.map((i) => [`${t.code}:${i.code}`, i.label] as const))));
  const asset = job.asset as unknown as { asset_type: never; make: string | null; model: string | null } | null;
  const site = job.site as unknown as { label: string | null; address: string; city: string | null } | null;
  const tech = (job.assignee as unknown as { full_name: string | null } | null)?.full_name;
  const photoGroups = [
    { title: 'Prije', items: (files ?? []).filter((f) => f.tag === 'before') },
    { title: 'Poslije', items: (files ?? []).filter((f) => f.tag === 'after') },
    { title: 'Ostalo', items: (files ?? []).filter((f) => f.tag !== 'before' && f.tag !== 'after') },
  ].filter((g) => g.items.length);
  const minutes = job.arrived_at && job.left_at ? Math.round((new Date(job.left_at as string).getTime() - new Date(job.arrived_at as string).getTime()) / 60000) : null;

  return (
    <main className="accent-scope mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-safe" style={accentStyle(pkg)}>
      {header}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 className="size-4" /> Posao završen · nalog #{job.number as number}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{assetTitle(asset)}</h1>
        {site ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-4" /> {[site.label, site.address, site.city].filter(Boolean).join(', ')}
          </p>
        ) : null}
        {job.complaint ? <p className="mt-3 text-sm text-muted">Zahtjev: {job.complaint as string}</p> : null}
        {job.work_summary ? <p className="mt-2 whitespace-pre-line text-sm">{job.work_summary as string}</p> : null}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3.5" /> Dolazak
          </p>
          <p className="text-lg font-semibold tabular">{job.arrived_at ? formatTime(job.arrived_at as string) : '-'}</p>
          <p className="text-xs text-faint">{formatDate((job.arrived_at ?? job.finished_at) as string | null)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3.5" /> Odlazak
          </p>
          <p className="text-lg font-semibold tabular">{job.left_at ? formatTime(job.left_at as string) : '-'}</p>
          <p className="text-xs text-faint">{minutes !== null ? `${minutes} min na lokaciji` : ''}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-3.5" /> Potvrda lokacije
          </p>
          {job.arrived_lat != null ? (
            <a href={`https://www.google.com/maps?q=${job.arrived_lat},${job.arrived_lng}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent underline">
              GPS pri dolasku
            </a>
          ) : (
            <p className="text-sm text-muted">-</p>
          )}
          {tech ? <p className="text-xs text-faint">Serviser: {tech}</p> : null}
        </div>
      </section>

      {photoGroups.map((group) => (
        <section key={group.title} className="mt-5">
          <h2 className="mb-2 text-sm font-semibold">{group.title}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.items.map((f) =>
              urlOf.get(f.path as string) ? (
                <a key={f.path as string} href={urlOf.get(f.path as string)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlOf.get(f.path as string)} alt={(f.caption as string | null) ?? group.title} className="aspect-[4/3] w-full object-cover" />
                  <p className="px-2 py-1 text-xs text-faint">
                    {formatDate((f.taken_at ?? f.created_at) as string)} {formatTime((f.taken_at ?? f.created_at) as string)}
                  </p>
                </a>
              ) : null
            )}
          </div>
        </section>
      ))}
      {(files ?? []).some((f) => f.sha256) ? (
        <p className="mt-2 text-xs text-faint">Za svaku fotografiju pohranjen je otisak (SHA-256) izvorne datoteke, pa se može dokazati da nije mijenjana.</p>
      ) : null}

      {(inspections ?? []).map((ins) => {
        const results = ((ins.results as { item_code: string; status: string; measure_value: number | null; measure_unit: string | null; note: string | null }[]) ?? []).filter(
          (r) => r.status !== 'not_checked'
        );
        const flagged = results.filter((r) => r.status === 'warn' || r.status === 'crit');
        const measured = results.filter((r) => r.measure_value !== null);
        return (
          <section key={ins.title as string} className="mt-5 rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">
              {ins.title as string} <span className="font-normal text-muted">· {results.filter((r) => r.status === 'ok').length} u redu</span>
            </h2>
            <ul className="divide-y divide-line text-sm">
              {[...flagged, ...measured.filter((m) => !flagged.includes(m))].map((r) => (
                <li key={r.item_code} className="flex items-start justify-between gap-3 px-5 py-2.5">
                  <span>
                    {labels.get(`${ins.template_code}:${r.item_code}`) ?? r.item_code}
                    {r.note ? <span className="block text-xs text-muted">{r.note}</span> : null}
                  </span>
                  <span className="shrink-0 text-right">
                    {r.measure_value !== null ? <span className="block tabular">{`${r.measure_value} ${r.measure_unit ?? ''}`}</span> : null}
                    {r.status === 'crit' ? <span className="text-xs font-medium text-crit">Hitno</span> : r.status === 'warn' ? <span className="text-xs font-medium text-warn">Preporuka</span> : <span className="text-xs text-ok">U redu</span>}
                  </span>
                </li>
              ))}
              {flagged.length === 0 && measured.length === 0 ? <li className="px-5 py-2.5 text-muted">Sve provjerene stavke su u redu.</li> : null}
            </ul>
          </section>
        );
      })}

      {(gas ?? []).length ? (
        <section className="mt-5 rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Zapis o radnoj tvari (F-plin)</h2>
          <ul className="divide-y divide-line text-sm">
            {(gas ?? []).map((g, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span>
                  {FGAS_ACTIONS[g.action as string]} · {g.refrigerant as string}
                  {Number(g.quantity_kg) > 0 ? ` · ${g.quantity_kg} kg` : ''}
                </span>
                <span className="text-xs text-muted">
                  {g.action === 'leak_check' ? (g.leak_found ? `propuštanje: ${g.leak_location ?? 'da'}` : 'bez propuštanja · ') : ''}
                  cert. {(g.technician_cert as string | null) ?? '-'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Name, address and phone head the page; the footer adds only the e-mail. */}
      {tenant.email ? <p className="mt-8 text-center text-xs text-faint">{tenant.email as string}</p> : null}
    </main>
  );
}
