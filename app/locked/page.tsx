import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PaymentInstructions } from '@/components/billing/PaymentInstructions';
import { SupportWhatsApp } from '@/components/SupportWhatsApp';
import { Button } from '@/components/ui';
import { monthlyPrice } from '@/config/plans';
import { signOut } from '@/lib/actions/auth';
import { support } from '@/lib/billing';
import { isDemoUser } from '@/lib/demo';
import { formatDate } from '@/lib/format';
import { isPlayApp } from '@/lib/play';
import { getWorkshop, isPlatformAdmin } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Pristup zaključan' };

const TEXT = {
  suspended: {
    title: 'Pristup je privremeno isključen',
    body: 'Podaci radionice su sačuvani i ništa nije obrisano. Za ponovno uključivanje javite se podršci.',
  },
  trial_ended: {
    title: 'Probno razdoblje je završilo',
    body: 'Hvala što ste isprobali aplikaciju. Svi nalozi, fotografije i mušterije su sačuvani. Nakon uplate pretplate nastavljate točno gdje ste stali.',
  },
  unpaid: {
    title: 'Pretplata nije plaćena',
    body: 'Svi nalozi, fotografije i mušterije su sačuvani. Čim uplata stigne, aplikacija se otključa i nastavljate gdje ste stali.',
  },
  no_workshop: {
    title: 'Račun nije povezan s radionicom',
    body: 'Ovaj račun nema radionicu. Ako ste radnik, zamolite voditelja servisa da Vas doda u Postavke → Tim.',
  },
};

const PLAY_BODY = 'Svi nalozi, fotografije i mušterije su sačuvani. Za nastavak se javite TaktiX podršci.';

export default async function LockedPage({ searchParams }: { searchParams: Promise<{ mj?: string }> }) {
  const state = await getWorkshop();
  if (state.kind === 'anonymous') redirect('/login');
  if (state.kind === 'active') redirect('/app');
  if (state.reason === 'no_workshop' && (await isPlatformAdmin())) redirect('/admin');
  if (state.reason === 'no_workshop' && isDemoUser(state.user)) redirect('/demo');

  // The Google Play app shows no way to pay (config/play.ts).
  const play = await isPlayApp();
  const text = play && (state.reason === 'trial_ended' || state.reason === 'unpaid') ? { ...TEXT[state.reason], body: PLAY_BODY } : TEXT[state.reason];
  const help = support();
  const contact = [help.email, help.phone].filter(Boolean).join(' · ');
  // The owner of a workshop whose trial or subscription ran out sees how to pay.
  const payable = !play && (state.reason === 'trial_ended' || state.reason === 'unpaid') && state.role === 'owner' && state.tenantId;
  // Read on the server: the database hides a locked workshop's row from its
  // own users, and the id comes from this user's own access, not the URL.
  const { data: tenant } = payable ? await createAdminClient().from('tenants').select('name, address, city, billing_ref, plan, billing_term').eq('id', state.tenantId!).maybeSingle() : { data: null };
  const { mj } = await searchParams;
  const months = mj === '6' ? 6 : mj === '12' ? 12 : 1;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8 pb-safe pt-safe">
      <span className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-muted">
        <Lock className="size-5" />
      </span>
      {state.name ? <p className="text-sm text-muted">{state.name}</p> : null}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{text.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{text.body}</p>
      {state.reason !== 'no_workshop' && state.role === 'worker' ? <p className="mt-3 text-sm text-muted">Obavijestite voditelja servisa.</p> : null}
      {tenant ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <p className="mb-3 font-medium">Uplata pretplate</p>
          <PaymentInstructions
            workshop={{ name: tenant.name as string, address: (tenant.address as string | null) ?? null, city: (tenant.city as string | null) ?? null, billingRef: tenant.billing_ref as number }}
            monthly={monthlyPrice(tenant.plan as string, tenant.billing_term as string)}
            months={months}
            linkBase="/locked"
          />
        </section>
      ) : null}
      {contact ? <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-sm">Podrška: {contact}</p> : null}
      <SupportWhatsApp message={`Pozdrav, ${state.name ? `ovdje ${state.name}. ` : ''}${text.title}. `} label="Pišite nam na WhatsApp" className="mt-3 self-start" />
      <p className="mt-2 text-xs text-faint">Prijavljeni ste kao {state.user.email} · {formatDate(new Date().toISOString())}</p>
      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary">
          Odjava
        </Button>
      </form>
    </main>
  );
}
