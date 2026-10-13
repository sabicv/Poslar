'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductMark } from '@/components/ProductMark';
import { Button, Field, Input } from '@/components/ui';
import { PACKAGES, TRADE_GROUPS, accentStyle, tradeGroupOf, type PackageId } from '@/config/tenant.config';
import { registerWorkshop } from '@/lib/actions/public';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// The sign-up: name, e-mail, password and the trade. The workshop opens
// empty, for 30 free days (the demo opens without a form: /isprobaj).
export function RegisterForm({ initialPackage, packageLocked, referral = '' }: { initialPackage: PackageId; packageLocked: boolean; referral?: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState<PackageId>(initialPackage);
  const group = TRADE_GROUPS.find((g) => g.id === tradeGroupOf(pkg))!;
  const [form, setForm] = useState({ workshopName: '', fullName: '', email: '', password: '', phone: '', city: '', oib: '', website: '' });
  const [accept, setAccept] = useState(false);
  const [news, setNews] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const openedAt = useRef(Date.now());

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await registerWorkshop({ ...form, package: pkg, acceptTerms: accept as true, news, elapsedMs: Date.now() - openedAt.current, referral });
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
      <Field label="Ime i prezime">
        <Input required autoComplete="name" value={form.fullName} onChange={set('fullName')} />
      </Field>
      <Field label="Naziv radionice" hint="Ako ostavite prazno, radionica nosi Vaše ime.">
        <Input autoComplete="organization" value={form.workshopName} onChange={set('workshopName')} />
      </Field>
      <Field label="E-mail adresa">
        <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
      </Field>
      <Field label="Lozinka" hint="Barem 8 znakova.">
        <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
      </Field>

      {!packageLocked ? (
        <div className="space-y-2">
          <span className="block text-xs font-medium text-muted">Odabir struke</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
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
          <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
            {group.packages.map((id) => PACKAGES[id]).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPkg(p.id)}
                aria-pressed={pkg === p.id}
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
        </div>
      ) : null}

      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={set('website')} />
      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--accent))]" />
          <span>
            Prihvaćam{' '}
            <a href="/uvjeti" target="_blank" className="font-medium text-accent hover:underline">
              Uvjete korištenja
            </a>{' '}
            i{' '}
            <a href="/obrada-podataka" target="_blank" className="font-medium text-accent hover:underline">
              Ugovor o obradi podataka
            </a>
            .
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--accent))]" />
          <span>Želim primati obavijesti o novim funkcionalnostima.</span>
        </label>
      </div>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Otvaram radionicu…' : 'Otvori radionicu'}
      </Button>
      <p className="text-center text-xs text-faint">
        Kako čuvamo podatke:{' '}
        <a href="/privatnost" target="_blank" className="hover:underline">
          Politika privatnosti
        </a>
        .
      </p>
    </form>
  );
}
