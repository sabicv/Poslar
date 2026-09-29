'use client';

import { useState } from 'react';
import { useAction } from '@/components/client-ui';
import { Button, Input } from '@/components/ui';
import { addMeterReading } from '@/lib/actions/clients';

export function MeterForm({ assetId, unit }: { assetId: string; unit: 'km' | 'mth' }) {
  const { pending, run } = useAction();
  const [value, setValue] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.replace(/\s/g, '').replace(',', '.'));
        if (!value || Number.isNaN(n)) return;
        run(() => addMeterReading(assetId, unit, n, null), { success: 'Očitanje spremljeno', onDone: () => setValue('') });
      }}
    >
      <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={unit === 'mth' ? 'Motosati' : 'Kilometri'} />
      <Button type="submit" disabled={pending || !value}>
        Dodaj
      </Button>
    </form>
  );
}
