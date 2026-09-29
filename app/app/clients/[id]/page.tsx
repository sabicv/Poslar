import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssetSheet, ClientSheet } from '@/components/ClientForms';
import { BackLink, Badge, ButtonLink, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { ASSET_TYPE_LABELS, PHASE_TONE, defaultMeterUnit, phaseLabel } from '@/config/tenant.config';
import { assetTitle, clientName, formatDate, formatEuro } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import type { Asset, Client, Job } from '@/types/db';

export const metadata: Metadata = { title: 'Stranka' };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: client }, { data: assets }, { data: jobs }] = await Promise.all([
    ctx.supabase.from('clients').select('*').eq('id', id).maybeSingle(),
    ctx.supabase.from('assets').select('*').eq('client_id', id).order('created_at'),
    ctx.supabase.from('jobs').select('id, number, phase, complaint, created_at, payment_status, asset_id').eq('client_id', id).order('created_at', { ascending: false }).limit(100),
  ]);
  if (!client) notFound();
  const c = client as Client;
  const list = (assets ?? []) as Asset[];
  const jobList = (jobs ?? []) as Pick<Job, 'id' | 'number' | 'phase' | 'complaint' | 'created_at' | 'payment_status' | 'asset_id'>[];

  let totals = new Map<string, number>();
  if (ctx.isOwner && jobList.length) {
    const { data } = await ctx.supabase.from('job_totals').select('job_id, gross_total').in('job_id', jobList.map((j) => j.id));
    totals = new Map((data ?? []).map((t) => [t.job_id as string, Number(t.gross_total)]));
  }
  const lifetime = [...totals.values()].reduce((a, b) => a + b, 0);
  const assetTypes = ctx.pkg.assetTypes.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t], unit: defaultMeterUnit(t) }));
  const parents = list.map((a) => ({ value: a.id, label: `${a.identifier ?? ''} ${assetTitle(a)}`.trim() }));

  return (
    <>
      <PageHeader
        back={<BackLink href="/app/clients">{ctx.pkg.vocabulary.client.many}</BackLink>}
        title={clientName(c)}
        subtitle={[c.phone, c.city].filter(Boolean).join(' · ')}
        action={<ClientSheet client={c} title={`Uredi — ${ctx.pkg.vocabulary.client.one.toLowerCase()}`} isOwner={ctx.isOwner} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={ctx.pkg.vocabulary.asset.many}
              action={<AssetSheet clientId={c.id} assetTypes={assetTypes} parents={parents} title={ctx.pkg.vocabulary.asset.new} />}
            />
            {list.length ? (
              <ul className="divide-y divide-line">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <Link href={`/app/assets/${a.id}`} className="min-w-0 flex-1 hover:underline">
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
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted">Nema upisanih objekata.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Nalozi" subtitle={`${jobList.length} ukupno`} />
            {jobList.length ? (
              <ul className="divide-y divide-line">
                {jobList.map((j) => (
                  <li key={j.id}>
                    <Link href={`/app/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface2">
                      <span className="w-12 text-xs text-faint">#{j.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{j.complaint ?? '—'}</span>
                        <span className="block text-xs text-muted">
                          {formatDate(j.created_at)} · {list.find((a) => a.id === j.asset_id)?.identifier ?? ''}
                        </span>
                      </span>
                      <Badge tone={PHASE_TONE[j.phase]}>{phaseLabel(ctx.pkg, j.phase)}</Badge>
                      {ctx.isOwner && totals.has(j.id) ? <span className="w-24 text-right text-sm tabular text-muted">{formatEuro(totals.get(j.id))}</span> : null}
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
            <KeyValue label="Vrsta">{c.kind === 'company' ? 'Tvrtka' : 'Osoba'}</KeyValue>
            {c.oib ? <KeyValue label="OIB">{c.oib}</KeyValue> : null}
            {c.phone ? (
              <KeyValue label="Telefon">
                <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="text-accent">
                  {c.phone}
                </a>
              </KeyValue>
            ) : null}
            {c.email ? <KeyValue label="E-mail">{c.email}</KeyValue> : null}
            {c.address ? <KeyValue label="Adresa">{[c.address, c.city].filter(Boolean).join(', ')}</KeyValue> : null}
            {ctx.isOwner ? <KeyValue label="Ukupno potrošeno">{formatEuro(lifetime)}</KeyValue> : null}
          </div>
          {c.notes ? <p className="border-t border-line px-4 py-3 text-sm text-muted">{c.notes}</p> : null}
        </Card>
      </div>
    </>
  );
}
