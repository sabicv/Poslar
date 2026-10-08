import type { Metadata } from 'next';
import Link from 'next/link';
import { Camera, ChevronRight } from 'lucide-react';
import { BackLink, PageHeader } from '@/components/ui';
import { DEVICE_TYPES } from '@/config/tenant.config';
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
      {/* Paper first: most workshops start from a drawer of old job cards. */}
      <Link href="/app/clients/uvoz/papir" className="mb-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-accent/60">
        <Camera className="size-7 shrink-0 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Stari nalozi i računi na papiru?</span>
          <span className="block text-sm text-muted">Slikajte ih. Poslar pročita mušteriju, {v.identifier.toLowerCase()}, posao i stavke i složi ih u povijest.</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-faint" />
      </Link>
      <ImportWizard
        vocabulary={{ clients: v.client.many, asset: v.asset.one, assets: v.asset.many, identifier: v.identifier }}
        isClimate={DEVICE_TYPES.includes(ctx.pkg.defaultAssetType)}
      />
    </>
  );
}
