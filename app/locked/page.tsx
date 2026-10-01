import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui';
import { signOut } from '@/lib/actions/auth';
import { isDemoUser } from '@/lib/demo';
import { formatDate } from '@/lib/format';
import { getWorkshop, isPlatformAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'Pristup zaključan' };

const TEXT = {
  suspended: {
    title: 'Pristup je privremeno isključen',
    body: 'Podaci radionice su sačuvani i ništa nije obrisano. Za ponovno uključivanje javite se podršci.',
  },
  trial_ended: {
    title: 'Probno razdoblje je završilo',
    body: 'Hvala što ste isprobali aplikaciju. Svi nalozi, fotografije i mušterije su sačuvani — nakon aktivacije pretplate nastavljate točno gdje ste stali.',
  },
  no_workshop: {
    title: 'Račun nije povezan s radionicom',
    body: 'Ovaj račun nema radionicu. Ako ste radnik, zamolite voditelja servisa da Vas doda u Postavke → Tim.',
  },
};

export default async function LockedPage() {
  const state = await getWorkshop();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'active') redirect('/app');
  if (state.reason === 'no_workshop' && (await isPlatformAdmin())) redirect('/admin');
  if (state.reason === 'no_workshop' && isDemoUser(state.user)) redirect('/demo');

  const text = TEXT[state.reason];
  const contact = [process.env.SUPPORT_EMAIL, process.env.SUPPORT_PHONE].filter(Boolean).join(' · ');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pb-safe pt-safe">
      <span className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-muted">
        <Lock className="size-5" />
      </span>
      {state.name ? <p className="text-sm text-muted">{state.name}</p> : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{text.body}</p>
      {state.reason !== 'no_workshop' && state.role === 'worker' ? (
        <p className="mt-3 text-sm text-muted">Obavijestite voditelja servisa.</p>
      ) : null}
      {contact ? <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm">Podrška: {contact}</p> : null}
      <p className="mt-2 text-xs text-faint">Prijavljeni ste kao {state.user.email} · {formatDate(new Date().toISOString())}</p>
      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary">
          Odjava
        </Button>
      </form>
    </main>
  );
}
