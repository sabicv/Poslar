'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Bell, ClipboardList, LogOut, Plus, Settings, Users, type LucideIcon } from 'lucide-react';
import { PRODUCT_ICONS, ProductMark } from '@/components/ProductMark';
import { buttonClass } from '@/components/ui';
import type { PackageId } from '@/config/tenant.config';
import { signOut } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function AppShell({
  product,
  workshop,
  user,
  inboxCount,
  trialDaysLeft,
  children,
}: {
  product: { id: PackageId; name: string; clients: string; modulePage: string };
  workshop: { name: string; logoUrl: string | null };
  user: { name: string; isOwner: boolean };
  inboxCount: number;
  trialDaysLeft: number | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: '/app', label: 'Nalozi', icon: ClipboardList, exact: true },
    { href: '/app/clients', label: product.clients, icon: Users },
    { href: '/app/module', label: product.modulePage, icon: PRODUCT_ICONS[product.id] },
    ...(user.isOwner ? [{ href: '/app/business', label: 'Poslovanje', icon: BarChart3 }] : []),
    { href: '/app/settings', label: 'Postavke', icon: Settings },
  ];
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href || pathname.startsWith('/app/jobs') : pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === '/app/clients' && pathname.startsWith('/app/assets'));

  return (
    <div className="lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/40 px-3 py-4 lg:flex">
        <Link href="/app" className="mb-6 flex items-center gap-2.5 px-2">
          {workshop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workshop.logoUrl} alt="" className="size-8 rounded-lg object-contain" />
          ) : (
            <ProductMark id={product.id} />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{workshop.name}</span>
            <span className="block truncate text-xs text-faint">{product.name}</span>
          </span>
        </Link>
        <Link href="/app/jobs/new" className={buttonClass('primary', 'md', 'mb-4 w-full')}>
          <Plus className="size-4" /> Novi nalog
        </Link>
        <nav className="space-y-0.5">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                isActive(item) ? 'bg-surface2 font-medium text-fg' : 'text-muted hover:bg-surface2/60 hover:text-fg'
              )}
            >
              <item.icon className={cn('size-4', isActive(item) && 'text-accent')} />
              {item.label}
            </Link>
          ))}
          <Link
            href="/app/inbox"
            className={cn(
              'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
              pathname === '/app/inbox' ? 'bg-surface2 font-medium text-fg' : 'text-muted hover:bg-surface2/60 hover:text-fg'
            )}
          >
            <Bell className="size-4" />
            Poruke
            {inboxCount > 0 ? <span className="ml-auto rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg">{inboxCount}</span> : null}
          </Link>
        </nav>
        <div className="mt-auto space-y-3 border-t border-line pt-4">
          {trialDaysLeft !== null ? <TrialNote days={trialDaysLeft} /> : null}
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="min-w-0">
              <span className="block truncate text-sm">{user.name}</span>
              <span className="block text-xs text-faint">{user.isOwner ? 'Voditelj servisa' : 'Radnik'}</span>
            </span>
            <form action={signOut}>
              <button type="submit" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface2 hover:text-fg" aria-label="Odjava">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-safe backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-3 px-4">
            <Link href="/app" className="flex min-w-0 flex-1 items-center gap-2.5">
              {workshop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={workshop.logoUrl} alt="" className="size-8 rounded-lg object-contain" />
              ) : (
                <ProductMark id={product.id} />
              )}
              <span className="truncate text-sm font-semibold">{workshop.name}</span>
            </Link>
            <Link href="/app/inbox" className="relative flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface2" aria-label="Poruke">
              <Bell className="size-5" />
              {inboxCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">{inboxCount}</span>
              ) : null}
            </Link>
            <Link href="/app/jobs/new" className={buttonClass('primary', 'md', 'px-3')} aria-label="Novi nalog">
              <Plus className="size-5" />
              <span className="hidden sm:inline">Novi nalog</span>
            </Link>
          </div>
          {trialDaysLeft !== null && trialDaysLeft <= 7 ? (
            <div className="px-4 pb-2">
              <TrialNote days={trialDaysLeft} />
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>

        {/* Phone bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-safe backdrop-blur-md lg:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px]', isActive(item) ? 'text-fg' : 'text-faint')}
              >
                <item.icon className={cn('size-5', isActive(item) && 'text-accent')} />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function TrialNote({ days }: { days: number }) {
  return (
    <p className={cn('rounded-lg border px-3 py-2 text-xs', days <= 3 ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line bg-surface2 text-muted')}>
      Probno razdoblje: {days <= 0 ? 'završava danas' : `još ${days} ${days === 1 ? 'dan' : 'dana'}`}
    </p>
  );
}
