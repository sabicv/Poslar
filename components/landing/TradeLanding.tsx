import { existsSync } from 'node:fs';
import path from 'node:path';
import { ClipboardList, PhoneIncoming, Wrench } from 'lucide-react';
import { CtaButtons, FaqSection, FinalCall, LandingFooter, LandingHeader, PainsGrid, PhoneShot, PricingSection, Section, SectionTitle, type Where } from '@/components/landing/Parts';
import { ProductMark } from '@/components/ProductMark';
import { COMMON_FEATURE, TRADE_SECTION, type TradePage } from '@/config/landing';
import { PACKAGES, accentStyle } from '@/config/tenant.config';

// One trade's page: its own headline, the AI secretary and a scene from
// its work, the troubles it knows, what it gets and its ready-made jobs.
// Shown at /zanat/<slug> and as the home page of the trade's own domain.
export function TradeLanding({ trade, signedIn, ownDomain }: { trade: TradePage; signedIn: boolean; ownDomain: boolean }) {
  const pkg = PACKAGES[trade.id];
  const register = `/register?paket=${trade.id}`;
  // Where this trade works, for the words of the main button.
  const where: Where = trade.id === 'tow' ? 'cesta' : trade.id === 'deal' ? 'plac' : pkg.sector === 'field' ? 'teren' : 'radionica';
  const shot = existsSync(path.join(process.cwd(), 'public', 'landing', `${trade.id}-hero.webp`)) ? `/landing/${trade.id}-hero.webp` : null;
  // Where this trade's work happens, for the heading of its scene.
  const scene = trade.id === 'deal' ? 'Prizor s placa' : pkg.sector === 'field' || trade.id === 'tow' ? 'Prizor s terena' : TRADE_SECTION.scene;

  // The buttons keep the one brand colour of the whole site; the trade's own
  // colour marks only its icon.
  const tradeColour = accentStyle(pkg);
  const features = [...trade.features, COMMON_FEATURE];

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 pb-safe">
        <LandingHeader product={ownDomain ? pkg : null} signedIn={signedIn} register={register} tradesHref={ownDomain ? '#mogucnosti' : '/#zanati'} />

        {/* Hero */}
        <section className={shot ? 'grid items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-20' : 'py-12 lg:py-20'}>
          <div>
            <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs text-muted">
              <span className="accent-scope" style={tradeColour}>
                <ProductMark id={pkg.id} className="size-6 rounded-full" />
              </span>
              {trade.eyebrow}
            </p>
            <h1 className="max-w-3xl text-balance font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">{trade.title}</h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">{trade.subtitle}</p>
            <div className="mt-8">
              <CtaButtons register={register} where={where} pkg={trade.id} />
            </div>
          </div>
          {shot ? <PhoneShot src={shot} alt={`${pkg.product}: radni nalog u aplikaciji`} priority /> : null}
        </section>

        {/* The AI secretary and a scene from the work */}
        <Section>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: TRADE_SECTION.agent, text: trade.agent, icon: PhoneIncoming },
              { title: scene, text: trade.scene, icon: Wrench },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-line bg-surface p-6">
                <p className="flex items-center gap-3 font-display text-xl font-bold">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    <b.icon className="size-5" />
                  </span>
                  {b.title}
                </p>
                <p className="mt-4 text-muted">{b.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Troubles it knows (the same grid as on the main page) */}
        <PainsGrid title={TRADE_SECTION.pains} items={trade.pains} />

        {/* What it gets: its own five and "Pitaj Poslara", a full 3 x 2 */}
        <Section>
          <SectionTitle id="mogucnosti" title={TRADE_SECTION.features} />
          <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="border-l-2 border-accent/70 pl-4">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Ready-made jobs */}
        <Section>
          <SectionTitle title={TRADE_SECTION.jobs} />
          <ul className="mt-6 flex flex-wrap gap-2">
            {trade.jobs.map((j) => (
              <li key={j} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm">
                <ClipboardList className="size-4 text-accent" />
                {j}
              </li>
            ))}
          </ul>
        </Section>

        <PricingSection />
        <FaqSection />
        <FinalCall register={register} where={where} pkg={trade.id} />
        <LandingFooter />
      </div>
    </div>
  );
}
