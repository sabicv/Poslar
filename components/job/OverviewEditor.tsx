'use client';

import { useState } from 'react';
import { AutoSaveTextarea, useAction } from '@/components/client-ui';
import { Card, Field, Input, Select } from '@/components/ui';
import type { MeterUnit } from '@/config/tenant.config';
import { updateJob } from '@/lib/actions/jobs';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// field: a visit at the client's address (no bay, the appointment replaces
// "promised by"); meter: the object has a km / hour meter (not a split AC).
export function OverviewEditor({
  job,
  staff,
  locked,
  field,
  meter,
}: {
  field: boolean;
  meter: boolean;
  job: {
    id: string;
    complaint: string;
    diagnosis_notes: string;
    work_summary: string;
    meter_out: number | null;
    meter_unit: MeterUnit | null;
    promised_at: string | null;
    bay: string;
    is_urgent: boolean;
    assigned_to: string | null;
  };
  staff: { id: string; name: string }[];
  locked: boolean;
}) {
  const { run } = useAction();
  const [meterOut, setMeterOut] = useState(job.meter_out?.toString() ?? '');
  const [bay, setBay] = useState(job.bay);
  const save = (patch: Parameters<typeof updateJob>[1]) => updateJob(job.id, patch);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="mb-1.5 text-xs font-medium text-muted">Opis kvara</p>
        <AutoSaveTextarea initial={job.complaint} disabled={locked} onSave={(v) => save({ complaint: v || null })} />
      </Card>
      <Card className="p-4">
        <p className="mb-1.5 text-xs font-medium text-muted">Bilješke (interno)</p>
        <AutoSaveTextarea initial={job.diagnosis_notes} rows={4} disabled={locked} placeholder="Mjerenja, zaključci, što je provjereno…" onSave={(v) => save({ diagnosis_notes: v || null })} />
      </Card>
      <Card className="p-4">
        <p className="mb-1.5 text-xs font-medium text-muted">Obavljeni radovi (vidi stranka)</p>
        <AutoSaveTextarea initial={job.work_summary} rows={4} disabled={locked} placeholder="Što je napravljeno i preporuke" onSave={(v) => save({ work_summary: v || null })} />
      </Card>
      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        {/* On a field visit the technician is chosen with the appointment. */}
        {field ? null : (
          <Field label="Radnik">
            <Select defaultValue={job.assigned_to ?? ''} disabled={locked} onChange={(e) => run(() => save({ assigned_to: e.target.value || null }), { success: 'Spremljeno' })}>
              <option value="">Nije dodijeljeno</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {field ? null : (
          <Field label="Obećano do">
            <Input
              type="datetime-local"
              defaultValue={toLocalInput(job.promised_at)}
              disabled={locked}
              onBlur={(e) => {
                const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                if (value !== job.promised_at) run(() => save({ promised_at: value }));
              }}
            />
          </Field>
        )}
        {meter ? (
          <Field label={`Stanje pri predaji (${job.meter_unit === 'mth' ? 'mth' : 'km'})`}>
            <Input
              inputMode="decimal"
              value={meterOut}
              disabled={locked}
              onChange={(e) => setMeterOut(e.target.value)}
              onBlur={() => {
                const value = meterOut ? Number(meterOut.replace(',', '.')) : null;
                if (value !== job.meter_out && (value === null || !Number.isNaN(value))) run(() => save({ meter_out: value }));
              }}
            />
          </Field>
        ) : null}
        {field ? null : (
          <Field label="Mjesto u radionici">
            <Input value={bay} disabled={locked} placeholder="npr. Dizalica 2" onChange={(e) => setBay(e.target.value)} onBlur={() => bay !== job.bay && run(() => save({ bay: bay || null }))} />
          </Field>
        )}
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            defaultChecked={job.is_urgent}
            disabled={locked}
            onChange={(e) => run(() => save({ is_urgent: e.target.checked }))}
            className="size-5 accent-[rgb(var(--crit))]"
          />
          Hitno
        </label>
      </Card>
    </div>
  );
}
