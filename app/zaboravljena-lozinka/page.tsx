import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/ProductMark';
import { SupportWhatsApp } from '@/components/SupportWhatsApp';
import { support } from '@/lib/billing';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Zaboravljena lozinka' };

// With e-mail switched on (AUTH_EMAIL=1, Brevo through Supabase) a link
// comes by mail; until then Poslar support sends a new password on
// WhatsApp (Toranj → Radionice → Uredi → Nova lozinka).
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ istekla?: string }> }) {
  const { istekla } = await searchParams;
  const byEmail = process.env.AUTH_EMAIL === '1';
  const help = support();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 pb-safe pt-safe">
      <Link href="/" className="mb-8">
        <BrandLogo />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Zaboravljena lozinka</h1>
      {istekla ? <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">Poveznica je istekla ili je već iskorištena. Zatražite novu.</p> : null}
      {byEmail ? (
        <>
          <p className="mb-6 mt-1 text-sm text-muted">Upišite e-mail kojim se prijavljujete. Poveznica ide samo na taj račun, i samo ako postoji.</p>
          <ForgotForm />
        </>
      ) : (
        <>
          <p className="mb-6 mt-1 text-sm text-muted">Javite nam se i poslat ćemo Vam novu lozinku. Napišite e-mail kojim se prijavljujete.</p>
          <SupportWhatsApp message="Pozdrav, trebam novu lozinku za Poslar. E-mail kojim se prijavljujem: " label="Zatraži na WhatsAppu" variant="primary" size="lg" className="w-full" />
          {help.email ? <p className="mt-3 text-sm text-muted">Ili pišite na {help.email}.</p> : null}
        </>
      )}
      <p className="mt-6 text-sm text-muted">Radnik ste? Novu lozinku Vam može dati i voditelj servisa, u Postavke → Tim.</p>
      <Link href="/login" className="mt-4 text-sm text-faint hover:text-fg">
        ← Prijava
      </Link>
    </main>
  );
}
