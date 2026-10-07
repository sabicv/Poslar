'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AutoSaveTextarea, useAction } from '@/components/client-ui';
import { Card, Field, Input, Select } from '@/components/ui';
import type { MeterUnit } from '@/config/tenant.config';
import { updateJob } from '@/lib/actions/jobs';

function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Everything saves by itself (text a moment after typing, the rest on
// change). Core: the complaint and the work done. The rest shows with
// "Više" or once it holds something, so nothing entered is ever hidden.
// field: a visit at the client's address (no bay, the appointment replaces
// "promised by"); meter: the object has a km / hour meter (not a split AC).
export function OverviewEditor({
  job,
  staff,
  locked,
  field,
  meter,
  extras,
}: {
  field: boolean;
  meter: boolean;
  extras: boolean;
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
  // "Više polja" opens the rest right here, in the tab, not in the tab bar.
  const [more, setMore] = useState(extras);
  const save = (patch: Parameters<typeof updateJob>[1]) => updateJob(job.id, patch);
  const quiet = { quiet: true };

  const showNotes = more || Boolean(job.diagnosis_notes);
  // A worker picker only matters with more than one person in the workshop.
  const showWorker = !field && (staff.length > 1 || Boolean(job.assigned_to));
  const showPromised = !field && (more || Boolean(job.promised_at));
  const showMeter = meter && (more || job.meter_out !== null);
  const showBay = !field && (more || Boolean(job.bay));
  const showUrgent = more || job.is_urgent;
  // What "Više polja" would open, by name.
  const folded = [
    !showNotes && 'Bilješke',
    !field && !showPromised && 'Obećano do',
    meter && !showMeter && (job.meter_unit === 'mth' ? 'Motosati' : 'Kilometri'),
    !field && !showBay && 'Mjesto',
    !showUrgent && 'Hitno',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <AutoSaveTextarea label="Opis kvara" initial={job.complaint} disabled={locked} onSave={(v) => save({ complaint: v || null })} />
      </Card>
      <Card className="p-4">
        <AutoSaveTextarea label="Obavljeni radovi (vidi stranka)" initial={job.work_summary} rows={4} disabled={locked} placeholder="Što je napravljeno i preporuke" onSave={(v) => save({ work_summary: v || null })} />
      </Card>
      {showNotes ? (
        <Card className="p-4">
          <AutoSaveTextarea label="Bilješke (interno, stranka ne vidi)" initial={job.diagnosis_notes} rows={3} disabled={locked} placeholder="Mjerenja, zaključci, što je provjereno…" onSave={(v) => save({ diagnosis_notes: v || null })} />
        </Card>
      ) : null}
      {showWorker || showPromised || showMeter || showBay || showUrgent ? (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          {showWorker ? (
            <Field label="Radnik">
              <Select defaultValue={job.assigned_to ?? ''} disabled={locked} onChange={(e) => run(() => save({ assigned_to: e.target.value || null }), quiet)}>
                <option value="">Nije dodijeljeno</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {showPromised ? (
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
          ) : null}
          {showMeter ? (
            <Field label={`Stanje pri predaji (${job.meter_unit === 'mth' ? 'mth' : 'km'})`}>
              <Input
                inputMode="decimal"
                value={meterOut}
                disabled={locked}
                onChange={(e) => setMeterOut(e.target.value)}
                onBlur={() => {
                  const value = meterOut ? Number(meterOut.replace(',', '.')) : null;
                  if (value !== job.meter_out && (value === null || !Number.isNaN(value))) run(() => save({ meter_out: value }), quiet);
                }}
              />
            </Field>
          ) : null}
          {showBay ? (
            <Field label="Mjesto u radionici">
              <Input value={bay} disabled={locked} placeholder="npr. Dizalica 2" onChange={(e) => setBay(e.target.value)} onBlur={() => bay !== job.bay && run(() => save({ bay: bay || null }), quiet)} />
            </Field>
          ) : null}
          {showUrgent ? (
            <label className="flex min-h-12 items-center gap-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                defaultChecked={job.is_urgent}
                disabled={locked}
                onChange={(e) => run(() => save({ is_urgent: e.target.checked }), quiet)}
                className="size-5 accent-[rgb(var(--crit))]"
              />
              Hitno
            </label>
          ) : null}
        </Card>
      ) : null}
      {folded.length ? (
        <button
          type="button"
          onClick={() => setMore(true)}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-muted hover:text-fg"
        >
          <ChevronDown className="size-4 shrink-0" />
          Više polja: {folded.join(', ')}
        </button>
      ) : null}
    </div>
  );
}
