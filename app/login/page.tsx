import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { BrandLogo, ProductMark } from '@/components/ProductMark';
import { BRAND, matchPackageFromHost } from '@/config/tenant.config';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Prijava' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // A product domain shows its product; any other address the TaktIX brand.
  const pkg = matchPackageFromHost((await headers()).get('host'));
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 pb-safe pt-safe">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        {pkg ? (
          <>
            <ProductMark id={pkg.id} />
            <span className="font-semibold tracking-tight">{pkg.product}</span>
          </>
        ) : (
          <BrandLogo />
        )}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Prijava</h1>
      <p className="mb-6 mt-1 text-sm text-muted">E-mail i lozinka koje ste dobili od voditelja servisa.</p>
      <LoginForm next={safeNext} />
      <p className="mt-6 text-sm text-muted">
        Nova radionica?{' '}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Registrirajte se
        </Link>
      </p>
    </main>
  );
}
