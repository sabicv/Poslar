import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssetSheet } from '@/components/ClientForms';
import { BackLink, Badge, ButtonLink, Card, CardHeader, KeyValue, PageHeader } from '@/components/ui';
import { ASSET_TYPE_LABELS, METER_LABELS, PHASE_TONE, defaultMeterUnit, identifierLabel, phaseLabel, vinLabel } from '@/config/tenant.config';
import { assetTitle, clientName, formatDate, formatMeter } from '@/lib/format';
import { requireWorkshop } from '@/lib/session';
import { signPaths } from '@/lib/signed';
import type { Asset, Client, Job } from '@/types/db';
import { MeterForm } from './MeterForm';

export const metadata: Metadata = { title: 'Povijest objekta' };

// The object's passport: every visit, reading and photo in one place.
export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkshop();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await ctx.supabase.from('assets').select('*, client:clients(*), parent:assets!assets_parent_asset_id_tenant_id_fkey(id, identifier, make, model, asset_type)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const asset = data as unknown as Asset & { client: Client; parent: Pick<Asset, 'id' | 'identifier' | 'make' | 'model' | 'asset_type'> | null };

  const [{ data: jobs }, { data: readings }, { data: photos }, { data: siblings }] = await Promise.all([
    ctx.supabase.from('jobs').select('id, number, phase, complaint, work_summary, created_at, meter_in, meter_unit').eq('asset_id', id).order('created_at', { ascending: false }),
    ctx.supabase.from('meter_readings').select('id, value, unit, read_at, source').eq('asset_id', id).order('read_at', { ascending: false }).limit(20),
    ctx.supabase.from('attachments').select('id, path, job_id, tag').eq('asset_id', id).order('created_at', { ascending: false }).limit(12),
    ctx.supabase.from('assets').select('id, identifier, make, model, asset_type').eq('client_id', asset.client_id).neq('id', id),
  ]);
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const { data: jobPhotos } = jobIds.length
    ? await ctx.supabase.from('attachments').select('id, path, job_id, mime').in('job_id', jobIds).like('mime', 'image/%').order('created_at', { ascending: false }).limit(12)
    : { data: [] };
  const gallery = [...(photos ?? []), ...(jobPhotos ?? [])].slice(0, 12);
  const signed = await signPaths(ctx.supabase, gallery.map((p) => p.path as string));
  const unit = asset.meter_primary_unit;
  const last = readings?.[0];

  return (
    <>
      <PageHeader
        back={<BackLink href={`/app/clients/${asset.client.id}`}>{clientName(asset.client)}</BackLink>}
        title={
          <span className="flex items-center gap-3">
            {asset.identifier ? <span className="rounded-lg border border-line bg-surface px-2 font-mono text-lg">{asset.identifier}</span> : null}
            {assetTitle(asset)}
          </span>
        }
        subtitle={`${ASSET_TYPE_LABELS[asset.asset_type]}${asset.year ? ` · ${asset.year}` : ''} · ${(jobs ?? []).length} posjeta`}
        action={
          <>
            <AssetSheet
              clientId={asset.client_id}
              asset={asset}
              assetTypes={ctx.pkg.assetTypes.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t], unit: defaultMeterUnit(t) }))}
              parents={(siblings ?? []).map((s) => ({ value: s.id as string, label: `${s.identifier ?? ''} ${assetTitle(s as never)}`.trim() }))}
              title={`Uredi — ${ctx.pkg.vocabulary.asset.one.toLowerCase()}`}
              isOwner={ctx.isOwner}
            />
            <ButtonLink href={`/app/jobs/new?asset=${asset.id}`} variant="primary" size="sm">
              Novi nalog
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Povijest" />
            {(jobs ?? []).length ? (
              <ol className="px-4 py-3">
                {(jobs ?? []).map((j) => (
                  <li key={j.id as string} className="relative border-l border-line pb-5 pl-5 last:pb-0">
                    <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-bg bg-accent" />
                    <Link href={`/app/jobs/${j.id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{formatDate(j.created_at as string)}</span>
                        <span>#{j.number as number}</span>
                        {j.meter_in !== null ? <span>{formatMeter(j.meter_in as number, j.meter_unit as never)}</span> : null}
                        <Badge tone={PHASE_TONE[j.phase as keyof typeof PHASE_TONE]}>{phaseLabel(ctx.pkg, j.phase as never)}</Badge>
                      </div>
                      <p className="mt-1 text-sm group-hover:underline">{(j.complaint as string | null) ?? '—'}</p>
                      {j.work_summary ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{j.work_summary as string}</p> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-4 text-sm text-muted">Još nema posjeta.</p>
            )}
          </Card>
          {gallery.length ? (
            <Card>
              <CardHeader title="Zadnje fotografije" />
              <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-6">
                {gallery.map((p) => (
                  <Link key={p.id as string} href={p.job_id ? `/app/jobs/${p.job_id}?tab=foto` : '#'} className="aspect-square overflow-hidden rounded-lg border border-line bg-surface2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signed.get(p.path as string)?.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Podaci" />
            <div className="divide-y divide-line px-4">
              <KeyValue label={identifierLabel(asset.asset_type)}>{asset.identifier ?? '—'}</KeyValue>
              <KeyValue label={vinLabel(asset.asset_type)}>{asset.vin ? <span className="font-mono text-xs">{asset.vin}</span> : '—'}</KeyValue>
              {asset.engine_code ? <KeyValue label="Motor">{asset.engine_code}</KeyValue> : null}
              {asset.paint_code ? <KeyValue label="Boja">{asset.paint_code}</KeyValue> : null}
              {asset.internal_number ? <KeyValue label="Interni broj">{asset.internal_number}</KeyValue> : null}
              {asset.parent ? (
                <KeyValue label="Vezano uz">
                  <Link href={`/app/assets/${asset.parent.id}`} className="text-accent">
                    {asset.parent.identifier ?? assetTitle(asset.parent)}
                  </Link>
                </KeyValue>
              ) : null}
              <KeyValue label={METER_LABELS[unit].long}>{last ? formatMeter(last.value as number, unit) : '—'}</KeyValue>
            </div>
          </Card>
          <Card>
            <CardHeader title="Očitanja brojila" />
            <div className="p-4">
              <MeterForm assetId={asset.id} unit={unit} />
              {(readings ?? []).length ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {(readings ?? []).map((r) => (
                    <li key={r.id as string} className="flex justify-between">
                      <span className="text-muted">{formatDate(r.read_at as string)}</span>
                      <span className="tabular">{formatMeter(r.value as number, r.unit as never)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
