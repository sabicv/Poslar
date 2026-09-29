import Link from 'next/link';
import { FieldActions, ScheduleSheet } from '@/components/field/FieldActions';
import { Card, CardHeader, KeyValue } from '@/components/ui';
import { CLIMATE_TYPES, phaseLabel } from '@/config/tenant.config';
import { clientName, formatDate, formatDateTime, formatMeter } from '@/lib/format';
import type { WorkshopContext } from '@/lib/session';
import type { JobWithRefs } from '@/types/db';
import { OverviewEditor } from './OverviewEditor';

export async function OverviewTab({ ctx, job }: { ctx: WorkshopContext; job: JobWithRefs }) {
  const [{ data: staff }, { data: previous }] = await Promise.all([
    ctx.supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ctx.supabase
      .from('jobs')
      .select('id, number, phase, complaint, created_at, meter_in, meter_unit')
      .eq('asset_id', job.asset.id)
      .neq('id', job.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const staffList = (staff ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null) ?? 'Bez imena' }));
  // Air conditioners and heat pumps have no km or hour meter to read.
  const climate = CLIMATE_TYPES.includes(job.asset.asset_type);
  const fieldCard =
    job.work_mode === 'field' ? (
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
    ) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
      {fieldCard}
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
        staff={(staff ?? []).map((s) => ({ id: s.id as string, name: (s.full_name as string | null) ?? 'Bez imena' }))}
        locked={Boolean(job.locked_at)}
        field={job.work_mode === 'field'}
        meter={!climate}
      />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title={ctx.pkg.vocabulary.client.one} action={<Link href={`/app/clients/${job.client.id}`} className="text-xs text-accent">Otvori</Link>} />
          <div className="divide-y divide-line px-4">
            <KeyValue label="Ime">{clientName(job.client)}</KeyValue>
            {job.client.phone ? <KeyValue label="Telefon">{job.client.phone}</KeyValue> : null}
            {job.client.oib ? <KeyValue label="OIB">{job.client.oib}</KeyValue> : null}
            {job.client.email ? <KeyValue label="E-mail">{job.client.email}</KeyValue> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title={ctx.pkg.vocabulary.asset.one} action={<Link href={`/app/assets/${job.asset.id}`} className="text-xs text-accent">Povijest</Link>} />
          <div className="divide-y divide-line px-4">
            {job.asset.vin ? <KeyValue label="VIN / serijski">{<span className="font-mono text-xs">{job.asset.vin}</span>}</KeyValue> : null}
            {job.asset.year ? <KeyValue label={climate ? 'Godina ugradnje' : 'Godište'}>{job.asset.year}</KeyValue> : null}
            {job.asset.engine_code ? <KeyValue label="Motor">{job.asset.engine_code}</KeyValue> : null}
            {climate && job.meter_in === null ? null : <KeyValue label="Pri prijemu">{formatMeter(job.meter_in, job.meter_unit)}</KeyValue>}
          </div>
        </Card>
        {previous?.length ? (
          <Card>
            <CardHeader title="Ranije posjete" />
            <ul className="divide-y divide-line">
              {previous.map((p) => (
                <li key={p.id as string}>
                  <Link href={`/app/jobs/${p.id}`} className="block px-4 py-3 hover:bg-surface2">
                    <span className="flex items-center justify-between text-xs text-faint">
                      <span>
                        #{p.number as number} · {formatDate(p.created_at as string)}
                      </span>
                      <span>{phaseLabel(ctx.pkg, p.phase as never)}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm">{(p.complaint as string | null) ?? '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
