import type { Metadata } from 'next';
import { BrandMark } from '@/components/ProductMark';
import { Button } from '@/components/ui';
import { brandAccentStyle } from '@/config/tenant.config';
import { signOut } from '@/lib/actions/auth';
import { getAuth } from '@/lib/session';
import { requireTower, towerCounts } from '@/lib/tower';
import { TowerNav } from './TowerNav';

export const metadata: Metadata = { title: { default: 'Toranj', template: '%s · Toranj' } };

// Vedran's tower: workshops and their subscriptions, support, errors and
// the numbers. Only platform admins get past requireTower().
export default async function TowerLayout({ children }: { children: React.ReactNode }) {
  await requireTower();
  const [{ user }, counts] = await Promise.all([getAuth(), towerCounts()]);
  return (
    <div className="accent-scope min-h-dvh" style={brandAccentStyle()}>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <BrandMark className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold leading-none">Toranj</span>
            <span className="block truncate text-xs text-faint">{user?.email}</span>
          </span>
          <form action={signOut}>
            <Button type="submit" size="sm" variant="ghost">
              Odjava
            </Button>
          </form>
        </div>
        <TowerNav tickets={counts.tickets} errors={counts.errors} />
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">{children}</main>
    </div>
  );
}
