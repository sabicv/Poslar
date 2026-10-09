import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { BackLink, Card, CardHeader, PageHeader, buttonClass } from '@/components/ui';
import { requireOwner } from '@/lib/session';

export const metadata: Metadata = { title: 'Izvoz podataka' };

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ greska?: string }> }) {
  const ctx = await requireOwner();
  const { greska } = await searchParams;
  return (
    <>
      <PageHeader title="Izvoz podataka" subtitle={ctx.tenant.name} back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <Card className="max-w-2xl">
        <CardHeader title="Svi podaci radionice u jednoj datoteci" subtitle="ZIP: tablice za Excel i iste tablice za prijenos u drugi program" />
        <div className="space-y-4 p-4 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Mušterije, vozila i uređaji, adrese, nalozi, stavke s cijenama, ponude, odobrenja i računi.</li>
            <li>Inspekcije, mjerenja, servisni planovi, podsjetnici, pozivi Poslara na telefonu i poruke.</li>
            <li>Popis svih fotografija i datoteka s poveznicom za preuzimanje, koja vrijedi 7 dana.</li>
          </ul>
          <p className="text-muted">Podaci su Vaši. Izvoz možete napraviti kad god želite, primjerice za svoju kopiju ili prije prelaska na drugi program.</p>
          <a href="/app/settings/izvoz/zip" className={buttonClass('primary')}>
            <Download className="size-5" /> Preuzmi izvoz
          </a>
          <p className="text-xs text-faint">Izrada traje od nekoliko sekundi do minute, ovisno o broju naloga. Preuzimanje počne samo.</p>
          {greska ? <p className="text-crit">Izvoz se ovaj put nije složio. Pokušajte za minutu, a ako se ponovi, javite nam se.</p> : null}
        </div>
      </Card>
    </>
  );
}
