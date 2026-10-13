'use client';

import { useState } from 'react';
import { AutoSaveTextarea, useAction } from '@/components/client-ui';
import { Card, Field, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { MeterUnit } from '@/config/tenant.config';
import { updateJob } from '@/lib/actions/jobs';
import { ShotButton } from './ShotButton';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function AssignWorker({ jobId, assignedTo, staff, locked }: { jobId: string; assignedTo: string | null; staff: { id: string; name: string }[]; locked: boolean }) {
  const { run } = useAction();
  if (!staff.length) return null;
  const assigned = staff.find((person) => person.id === assignedTo);
  return (
    <Card className="p-4">
      <p className="text-sm">
        <span className="text-muted">Radnik</span> <span className="font-semibold">{assigned?.name ?? 'nije dodijeljen'}</span>
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {staff.map((person) => {
          const on = person.id === assignedTo;
          return (
            <button
              key={person.id}
              type="button"
              disabled={locked}
              onClick={() => run(() => updateJob(jobId, { assigned_to: on ? null : person.id }), { quiet: true })}
              className={cn('flex h-12 items-center rounded-xl border px-3 text-left text-sm', on ? 'border-accent bg-accent/10 font-medium' : 'border-line')}
            >
              {person.name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Everything saves by itself (text a moment after typing, the rest on
// change). The complaint stays open: it is why the job exists.
// field: a visit at the client's address (no bay, the appointment replaces
// "promised by"); meter: the object has a km / hour meter (not a split AC).
export function OverviewEditor({
  job,
  locked,
  field,
  complaint = 'fault',
}: {
  field: boolean;
  // fault: a workshop writes what is wrong. note: a visit. none: the job
  // type was already chosen, so the overview does not ask again.
  complaint?: 'fault' | 'note' | 'none';
  job: {
    id: string;
    complaint: string;
    promised_at: string | null;
    bay: string;
    is_urgent: boolean;
  };
  locked: boolean;
}) {
  const { run } = useAction();
  const [bay, setBay] = useState(job.bay);
  const save = (patch: Parameters<typeof updateJob>[1]) => updateJob(job.id, patch);
  const quiet = { quiet: true };

  return (
    <div className="space-y-3">
      {complaint === 'none' ? null : (
        <Card className="p-4">
          <AutoSaveTextarea label={complaint === 'note' ? 'Što treba napraviti' : 'Opis kvara'} initial={job.complaint} disabled={locked} onSave={(v) => save({ complaint: v || null })} />
        </Card>
      )}
      {!field ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Obećano do">
              <Input
                type="datetime-local"
                defaultValue={toLocalInput(job.promised_at)}
                disabled={locked}
                onChange={(e) => {
                  const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                  if (value !== job.promised_at) run(() => save({ promised_at: value }), quiet);
                }}
              />
            </Field>
            <Field label="Mjesto u radionici">
              <Input value={bay} disabled={locked} placeholder="npr. Dizalica 2" onChange={(e) => setBay(e.target.value)} onBlur={() => bay !== job.bay && run(() => save({ bay: bay || null }), quiet)} />
            </Field>
            <label className="flex min-h-12 items-center gap-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                defaultChecked={job.is_urgent}
                disabled={locked}
                onChange={(e) => run(() => save({ is_urgent: e.target.checked }), quiet)}
                className="size-5 accent-[rgb(var(--crit))]"
              />
              Hitno?
            </label>
          </div>
        </Card>
      ) : (
        <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-sm">
          <input
            type="checkbox"
            defaultChecked={job.is_urgent}
            disabled={locked}
            onChange={(e) => run(() => save({ is_urgent: e.target.checked }), quiet)}
            className="size-5 accent-[rgb(var(--crit))]"
          />
          Hitno?
        </label>
      )}
    </div>
  );
}

export function JobMeter({
  jobId,
  meterIn: initialIn,
  meterOut: initialOut,
  meterUnit,
  locked,
  tenantId,
  meterShots,
}: {
  jobId: string;
  meterIn: number | null;
  meterOut: number | null;
  meterUnit: MeterUnit | null;
  locked: boolean;
  tenantId: string;
  meterShots: number;
}) {
  const { run } = useAction();
  const [meterIn, setMeterIn] = useState(initialIn?.toString() ?? '');
  const [meterOut, setMeterOut] = useState(initialOut?.toString() ?? '');
  const save = (patch: Parameters<typeof updateJob>[1]) => updateJob(jobId, patch);
  const quiet = { quiet: true };
  const unit = meterUnit === 'mth' ? 'mth' : 'km';

  return (
    <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
      <Field label={`Pri prijemu (${unit})`}>
        <Input
          inputMode="decimal"
          value={meterIn}
          disabled={locked}
          onChange={(e) => setMeterIn(e.target.value)}
          onBlur={() => {
            const value = meterIn ? Number(meterIn.replace(',', '.')) : null;
            if (value !== initialIn && (value === null || !Number.isNaN(value))) run(() => save({ meter_in: value }), quiet);
          }}
        />
      </Field>
      <Field label={`Pri predaji (${unit})`}>
        <Input
          inputMode="decimal"
          value={meterOut}
          disabled={locked}
          onChange={(e) => setMeterOut(e.target.value)}
          onBlur={() => {
            const value = meterOut ? Number(meterOut.replace(',', '.')) : null;
            if (value !== initialOut && (value === null || !Number.isNaN(value))) run(() => save({ meter_out: value }), quiet);
          }}
        />
      </Field>
      {!locked ? (
        <div className="sm:col-span-2">
          <ShotButton tenantId={tenantId} jobId={jobId} tag="meter" caption="Brojilo" label="Fotografija brojila" count={meterShots} />
        </div>
      ) : null}
    </div>
  );
}
