import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FieldActions, ScheduleSheet } from '@/components/field/FieldActions';
import { Card, CardHeader, KeyValue } from '@/components/ui';
import { DEVICE_TYPES } from '@/config/tenant.config';
import { formatDateTime, plural } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';
import { OverviewEditor } from './OverviewEditor';

// Client and object details are not repeated here: the header names them
// and links to their pages, where everything about them lives once.
export async function OverviewTab({ ctx, job, extras }: { ctx: WorkshopContext; job: JobWithRefs; extras: boolean }) {
  const [{ data: staff }, { count: earlier }] = await Promise.all([
    ctx.supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ctx.supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('asset_id', job.asset.id).neq('id', job.id),
  ]);

  const staffList = (staff ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null) ?? 'Bez imena' }));
  const field = job.work_mode === 'field';
  // Air conditioners and heat pumps have no km or hour meter to read.
  const climate = DEVICE_TYPES.includes(job.asset.asset_type);
  const visits = earlier ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {field ? (
          <Card>
            <CardHeader
              title="Posjet na lokaciji"
              subtitle={job.scheduled_start ? `Termin ${formatDateTime(job.scheduled_start)}${job.assignee?.full_name ? ` · ${job.assignee.full_name}` : ''}` : 'Još nije zakazano'}
              action={<ScheduleSheet jobId={job.id} current={{ start: job.scheduled_start, end: job.scheduled_end, assignedTo: job.assigned_to }} staff={staffList} />}
            />
            <div className="p-4">
              <FieldActions
                variant="panel"
                job={job}
                site={job.site}
                ctx={{
                  workshopName: ctx.tenant.name,
                  techName: job.assignee?.full_name ?? ctx.profile.full_name ?? 'Tehničar',
                  clientFirstName: job.client.kind === 'person' ? job.client.first_name : null,
                  clientPhone: job.client.phone,
                  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
                  isOwner: ctx.isOwner,
                }}
              />
            </div>
          </Card>
        ) : null}
        <OverviewEditor
          job={{
            id: job.id,
            complaint: job.complaint ?? '',
            diagnosis_notes: job.diagnosis_notes ?? '',
            work_summary: job.work_summary ?? '',
            meter_out: job.meter_out,
            meter_unit: job.meter_unit,
            promised_at: job.promised_at,
            bay: job.bay ?? '',
            is_urgent: job.is_urgent,
            assigned_to: job.assigned_to,
          }}
          staff={staffList}
          locked={Boolean(job.locked_at)}
          field={field}
          meter={!climate}
          extras={extras}
        />
      </div>

      <Card className="h-fit">
        <CardHeader title={ctx.pkg.vocabulary.asset.one} />
        {job.asset.vin || job.asset.year || job.asset.engine_code ? (
          <div className="divide-y divide-line px-4">
            {job.asset.vin ? <KeyValue label={climate ? 'Serijski broj' : 'VIN'}>{<span className="font-mono text-xs">{job.asset.vin}</span>}</KeyValue> : null}
            {job.asset.year ? <KeyValue label={climate ? 'Godina ugradnje' : 'Godište'}>{job.asset.year}</KeyValue> : null}
            {job.asset.engine_code ? <KeyValue label="Motor">{job.asset.engine_code}</KeyValue> : null}
          </div>
        ) : null}
        <Link prefetch={false} href={`/app/assets/${job.asset.id}`} className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-accent hover:bg-surface2">
          {visits ? `Povijest · ${visits} ${plural(visits, 'raniji posjet', 'ranija posjeta', 'ranijih posjeta')}` : 'Povijest · prvi posjet'}
          <ChevronRight className="size-4" />
        </Link>
      </Card>
    </div>
  );
}
