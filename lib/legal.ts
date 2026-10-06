import 'server-only';

// Who provides the service, from the server environment (the same company
// details as on the payment slip, plus its OIB). Anything not set is left
// out rather than made up.
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

export function provider(): Provider {
  const env = (key: string) => process.env[key]?.trim() || null;
  return {
    name: companyEnv('PAYEE_NAME') ?? 'Poslar',
    street: companyEnv('PAYEE_STREET'),
    city: companyEnv('PAYEE_CITY'),
    oib: companyEnv('OIB'),
    email: env('SUPPORT_EMAIL'),
    phone: env('SUPPORT_PHONE'),
  };
}
