import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing } from 'lucide-react';
import { HelpVideo } from '@/components/help/HelpVideo';
import { ReminderActions } from '@/components/reminders/ReminderActions';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { loadReminders, type ReminderGroup } from '@/lib/reminders';
import { requireOwner } from '@/lib/session';
import { BusinessTabs } from '../BusinessTabs';

export const metadata: Metadata = { title: 'Podsjetnici' };

// Customers to call back: one WhatsApp message each, written out, one tap.
export default async function RemindersPage() {
  const ctx = await requireOwner();
  const { items, season, sentLately } = await loadReminders(ctx);
  const word = season.kind === 'winter' ? 'zimske' : 'ljetne';
  const titles: Record<ReminderGroup, { title: string; hint: string }> = {
    season: { title: `Vrijeme je za ${word} gume`, hint: `Do ${formatDate(season.end)} Gume koje čuvamo i tko je lani mijenjao kod nas.` },
    service: { title: 'Dospio servis', hint: 'Godinu dana od zadnjeg servisa, ili po servisnom planu vozila' },
    plan: { title: 'Servisni planovi', hint: 'Rok u sljedećih 30 dana ili prošao' },
    compliance: { title: 'Rokovi koji ističu', hint: 'Tehnički, tahograf i ostalo u 30 dana' },
  };
  const groups = (['season', 'service', 'plan', 'compliance'] as ReminderGroup[]).map((g) => ({ g, rows: items.filter((i) => i.group === g) })).filter((x) => x.rows.length);

  return (
    <>
      <PageHeader title="Poslovanje" />
      <BusinessTabs active="podsjetnici" count={items.length} invoices={!ctx.pkg.internalJobs} />
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-muted">
          WhatsApp otvara poruku s Vašim potpisom; Vi samo pritisnete pošalji.{' '}
          {sentLately ? <span className="text-faint">Poslano u zadnjih 30 dana: {sentLately}.</span> : null}
        </p>
        <HelpVideo topic="reminders" className="shrink-0" />
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<BellRing className="size-8" />} title="Nitko ne čeka podsjetnik">
          {season.kind === null && (ctx.pkg.id === 'wheel' || ctx.pkg.id === 'gear')
            ? `Podsjetnici za ${season.next.kind === 'winter' ? 'zimske' : 'ljetne'} gume kreću ${formatDate(season.next.start)}.`
            : 'Ovdje se sami pojave servisi, gume i rokovi kad dođe vrijeme.'}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {groups.map(({ g, rows }) => (
            <Card key={g}>
              <CardHeader title={titles[g].title} subtitle={titles[g].hint} action={<Badge tone="accent">{rows.length}</Badge>} />
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.key} className="space-y-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                        {r.clientId ? (
                          <Link href={`/app/clients/${r.clientId}`} className="hover:underline">
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                        {r.phone ? <span className="text-xs font-normal text-muted">{r.phone}</span> : null}
                      </p>
                      <p className="break-words text-xs text-muted">{r.asset}</p>
                      <p className="text-xs text-faint">{r.reason}</p>
                    </div>
                    <ReminderActions item={{ group: r.group, clientId: r.clientId, assetId: r.assetId, planId: r.planId, title: titles[r.group].title }} phone={r.phone} message={r.message} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
