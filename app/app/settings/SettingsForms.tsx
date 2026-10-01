'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Moon, Sun, Upload, UserPlus } from 'lucide-react';
import { ConfirmButton, Segmented, Sheet, useAction } from '@/components/client-ui';
import { Badge, Button, Field, Input } from '@/components/ui';
import { createStaff, removeStaff, resetStaffPassword, setOptionalModule, setStaffRole, setTenantLogo, updateBilling, updateMyProfile, updateTenant } from '@/lib/actions/settings';
import { randomId } from '@/lib/ids';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function ProfileForm({ fullName, phone, fgasCertificate }: { fullName: string; phone: string; fgasCertificate?: string }) {
  const { pending, run } = useAction();
  const [v, setV] = useState({ full_name: fullName, phone, fgas_certificate: fgasCertificate ?? '' });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateMyProfile(fgasCertificate === undefined ? { full_name: v.full_name, phone: v.phone } : v), { success: 'Spremljeno' });
      }}
    >
      <Field label="Ime i prezime">
        <Input value={v.full_name} onChange={(e) => setV((s) => ({ ...s, full_name: e.target.value }))} />
      </Field>
      <Field label="Telefon">
        <Input type="tel" value={v.phone} onChange={(e) => setV((s) => ({ ...s, phone: e.target.value }))} />
      </Field>
      {fgasCertificate !== undefined ? (
        <Field label="Broj F-plin certifikata" hint="Sam se upisuje u evidenciju F-plina i izvještaj klijentu.">
          <Input value={v.fgas_certificate} onChange={(e) => setV((s) => ({ ...s, fgas_certificate: e.target.value }))} />
        </Field>
      ) : null}
      <Button type="submit" disabled={pending}>
        Spremi
      </Button>
    </form>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);
  function apply(next: 'dark' | 'light') {
    setTheme(next);
    if (next === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
  }
  return (
    <Segmented
      value={theme}
      onChange={apply}
      size="lg"
      options={[
        { value: 'dark', label: <span className="flex items-center gap-2"><Moon className="size-4" /> Tamno</span> },
        { value: 'light', label: <span className="flex items-center gap-2"><Sun className="size-4" /> Svijetlo</span> },
      ]}
    />
  );
}

export function WorkshopForm({ tenant }: { tenant: { name: string; oib: string; phone: string; email: string; address: string; city: string } }) {
  const { pending, run } = useAction();
  const [v, setV] = useState(tenant);
  const set = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [key]: e.target.value }));
  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateTenant(v), { success: 'Podaci radionice spremljeni' });
      }}
    >
      <Field label="Naziv" className="col-span-2">
        <Input value={v.name} onChange={set('name')} />
      </Field>
      <Field label="OIB">
        <Input inputMode="numeric" maxLength={11} value={v.oib} onChange={set('oib')} />
      </Field>
      <Field label="Telefon">
        <Input value={v.phone} onChange={set('phone')} />
      </Field>
      <Field label="E-mail" className="col-span-2">
        <Input type="email" value={v.email} onChange={set('email')} />
      </Field>
      <Field label="Adresa">
        <Input value={v.address} onChange={set('address')} />
      </Field>
      <Field label="Grad">
        <Input value={v.city} onChange={set('city')} />
      </Field>
      <div className="col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          Spremi
        </Button>
      </div>
    </form>
  );
}

// IBAN, VAT status and a line of text for the invoice.
export function BillingForm({ billing }: { billing: { iban: string; vatRegistered: boolean; note: string } }) {
  const { pending, run } = useAction();
  const [v, setV] = useState(billing);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateBilling({ iban: v.iban, vat_registered: v.vatRegistered, invoice_note: v.note }), { success: 'Podaci za račun spremljeni' });
      }}
    >
      <Field label="IBAN (za plaćanje na račun)">
        <Input value={v.iban} onChange={(e) => setV((s) => ({ ...s, iban: e.target.value }))} placeholder="HR12 3456 7890 1234 5678 9" className="font-mono" />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={v.vatRegistered} onChange={(e) => setV((s) => ({ ...s, vatRegistered: e.target.checked }))} className="size-5" />
        Obrt je u sustavu PDV-a
      </label>
      <Field label="Napomena na računu (nije obavezno)">
        <Input value={v.note} maxLength={300} onChange={(e) => setV((s) => ({ ...s, note: e.target.value }))} placeholder="npr. Hvala na povjerenju!" />
      </Field>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          Spremi
        </Button>
      </div>
    </form>
  );
}

export function LogoUpload({ tenantId, logoUrl }: { tenantId: string; logoUrl: string | null }) {
  const { pending, run } = useAction();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error('Logo mora biti manji od 5 MB.');
    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${tenantId}/logo-${randomId()}.${ext}`;
      const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('branding').getPublicUrl(path);
      run(() => setTenantLogo(data.publicUrl), { success: 'Logo postavljen' });
    } catch {
      toast.error('Logo nije poslan. Pokušajte ponovno.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" /> : <span className="text-xs text-faint">Logo</span>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || pending} onClick={() => ref.current?.click()}>
          <Upload className="size-4" /> {logoUrl ? 'Promijeni' : 'Učitaj logo'}
        </Button>
        {logoUrl ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setTenantLogo(null), { success: 'Logo uklonjen' })}>
            Ukloni
          </Button>
        ) : null}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

export function TeamManager({ me, staff }: { me: string; staff: { id: string; name: string; role: 'owner' | 'worker' }[] }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ fullName: '', email: '', password: '', role: 'worker' as 'owner' | 'worker' });
  const [reset, setReset] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {staff.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm">
              {p.name} {p.id === me ? <span className="text-faint">(vi)</span> : null}
            </span>
            <Badge tone={p.role === 'owner' ? 'accent' : 'neutral'}>{p.role === 'owner' ? 'Voditelj' : 'Radnik'}</Badge>
            {p.id !== me ? (
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setStaffRole(p.id, p.role === 'owner' ? 'worker' : 'owner'), { success: 'Uloga promijenjena' })}>
                  {p.role === 'owner' ? 'U radnika' : 'U voditelja'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReset({ id: p.id, name: p.name })}>
                  Lozinka
                </Button>
                <ConfirmButton size="sm" variant="ghost" confirmLabel="Ukloniti?" onConfirm={() => run(() => removeStaff(p.id), { success: 'Djelatnik uklonjen' })}>
                  Ukloni
                </ConfirmButton>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Novi djelatnik"
        trigger={
          <Button variant="primary">
            <UserPlus className="size-4" /> Dodaj djelatnika
          </Button>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createStaff(v), {
              success: `Račun stvoren — pošaljite djelatniku e-mail i lozinku`,
              onDone: () => {
                setOpen(false);
                setV({ fullName: '', email: '', password: '', role: 'worker' });
              },
            });
          }}
        >
          <Field label="Ime i prezime">
            <Input value={v.fullName} onChange={(e) => setV((s) => ({ ...s, fullName: e.target.value }))} />
          </Field>
          <Field label="E-mail za prijavu">
            <Input type="email" value={v.email} onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))} />
          </Field>
          <Field label="Početna lozinka" hint="Barem 8 znakova. Djelatnik je kasnije može promijeniti preko Vas.">
            <Input value={v.password} onChange={(e) => setV((s) => ({ ...s, password: e.target.value }))} />
          </Field>
          <Segmented
            value={v.role}
            onChange={(role) => setV((s) => ({ ...s, role }))}
            options={[
              { value: 'worker', label: 'Radnik' },
              { value: 'owner', label: 'Voditelj' },
            ]}
          />
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
            Stvori račun
          </Button>
        </form>
      </Sheet>

      <Sheet open={reset !== null} onOpenChange={(o) => !o && setReset(null)} title={`Nova lozinka — ${reset?.name ?? ''}`}>
        <div className="space-y-3">
          <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Barem 8 znakova" />
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={pending || newPassword.length < 8}
            onClick={() => reset && run(() => resetStaffPassword(reset.id, newPassword), { success: 'Lozinka promijenjena', onDone: () => { setReset(null); setNewPassword(''); } })}
          >
            Postavi lozinku
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

export function ModuleToggles({ modules }: { modules: { id: string; label: string; on: boolean }[] }) {
  const { pending, run } = useAction();
  return (
    <ul className="space-y-2">
      {modules.map((m) => (
        <li key={m.id}>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm">
            <input type="checkbox" defaultChecked={m.on} disabled={pending} onChange={(e) => run(() => setOptionalModule(m.id, e.target.checked), { success: 'Spremljeno' })} className="size-5" />
            {m.label}
          </label>
        </li>
      ))}
    </ul>
  );
}
