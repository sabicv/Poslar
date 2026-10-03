'use client';

import { useState } from 'react';
import { Warehouse } from 'lucide-react';
import { DictateInput, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select } from '@/components/ui';
import { saveRecord } from '@/lib/actions/records';

// Put a bike or boat into storage: a place from the list, or one typed in
// words ("Hala B, uz zid") that is remembered for next time.
export function StoreSheet({ assetId, locations, revalidate }: { assetId: string; locations: { value: string; label: string }[]; revalidate: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(locations.length === 0);
  const [location, setLocation] = useState(locations[0]?.value ?? '');
  const [place, setPlace] = useState('');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState('');

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Smještaj"
      trigger={
        <Button size="sm" variant="secondary">
          <Warehouse className="size-4" /> Smjesti
        </Button>
      }
    >
      <div className="space-y-4">
        {manual ? (
          <Field label="Mjesto" hint="Npr. „Hala B, uz zid” ili „Vani, mjesto 4”.">
            <DictateInput value={place} onValue={setPlace} placeholder="Gdje će stajati" />
          </Field>
        ) : (
          <Field label="Mjesto">
            <Select value={location} onChange={(e) => setLocation(e.target.value)}>
              {locations.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {locations.length ? (
          <button type="button" className="-mt-2 text-sm font-medium text-accent" onClick={() => setManual((m) => !m)}>
            {manual ? 'Odaberi s popisa' : 'Upiši mjesto ručno'}
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Od">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Do (planirano)">
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={pending || !from || (manual ? !place.trim() : !location)}
          onClick={() =>
            run(
              async () => {
                let locationId = location;
                if (manual) {
                  // The words are the place; "-" fills the slot the list uses for numbered places.
                  const spot = await saveRecord('moto_storage_locations', { area: place.trim(), slot: '-' }, { upsertOn: 'tenant_id,area,slot' });
                  if (!spot.ok) return spot;
                  locationId = spot.data!.id;
                }
                return saveRecord('moto_storage_stays', { asset_id: assetId, location_id: locationId, from_date: from, until_date: until || null }, { revalidate });
              },
              { success: 'Smješteno', onDone: () => setOpen(false) }
            )
          }
        >
          Smjesti
        </Button>
      </div>
    </Sheet>
  );
}
