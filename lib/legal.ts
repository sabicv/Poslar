import 'server-only';

// Who provides the service, from the server environment (the same company
// details as on the payment slip, plus its OIB). Address and OIB stay out
// when they are not set. The support mailbox is podrska@poslar.eu.
export interface Provider {
  name: string;
  street: string | null;
  city: string | null;
  oib: string | null;
  email: string | null;
  phone: string | null;
}

// The company's own settings: POSLAR_<key>, or the name used before the
// rebrand (TAKTIX_<key>) while Vercel still has that one.
export function companyEnv(key: 'IBAN' | 'PAYEE_NAME' | 'PAYEE_STREET' | 'PAYEE_CITY' | 'OIB'): string | null {
  return process.env[`POSLAR_${key}`]?.trim() || process.env[`TAKTIX_${key}`]?.trim() || null;
}

// The public mailbox. ImprovMX already forwards podrska@, info@ and vedran@
// to the same inbox. The site and the bills show this address.
export function supportEmail(): string {
  return process.env.SUPPORT_EMAIL?.trim() || 'podrska@poslar.eu';
}

export function provider(): Provider {
  const env = (key: string) => process.env[key]?.trim() || null;
  return {
    name: companyEnv('PAYEE_NAME') ?? 'Poslar',
    street: companyEnv('PAYEE_STREET'),
    city: companyEnv('PAYEE_CITY'),
    oib: companyEnv('OIB'),
    email: supportEmail(),
    phone: env('SUPPORT_PHONE'),
  };
}
