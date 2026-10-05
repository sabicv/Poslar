import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/ProductMark';
import { Button } from '@/components/ui';
import { accentStyle } from '@/config/tenant.config';
import { signOut } from '@/lib/actions/auth';
import { isGuestUser } from '@/lib/guest';
import { getWorkshop } from '@/lib/session';
import { SampleEndChoice } from './SampleEndChoice';

export const metadata: Metadata = { title: 'Probni period je završen' };

// After the 24-hour trial on examples the owner chooses how to go on.
export default async function SampleEndPage() {
  const state = await getWorkshop();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'active') redirect('/app');
  if (state.reason !== 'sample_ended') redirect('/locked');
  // The open demo ends here too, with a workshop of one's own to open.
  const guest = isGuestUser(state.user);

  return (
    <main className="accent-scope mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8 pb-safe pt-safe" style={state.pkg ? accentStyle(state.pkg) : undefined}>
      <BrandLogo className="mb-8" />
      <h1 className="text-balance font-display text-3xl font-bold tracking-tight">{guest ? 'Demo je završio.' : 'Probni period od 24 sata je završen.'}</h1>
      <p className="mb-6 mt-2 text-muted">{guest ? 'Hvala što ste isprobali TaktiX. Demo radionica se uskoro sama briše.' : 'Kako želite nastaviti?'}</p>
      {state.role === 'owner' ? (
        <SampleEndChoice registerHref={guest ? `/register?paket=${state.pkg?.id ?? ''}` : undefined} />
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">Voditelj radionice odlučuje kako dalje. Obavijestite ga.</p>
      )}
      <form action={signOut} className="mt-6 text-center">
        <Button type="submit" variant="ghost" size="sm">
          Odjava
        </Button>
      </form>
    </main>
  );
}
