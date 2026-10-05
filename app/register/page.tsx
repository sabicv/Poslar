import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { BrandLogo, ProductMark } from '@/components/ProductMark';
import { PACKAGE_IDS, matchPackageFromHost, resolvePackageFromHost, type PackageId } from '@/config/tenant.config';
import { supportWhatsApp } from '@/lib/billing';
import { createAdminClient } from '@/lib/supabase/admin';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Isprobaj besplatno' };

// Two ways in: the workshop's own, empty, 30 days free (the main one), or
// the demo full of examples from the trade for 24 hours (?demo=1).
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ paket?: string; ref?: string; demo?: string }> }) {
  const host = (await headers()).get('host');
  const matched = matchPackageFromHost(host);
  const pkg = resolvePackageFromHost(host);
  const { paket, ref, demo: demoParam } = await searchParams;
  const demo = demoParam === '1';
  // A link from another workshop ("Preporučite TaktiX"): say who sent it.
  const referral = ref && /^\d{1,9}$/.test(ref) ? ref : '';
  const { data: referrer } = referral ? await createAdminClient().from('tenants').select('name').eq('billing_ref', Number(referral)).maybeSingle() : { data: null };
  // On a product domain the package is fixed; elsewhere (localhost,
  // previews) the visitor picks one.
  const initial = matched?.id ?? (PACKAGE_IDS.includes(paket as PackageId) ? (paket as PackageId) : pkg.id);
  const chat = supportWhatsApp('Pozdrav, zapelo mi je kod registracije u TaktiX. ');
  // The other way in, keeping the trade and who sent the link.
  const other = new URLSearchParams({ ...(paket ? { paket } : {}), ...(referral ? { ref: referral } : {}), ...(demo ? {} : { demo: '1' }) }).toString();

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
      <h1 className="text-balance font-display text-3xl font-bold tracking-tight">{demo ? 'Isprobaj demo s izmišljenim podacima' : 'Isprobaj TaktiX 30 dana besplatno'}</h1>
      <p className="mb-6 mt-2 text-sm text-muted">
        {demo
          ? 'Otvori radionicu napunjenu primjerima iz tvoje struke i uvjeri se kako sustav olakšava rad. Demo traje 24 sata.'
          : 'Otvori svoju radionicu i odmah radi na pravim poslovima. Kartica nije potrebna.'}
      </p>
      {referrer ? <p className="mb-5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">Preporučila te je radionica {referrer.name as string}.</p> : null}
      <RegisterForm initialPackage={initial} packageLocked={matched !== null} referral={referrer ? referral : ''} demo={demo} />
      <p className="mt-6 text-sm text-muted">
        {demo ? 'Radije odmah na prave poslove? ' : 'Radije prvo razgledati primjere? '}
        <Link href={`/register${other ? `?${other}` : ''}`} className="font-medium text-accent hover:underline">
          {demo ? '30 dana besplatno' : 'Demo s izmišljenim podacima'}
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        Već imaš račun?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Prijava
        </Link>
      </p>
      {chat ? (
        <p className="mt-2 text-sm text-muted">
          Zapelo?{' '}
          <a href={chat} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
            Piši nam na WhatsApp
          </a>
        </p>
      ) : null}
      <div className="mb-10" />
    </main>
  );
}
