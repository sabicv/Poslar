'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductMark } from '@/components/ProductMark';
import { Button, Field, Input } from '@/components/ui';
import { PACKAGES, TRADE_GROUPS, accentStyle, tradeGroupOf, type PackageId } from '@/config/tenant.config';
import { registerWorkshop } from '@/lib/actions/public';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function RegisterForm({ initialPackage, packageLocked }: { initialPackage: PackageId; packageLocked: boolean }) {
  const router = useRouter();
  const [pkg, setPkg] = useState<PackageId>(initialPackage);
  const group = TRADE_GROUPS.find((g) => g.id === tradeGroupOf(pkg))!;
  const [form, setForm] = useState({ workshopName: '', fullName: '', email: '', password: '', phone: '', city: '', oib: '', website: '' });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const openedAt = useRef(Date.now());

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await registerWorkshop({ ...form, package: pkg, acceptTerms: accept as true, elapsedMs: Date.now() - openedAt.current });
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    if (result.data?.confirmEmail) {
      setCheckEmail(true);
      return;
    }
    const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password });
    if (signInError) {
      router.replace('/login');
      return;
    }
    router.replace('/app');
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="rounded-2xl border border-ok/40 bg-ok/10 p-5 text-sm">
        <p className="font-medium text-fg">Provjerite e-mail</p>
        <p className="mt-1 text-muted">
          Poslali smo poveznicu za potvrdu na {form.email}. Nakon potvrde prijavite se e-mailom i lozinkom. Ako poruka ne stigne za nekoliko minuta, pogledajte i mapu neželjene pošte.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!packageLocked ? (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted">Kako radite?</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
            {TRADE_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setPkg(g.packages.includes(pkg) ? pkg : g.packages[0])}
                aria-pressed={group.id === g.id}
                className={cn('h-10 rounded-lg text-sm font-medium transition-colors', group.id === g.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg')}
              >
                {g.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">{group.hint}</p>
          <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
            {group.packages.map((id) => PACKAGES[id]).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPkg(p.id)}
                style={accentStyle(p)}
                className={cn(
                  'accent-scope flex items-center gap-2 rounded-xl border bg-surface p-2.5 text-left text-sm transition-colors',
                  pkg === p.id ? 'border-accent' : 'border-line hover:border-faint/60'
                )}
              >
                <ProductMark id={p.id} className="size-7" />
                <span className="font-medium">{p.short}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">{PACKAGES[pkg].tagline}</p>
        </div>
      ) : null}

      <Field label="Naziv radionice">
        <Input required value={form.workshopName} onChange={set('workshopName')} placeholder="npr. Autoservis Horvat" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grad">
          <Input value={form.city} onChange={set('city')} />
        </Field>
        <Field label="OIB (nije obavezno)">
          <Input inputMode="numeric" maxLength={11} value={form.oib} onChange={set('oib')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vaše ime i prezime">
          <Input required autoComplete="name" value={form.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="Telefon">
          <Input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </Field>
      </div>
      <Field label="E-mail (za prijavu)">
        <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
      </Field>
      <Field label="Lozinka" hint="Barem 8 znakova.">
        <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
      </Field>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={set('website')} />
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 size-5 accent-[rgb(var(--accent))]" />
        <span>Prihvaćam uvjete korištenja i obradu podataka radionice radi pružanja usluge.</span>
      </label>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Stvaram radionicu…' : `Otvori ${PACKAGES[pkg].product}`}
      </Button>
    </form>
  );
}
