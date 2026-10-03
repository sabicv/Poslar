import Link from 'next/link';
import { cn } from '@/lib/utils';

// Poslovanje has two faces: the numbers, and every closed job behind them.
export function BusinessTabs({ active }: { active: 'pregled' | 'arhiva' }) {
  const tabs = [
    { id: 'pregled', label: 'Pregled', href: '/app/business' },
    { id: 'arhiva', label: 'Arhiva', href: '/app/business/arhiva' },
  ] as const;
  return (
    <nav className="mb-5 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={cn(
            'relative flex h-11 items-center px-3 text-sm transition-colors',
            active === t.id ? 'font-medium text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg'
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
