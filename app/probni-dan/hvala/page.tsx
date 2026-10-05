import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '@/components/ProductMark';
import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Hvala' };

// After a review: the trial workshop and its login are gone.
export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8 pb-safe pt-safe">
      <BrandLogo className="mb-8" />
      <CheckCircle2 className="size-10 text-ok" />
      <h1 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight">Hvala Vam na povratnoj informaciji.</h1>
      <p className="mt-2 text-muted">Vaši probni podaci uspješno su obrisani.</p>
      <ButtonLink href="/" className="mt-8 self-start">
        Početna stranica
      </ButtonLink>
    </main>
  );
}
