'use client';

import { useState } from 'react';
import { Archive, PackageOpen } from 'lucide-react';
import { ConfirmButton, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select } from '@/components/ui';
import { saveRecord } from '@/lib/actions/records';

// Check a tyre set into the hotel (stay + set status) or hand it back.
export function StorageActions({
  setId,
  stayId,
  locations,
  seasonLabel,
  jobId,
}: {
  setId: string;
  stayId: string | null;
  locations: { value: string; label: string }[];
  seasonLabel: string;
  jobId: string | null;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(locations[0]?.value ?? '');
  const [label, setLabel] = useState(seasonLabel);
  const [contract, setContract] = useState(true);
  const revalidate = jobId ? `/app/jobs/${jobId}` : '/app/module';

  if (stayId) {
    return (
      <ConfirmButton
        variant="secondary"
        confirmLabel="Izdati set?"
        onConfirm={() =>
          run(
            async () => {
              const out = await saveRecord('wheel_storage_stays', { checked_out_at: '__now__' }, { id: stayId, revalidate });
              if (!out.ok) return out;
              return saveRecord('wheel_tire_sets', { status: 'on_vehicle' }, { id: setId, revalidate });
            },
            { success: 'Set izdan iz hotela' }
          )
        }
      >
        <PackageOpen className="size-4" /> Izdaj
      </ConfirmButton>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Zaprimi na čuvanje"
      trigger={
        <Button size="sm" variant="primary" disabled={!locations.length}>
          <Archive className="size-4" /> Uskladišti
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Mjesto (sektor-regal-polica-mjesto)">
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sezona">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm">
          <input type="checkbox" checked={contract} onChange={(e) => setContract(e.target.checked)} className="size-5" />
          Stranka je potpisala potvrdu o zaprimanju
        </label>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending || !location}
          onClick={() =>
            run(
              async () => {
                const stay = await saveRecord('wheel_storage_stays', { set_id: setId, location_id: location, season_label: label, contract_signed: contract }, { revalidate });
                if (!stay.ok) return stay;
                return saveRecord('wheel_tire_sets', { status: 'stored' }, { id: setId, revalidate });
              },
              { success: 'Set uskladišten', onDone: () => setOpen(false) }
            )
          }
        >
          Zaprimi
        </Button>
      </div>
    </Sheet>
  );
}
