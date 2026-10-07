'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// The job's tabs as one strip of pills that scrolls sideways with the
// thumb; every tab is always there (no "Više" in the bar), and the open one
// is scrolled into view.
export function JobTabs({ tabs, active }: { tabs: { id: string; label: string; href: string }[]; active: string }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <nav aria-label="Dijelovi naloga" className="sticky top-[var(--shell-top)] z-20 -mx-4 mb-5 border-b border-line bg-bg/90 backdrop-blur-md sm:mx-0 lg:top-0">
      <div ref={strip} className="no-scrollbar flex snap-x gap-1.5 overflow-x-auto scroll-smooth px-4 py-2 sm:px-0" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((t) => (
          <Link
            key={t.id}
            prefetch={false}
            href={t.href}
            replace
            scroll={false}
            aria-current={active === t.id ? 'page' : undefined}
            className={cn(
              'flex h-12 shrink-0 snap-start items-center rounded-full px-4 text-sm transition-colors',
              active === t.id ? 'bg-accent font-medium text-accent-fg' : 'border border-line text-muted hover:text-fg'
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
