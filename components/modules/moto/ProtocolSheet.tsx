'use client';

import { useState } from 'react';
import { Sheet } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { deleteRecord, saveRecord } from '@/lib/actions/records';
import { QuickForm } from '../kit';

const ANODES = { anode_leg: 'noga', anode_trim: 'trim', anode_hull: 'trup' } as const;

// Anode wear is stored as one JSON object ({"noga": 40, ...}); the form
// shows it as three plain number fields.
export function ProtocolSheet({
  id,
  jobId,
  fuelStabilized,
  batteryMaintained,
  anodes,
}: {
  id: string;
  jobId: string;
  fuelStabilized: boolean;
  batteryMaintained: boolean;
  anodes: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const path = `/app/jobs/${jobId}`;
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Protokol"
      trigger={
        <Button size="sm" variant="secondary">
          Podaci
        </Button>
      }
    >
      {open ? (
        <QuickForm
          initial={{
            fuel_stabilized: fuelStabilized,
            battery_maintained: batteryMaintained,
            anode_leg: anodes.noga,
            anode_trim: anodes.trim,
            anode_hull: anodes.trup,
          }}
          fields={[
            { name: 'fuel_stabilized', label: 'Stabilizator goriva dodan', type: 'checkbox' },
            { name: 'battery_maintained', label: 'Akumulator na održavanju / skinut', type: 'checkbox' },
            { name: 'anode_leg', label: 'Istrošenost anode noge', type: 'number', suffix: '%', half: true },
            { name: 'anode_trim', label: 'Anoda trima', type: 'number', suffix: '%', half: true },
            { name: 'anode_hull', label: 'Anoda trupa', type: 'number', suffix: '%', half: true },
          ]}
          onSubmit={(values) => {
            const wear: Record<string, number> = {};
            for (const [field, name] of Object.entries(ANODES)) {
              const v = values[field];
              if (typeof v === 'number') wear[name] = Math.max(0, Math.min(100, v));
            }
            return saveRecord(
              'moto_seasonal_protocols',
              { fuel_stabilized: values.fuel_stabilized, battery_maintained: values.battery_maintained, anodes_wear_pct: wear },
              { id, revalidate: path }
            );
          }}
          onDelete={() => deleteRecord('moto_seasonal_protocols', id, path)}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </Sheet>
  );
}
