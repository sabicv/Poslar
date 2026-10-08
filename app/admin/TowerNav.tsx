'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function TowerNav({ tickets, errors }: { tickets: number; errors: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/admin', label: 'Pregled', exact: true },
    { href: '/admin/radionice', label: 'Radionice' },
    { href: '/admin/podrska', label: 'Podrška', count: tickets },
    { href: '/admin/greske', label: 'Greške', count: errors },
    { href: '/admin/prostor', label: 'Prostor i kopije' },
    { href: '/admin/upute', label: 'Upute' },
  ];
  return (
    <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm transition-colors',
              active ? 'font-medium text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg'
            )}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
