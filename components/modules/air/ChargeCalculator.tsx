'use client';

import { useState } from 'react';
import { Calculator, ListPlus } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button, Card, CardHeader, Field, Input } from '@/components/ui';
import { extraCharge } from '@/config/packages/air';
import { addLine } from '@/lib/actions/jobs';
import { saveRecord } from '@/lib/actions/records';

const num = (v: string) => Number(v.replace(',', '.'));

// Extra refrigerant for installation longer than the factory pre-charge:
// deterministic formula, values from the unit's installation manual.
export function ChargeCalculator({ jobId, assetId, refrigerant, certificate }: { jobId: string; assetId: string; refrigerant: string; certificate: string }) {
  const { pending, run } = useAction();
  const [length, setLength] = useState('');
  const [precharged, setPrecharged] = useState('7');
  const [perMeter, setPerMeter] = useState('20');
  const grams = length ? extraCharge(num(length), num(precharged), num(perMeter)) : null;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Calculator className="size-4 text-accent" /> Dopuna za duljinu instalacije
          </span>
        }
        subtitle="Vrijednosti iz uputa za montažu"
      />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Duljina cijevi">
            <Input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} placeholder="m" />
          </Field>
          <Field label="Uključeno u punjenje">
            <Input inputMode="decimal" value={precharged} onChange={(e) => setPrecharged(e.target.value)} />
          </Field>
          <Field label="Dopuna po metru">
            <Input inputMode="decimal" value={perMeter} onChange={(e) => setPerMeter(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-faint">m · m · g/m</p>
        {grams !== null && !Number.isNaN(grams) ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
            <p className="text-sm">
              Dopuniti: <b className="text-lg tabular">{grams} g</b> {refrigerant}
            </p>
            {grams > 0 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => addLine(jobId, { kind: 'material', description: `Radna tvar ${refrigerant} — dopuna za ${length} m instalacije`, qty: grams, unit: 'g', approval: 'approved' }), {
                      success: 'Dodano u stavke',
                    })
                  }
                >
                  <ListPlus className="size-4" /> U stavke
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={pending || !certificate}
                  onClick={() =>
                    run(
                      () =>
                        saveRecord(
                          'air_fgas_log',
                          { job_id: jobId, asset_id: assetId, refrigerant, action: 'charge', quantity_kg: grams / 1000, leak_found: false, technician_cert: certificate, performed_at: '__now__' },
                          { revalidate: `/app/jobs/${jobId}` }
                        ),
                      { success: 'Upisano u evidenciju F-plina' }
                    )
                  }
                >
                  U evidenciju
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
