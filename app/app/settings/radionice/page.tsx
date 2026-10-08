import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { ProductMark } from '@/components/ProductMark';
import { AddWorkshopForm } from '@/components/settings/AddWorkshopForm';
import { BackLink, Badge, Card, CardHeader, PageHeader, buttonClass } from '@/components/ui';
import { PLANS } from '@/config/plans';
import { getPackage, TRADE_GROUPS } from '@/config/tenant.config';
import { switchWorkshop } from '@/lib/actions/workshops';
import { isPlayApp } from '@/lib/play';
import { requireOwner } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { branchesAllowed, groupId, groupTenantIds, MAX_WORKSHOPS, myWorkshops } from '@/lib/workshops';
import type { Tenant } from '@/types/db';

export const metadata: Metadata = { title: 'Radionice' };

// Više radionica pod jednim vlasnikom: the list, one tap to open one, and
// a new branch (Premium covers three).
export default async function WorkshopsPage() {
  const ctx = await requireOwner();
  const mainId = groupId(ctx.tenant);
  const main = mainId === ctx.tenant.id ? ctx.tenant : ((await createAdminClient().from('tenants').select('*').eq('id', mainId).single()).data as Tenant);
  const [workshops, group] = await Promise.all([myWorkshops(ctx), groupTenantIds(createAdminClient(), ctx.tenant)]);
  const inGroup = group.length;
  const allowed = branchesAllowed(main);
  const play = await isPlayApp();
  const trades = TRADE_GROUPS.map((g) => ({ group: g.name, items: g.packages.map((id) => ({ id, name: getPackage(id).product })) }));

  return (
    <>
      <PageHeader title="Radionice" subtitle="Više radionica pod jednim računom" back={<BackLink href="/app/settings">Postavke</BackLink>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vaše radionice" subtitle={allowed === 'ok' ? `${inGroup} od ${MAX_WORKSHOPS}` : undefined} />
          <div className="space-y-2 p-4">
            {workshops.map((w) => (
              <form key={w.id} action={switchWorkshop}>
                <input type="hidden" name="tenant" value={w.id} />
                <button
                  type="submit"
                  disabled={w.active}
                  className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line px-4 py-2 text-left hover:border-accent/60 disabled:border-accent disabled:bg-accent/10"
                >
                  <ProductMark id={w.package} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold">{w.name}</span>
                    <span className="block break-words text-sm text-muted">{[getPackage(w.package).product, w.city].filter(Boolean).join(' · ')}</span>
                  </span>
                  {w.main ? <Badge tone="muted">Glavna</Badge> : null}
                  {w.active ? <Check className="size-5 shrink-0 text-accent" aria-label="Otvorena" /> : null}
                </button>
              </form>
            ))}
            <p className="pt-2 text-sm text-muted">
              Svaka radionica ima svoje naloge, mušterije, račune i radnike. Radnik vidi samo svoju. Vi prelazite iz jedne u drugu dodirom na naziv radionice na vrhu ekrana.
            </p>
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Nova radionica" />
          <div className="p-4">
            {allowed === 'demo' ? (
              <p className="text-sm text-muted">U demo verziji ne dodajete radionice. U svojoj radionici, uz paket Premium, imate do {MAX_WORKSHOPS}.</p>
            ) : allowed === 'plan' ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium">Više radionica dolazi uz paket Premium{play ? '' : ` (${PLANS.premium.price} € mjesečno)`}.</p>
                <p className="text-muted">Premium pokriva do {MAX_WORKSHOPS} radionice. Radnici, slikanja, pitanja Poslaru i pozivi na telefonu su zajednički.</p>
                {play ? null : (
                  <Link href="/app/settings/pretplata" className={buttonClass('secondary')}>
                    Pretplata
                  </Link>
                )}
              </div>
            ) : !workshops.some((w) => w.id === mainId) ? (
              <p className="text-sm text-muted">Radionicu dodaje vlasnik glavne radionice.</p>
            ) : inGroup >= MAX_WORKSHOPS ? (
              <p className="text-sm text-muted">Imate {MAX_WORKSHOPS} radionice, koliko pokriva Premium. Za više se javite kroz „Javi problem”.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Plaća se kroz glavnu radionicu ({main.name}). Podaci za račun i radno vrijeme prenose se iz nje; oznaku poslovnog prostora za fiskalizaciju upisujete posebno.
                </p>
                <AddWorkshopForm trades={trades} current={ctx.pkg.id} />
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
