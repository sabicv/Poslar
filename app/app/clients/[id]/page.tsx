import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { AssetSheet, ClientSheet, SITE_KIND_LABELS, SiteSheet } from '@/components/ClientForms';
import { BackLink, Badge, ButtonLink, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { ASSET_TYPE_LABELS, PHASE_TONE, defaultMeterUnit, hasFieldWork, phaseLabel } from '@/config/tenant.config';
import { googleMapsLink } from '@/lib/contact';
import { assetTitle, clientName, formatDate, formatEuro } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import type { Asset, Client, Job, Site } from '@/types/db';

export const metadata: Metadata = { title: 'Stranka' };

// Each fact once: contact details only in "Podaci", a device's address only
// on its location (devices are listed under the location they are at).
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const field = hasFieldWork(ctx.pkg, ctx.tenant.enabled_modules);
  const [{ data: client }, { data: assets }, { data: jobs }, { data: siteRows }] = await Promise.all([
    ctx.supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    ctx.supabase.from('assets').select('*').eq('client_id', id).order('created_at'),
    ctx.supabase.from('jobs').select('id, number, phase, complaint, created_at, payment_status, asset_id').eq('client_id', id).order('created_at', { ascending: false }).limit(100),
    field ? ctx.supabase.from('sites').select('*').eq('client_id', id).order('created_at') : Promise.resolve({ data: [] }),
  ]);
  if (!client) notFound();
  const c = client as Client;
  const list = (assets ?? []) as Asset[];
  const sites = (siteRows ?? []) as Site[];
  const siteLabel = (s: Site) => [s.label, s.address, s.city].filter(Boolean).join(', ');
  const siteOptions = sites.map((s) => ({ value: s.id, label: siteLabel(s) }));
  const jobList = (jobs ?? []) as Pick<Job, 'id' | 'number' | 'phase' | 'complaint' | 'created_at' | 'payment_status' | 'asset_id'>[];

  let totals = new Map<string, number>();
  if (ctx.isOwner && jobList.length) {
    const { data } = await ctx.supabase.from('job_totals').select('job_id, gross_total').in('job_id', jobList.map((j) => j.id));
    totals = new Map((data ?? []).map((t) => [t.job_id as string, Number(t.gross_total)]));
  }
  const lifetime = [...totals.values()].reduce((a, b) => a + b, 0);
  const assetTypes = ctx.pkg.assetTypes.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t], unit: defaultMeterUnit(t) }));
  const parents = list.map((a) => ({ value: a.id, label: `${a.identifier ?? ''} ${assetTitle(a)}`.trim() }));
  const address = [c.address, c.city].filter(Boolean).join(', ');

  const assetRow = (a: Asset, indent = false) => (
    <li key={a.id} className={indent ? 'flex items-center gap-3 py-2.5 pl-11 pr-4' : 'flex items-center gap-3 px-4 py-3'}>
      <Link prefetch={false} href={`/app/assets/${a.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block text-sm font-medium">
          {a.identifier ? <span className="mr-2 font-mono">{a.identifier}</span> : null}
          {assetTitle(a)}
        </span>
        <span className="block text-xs text-muted">
          {ASSET_TYPE_LABELS[a.asset_type]}
          {a.year ? ` · ${a.year}` : ''}
        </span>
      </Link>
      <ButtonLink href={`/app/jobs/new?asset=${a.id}`} size="sm" variant="primary">
        Nalog
      </ButtonLink>
    </li>
  );
  const newAsset = <AssetSheet clientId={c.id} assetTypes={assetTypes} parents={parents} sites={siteOptions} title={ctx.pkg.vocabulary.asset.new} />;
  const unplaced = list.filter((a) => !a.site_id || !sites.some((s) => s.id === a.site_id));

  return (
    <>
      <PageHeader
        back={<BackLink href="/app/clients">{ctx.pkg.vocabulary.client.many}</BackLink>}
        title={clientName(c)}
        action={<ClientSheet client={c} title={`Uredi — ${ctx.pkg.vocabulary.client.one.toLowerCase()}`} isOwner={ctx.isOwner} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {field ? (
            <Card>
              <CardHeader
                title={`Lokacije i ${ctx.pkg.vocabulary.asset.many.toLowerCase()}`}
                action={
                  <div className="flex flex-wrap justify-end gap-2">
                    <SiteSheet clientId={c.id} />
                    {newAsset}
                  </div>
                }
              />
              {sites.length || list.length ? (
                <ul className="divide-y divide-line">
                  {sites.map((s) => (
                    <li key={s.id}>
                      <div className="flex items-start gap-3 px-4 py-3">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                        <div className="min-w-0 flex-1">
                          <a href={googleMapsLink(s)} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium hover:underline">
                            {siteLabel(s)}
                          </a>
                          <p className="text-xs text-muted">{[SITE_KIND_LABELS[s.kind], s.contact_name && `${s.contact_name} ${s.contact_phone ?? ''}`.trim()].filter(Boolean).join(' · ')}</p>
                          {s.access_notes ? <p className="mt-0.5 text-xs text-warn">{s.access_notes}</p> : null}
                        </div>
                        <SiteSheet clientId={c.id} site={s} isOwner={ctx.isOwner} />
                      </div>
                      {list.some((a) => a.site_id === s.id) ? <ul className="border-t border-line/60">{list.filter((a) => a.site_id === s.id).map((a) => assetRow(a, true))}</ul> : null}
                    </li>
                  ))}
                  {unplaced.map((a) => assetRow(a))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-muted">Nema upisanih lokacija ni uređaja. Dodaju se i sami pri zakazivanju posjeta.</p>
              )}
            </Card>
          ) : (
            <Card>
              <CardHeader title={ctx.pkg.vocabulary.asset.many} action={newAsset} />
              {list.length ? <ul className="divide-y divide-line">{list.map((a) => assetRow(a))}</ul> : <p className="px-4 py-4 text-sm text-muted">Nema upisanih objekata.</p>}
            </Card>
          )}
          <Card>
            <CardHeader title="Nalozi" />
            {jobList.length ? (
              <ul className="divide-y divide-line">
                {jobList.map((j) => (
                  <li key={j.id}>
                    {/* Two lines: what was done (and the amount), then when, on what, and where it stands. */}
                    <Link prefetch={false} href={`/app/jobs/${j.id}`} className="block px-4 py-3 hover:bg-surface2">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-sm">
                          <span className="text-faint">#{j.number}</span> {j.complaint ?? '—'}
                        </span>
                        {ctx.isOwner && totals.has(j.id) ? <span className="shrink-0 text-sm tabular text-muted">{formatEuro(totals.get(j.id))}</span> : null}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        {formatDate(j.created_at)}
                        {list.length > 1 && list.find((a) => a.id === j.asset_id)?.identifier ? <span>· {list.find((a) => a.id === j.asset_id)!.identifier}</span> : null}
                        <Badge tone={PHASE_TONE[j.phase]}>{phaseLabel(ctx.pkg, j.phase)}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted">Još nema naloga.</p>
            )}
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="Podaci" />
          <div className="divide-y divide-line px-4">
            {c.phone ? (
              <KeyValue label="Telefon">
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-accent">
                  {c.phone}
                </a>
              </KeyValue>
            ) : null}
            {c.email ? <KeyValue label="E-mail">{c.email}</KeyValue> : null}
            {address ? <KeyValue label="Adresa">{address}</KeyValue> : null}
            {c.oib ? <KeyValue label="OIB">{c.oib}</KeyValue> : null}
            {ctx.isOwner ? <KeyValue label="Ukupno potrošeno">{formatEuro(lifetime)}</KeyValue> : null}
            {!c.phone && !c.email && !address && !c.oib && !ctx.isOwner ? <p className="py-3 text-sm text-muted">Nema upisanih podataka.</p> : null}
          </div>
          {c.notes ? <p className="border-t border-line px-4 py-3 text-sm text-muted">{c.notes}</p> : null}
        </Card>
      </div>
    </>
  );
}
