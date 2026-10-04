import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/ProductMark';
import { isDemoUser } from '@/lib/demo';
import { getAuth } from '@/lib/session';
import { NewPasswordForm } from './NewPasswordForm';

export const metadata: Metadata = { title: 'Nova lozinka' };

// Setting a new password: after the e-mail link (which signs the person
// in) or from Postavke → Moj račun → Promijeni lozinku.
export default async function NewPasswordPage() {
  const { user } = await getAuth();
  if (!user) redirect('/zaboravljena-lozinka');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 pb-safe pt-safe">
      <Link href="/app" className="mb-8">
        <BrandLogo />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nova lozinka</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Za račun {user.email}</p>
      {isDemoUser(user) ? <p className="text-sm text-muted">Demo računi imaju zajedničku lozinku, ona se ne mijenja.</p> : <NewPasswordForm />}
      <Link href="/app" className="mt-6 text-sm text-faint hover:text-fg">
        ← Natrag u aplikaciju
      </Link>
    </main>
  );
}
