import type { Metadata } from 'next';
import { BackLink, PageHeader } from '@/components/ui';
import { ASSET_TYPE_LABELS, defaultMeterUnit } from '@/config/tenant.config';
import { requireWorkshop } from '@/lib/session';
import { getJobTemplates } from '@/lib/templates';
import { NewJobForm } from './NewJobForm';

export const metadata: Metadata = { title: 'Novi nalog' };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  const ctx = await requireWorkshop();
  const { asset: assetId } = await searchParams;
  const templates = await getJobTemplates(ctx);

  // Opened from an asset's page: client and object are already known.
  let preset = null;
  if (assetId) {
    const { data } = await ctx.supabase
      .from('assets')
      .select('id, asset_type, identifier, make, model, meter_primary_unit, client:clients(id, kind, first_name, last_name, company_name, phone)')
      .eq('id', assetId)
      .maybeSingle();
    if (data?.client) {
      const { client, ...asset } = data as unknown as { client: Record<string, unknown> } & Record<string, unknown>;
      preset = { ...asset, client: { ...client, assets: [asset] } } as unknown as Parameters<typeof NewJobForm>[0]['preset'];
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Novi nalog" back={<BackLink href="/app">Nalozi</BackLink>} />
      <NewJobForm
        vocabulary={ctx.pkg.vocabulary}
        assetTypes={ctx.pkg.assetTypes.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t], unit: defaultMeterUnit(t) }))}
        defaultAssetType={ctx.pkg.defaultAssetType}
        symptoms={ctx.pkg.symptoms}
        templates={templates.map((t) => ({ code: t.code, name: t.name }))}
        isFleet={ctx.pkg.id === 'fleet'}
        preset={preset}
      />
    </div>
  );
}
