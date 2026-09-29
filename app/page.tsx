import Link from 'next/link';
import { headers } from 'next/headers';
import { Check } from 'lucide-react';
import { ProductMark } from '@/components/ProductMark';
import { ButtonLink } from '@/components/ui';
import { PACKAGES, accentStyle, matchPackageFromHost, resolvePackageFromHost } from '@/config/tenant.config';
import { getAuth } from '@/lib/session';

// Product landing page, chosen by domain (voltfiles.hr → Volt Files).
export default async function Home() {
  const host = (await headers()).get('host');
  const pkg = resolvePackageFromHost(host);
  const onProductDomain = matchPackageFromHost(host) !== null;
  const { user } = await getAuth();
  const trialDays = Number(process.env.TRIAL_DAYS ?? 30) || 30;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 pb-safe pt-safe">
      <header className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ProductMark id={pkg.id} />
          <span className="font-semibold tracking-tight">{pkg.product}</span>
        </div>
        {user ? (
          <ButtonLink href="/app" size="sm" variant="primary">
            Otvori aplikaciju
          </ButtonLink>
        ) : (
          <ButtonLink href="/login" size="sm" variant="ghost">
            Prijava
          </ButtonLink>
        )}
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-accent" /> {pkg.tagline}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Radni nalog, dokazi i naplata — <span className="text-accent">na jednom mjestu.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          {pkg.product} je aplikacija za radionicu: prijem, fotografije, inspekcija, odobrenje stranke putem poveznice, zaključavanje i arhiva. Radi na mobitelu,
          tabletu i računalu.
        </p>
        <ul className="mt-8 grid max-w-2xl gap-3">
          {pkg.pitch.map((line) => (
            <li key={line} className="flex items-start gap-3 text-sm sm:text-base">
              <Check className="mt-0.5 size-5 shrink-0 text-accent" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/register" variant="primary" size="lg">
            Isprobajte {trialDays} dana besplatno
          </ButtonLink>
          <ButtonLink href="/login" size="lg">
            Već imam račun
          </ButtonLink>
        </div>
      </section>

      {!onProductDomain ? (
        <footer className="border-t border-line py-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">X-Files paketi</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.values(PACKAGES).map((p) => (
              <Link key={p.id} href={`/register?paket=${p.id}`} className="accent-scope flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-faint/60" style={accentStyle(p)}>
                <ProductMark id={p.id} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{p.product}</span>
                  <span className="block truncate text-xs text-muted">{p.tagline}</span>
                </span>
              </Link>
            ))}
          </div>
        </footer>
      ) : null}
    </main>
  );
}
