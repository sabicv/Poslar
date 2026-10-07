import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { Badge, EmptyState, buttonClass } from '@/components/ui';
import { assetTitle, clientName, daysUntil, formatDate, formatRelative } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addDays, todayInZagreb } from '@/lib/time';
import { PlanReminderButton } from './PlanReminderButton';

type PlanRow = {
  id: string;
  title: string;
  next_due_date: string;
  interval_months: number;
  last_reminded_at: string | null;
  client: { kind: 'person' | 'company'; first_name: string | null; last_name: string | null; company_name: string | null; phone: string | null } | null;
  site: { address: string; city: string | null; contact_phone: string | null } | null;
  asset: { asset_type: never; make: string | null; model: string | null } | null;
};

// Recurring service due in the next 60 days (field trades): overdue first,
// each with a ready reminder message and "Zakaži".
export async function DuePlans({ ctx, emptyHint }: { ctx: WorkshopContext; emptyHint: string }) {
  const today = todayInZagreb();
  const { data: plans } = await ctx.supabase
    .from('maintenance_plans')
    .select('id, title, next_due_date, interval_months, last_reminded_at, client:clients(kind, first_name, last_name, company_name, phone), site:sites(address, city, contact_phone), asset:assets(asset_type, make, model)')
    .eq('active', true)
    .lte('next_due_date', addDays(today, 60))
    .order('next_due_date');

  const rows = (plans ?? []) as unknown as PlanRow[];
  const groups = [
    { title: 'Prekoračeno', rows: rows.filter((p) => (daysUntil(p.next_due_date) ?? 0) < 0), tone: 'crit' as const },
    { title: 'Sljedećih 30 dana', rows: rows.filter((p) => { const d = daysUntil(p.next_due_date) ?? 0; return d >= 0 && d <= 30; }), tone: 'warn' as const },
    { title: '31–60 dana', rows: rows.filter((p) => (daysUntil(p.next_due_date) ?? 0) > 30), tone: 'muted' as const },
  ].filter((g) => g.rows.length);

  return (
    <section className="space-y-4">
      {groups.length === 0 ? (
        <EmptyState icon={<CalendarPlus className="size-8" />} title="Nema servisa u sljedećih 60 dana">
          {emptyHint}
        </EmptyState>
      ) : (
        groups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {group.title} <span className="rounded bg-surface2 px-1.5 text-[11px] text-faint">{group.rows.length}</span>
            </h2>
            <ul className="space-y-2">
              {group.rows.map((plan) => {
                const phone = plan.site?.contact_phone || plan.client?.phone || null;
                const place = [plan.site?.address, plan.site?.city].filter(Boolean).join(', ');
                return (
                  <li key={plan.id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{clientName(plan.client)}</p>
                        <p className="break-words text-xs text-muted">{[place, assetTitle(plan.asset)].filter(Boolean).join(' · ')}</p>
                        <p className="text-xs text-faint">
                          {plan.title}
                          {plan.last_reminded_at ? ` · podsjetnik poslan ${formatRelative(plan.last_reminded_at)}` : ''}
                        </p>
                      </div>
                      <Badge tone={group.tone}>{formatDate(plan.next_due_date)}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PlanReminderButton
                        planId={plan.id}
                        phone={phone}
                        message={`Poštovani, bliži se ${plan.title.toLowerCase()}${place ? ` na adresi ${place}` : ''} (rok ${formatDate(plan.next_due_date)}). Odgovorite s danom i vremenom koje Vam odgovara.

${ctx.tenant.name}${ctx.tenant.phone ? `, ${ctx.tenant.phone}` : ''}`}
                      />
                      <Link href={`/app/jobs/new?plan=${plan.id}`} className={buttonClass('primary', 'sm')}>
                        <CalendarPlus className="size-4" /> Zakaži
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
