'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAction } from '@/components/client-ui';
import { Button, Field, Input, Select } from '@/components/ui';
import type { PackageId } from '@/config/tenant.config';
import { addWorkshop } from '@/lib/actions/workshops';

// A new branch: name, trade, address. Everything else is set inside it.
export function AddWorkshopForm({ trades, current }: { trades: { group: string; items: { id: PackageId; name: string }[] }[]; current: PackageId }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [v, setV] = useState({ name: '', package: current, address: '', city: '' });
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [key]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addWorkshop(v), {
          success: `Radionica ${v.name.trim()} je spremna`,
          onDone: () => {
            router.push('/app');
            router.refresh();
          },
        });
      }}
    >
      <Field label="Naziv radionice">
        <Input value={v.name} onChange={set('name')} placeholder="npr. Autoservis Kovač Solin" required />
      </Field>
      <Field label="Zanat">
        <Select value={v.package} onChange={set('package')}>
          {trades.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Adresa">
          <Input value={v.address} onChange={set('address')} autoComplete="street-address" />
        </Field>
        <Field label="Mjesto">
          <Input value={v.city} onChange={set('city')} autoComplete="address-level2" />
        </Field>
      </div>
      <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={pending || v.name.trim().length < 2}>
        <Plus className="size-4" /> Dodaj radionicu
      </Button>
    </form>
  );
}
