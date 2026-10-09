import type { Metadata } from 'next';
import { AirPage } from '@/components/pages/AirPage';
import { AquaPage } from '@/components/pages/AquaPage';
import { DealPage } from '@/components/pages/DealPage';
import { TowPage } from '@/components/pages/TowPage';
import { BodyPage } from '@/components/pages/BodyPage';
import { FleetPage } from '@/components/pages/FleetPage';
import { GenericPage } from '@/components/pages/GenericPage';
import { GearPage } from '@/components/pages/GearPage';
import { MotoPage } from '@/components/pages/MotoPage';
import { VoltPage } from '@/components/pages/VoltPage';
import { WheelPage } from '@/components/pages/WheelPage';
import { PageHeader } from '@/components/ui';
import { requireWorkshop } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkshop();
  return { title: ctx.pkg.modulePage };
}

// The package's own workspace, beyond single work orders.
export default async function ModulePage({ searchParams }: { searchParams: Promise<{ q?: string; y?: string }> }) {
  const ctx = await requireWorkshop();
  const { q = '', y } = await searchParams;

  return (
    <>
      <PageHeader title={ctx.pkg.modulePage} />
      {ctx.pkg.id === 'volt' ? <VoltPage ctx={ctx} q={q} /> : null}
      {ctx.pkg.id === 'gear' ? <GearPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'body' ? <BodyPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'wheel' ? <WheelPage ctx={ctx} q={q} /> : null}
      {ctx.pkg.id === 'fleet' || ctx.pkg.id === 'machine' ? <FleetPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'moto' || ctx.pkg.id === 'marine' ? <MotoPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'air' ? <AirPage ctx={ctx} year={y} /> : null}
      {ctx.pkg.id === 'aqua' ? <AquaPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'tow' ? <TowPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'deal' ? <DealPage ctx={ctx} /> : null}
      {['detail', 'electric', 'appliance', 'locksmith', 'pool', 'clean'].includes(ctx.pkg.id) ? <GenericPage ctx={ctx} /> : null}
    </>
  );
}
