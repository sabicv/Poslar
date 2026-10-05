import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Building2, FileCheck2, GraduationCap, Laptop, PhoneCall, PhoneIncoming, Plus, Smartphone, Tablet, TreePalm, Upload } from 'lucide-react';
import { CtaButtons, FaqSection, FinalCall, LandingFooter, LandingHeader, PhoneShot, PricingSection, Section, SectionTitle } from '@/components/landing/Parts';
import { TradeLanding } from '@/components/landing/TradeLanding';
import { ProductMark } from '@/components/ProductMark';
import { MAIN, TRADE_LINES, TRADE_PAGES, tradeById } from '@/config/landing';
import { PACKAGES, TRADE_GROUPS, accentStyle, matchPackageFromHost, type PackageId } from '@/config/tenant.config';
import { isPlayApp } from '@/lib/play';
import { getAuth } from '@/lib/session';

// The home page sells the benefits: the AI secretary takes the calls, the
// paperwork makes itself, and the owner sees everything from the phone.
// Every word is in config/landing.ts. On a trade's own domain the home page
// is that trade's page.

export const metadata: Metadata = { description: MAIN.subtitle };

const PILLAR_ICONS = [PhoneCall, FileCheck2, Smartphone];
const SCENE_ICONS = [PhoneIncoming, TreePalm, GraduationCap, Building2, Upload];

// Trades in the order of the text (Automehaničar first).
const inPageOrder = (ids: PackageId[]) => TRADE_PAGES.map((t) => t.id).filter((id) => ids.includes(id));

export default async function Home() {
  // The Google Play app is the app itself, with no prices (config/play.ts).
  if (await isPlayApp()) redirect('/app');
  const product = matchPackageFromHost((await headers()).get('host'));
  // Signed in or not, the page shows (showing it to a customer from your own
  // phone must work); a signed-in visitor gets "Otvori aplikaciju".
  const { user } = await getAuth();
  if (product) return <TradeLanding trade={tradeById(product.id)} signedIn={Boolean(user)} ownDomain />;

  const register = '/register';
  const dir = path.join(process.cwd(), 'public', 'landing');
  // Photos from real work (public/landing/foto-1.jpg …), shown once added.
  const photos = Array.from({ length: 10 }, (_, i) => ['jpg', 'webp'].map((ext) => `foto-${i + 1}.${ext}`).find((f) => existsSync(path.join(dir, f)))).filter(Boolean) as string[];

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 pb-safe">
        <LandingHeader product={null} signedIn={Boolean(user)} register={register} tradesHref="#zanati" />

        {/* Hero */}
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              {MAIN.eyebrow}
            </p>
            <h1 className="max-w-3xl text-balance font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">{MAIN.title}</h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">{MAIN.subtitle}</p>
            <div className="mt-8">
              <CtaButtons register={register} where="sve" />
            </div>
            <p className="mt-9 text-sm font-medium">{MAIN.pickLabel}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {TRADE_PAGES.map((t) => t.id).map((id) => (
                <li key={id}>
                  <Link
                    href={`/zanat/${tradeById(id).slug}`}
                    className="accent-scope flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-sm transition-colors hover:border-accent/70"
                    style={accentStyle(PACKAGES[id])}
                  >
                    <ProductMark id={id} className="size-7 rounded-full" />
                    {PACKAGES[id].short}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <PhoneShot src="/landing/gear-hero.webp" alt="Radni nalog u aplikaciji" priority />
        </section>

        {/* Three pillars */}
        <section className="grid gap-4 pb-14 md:grid-cols-3">
          {MAIN.pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i];
            return (
              <div key={p.title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-bold">{p.title}</h2>
                <p className="mt-1.5 text-muted">{p.text}</p>
              </div>
            );
          })}
        </section>

        {/* Scenes from the working week */}
        <Section>
          <SectionTitle title={MAIN.scenesTitle} />
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {MAIN.scenes.map((s, i) => {
              const Icon = SCENE_ICONS[i];
              return (
                <li key={s.title} className={i === 0 ? 'rounded-2xl border border-accent/50 bg-accent/10 p-6 md:col-span-2' : 'rounded-2xl border border-line bg-surface p-6'}>
                  <Icon className="size-6 text-accent" />
                  <h3 className="mt-3 text-balance font-display text-2xl font-bold leading-tight">{s.title}</h3>
                  <p className="mt-2 max-w-3xl text-muted">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </Section>

        {/* Real work: Vedran's photos (public/landing/foto-N, with a small one for phones) */}
        {photos.length ? (
          <section className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-14 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
            {photos.map((f) => {
              const small = f.replace(/\.(webp|jpg)$/, '-sm.webp');
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f}
                  src={`/landing/${f}`}
                  srcSet={existsSync(path.join(dir, small)) ? `/landing/${small} 700w, /landing/${f} 1400w` : undefined}
                  sizes="(min-width: 640px) 33vw, 80vw"
                  alt=""
                  loading="lazy"
                  className="aspect-[3/2] w-[80%] shrink-0 snap-center rounded-2xl border border-line object-cover sm:w-full"
                />
              );
            })}
          </section>
        ) : null}

        {/* Phone on the road, laptop in the office */}
        {existsSync(path.join(dir, 'laptop.webp')) ? (
          <Section className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionTitle title={MAIN.devicesTitle} />
              <p className="mt-3 max-w-xl text-muted">{MAIN.devicesText}</p>
              <p className="mt-4 flex items-center gap-3 text-sm text-faint">
                <Smartphone className="size-5" /> <Tablet className="size-5" /> <Laptop className="size-5" />
                Android · iPhone · tablet · laptop
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/laptop.webp" srcSet="/landing/laptop-sm.webp 700w, /landing/laptop.webp 1400w" sizes="(min-width: 1024px) 55vw, 100vw" alt="TaktiX na laptopu u radionici" loading="lazy" className="w-full rounded-2xl border border-line object-cover" />
          </Section>
        ) : null}

        {/* Sounds familiar? */}
        <Section>
          <SectionTitle title={MAIN.painsTitle} />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {MAIN.pains.map((p) => (
              <li key={p.q} className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-lg font-semibold">{p.q}</p>
                <p className="mt-3 border-l-2 border-accent/70 pl-3 text-sm text-muted">{p.a}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 font-medium">{MAIN.extrasLabel}</span>
            {MAIN.extras.map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-muted">
                <Plus className="size-3.5 text-accent" />
                {e}
              </span>
            ))}
          </div>
        </Section>

        {/* Made for each trade */}
        <Section>
          <SectionTitle id="zanati" title={MAIN.tradesTitle} subtitle={MAIN.tradesSubtitle} />
          <div className="mt-8 space-y-8">
            {TRADE_GROUPS.map((g) => (
              <div key={g.id}>
                <h3 className="font-display text-xl font-bold">{g.name}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inPageOrder(g.packages).map((id) => (
                    <Link
                      key={id}
                      href={`/zanat/${tradeById(id).slug}`}
                      className="accent-scope group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/70"
                      style={accentStyle(PACKAGES[id])}
                    >
                      <ProductMark id={id} className="size-10" />
                      <span className="min-w-0">
                        <span className="block font-semibold group-hover:text-accent">{PACKAGES[id].short}</span>
                        <span className="mt-0.5 block text-sm text-muted">{TRADE_LINES[id]}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <PricingSection />
        <FaqSection />
        <FinalCall register={register} where="sve" />
        <LandingFooter />
      </div>
    </div>
  );
}
