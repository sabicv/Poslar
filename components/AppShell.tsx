'use client';

import { plural } from '@/lib/format';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { InstallPrompt } from '@/components/InstallPrompt';
import { BarChart3, Bell, CalendarDays, ClipboardList, FlaskConical, LogOut, Plus, Repeat, Settings, Users, type LucideIcon } from 'lucide-react';
import { PRODUCT_ICONS, ProductMark } from '@/components/ProductMark';
import { buttonClass } from '@/components/ui';
import type { PackageId } from '@/config/tenant.config';
import { signOut } from '@/lib/actions/auth';
import { openDemoSeat } from '@/lib/actions/demo';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  // A small dot with what it means (read by screen readers).
  dot?: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function AppShell({
  product,
  workshop,
  user,
  inboxCount,
  supportUnread = 0,
  doorCount = 0,
  trialDaysLeft,
  play = false,
  demo,
  notice,
  children,
}: {
  product: { id: PackageId; name: string; clients: string; modulePage: string; field: boolean };
  workshop: { name: string; logoUrl: string | null };
  user: { name: string; isOwner: boolean };
  inboxCount: number;
  // Answers from Poslar support not yet read: a dot on Postavke.
  supportUnread?: number;
  // New requests from the door QR code: a dot on Nalozi / Raspored.
  doorCount?: number;
  trialDaysLeft: number | null;
  // Inside the Google Play app: the trial note does not lead to paying.
  play?: boolean;
  demo: boolean;
  // A note at the top of every page (e.g. the subscription is running out).
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // From a day picked in the schedule, a new job opens on that day.
  const pickedDay = useSearchParams().get('d');
  const newJobHref = pathname === '/app' && pickedDay && /^\d{4}-\d{2}-\d{2}$/.test(pickedDay) ? `/app/jobs/new?d=${pickedDay}` : '/app/jobs/new';
  const items: NavItem[] = [
    { href: '/app', label: product.field ? 'Raspored' : 'Nalozi', icon: product.field ? CalendarDays : ClipboardList, exact: true, dot: doorCount > 0 ? `Nove prijave: ${doorCount}` : undefined },
    { href: '/app/clients', label: product.clients, icon: Users },
    { href: '/app/module', label: product.modulePage, icon: PRODUCT_ICONS[product.id] },
    ...(user.isOwner ? [{ href: '/app/business', label: 'Poslovanje', icon: BarChart3 }] : []),
    { href: '/app/settings', label: 'Postavke', icon: Settings, dot: supportUnread > 0 ? 'Novi odgovor podrške' : undefined },
  ];
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href || pathname.startsWith('/app/jobs') : pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === '/app/clients' && pathname.startsWith('/app/assets'));
  // Phone header height (14 + an 11 per extra strip), so sticky bars on a
  // page (job tabs) sit right under it: --shell-top.
  const showTrial = trialDaysLeft !== null && trialDaysLeft <= 7;
  const headerRem = 3.5 + (demo ? 2.75 : 0) + (showTrial ? 2.75 : 0);

  return (
    <div className="lg:flex" style={{ '--shell-top': `calc(${headerRem}rem + env(safe-area-inset-top))` } as React.CSSProperties}>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh print:!hidden w-60 shrink-0 flex-col border-r border-line bg-surface/40 px-3 py-4 lg:flex">
        {demo ? <DemoBar product={product.id} isOwner={user.isOwner} className="mb-4 flex-wrap rounded-xl border border-line px-2 py-1.5" /> : null}
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
        <Link href={newJobHref} className={buttonClass('primary', 'md', 'mb-4 w-full')}>
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
              {item.dot ? <span className="ml-auto size-2 rounded-full bg-accent" aria-label={item.dot} /> : null}
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
          {trialDaysLeft !== null ? <TrialNote days={trialDaysLeft} linked={!play} /> : null}
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
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 pt-safe backdrop-blur-md print:hidden lg:hidden">
          {demo ? <DemoBar product={product.id} isOwner={user.isOwner} className="h-11 border-b border-line px-4" /> : null}
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
            <Link href={newJobHref} className={buttonClass('primary', 'md', 'px-3')} aria-label="Novi nalog">
              <Plus className="size-5" />
              <span className="hidden sm:inline">Novi nalog</span>
            </Link>
          </div>
          {showTrial ? (
            <div className="flex h-11 items-start px-4">
              <TrialNote days={trialDaysLeft} linked={!play} />
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 print:max-w-none print:p-0">
          {pathname === '/app' ? <InstallPrompt /> : null}
          {notice}
          {children}
        </main>

        {/* Phone bottom navigation */}
        <nav className="hide-on-type fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-safe backdrop-blur-md print:hidden lg:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px]', isActive(item) ? 'text-fg' : 'text-faint')}
              >
                <item.icon className={cn('size-5 shrink-0', isActive(item) && 'text-accent')} />
                {item.dot ? <span className="absolute right-[calc(50%-14px)] top-2.5 size-2 rounded-full bg-accent" aria-label={item.dot} /> : null}
                {/* Two short lines ("Servisni / planovi") rather than a cut-off word. */}
                <span className="line-clamp-2 max-w-full break-words px-0.5 text-center leading-[1.1]">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

// Testing aid for the demo login: flip between owner and worker of the
// same workshop in one tap, or go back to the demo centre for another
// product.
function DemoBar({ product, isOwner, className }: { product: PackageId; isOwner: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 bg-surface2/70 text-xs', className)}>
      <span className="flex items-center gap-1.5 text-muted">
        <FlaskConical className="size-3.5" />
        Demo · <span className="font-medium text-fg">{isOwner ? 'Voditelj' : 'Radnik'}</span>
      </span>
      <span className="ml-auto flex items-center gap-1">
        <form action={openDemoSeat}>
          <input type="hidden" name="pkg" value={product} />
          <input type="hidden" name="role" value={isOwner ? 'worker' : 'owner'} />
          <button type="submit" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 font-medium text-accent hover:bg-surface2">
            <Repeat className="size-3.5" /> {isOwner ? 'Radnik' : 'Voditelj'}
          </button>
        </form>
        <Link href="/demo" className="inline-flex h-9 items-center rounded-lg px-2 font-medium text-muted hover:bg-surface2 hover:text-fg">
          Svi proizvodi
        </Link>
      </span>
    </div>
  );
}

function TrialNote({ days, linked }: { days: number; linked: boolean }) {
  const className = cn('block rounded-lg border px-3 py-2 text-xs', days <= 3 ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line bg-surface2 text-muted');
  const left = `Probno razdoblje: ${days <= 0 ? 'završava danas' : `još ${days} ${plural(days, 'dan', 'dana', 'dana')}`}`;
  return linked ? (
    <Link href="/app/settings/pretplata" className={className}>
      {left} · Pretplata
    </Link>
  ) : (
    <span className={className}>{left}</span>
  );
}
