'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { setNewPassword } from '@/lib/actions/password';

export function NewPasswordForm() {
  const router = useRouter();
  const [v, setV] = useState({ password: '', repeat: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await setNewPassword(v);
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    toast.success('Lozinka je promijenjena');
    router.replace('/app');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nova lozinka" hint="Barem 8 znakova.">
        <Input type="password" autoComplete="new-password" required minLength={8} value={v.password} onChange={(e) => setV((s) => ({ ...s, password: e.target.value }))} />
      </Field>
      <Field label="Ponovite lozinku">
        <Input type="password" autoComplete="new-password" required value={v.repeat} onChange={(e) => setV((s) => ({ ...s, repeat: e.target.value }))} />
      </Field>
      {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Spremam…' : 'Spremi lozinku'}
      </Button>
    </form>
  );
}
