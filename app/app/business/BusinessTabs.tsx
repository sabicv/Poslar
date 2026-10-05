import Link from 'next/link';
import { cn } from '@/lib/utils';

// Poslovanje: the numbers, today's invoices for the fiscal till, every
// closed job behind them, and the customers to call back. A workshop's own
// jobs (Auto plac) issue no invoices. The count belongs to the active tab.
export function BusinessTabs({ active, count, invoices = true }: { active: 'pregled' | 'racuni' | 'arhiva' | 'podsjetnici'; count?: number; invoices?: boolean }) {
  const tabs = [
    { id: 'pregled', label: 'Pregled', href: '/app/business' },
    ...(invoices ? [{ id: 'racuni', label: 'Računi danas', href: '/app/business/racuni' } as const] : []),
    { id: 'arhiva', label: 'Arhiva', href: '/app/business/arhiva' },
    { id: 'podsjetnici', label: 'Podsjetnici', href: '/app/business/podsjetnici' },
  ] as const;
  return (
    <nav className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={cn(
            'relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-sm transition-colors',
            active === t.id ? 'font-medium text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg'
          )}
        >
          {t.label}
          {t.id === active && count ? <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg">{count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
