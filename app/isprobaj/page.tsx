import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DemoSubmit } from '@/components/landing/DemoSubmit';
import { BrandLogo, ProductMark } from '@/components/ProductMark';
import { TRADE_LINES } from '@/config/landing';
import { PACKAGES, PACKAGE_IDS, TRADE_GROUPS, accentStyle, type PackageId } from '@/config/tenant.config';
import { openDemo } from '@/lib/actions/guest';
import { supportWhatsApp } from '@/lib/billing';
import { isGuestUser } from '@/lib/guest';
import { getAuth } from '@/lib/session';

export const metadata: Metadata = { title: 'Isprobaj demo verziju' };

// The open demo: pick the trade and the workshop full of examples opens,
// no sign-in, no password (lib/actions/guest.ts). A trade's own page opens
// its demo straight away; this page is for the main page and for the
// cases that need a word first (someone signed in, too many demos).
export default async function TryDemoPage({ searchParams }: { searchParams: Promise<{ paket?: string; prijavljen?: string; greska?: string }> }) {
  const { paket, prijavljen, greska } = await searchParams;
  const picked = PACKAGE_IDS.includes(paket as PackageId) ? (paket as PackageId) : null;
  const { user } = await getAuth();
  // A real account on this phone: the demo signs it out, so it asks first.
  const signedInAs = prijavljen === '1' && user && !isGuestUser(user) ? user.email : null;
  const chat = supportWhatsApp('Pozdrav, ne mogu otvoriti demo TaktiX-a. ');
  const others = picked ? TRADE_GROUPS.map((g) => ({ ...g, packages: g.packages.filter((id) => id !== picked) })).filter((g) => g.packages.length) : TRADE_GROUPS;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 pb-safe pt-safe">
      <Link href="/" className="mb-8 mt-10 self-start">
        <BrandLogo />
      </Link>
      <h1 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">Isprobaj demo verziju</h1>
      <p className="mt-2 text-muted">Radionica puna primjera iz tvoje struke. Bez prijave i bez lozinke. Demo traje 24 sata, onda se briše.</p>

      {greska ? (
        <p className="mt-5 rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">
          {greska === 'puno' ? 'S ove mreže je otvoreno puno demo radionica. Pokušaj ponovno za sat vremena.' : 'Demo se sada ne može otvoriti. Pokušaj ponovno za minutu.'}
          {chat ? (
            <>
              {' '}
              <a href={chat} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                Piši nam na WhatsApp
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      {signedInAs && picked ? (
        <section className="mt-6 rounded-2xl border border-warn/40 bg-warn/10 p-5">
          <p className="text-sm">
            Na ovom uređaju si prijavljen kao <span className="font-medium">{signedInAs}</span>. Demo je zasebna radionica, pa te prvo odjavljujemo. Tvoji podaci ostaju
            kakvi jesu.
          </p>
          <form action={openDemo} className="mt-4">
            <input type="hidden" name="paket" value={picked} />
            <input type="hidden" name="zamijeni" value="1" />
            <DemoSubmit variant="primary">Odjavi me i otvori demo</DemoSubmit>
          </form>
          <Link href="/app" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
            Natrag u moju aplikaciju
          </Link>
        </section>
      ) : picked ? (
        <section className="accent-scope mt-6 rounded-2xl border border-accent/50 bg-accent/10 p-5" style={accentStyle(PACKAGES[picked])}>
          <div className="flex items-start gap-3">
            <ProductMark id={picked} className="size-12" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold">{PACKAGES[picked].product}</h2>
              <p className="mt-0.5 text-sm text-muted">{TRADE_LINES[picked]}</p>
            </div>
          </div>
          <form action={openDemo} className="mt-4">
            <input type="hidden" name="paket" value={picked} />
            <DemoSubmit variant="primary">
              Otvori demo <ArrowRight className="size-5" />
            </DemoSubmit>
          </form>
        </section>
      ) : null}

      <h2 className="mt-9 text-lg font-semibold">{picked ? 'Ili odaberi drugu struku' : 'Odaberi svoju struku'}</h2>
      {others.map((group) => (
        <section key={group.id} className="mt-4">
          <p className="text-sm text-faint">{group.name}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {group.packages.map((id) => (
              <form key={id} action={openDemo} className="accent-scope" style={accentStyle(PACKAGES[id])}>
                <input type="hidden" name="paket" value={id} />
                <DemoSubmit variant="tile" className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent/70 disabled:opacity-80">
                  <ProductMark id={id} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{PACKAGES[id].short}</span>
                    <span className="block truncate text-xs text-muted">{TRADE_LINES[id]}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" />
                </DemoSubmit>
              </form>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-8 space-y-2 text-sm text-muted">
        <p>Podaci u demu su izmišljeni. Ne upisuj prave podatke mušterija.</p>
        <p>
          Otvaranjem demo verzije prihvaćaš{' '}
          <Link href="/uvjeti" className="font-medium text-accent hover:underline">
            Uvjete korištenja
          </Link>
          .
        </p>
        <p>
          Radije odmah na prave poslove?{' '}
          <Link href={`/register${picked ? `?paket=${picked}` : ''}`} className="font-medium text-accent hover:underline">
            30 dana besplatno
          </Link>
        </p>
      </div>
      <div className="mb-10" />
    </main>
  );
}
