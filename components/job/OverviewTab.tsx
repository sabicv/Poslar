import { FieldActions, ScheduleSheet } from '@/components/field/FieldActions';
import { ButtonLink, Card, CardHeader } from '@/components/ui';
import { hasModule } from '@/config/tenant.config';
import { ConditionTab } from './ConditionTab';
import { waEnabled } from '@/config/whatsapp';
import { canMessage, whatsappReady } from '@/lib/whatsapp';
import { ConfirmAppointment } from './ConfirmAppointment';
import { spokenSlot } from '@/lib/calendar';
import { publicAppUrl } from '@/lib/qr';
import { whatsappLink } from '@/lib/contact';
import { formatDateTime, vocativeHR } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';
import { NextStep } from './NextStep';
import { AssignWorker, OverviewEditor } from './OverviewEditor';

// Client and object details are not repeated here: the header names them
// and links to their pages, where everything about them lives once.
export async function OverviewTab({ ctx, job }: { ctx: WorkshopContext; job: JobWithRefs }) {
  const [{ data: staff }, { data: calls }, { data: sent }, { count: messageCount }] = await Promise.all([
    ctx.supabase.from('profiles').select('id, full_name, role').order('full_name'),
    // The AI phone call that booked it (the owner sees calls).
    ctx.isOwner ? ctx.supabase.from('phone_calls').select('summary, started_at, created_at').eq('job_id', job.id).order('created_at').limit(1) : Promise.resolve({ data: [] }),
    // The last confirmation Poslar sent (the owner sees messages).
    ctx.isOwner && job.scheduled_start
      ? ctx.supabase.from('whatsapp_messages').select('created_at').eq('job_id', job.id).eq('kind', 'confirm').eq('direction', 'out').neq('status', 'failed').order('created_at', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] }),
    ctx.supabase.from('job_messages').select('id', { count: 'exact', head: true }).eq('job_id', job.id),
  ]);
  const confirmedAt = ((sent ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null;
  const autoConfirm = whatsappReady() && canMessage(ctx.tenant) && waEnabled(ctx.tenant.settings, 'confirm');
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

  return (
    <div className="space-y-4">
        {field ? null : <AssignWorker jobId={job.id} assignedTo={job.assigned_to} staff={staffList} locked={Boolean(job.locked_at)} />}
        <NextStep ctx={ctx} job={job} />
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href={`/app/jobs/${job.id}/papir`} variant="secondary" className="w-full">
            Nalog na papiru
          </ButtonLink>
          <ButtonLink href={`/app/jobs/${job.id}?tab=povijest&otvori=poruke`} variant="secondary" className="w-full">
            Poruke{messageCount ? ` (${messageCount})` : ''}
          </ButtonLink>
        </div>
        {/* On the field what the caller said comes first, then the visit. */}
        {field && (bookedNote || (confirm && booked)) ? (
          <Card>
            <div className="space-y-3 p-4 text-sm">
              {bookedNote}
              {confirm ? <ConfirmAppointment jobId={job.id} auto={autoConfirm} link={confirm} sentAt={confirmedAt} /> : null}
            </div>
          </Card>
        ) : null}
        {field ? (
          <Card id="termin" className="scroll-mt-28">
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
                  appUrl: publicAppUrl(),
                  isOwner: ctx.isOwner,
                }}
              />
            </div>
          </Card>
        ) : null}
        {!field && (job.scheduled_start || booked) ? (
          <Card id="termin" className="scroll-mt-28">
            <CardHeader
              title="Termin"
              subtitle={job.scheduled_start ? spokenSlot(new Date(job.scheduled_start)) : 'Još nije zakazano'}
              action={<ScheduleSheet jobId={job.id} current={{ start: job.scheduled_start, end: job.scheduled_end, assignedTo: job.assigned_to }} staff={staffList} />}
            />
            {confirm || bookedNote ? (
              <div className="space-y-3 p-4 text-sm">
                {bookedNote}
                {confirm ? <ConfirmAppointment jobId={job.id} auto={autoConfirm} link={confirm} sentAt={confirmedAt} /> : null}
              </div>
            ) : null}
          </Card>
        ) : null}
        {hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'condition_report') ? <ConditionTab ctx={ctx} job={job} locked={Boolean(job.locked_at)} part="intake" /> : null}
        <OverviewEditor
          job={{
            id: job.id,
            complaint: job.complaint ?? '',
            promised_at: job.promised_at,
            bay: job.bay ?? '',
            is_urgent: job.is_urgent,
          }}
          locked={Boolean(job.locked_at)}
          field={field}
          complaint={ctx.pkg.id === 'clean' ? 'none' : field ? 'note' : 'fault'}
        />
        {hasModule(ctx.pkg, ctx.tenant.enabled_modules, 'condition_report') ? <ConditionTab ctx={ctx} job={job} locked={Boolean(job.locked_at)} part="handover" /> : null}
    </div>
  );
}
