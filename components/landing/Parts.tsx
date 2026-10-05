import Link from 'next/link';
import type { ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { Pricing } from '@/components/landing/Pricing';
import { BrandLogo, ProductMark } from '@/components/ProductMark';
import { ButtonLink } from '@/components/ui';
import { CTA, FAQ, MAIN, PRICING } from '@/config/landing';
import type { PackageConfig } from '@/config/tenant.config';
import { supportWhatsApp } from '@/lib/billing';
import { provider } from '@/lib/legal';
import { cn } from '@/lib/utils';

// The pieces both the main page and the trade pages are built from.

export const HELLO = 'Pozdrav, zanima me TaktiX. ';

export function SectionTitle({ id, title, subtitle }: { id?: string; title: string; subtitle?: string }) {
  return (
    <div id={id} className="scroll-mt-20">
      <h2 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-2 max-w-2xl text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function Section({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('border-t border-line py-14 sm:py-16', className)}>{children}</section>;
}

// "Za tvoj zanat · Cijene · Prijava" and the one button. On a trade's own
// domain the trade's mark replaces the TaktiX logo.
export function LandingHeader({ product, signedIn, register, tradesHref }: { product: PackageConfig | null; signedIn: boolean; register: string; tradesHref: string }) {
  return (
    <header className="sticky top-0 z-30 -mx-5 border-b border-transparent bg-bg/90 px-5 pt-safe backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {product ? (
            <>
              <ProductMark id={product.id} />
              <span className="truncate font-semibold tracking-tight">{product.product}</span>
            </>
          ) : (
            <BrandLogo />
          )}
        </Link>
        <nav className="flex shrink-0 items-center gap-1">
          <ButtonLink href={tradesHref} size="sm" variant="ghost" className="hidden md:inline-flex">
            Za tvoj zanat
          </ButtonLink>
          <ButtonLink href="#cijene" size="sm" variant="ghost" className="hidden sm:inline-flex">
            Cijene
          </ButtonLink>
          {signedIn ? (
            <ButtonLink href="/app" size="sm" variant="ghost">
              Otvori aplikaciju
            </ButtonLink>
          ) : (
            <ButtonLink href="/login" size="sm" variant="ghost">
              Prijava
            </ButtonLink>
          )}
          {/* Next to "Otvori aplikaciju" it no longer fits on a phone. */}
          <ButtonLink href={register} size="sm" variant="primary" className={signedIn ? 'hidden sm:inline-flex' : undefined}>
            {CTA}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}

export function PricingSection() {
  return (
    <Section>
      <SectionTitle id="cijene" title={PRICING.title} subtitle={PRICING.subtitle} />
      <Pricing />
      <p className="mt-4 text-sm text-faint">{PRICING.vat}</p>
    </Section>
  );
}

export function FaqSection() {
  return (
    <Section>
      <SectionTitle title="Česta pitanja" />
      <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {f.q}
              <span className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function FinalCall({ register }: { register: string }) {
  const chat = supportWhatsApp(HELLO);
  return (
    <section className="my-10 rounded-3xl border border-line bg-surface px-6 py-12 text-center sm:py-16">
      <h2 className="text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl">{MAIN.finalTitle}</h2>
      <div className="mt-8 flex flex-col items-center gap-4">
        <ButtonLink href={register} variant="primary" size="lg">
          {MAIN.finalCta}
        </ButtonLink>
        {chat ? (
          <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
            <MessageCircle className="size-4" /> {MAIN.finalAsk}
          </a>
        ) : null}
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { href: '/uvjeti', label: 'Uvjeti korištenja' },
  { href: '/privatnost', label: 'Politika privatnosti' },
  { href: '/obrada-podataka', label: 'Ugovor o obradi podataka (DPA)' },
  { href: '/brisanje-racuna', label: 'Zahtjev za brisanje podataka' },
];

export function LandingFooter() {
  const p = provider();
  const chat = supportWhatsApp(HELLO);
  const company = [p.name, p.street, p.city, p.oib ? `OIB ${p.oib}` : null].filter(Boolean).join(', ');
  return (
    <footer className="space-y-4 border-t border-line py-8 text-sm text-faint">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <BrandLogo size="sm" />
          <span>{company}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {chat ? (
            <a href={chat} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
              WhatsApp {p.phone}
            </a>
          ) : null}
          {p.email ? (
            <a href={`mailto:${p.email}`} className="hover:text-fg">
              {p.email}
            </a>
          ) : null}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-fg">
              {l.label}
            </Link>
          ))}
        </span>
        <span>{MAIN.madeIn}</span>
      </div>
    </footer>
  );
}

// A real screenshot of the app in a phone frame.
export function PhoneShot({ src, alt, className, priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn('mx-auto w-full max-w-[300px]', className)}>
      <div className="rounded-[2.2rem] border border-line bg-[#05080F] p-2 shadow-2xl shadow-black/50">
        <div className="overflow-hidden rounded-[1.7rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} className="block w-full" />
        </div>
      </div>
    </div>
  );
}
