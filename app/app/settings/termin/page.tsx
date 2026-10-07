import type { Metadata } from 'next';
import Link from 'next/link';
import { BookingControls } from '@/components/booking/BookingControls';
import { BackLink, Card, CardHeader, PageHeader } from '@/components/ui';
import { readHours, spokenHours } from '@/lib/calendar';
import { bookingUrl, qrSvg } from '@/lib/qr';
import { requireOwner } from '@/lib/session';

export const metadata: Metadata = { title: 'Rezerviraj termin' };

// "Rezerviraj termin" from the owner's side: the link, where to put it, and
// the hours it books into (the same as Poslar on the phone).
export default async function BookingSettingsPage() {
  const ctx = await requireOwner();
  const t = ctx.tenant;
  const url = await bookingUrl(t.intake_token);
  const svg = await qrSvg(url);

  return (
    <>
      <PageHeader title="Rezerviraj termin" subtitle="Mušterije same biraju slobodan termin" back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vaša poveznica" subtitle="Ista vrijedi dok ne napravite novi QR kod za vrata" />
          <div className="space-y-4 p-4">
            <p className="break-all rounded-xl bg-surface2 px-3 py-2 font-mono text-xs text-muted">{url}</p>
            <BookingControls url={url} enabled={t.booking_enabled !== false} workshop={t.name} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Gdje je staviti" />
            <ul className="list-disc space-y-2 py-4 pl-9 pr-4 text-sm text-muted">
              <li>WhatsApp Business: automatski odgovor i opis profila.</li>
              <li>Google profil radionice (Google Karte): gumb za web stranicu ili termin.</li>
              <li>Poruka na sekretarici: „Termin rezervirajte preko poveznice koju Vam šaljemo porukom.”</li>
              <li>Facebook i Instagram stranica radionice.</li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="Termini" subtitle={spokenHours(readHours(t.settings))} />
            <p className="p-4 text-sm text-muted">
              Nudimo samo slobodne termine unutar radnog vremena. Radno vrijeme, trajanje termina i koliko poslova odjednom mijenjate u{' '}
              <Link href="/app/settings/telefon" className="font-medium text-accent hover:underline">
                Postavke → Poslar na telefonu
              </Link>
              . Rezervacija stiže u Prijem, a Vi je potvrđujete jednim dodirom na WhatsApp.
            </p>
          </Card>
          <Card>
            <CardHeader title="QR kod poveznice" subtitle="Za vizitke, račune ili naljepnicu na autu" />
            <div className="p-4">
              <div className="mx-auto w-48 overflow-hidden rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
