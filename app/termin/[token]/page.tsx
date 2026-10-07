import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingForm } from '@/components/booking/BookingForm';
import { ProductMark } from '@/components/ProductMark';
import { identifierLabel } from '@/config/tenant.config';
import { loadBookingPage, slotsFor } from '@/lib/booking';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Rezerviraj termin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// "Rezerviraj termin": the workshop's own booking page (the link it puts on
// WhatsApp, Google and its voicemail). No account; the workshop is named
// by the token. Switched off, it shows only how to reach the workshop.
export default async function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadBookingPage(token);
  if (page.kind === 'missing') notFound();

  if (page.kind === 'off') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pb-safe pt-safe text-center">
        <h1 className="font-display text-2xl font-bold">{page.name}</h1>
        <p className="mt-2 text-muted">Rezervacija preko ove poveznice trenutno nije uključena.</p>
        {page.phone ? (
          <a href={`tel:${page.phone.replace(/[^\d+]/g, '')}`} className="mx-auto mt-6 inline-flex h-12 items-center rounded-xl border border-line px-5 font-medium">
            Nazovite {page.phone}
          </a>
        ) : null}
      </main>
    );
  }

  const { tenant: t, pkg } = page.at;
  const field = pkg.sector === 'field';
  const slots = await slotsFor(createAdminClient(), page.at, { days: 14, limit: 150 });
  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-safe pt-safe">
      <header className="flex items-center gap-3 py-5">
        {t.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo_url} alt="" className="size-11 rounded-xl object-contain" />
        ) : (
          <ProductMark id={pkg.id} className="size-11" />
        )}
        <div className="min-w-0">
          <p className="break-words font-semibold">{t.name}</p>
          <p className="break-words text-xs text-muted">{[t.address, t.city].filter(Boolean).join(', ')}</p>
        </div>
      </header>
      <h1 className="font-display text-3xl font-bold leading-tight">Rezerviraj termin</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{field ? 'Odaberite kad da dođemo. Termin potvrđujemo porukom.' : 'Odaberite slobodan termin. Majstor ga potvrđuje porukom.'}</p>
      <BookingForm
        token={token}
        workshop={t.name}
        workshopPhone={t.phone ?? null}
        field={field}
        identifierLabel={identifierLabel(pkg.defaultAssetType)}
        slots={slots.map((s) => ({ start: s.start, label: s.label }))}
      />
      <p className="pt-8 text-center text-xs text-faint">
        Podatke šaljete radionici {t.name}, samo za ovaj posao.{' '}
        <a href="/privatnost" target="_blank" className="underline hover:text-fg">
          Privatnost
        </a>
      </p>
      <p className="pb-8 pt-1 text-center text-xs text-faint">Pokreće Poslar</p>
    </main>
  );
}
