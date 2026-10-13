'use client';

import { useState } from 'react';
import { Diagram, type DiagramKind } from '@/components/Diagram';
import { UndrawnZones } from '@/components/job/UndrawnZones';
import { Sheet } from '@/components/client-ui';
import { Badge } from '@/components/ui';
import { formatHours } from '@/lib/format';
import type { ConditionZone } from '@/config/tenant.config';
import { BODY_DAMAGE_TYPES, BODY_OPERATIONS, BODY_ZONES } from '@/config/packages/body';
import { deleteRecord, saveRecord } from '@/lib/actions/records';
import { QuickForm } from '../kit';
import { opts } from '../options';

interface Damage {
  id: string;
  zone: string;
  damage_type: string | null;
  size: string | null;
  operation: string;
  hours_body: number;
  hours_prep: number;
  hours_paint: number;
  hours_assembly: number;
  note: string | null;
}

const SIZE = { small: 'Malo', medium: 'Srednje', large: 'Veliko' };
const TYPE_LETTER: Record<string, string> = { scratch: 'O', dent: 'U', crack: 'P', deformation: 'B', break: 'L', corrosion: 'R', defect: 'D' };
const OP_LETTER: Record<string, string> = { repair: 'P', replace: 'Z', remove_install: 'S', refinish: 'L', polish: 'Po', pdr: 'D' };

export function BodyDamageMap({
  estimateId,
  jobId,
  damages,
  readOnly,
  kind = 'car',
  zones = BODY_ZONES,
  intakeMarks = [],
}: {
  estimateId: string;
  jobId: string;
  damages: Damage[];
  readOnly: boolean;
  kind?: DiagramKind;
  zones?: ConditionZone[];
  intakeMarks?: { zone: string; code: string }[];
}) {
  const [zone, setZone] = useState<{ code: string; label: string } | null>(null);
  const path = `/app/jobs/${jobId}`;
  const byZone = new Map(damages.map((d) => [d.zone, d]));
  const letterOf = (d: Damage) => (d.damage_type && TYPE_LETTER[d.damage_type]) || OP_LETTER[d.operation] || '•';
  const marked: Record<string, string[]> = {};
  for (const mark of intakeMarks) (marked[mark.zone] ??= []).push(mark.code);
  for (const damage of damages) marked[damage.zone] = [letterOf(damage)];
  const current = zone ? byZone.get(zone.code) : undefined;
  const label = (code: string) => zones.find((z) => z.code === code)?.label ?? code;
  const fromIntake = [...new Set(intakeMarks.map((mark) => mark.zone))].filter((code) => !byZone.has(code));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div>
          {kind === 'car' ? (
            <>
              <Diagram kind="car" marked={marked} onZone={setZone} disabled={readOnly} />
              <UndrawnZones kind="car" zones={zones} marked={marked} onZone={setZone} disabled={readOnly} />
            </>
          ) : (
            <Diagram kind={kind} zones={zones} marked={marked} onZone={setZone} disabled={readOnly} detail />
          )}
        </div>
        <ul className="space-y-2">
          {damages.length === 0 && fromIntake.length === 0 ? <li className="text-sm text-muted">Nema označenih dijelova.</li> : null}
          {fromIntake.map((code) => (
            <li key={code}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setZone({ code, label: label(code) })}
                className="flex w-full items-center gap-2 rounded-xl border border-[rgb(var(--orange))] bg-[rgb(var(--orange))]/10 px-3 py-2.5 text-left"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--orange))] font-mono text-sm font-bold text-white">{(marked[code] ?? ['•']).join('')}</span>
                <span className="min-w-0 flex-1 text-sm font-medium">{label(code)}</span>
                <span className="text-xs text-muted">S prijema</span>
              </button>
            </li>
          ))}
          {damages.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setZone({ code: d.zone, label: label(d.zone) })}
                className="flex w-full items-start gap-2 rounded-xl border border-[rgb(var(--orange))] bg-[rgb(var(--orange))]/10 px-3 py-2.5 text-left"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--orange))] font-mono text-sm font-bold text-white">{letterOf(d)}</span>
                <span className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{label(d.zone)}</span>
                  <Badge tone="accent">{BODY_OPERATIONS[d.operation]}</Badge>
                  {d.damage_type ? <Badge tone="warn">{BODY_DAMAGE_TYPES[d.damage_type]}</Badge> : null}
                </div>
                {d.hours_body + d.hours_prep + d.hours_paint + d.hours_assembly > 0 ? (
                  <p className="mt-1 text-xs tabular text-muted">
                    {(
                      [
                        ['Lim', d.hours_body],
                        ['priprema', d.hours_prep],
                        ['lak', d.hours_paint],
                        ['sastavljanje', d.hours_assembly],
                      ] as [string, number][]
                    )
                      .filter(([, hours]) => hours > 0)
                      .map(([name, hours]) => `${name} ${formatHours(hours)}`)
                      .join(' · ')}
                  </p>
                ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Sheet open={zone !== null} onOpenChange={(o) => !o && setZone(null)} title={zone?.label ?? ''}>
        {zone ? (
          <QuickForm
            key={zone.code}
            initial={current ? { ...current } : { operation: 'repair', hours_body: 0, hours_prep: 0, hours_paint: 0, hours_assembly: 0 }}
            fields={[
              { name: 'damage_type', label: 'Oštećenje', type: 'select', options: opts(BODY_DAMAGE_TYPES), half: true },
              { name: 'size', label: 'Veličina', type: 'select', options: opts(SIZE), half: true, extra: true },
              { name: 'operation', label: 'Operacija', type: 'select', options: opts(BODY_OPERATIONS), required: true },
              { name: 'hours_body', label: 'Limarija', type: 'hours' },
              { name: 'hours_prep', label: 'Priprema', type: 'hours' },
              { name: 'hours_paint', label: 'Lakiranje', type: 'hours' },
              { name: 'hours_assembly', label: 'Sastavljanje', type: 'hours' },
              { name: 'note', label: 'Napomena', type: 'textarea' },
            ]}
            onSubmit={(values) =>
              saveRecord(
                'body_panel_damages',
                {
                  ...values,
                  hours_body: values.hours_body ?? 0,
                  hours_prep: values.hours_prep ?? 0,
                  hours_paint: values.hours_paint ?? 0,
                  hours_assembly: values.hours_assembly ?? 0,
                  estimate_id: estimateId,
                  zone: zone.code,
                },
                { upsertOn: 'estimate_id,zone', revalidate: path }
              )
            }
            onDelete={current ? () => deleteRecord('body_panel_damages', current.id, path) : undefined}
            onDone={() => setZone(null)}
          />
        ) : null}
      </Sheet>
    </>
  );
}
