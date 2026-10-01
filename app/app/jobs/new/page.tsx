import type { Metadata } from 'next';
import { BackLink, PageHeader } from '@/components/ui';
import { ASSET_TYPE_LABELS, defaultMeterUnit, hasFieldWork } from '@/config/tenant.config';
import type { ClientHit } from '@/lib/actions/clients';
import { requireWorkshop } from '@/lib/session';
import { getJobTemplates } from '@/lib/templates';
import { NewJobForm, type NewJobPreset } from './NewJobForm';

export const metadata: Metadata = { title: 'Novi nalog' };

const CLIENT_FIELDS =
  'id, kind, first_name, last_name, company_name, phone, assets(id, asset_type, identifier, make, model, meter_primary_unit, site_id), sites(id, label, kind, address, city, access_notes)';

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ asset?: string; plan?: string }> }) {
  const ctx = await requireWorkshop();
  const { asset: assetId, plan: planId } = await searchParams;
  const field = hasFieldWork(ctx.pkg, ctx.tenant.enabled_modules);
  const [templates, { data: staff }] = await Promise.all([getJobTemplates(ctx), ctx.supabase.from('profiles').select('id, full_name').order('full_name')]);

  // Opened from a maintenance plan ("Zakaži") or from an object's page:
  // the customer, place and device are already known.
  let preset: NewJobPreset | null = null;
  if (planId && /^[0-9a-f-]{36}$/i.test(planId)) {
    const { data: plan } = await ctx.supabase.from('maintenance_plans').select('id, title, client_id, site_id, asset_id, template_code').eq('id', planId).maybeSingle();
    if (plan) {
      const { data: client } = await ctx.supabase.from('clients').select(CLIENT_FIELDS).eq('id', plan.client_id).single();
      if (client) {
        preset = {
          client: client as unknown as ClientHit,
          assetId: plan.asset_id as string | null,
          siteId: plan.site_id as string | null,
          planId: plan.id as string,
          templateCode: plan.template_code as string | null,
          complaint: plan.title as string,
        };
      }
    }
  } else if (assetId && /^[0-9a-f-]{36}$/i.test(assetId)) {
    const { data: asset } = await ctx.supabase.from('assets').select('id, client_id, site_id').eq('id', assetId).maybeSingle();
    if (asset) {
      const { data: client } = await ctx.supabase.from('clients').select(CLIENT_FIELDS).eq('id', asset.client_id).single();
      if (client) preset = { client: client as unknown as ClientHit, assetId: asset.id as string, siteId: asset.site_id as string | null, planId: null, templateCode: null, complaint: null };
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={preset?.planId ? 'Zakaži servis' : 'Novi nalog'} back={<BackLink href="/app">{ctx.pkg.sector === 'field' ? 'Raspored' : 'Nalozi'}</BackLink>} />
      <NewJobForm
        vocabulary={ctx.pkg.vocabulary}
        assetTypes={ctx.pkg.assetTypes.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t], unit: defaultMeterUnit(t) }))}
        defaultAssetType={ctx.pkg.defaultAssetType}
        symptoms={ctx.pkg.symptoms}
        templates={templates.map((t) => ({ code: t.code, name: t.name }))}
        isFleet={ctx.pkg.id === 'fleet'}
        preset={preset}
        scan={Boolean(process.env.ANTHROPIC_API_KEY)}
        field={{
          enabled: field,
          defaultMode: ctx.pkg.sector === 'field' ? 'field' : 'workshop',
          staff: (staff ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null) ?? 'Bez imena' })),
          me: ctx.user.id,
          isOwner: ctx.isOwner,
        }}
      />
    </div>
  );
}
