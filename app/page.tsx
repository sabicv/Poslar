import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Bell, Building2, CalendarCheck, FileCheck2, FileCode2, Laptop, ListChecks, Moon, PhoneCall, PhoneIncoming, Plus, QrCode, ScanLine, ShieldCheck, Smartphone, Tablet, Upload } from 'lucide-react';
import { CtaButtons, FILL_GRID, FaqSection, FinalCall, LandingFooter, LandingHeader, PainsGrid, PhoneShot, PricingSection, Section, SectionTitle, fillCell } from '@/components/landing/Parts';
import { TradeLanding } from '@/components/landing/TradeLanding';
import { ProductMark } from '@/components/ProductMark';
import { MAIN, TRADE_LINES, TRADE_PAGES, tradeById } from '@/config/landing';
import { PACKAGES, TRADE_GROUPS, accentStyle, matchPackageFromHost, type PackageId } from '@/config/tenant.config';
import { isPlayApp } from '@/lib/play';
import { getAuth } from '@/lib/session';
import { cn } from '@/lib/utils';

// The home page sells the benefits: the AI secretary takes the calls, the
// paperwork makes itself, and the owner sees everything from the phone.
// Every word is in config/landing.ts. On a trade's own domain the home page
// is that trade's page.

export const metadata: Metadata = { description: MAIN.subtitle };

const PILLAR_ICONS = [PhoneCall, FileCheck2, Smartphone];
// Phone while working, the evening off, photos and approvals, every branch, moving in.
const SCENE_ICONS = [PhoneIncoming, Moon, ShieldCheck, Building2, Upload];
const EXTRA_ICONS = [Bell, QrCode, ListChecks, ScanLine, FileCode2, CalendarCheck];

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

        {/* Phone on the road, laptop in the office: the real app on a big screen */}
        <Section className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionTitle title={MAIN.devicesTitle} />
            <p className="mt-3 max-w-xl text-muted">{MAIN.devicesText}</p>
            <p className="mt-4 flex items-center gap-3 text-sm text-faint">
              <Smartphone className="size-5" /> <Tablet className="size-5" /> <Laptop className="size-5" />
              Android · iPhone · tablet · laptop
            </p>
          </div>
          <div className="px-2 sm:px-6">
            <div className="rounded-t-2xl border border-b-0 border-line bg-bg p-2 pb-0 sm:p-3 sm:pb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/desktop.webp"
                srcSet="/landing/desktop-sm.webp 800w, /landing/desktop.webp 1440w"
                sizes="(min-width: 1024px) 60vw, 100vw"
                alt="Radni nalog s grafom parazitske potrošnje na laptopu"
                loading="lazy"
                className="block aspect-[3/2] w-full rounded-t-lg object-cover object-top"
              />
            </div>
            <div className="-mx-2 h-3 rounded-b-xl border border-line bg-surface2 sm:-mx-6 sm:h-4" />
          </div>
        </Section>

        {/* Sounds familiar? (the same grid as on the trade pages) */}
        <PainsGrid title={MAIN.painsTitle} items={MAIN.pains} />

        {/* And more: each one opens to the trouble and how it goes with Poslar */}
        <Section>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-balance text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">{MAIN.extrasTitle}</h2>
            <p className="mt-2 text-center text-muted">{MAIN.extrasHint}</p>
            <ul className="mt-8 space-y-3">
              {MAIN.extras.map((e, i) => {
                const Icon = EXTRA_ICONS[i];
                return (
                  <li key={e.title}>
                    <details className="group rounded-2xl border border-line bg-surface transition-colors open:border-accent/60 hover:border-accent/50">
                      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1 text-base font-semibold leading-snug sm:text-lg">{e.title}</span>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-accent/60 text-accent transition-transform group-open:rotate-45 group-open:bg-accent group-open:text-accent-fg">
                          <Plus className="size-5" />
                        </span>
                      </summary>
                      <div className="grid gap-4 px-4 pb-5 sm:grid-cols-2 sm:px-5 sm:pl-[4.75rem]">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-faint">Problem</p>
                          <p className="mt-1.5 text-muted">{e.problem}</p>
                        </div>
                        <div className="border-l-2 border-accent/70 pl-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-accent">U praksi</p>
                          <p className="mt-1.5">{e.solution}</p>
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>

        {/* Made for each trade */}
        <Section>
          <SectionTitle id="zanati" title={MAIN.tradesTitle} subtitle={MAIN.tradesSubtitle} />
          <div className="mt-8 space-y-8">
            {TRADE_GROUPS.map((g) => (
              <div key={g.id}>
                <h3 className="font-display text-xl font-bold">{g.name}</h3>
                <div className={cn('mt-3', FILL_GRID)}>
                  {inPageOrder(g.packages).map((id, i, all) => (
                    <Link
                      key={id}
                      href={`/zanat/${tradeById(id).slug}`}
                      className={cn('accent-scope group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/70', fillCell(i, all.length))}
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
