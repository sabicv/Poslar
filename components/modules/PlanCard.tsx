import { CalendarClock } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { daysUntil, formatDate } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import { addMonths, todayInZagreb } from '@/lib/time';
import type { JobWithRefs } from '@/types/db';
import { RecordSheet } from './kit';

// Recurring service for this device (field trades): switched on from the
// job, then the customer shows up in "Servisni planovi" a month ahead.
export function PlanCard({
  ctx,
  job,
  plan,
  title,
  templateCode,
}: {
  ctx: WorkshopContext;
  job: JobWithRefs;
  plan: Record<string, unknown> | null;
  title: string;
  templateCode: string;
}) {
  const path = `/app/jobs/${job.id}`;
  const today = todayInZagreb();
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4 text-accent" /> Servisni plan
          </span>
        }
        subtitle={plan ? `${plan.title} · svakih ${plan.interval_months} mj.` : 'Ponavljajući servis: aplikacija sama ponudi termin kad se približi'}
        action={
          <RecordSheet
            table="maintenance_plans"
            title="Servisni plan"
            id={plan?.id as string | undefined}
            revalidate={path}
            fixed={{ client_id: job.client.id, site_id: job.site_id, asset_id: job.asset.id }}
            initial={plan ?? { title, interval_months: 12, next_due_date: addMonths(today, 12), template_code: templateCode }}
            label={plan ? 'Uredi' : 'Uključi'}
            deletable={ctx.isOwner}
            fields={[
              { name: 'title', label: 'Naziv', required: true },
              { name: 'interval_months', label: 'Svakih', type: 'number', suffix: 'mj.', half: true, required: true },
              { name: 'next_due_date', label: 'Sljedeći servis', type: 'date', half: true, required: true },
              { name: 'template_code', label: 'Predložak posla', type: 'select', options: ctx.pkg.templates.map((t) => ({ value: t.code, label: t.name })) },
              { name: 'notes', label: 'Napomena', type: 'textarea' },
            ]}
          />
        }
      />
      {plan ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
          <span className="text-muted">Sljedeći servis:</span>
          <Badge tone={(daysUntil(plan.next_due_date as string) ?? 0) < 0 ? 'crit' : (daysUntil(plan.next_due_date as string) ?? 99) <= 30 ? 'warn' : 'ok'}>{formatDate(plan.next_due_date as string)}</Badge>
          <span className="text-xs text-faint">Kad je ovaj nalog vezan uz plan i označen „{ctx.pkg.phaseLabels.ready ?? 'Gotovo'}”, datum se sam pomakne.</span>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-muted">Mjesec dana prije roka servis se sam pojavi u „{ctx.pkg.modulePage}”, s porukom za podsjetnik i gumbom Zakaži.</p>
      )}
    </Card>
  );
}
