import Link from 'next/link';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { FieldActions, ScheduleSheet } from '@/components/field/FieldActions';
import { Card, CardHeader, KeyValue, buttonClass } from '@/components/ui';
import { DEVICE_TYPES } from '@/config/tenant.config';
import { spokenSlot } from '@/lib/calendar';
import { whatsappLink } from '@/lib/contact';
import { formatDateTime, plural, vocativeHR } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';
import { OverviewEditor } from './OverviewEditor';

// Client and object details are not repeated here: the header names them
// and links to their pages, where everything about them lives once.
export async function OverviewTab({ ctx, job, extras }: { ctx: WorkshopContext; job: JobWithRefs; extras: boolean }) {
  const [{ data: staff }, { count: earlier }, { data: calls }] = await Promise.all([
    ctx.supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ctx.supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('asset_id', job.asset.id).neq('id', job.id),
    // The AI phone call that booked it (the owner sees calls).
    ctx.isOwner ? ctx.supabase.from('phone_calls').select('summary, started_at, created_at').eq('job_id', job.id).order('created_at').limit(1) : Promise.resolve({ data: [] }),
  ]);
  const call = (calls ?? [])[0] as { summary: string | null; started_at: string | null; created_at: string } | undefined;
  // Booked by Poslar on the phone or by the customer on the booking page.
  const booked = job.source === 'phone' || job.source === 'booking';
  const bookedNote =
    job.source === 'booking' ? (
      <p className="text-muted">
        <span className="font-medium text-fg">Mušterija je rezervirala preko poveznice.</span> Potvrdite joj termin.
      </p>
    ) : call ? (
      <p className="text-muted">
        <span className="font-medium text-fg">Dogovorio Poslar na telefonu.</span> {call.summary ?? ''}
      </p>
    ) : null;
  // "Potvrdi termin": the appointment to the customer on WhatsApp.
  const confirm =
    job.scheduled_start && job.client.phone
      ? whatsappLink(
          job.client.phone,
          `${job.client.kind === 'person' && job.client.first_name ? `Poštovani ${vocativeHR(job.client.first_name)}, ` : 'Poštovani, '}potvrđujemo termin: ${spokenSlot(new Date(job.scheduled_start))}.${job.work_mode === 'field' ? '' : ctx.tenant.address ? ` Adresa: ${[ctx.tenant.address, ctx.tenant.city].filter(Boolean).join(', ')}.` : ''}\n\n${ctx.tenant.name}`
        )
      : null;

  const staffList = (staff ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null) ?? 'Bez imena' }));
  const field = job.work_mode === 'field';
  // Air conditioners and heat pumps have no km or hour meter to read.
  const climate = DEVICE_TYPES.includes(job.asset.asset_type);
  const visits = earlier ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* On the field what the caller said comes first, then the visit. */}
        {field && (bookedNote || (confirm && booked)) ? (
          <Card>
            <div className="space-y-3 p-4 text-sm">
              {bookedNote}
              {confirm ? (
                <a href={confirm} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}>
                  <MessageCircle className="size-4" /> Potvrdi termin na WhatsApp
                </a>
              ) : null}
            </div>
          </Card>
        ) : null}
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
        {!field && (job.scheduled_start || booked) ? (
          <Card>
            <CardHeader
              title="Termin"
              subtitle={job.scheduled_start ? spokenSlot(new Date(job.scheduled_start)) : 'Još nije zakazano'}
              action={<ScheduleSheet jobId={job.id} current={{ start: job.scheduled_start, end: job.scheduled_end, assignedTo: job.assigned_to }} staff={staffList} />}
            />
            {confirm || bookedNote ? (
              <div className="space-y-3 p-4 text-sm">
                {bookedNote}
                {confirm ? (
                  <a href={confirm} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}>
                    <MessageCircle className="size-4" /> Potvrdi termin na WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
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
