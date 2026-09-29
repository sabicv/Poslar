'use client';

import { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Segmented, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input, Select } from '@/components/ui';
import { PACKAGES, type PackageId } from '@/config/tenant.config';
import { adminCreateWorkshop, adminExtendTrial, adminSetPackage, adminSetStatus } from '@/lib/actions/admin';

export function CreateWorkshop() {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const empty = { package: 'volt' as PackageId, workshopName: '', fullName: '', email: '', password: '', status: 'active' as 'trial' | 'active', trialDays: 30, city: '', oib: '', phone: '' };
  const [v, setV] = useState(empty);
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [key]: e.target.value }));

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Nova radionica"
      trigger={
        <Button variant="primary">
          <Plus className="size-4" /> Otvori radionicu
        </Button>
      }
    >
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => adminCreateWorkshop({ ...v, trialDays: Number(v.trialDays) || 30 }), {
            success: 'Radionica otvorena — pošaljite vlasniku e-mail i lozinku',
            onDone: () => {
              setOpen(false);
              setV(empty);
            },
          });
        }}
      >
        <Field label="Paket" className="col-span-2">
          <Select value={v.package} onChange={set('package')}>
            {Object.values(PACKAGES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.product} — {p.tagline}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Naziv radionice" className="col-span-2">
          <Input value={v.workshopName} onChange={set('workshopName')} />
        </Field>
        <Field label="Grad">
          <Input value={v.city} onChange={set('city')} />
        </Field>
        <Field label="OIB">
          <Input value={v.oib} maxLength={11} onChange={set('oib')} />
        </Field>
        <Field label="Vlasnik — ime i prezime" className="col-span-2">
          <Input value={v.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="E-mail vlasnika">
          <Input type="email" value={v.email} onChange={set('email')} />
        </Field>
        <Field label="Telefon">
          <Input value={v.phone} onChange={set('phone')} />
        </Field>
        <Field label="Početna lozinka" className="col-span-2">
          <Input value={v.password} onChange={set('password')} />
        </Field>
        <div className="col-span-2">
          <Segmented
            value={v.status}
            onChange={(status) => setV((s) => ({ ...s, status }))}
            options={[
              { value: 'active', label: 'Aktivna (plaća)' },
              { value: 'trial', label: 'Proba' },
            ]}
          />
        </div>
        {v.status === 'trial' ? (
          <Field label="Dana probe">
            <Input inputMode="numeric" value={String(v.trialDays)} onChange={(e) => setV((s) => ({ ...s, trialDays: Number(e.target.value.replace(/\D/g, '')) || 0 }))} />
          </Field>
        ) : null}
        <Button type="submit" variant="primary" size="lg" className="col-span-2" disabled={pending}>
          Otvori radionicu
        </Button>
      </form>
    </Sheet>
  );
}

export function TenantActions({ id, status, pkg, note }: { id: string; status: 'trial' | 'active' | 'suspended'; pkg: PackageId; note: string | null }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(note ?? '');
  const [pack, setPack] = useState(pkg);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Upravljanje radionicom"
      trigger={
        <Button size="sm" variant="ghost" aria-label="Upravljanje">
          <Settings2 className="size-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Button variant={status === 'active' ? 'ok' : 'secondary'} disabled={pending} onClick={() => run(() => adminSetStatus(id, 'active', null), { success: 'Aktivirano' })}>
            Aktiviraj
          </Button>
          <Button disabled={pending} onClick={() => run(() => adminExtendTrial(id, 14), { success: 'Proba produljena 14 dana' })}>
            +14 d probe
          </Button>
          <Button variant="danger" disabled={pending || status === 'suspended'} onClick={() => run(() => adminSetStatus(id, 'suspended', reason), { success: 'Radionica isključena' })}>
            Isključi
          </Button>
        </div>
        <Field label="Razlog isključenja (interno)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. neplaćena pretplata za rujan" />
        </Field>
        <Field label="Paket" hint="Promjena paketa mijenja izbornike i obrasce. Podaci ostaju.">
          <div className="flex gap-2">
            <Select value={pack} onChange={(e) => setPack(e.target.value as PackageId)}>
              {Object.values(PACKAGES).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product}
                </option>
              ))}
            </Select>
            <Button disabled={pending || pack === pkg} onClick={() => run(() => adminSetPackage(id, pack), { success: 'Paket promijenjen' })}>
              Promijeni
            </Button>
          </div>
        </Field>
        <p className="text-xs text-faint">Isključena radionica ne vidi ništa, ali se podaci ne brišu. Aktivacijom se sve vraća.</p>
      </div>
    </Sheet>
  );
}
