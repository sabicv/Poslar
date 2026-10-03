import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { BrandLogo, ProductMark } from '@/components/ProductMark';
import { BRAND, PACKAGE_IDS, matchPackageFromHost, resolvePackageFromHost, type PackageId } from '@/config/tenant.config';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Registracija' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ paket?: string }> }) {
  const host = (await headers()).get('host');
  const matched = matchPackageFromHost(host);
  const pkg = resolvePackageFromHost(host);
  const { paket } = await searchParams;
  // On a product domain the package is fixed; elsewhere (localhost,
  // previews) the visitor picks one.
  const initial = matched?.id ?? (PACKAGE_IDS.includes(paket as PackageId) ? (paket as PackageId) : pkg.id);
  const trialDays = Number(process.env.TRIAL_DAYS ?? 30) || 30;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-safe pt-safe">
      <Link href="/" className="mb-8 mt-10 flex items-center gap-2.5">
        {matched ? (
          <>
            <ProductMark id={matched.id} />
            <span className="font-semibold tracking-tight">{matched.product}</span>
          </>
        ) : (
          <BrandLogo />
        )}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Registracija radionice</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        {trialDays} dana besplatno, bez kartice. Vi ste voditelj servisa; radnike dodajete u Postavkama.
      </p>
      <RegisterForm initialPackage={initial} packageLocked={matched !== null} />
      <p className="mb-10 mt-6 text-sm text-muted">
        Već imate račun?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Prijava
        </Link>
      </p>
    </main>
  );
}
