'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input } from '@/components/ui';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setPending(false);
      setError(/invalid/i.test(signInError.message) ? 'Pogrešan e-mail ili lozinka.' : 'Prijava nije uspjela. Provjerite vezu.');
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="E-mail">
        <Input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Lozinka">
        <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Prijavljujem…' : 'Prijavi se'}
      </Button>
    </form>
  );
}
