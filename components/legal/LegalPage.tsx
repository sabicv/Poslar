import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/ProductMark';
import { LEGAL_PAGES, LEGAL_VERSION } from '@/config/legal';
import { provider } from '@/lib/legal';
import { cn } from '@/lib/utils';

const DATE = new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', year: 'numeric' });

// The frame of the three legal pages: who provides the service, the date
// they apply from, and links between them.
export function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pb-safe pt-safe">
      <header className="flex h-16 items-center justify-between gap-3">
        <Link href="/">
          <BrandLogo />
        </Link>
        <Link href="/" className="text-sm text-muted hover:text-fg">
          Početna
        </Link>
      </header>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-faint">Vrijedi od {DATE.format(new Date(`${LEGAL_VERSION}T12:00:00Z`))}</p>
      {intro ? <div className="mt-5 text-sm leading-relaxed text-muted">{intro}</div> : null}
      <div className="legal mt-6 space-y-8">{children}</div>
      <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-sm">
        {LEGAL_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className={cn('hover:text-fg', p.title === title ? 'font-medium text-fg' : 'text-muted')}>
            {p.title}
          </Link>
        ))}
      </nav>
    </main>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-fg [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

// The provider's details, as far as they are set.
export function ProviderBlock() {
  const p = provider();
  const address = [p.street, p.city].filter(Boolean).join(', ');
  return (
    <ul>
      <li>
        <strong>{p.name}</strong>
        {address ? `, ${address}` : ''}
        {p.oib ? `, OIB ${p.oib}` : ''}
      </li>
      {p.email ? <li>E-pošta: {p.email}</li> : null}
      {p.phone ? <li>Telefon i WhatsApp: {p.phone}</li> : null}
    </ul>
  );
}
