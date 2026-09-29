import type { Metadata } from 'next';
import { BodyPage } from '@/components/pages/BodyPage';
import { FleetPage } from '@/components/pages/FleetPage';
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
export default async function ModulePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireWorkshop();
  const { q = '' } = await searchParams;
  const subtitles = {
    volt: 'Knjižnica kodova grešaka i što su kodovi zaista bili na vašim nalozima',
    gear: 'Vozila kojima uskoro dolazi servis — pozovite ih prije nego odu drugdje',
    body: 'Svi aktivni popravci po fazama proizvodnje',
    wheel: 'Setovi na čuvanju, police i pretraga po QR kodu',
    fleet: 'Rokovi koji ističu u cijelom voznom parku i zahtjevi tvrtki',
    moto: 'Vozila i plovila na zimovanju',
  } as const;

  return (
    <>
      <PageHeader title={ctx.pkg.modulePage} subtitle={subtitles[ctx.pkg.id]} />
      {ctx.pkg.id === 'volt' ? <VoltPage ctx={ctx} q={q} /> : null}
      {ctx.pkg.id === 'gear' ? <GearPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'body' ? <BodyPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'wheel' ? <WheelPage ctx={ctx} q={q} /> : null}
      {ctx.pkg.id === 'fleet' ? <FleetPage ctx={ctx} /> : null}
      {ctx.pkg.id === 'moto' ? <MotoPage ctx={ctx} /> : null}
    </>
  );
}
