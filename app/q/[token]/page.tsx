import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IntakeForm } from '@/components/intake/IntakeForm';
import { ProductMark } from '@/components/ProductMark';
import { accentStyle, identifierLabel } from '@/config/tenant.config';
import { loadIntake } from '@/lib/intake';

export const metadata: Metadata = { title: 'Prijava kvara', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// The page behind the door QR code: no account, the workshop is named by
// the token. A switched-off code shows only how to reach the workshop.
export default async function DoorIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await loadIntake(token);
  if (state.kind === 'missing') notFound();

  if (state.kind === 'off') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pb-safe pt-safe text-center">
        <h1 className="font-display text-2xl font-bold">{state.name}</h1>
        <p className="mt-2 text-muted">Prijava preko ovog koda trenutno nije uključena.</p>
        {state.phone ? (
          <a href={`tel:${state.phone.replace(/[^\d+]/g, '')}`} className="mx-auto mt-6 inline-flex h-12 items-center rounded-xl border border-line px-5 font-medium">
            Nazovite {state.phone}
          </a>
        ) : null}
      </main>
    );
  }

  const t = state.tenant;
  const field = t.pkg.sector === 'field';
  return (
    <main className="accent-scope mx-auto min-h-dvh max-w-md px-5 pb-safe pt-safe" style={accentStyle(t.pkg)}>
      <header className="flex items-center gap-3 py-5">
        {t.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo_url} alt="" className="size-11 rounded-xl object-contain" />
        ) : (
          <ProductMark id={t.pkg.id} className="size-11" />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{t.name}</p>
          <p className="truncate text-xs text-muted">{[t.address, t.city].filter(Boolean).join(', ')}</p>
        </div>
      </header>
      <h1 className="font-display text-3xl font-bold leading-tight">{field ? 'Zatražite dolazak' : 'Prijavite kvar bez čekanja'}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{field ? 'Recite što trebate, javimo se s terminom.' : 'Ostavite podatke, majstor Vas zove kad krene.'}</p>
      <IntakeForm
        token={token}
        workshop={t.name}
        workshopPhone={t.phone}
        field={field}
        symptoms={t.pkg.symptoms.slice(0, 8)}
        identifierLabel={identifierLabel(t.pkg.defaultAssetType)}
      />
      <p className="pt-8 text-center text-xs text-faint">
        Podatke šaljete radionici {t.name}, samo za ovaj posao.{' '}
        <a href="/privatnost" target="_blank" className="underline hover:text-fg">
          Privatnost
        </a>
      </p>
      <p className="pb-8 pt-1 text-center text-xs text-faint">Pokreće TaktiX</p>
    </main>
  );
}
