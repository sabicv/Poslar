'use client';

import { useRef, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { requestPasswordReset } from '@/lib/actions/password';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const openedAt = useRef(Date.now());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await requestPasswordReset({ email, website, elapsedMs: Date.now() - openedAt.current });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSent(result.data?.message ?? '');
  }

  if (sent) return <p className="rounded-xl border border-ok/40 bg-ok/10 px-3 py-3 text-sm">{sent}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="E-mail">
        <Input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Šaljem…' : 'Pošalji poveznicu'}
      </Button>
    </form>
  );
}
