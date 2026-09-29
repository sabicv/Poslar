'use client';

import { useState } from 'react';
import { Diagram } from '@/components/Diagram';
import { Sheet } from '@/components/client-ui';
import { Badge } from '@/components/ui';
import { BODY_DAMAGE_TYPES, BODY_OPERATIONS, BODY_ZONES } from '@/config/packages/body';
import { deleteRecord, saveRecord } from '@/lib/actions/records';
import { QuickForm, opts } from '../kit';

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
const OP_LETTER: Record<string, string> = { repair: 'P', replace: 'Z', remove_install: 'S', refinish: 'L', polish: 'Po', pdr: 'D' };

export function BodyDamageMap({ estimateId, jobId, damages, readOnly }: { estimateId: string; jobId: string; damages: Damage[]; readOnly: boolean }) {
  const [zone, setZone] = useState<{ code: string; label: string } | null>(null);
  const path = `/app/jobs/${jobId}`;
  const byZone = new Map(damages.map((d) => [d.zone, d]));
  const marked = Object.fromEntries(damages.map((d) => [d.zone, [OP_LETTER[d.operation] ?? '•']]));
  const current = zone ? byZone.get(zone.code) : undefined;
  const label = (code: string) => BODY_ZONES.find((z) => z.code === code)?.label ?? code;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <Diagram kind="car" marked={marked} onZone={setZone} disabled={readOnly} />
        <ul className="space-y-2">
          {damages.length === 0 ? <li className="text-sm text-muted">Nema označenih dijelova.</li> : null}
          {damages.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setZone({ code: d.zone, label: label(d.zone) })}
                className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-left hover:border-faint/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{label(d.zone)}</span>
                  <Badge tone="accent">{BODY_OPERATIONS[d.operation]}</Badge>
                  {d.damage_type ? <Badge tone="warn">{BODY_DAMAGE_TYPES[d.damage_type]}</Badge> : null}
                </div>
                <p className="mt-1 text-xs tabular text-muted">
                  Lim {d.hours_body} h · priprema {d.hours_prep} h · lak {d.hours_paint} h · sastavljanje {d.hours_assembly} h
                </p>
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
              { name: 'size', label: 'Veličina', type: 'select', options: opts(SIZE), half: true },
              { name: 'operation', label: 'Operacija', type: 'select', options: opts(BODY_OPERATIONS), required: true },
              { name: 'hours_body', label: 'Limarija', type: 'number', suffix: 'h', half: true },
              { name: 'hours_prep', label: 'Priprema', type: 'number', suffix: 'h', half: true },
              { name: 'hours_paint', label: 'Lakiranje', type: 'number', suffix: 'h', half: true },
              { name: 'hours_assembly', label: 'Sastavljanje', type: 'number', suffix: 'h', half: true },
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
