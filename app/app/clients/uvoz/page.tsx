import type { Metadata } from 'next';
import { BackLink, PageHeader } from '@/components/ui';
import { CLIMATE_TYPES } from '@/config/tenant.config';
import { requireOwner } from '@/lib/session';
import { ImportWizard } from './ImportWizard';

export const metadata: Metadata = { title: 'Uvoz' };

export default async function ImportPage() {
  const ctx = await requireOwner();
  const v = ctx.pkg.vocabulary;
  return (
    <>
      <BackLink href="/app/clients">{v.client.many}</BackLink>
      <PageHeader title="Uvoz" />
      <ImportWizard
        vocabulary={{ clients: v.client.many, asset: v.asset.one, assets: v.asset.many, identifier: v.identifier }}
        isClimate={CLIMATE_TYPES.includes(ctx.pkg.defaultAssetType)}
      />
    </>
  );
}
