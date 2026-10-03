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

export function provider(): Provider {
  const env = (key: string) => process.env[key]?.trim() || null;
  return {
    name: env('TAKTIX_PAYEE_NAME') ?? 'TaktiX',
    street: env('TAKTIX_PAYEE_STREET'),
    city: env('TAKTIX_PAYEE_CITY'),
    oib: env('TAKTIX_OIB'),
    email: env('SUPPORT_EMAIL'),
    phone: env('SUPPORT_PHONE'),
  };
}
