import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { ProductMark } from '@/components/ProductMark';
import { Button } from '@/components/ui';
import { PACKAGES, TRADE_GROUPS, accentStyle, type PackageId } from '@/config/tenant.config';
import { openDemoSeat } from '@/lib/actions/demo';
import { signOut } from '@/lib/actions/auth';
import { demoSeat, isDemoUser, type DemoRole } from '@/lib/demo';
import { getAuth } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Demo centar' };

const ROLES: { role: DemoRole; label: string; hint: string }[] = [
  { role: 'owner', label: 'Voditelj', hint: 'cijene, naplata, poslovanje' },
  { role: 'worker', label: 'Radnik', hint: 'nalozi bez iznosa' },
];

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ greska?: string }> }) {
  const { user } = await getAuth();
  if (!user) redirect('/login?next=/demo');
  if (!isDemoUser(user)) redirect('/app');
  const { greska } = await searchParams;
  const current = demoSeat(user.email);

  // Workshop and staff names straight from the demo data, so the page
  // matches what the seed actually created.
  const admin = createAdminClient();
  const { data: tenants } = await admin.from('tenants').select('id, name, city, package').like('slug', 'demo-%').eq('settings->>demo', 'true');
  const { data: staff } = await admin
    .from('profiles')
    .select('tenant_id, full_name, role')
    .in('tenant_id', (tenants ?? []).map((t) => t.id));
  const byPackage = new Map((tenants ?? []).map((t) => [t.package as PackageId, t]));
  const nameOf = (tenantId: string | undefined, role: DemoRole) => staff?.find((p) => p.tenant_id === tenantId && p.role === role)?.full_name;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 pb-16 pt-safe sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted">
            <FlaskConical className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">Demo centar</span>
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Odjava
          </Button>
        </form>
      </header>

      <h1 className="font-display text-3xl font-bold tracking-tight">Odaberite proizvod i ulogu</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Jedan račun za svih jedanaest zanata. Voditelj vidi cijene i naplatu, radnik vidi samo posao. Podaci su izmišljeni: slobodno mijenjajte, dodajte i brišite,
        demo se može vratiti na početno stanje. Iz aplikacije se ovamo vraćate preko trake <span className="font-medium text-fg">Demo</span> na vrhu.
      </p>
      {greska ? (
        <p className="mt-4 rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">Prebacivanje nije uspjelo. Pokušajte ponovno za minutu.</p>
      ) : null}

      {TRADE_GROUPS.map((group) => (
        <section key={group.id} className="mt-7">
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <p className="text-sm text-muted">{group.hint}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {group.packages.map((id) => PACKAGES[id]).map((pkg, i, all) => {
              const tenant = byPackage.get(pkg.id);
              return (
                <section key={pkg.id} className={cn('accent-scope rounded-2xl border border-line bg-surface p-4', all.length % 2 === 1 && i === all.length - 1 && 'sm:col-span-2')} style={accentStyle(pkg)}>
                  <div className="flex items-start gap-3">
                    <ProductMark id={pkg.id} className="size-10" />
                    <div className="min-w-0">
                      <h3 className="font-semibold">{pkg.product}</h3>
                      <p className="text-xs text-muted">{pkg.tagline}</p>
                      {tenant ? (
                        <p className="mt-1 break-words text-xs text-faint">
                          {tenant.name} · {tenant.city}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {tenant ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {ROLES.map(({ role, label, hint }) => {
                        const active = current?.pkg === pkg.id && current.role === role;
                        return (
                          <form key={role} action={openDemoSeat}>
                            <input type="hidden" name="pkg" value={pkg.id} />
                            <input type="hidden" name="role" value={role} />
                            <button
                              type="submit"
                              className={cn(
                                'flex h-auto min-h-14 w-full flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors',
                                active ? 'border-accent bg-accent/15' : 'border-line bg-surface2 hover:border-faint/60'
                              )}
                            >
                              <span className="text-sm font-medium">
                                {label}
                                {active ? <span className="ml-1.5 text-xs font-normal text-accent">· sada</span> : null}
                              </span>
                              <span className="block w-full break-words text-xs text-muted">{nameOf(tenant.id, role) ?? hint}</span>
                              <span className="block w-full break-words text-[11px] text-faint">{hint}</span>
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-faint">Demo radionica još nije napravljena.</p>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
