'use client';

import { useState } from 'react';
import { useAction } from '@/components/client-ui';
import { Button, Field, Input } from '@/components/ui';
import { setForwardFrom } from '@/lib/actions/phone';

// The owner's mobile on the shared Poslar number: calls it forwards are
// answered in this workshop's name.
export function ForwardFromForm({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ? `+${current}` : '');
  const { pending, run } = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setForwardFrom(value), { success: value.trim() ? 'Broj spremljen' : 'Broj uklonjen' });
      }}
    >
      <Field label="Mobitel s kojeg preusmjeravate pozive" className="min-w-0 flex-1">
        <Input type="tel" inputMode="tel" autoComplete="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder="091 234 5678" />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        Spremi
      </Button>
    </form>
  );
}
