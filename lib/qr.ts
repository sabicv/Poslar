import 'server-only';
import { headers } from 'next/headers';
import QRCode from 'qrcode';

const SITE = 'https://poslar.eu';

// Address we put in e-mails. Preview hosts (*.vercel.app) never go out —
// the old project name is still in that URL.
export function publicAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ?? '';
  if (!raw) return SITE;
  try {
    if (new URL(raw).hostname.endsWith('.vercel.app')) return SITE;
  } catch {
    return SITE;
  }
  return raw;
}

// The full address of the door page, from the address the owner is using
// right now (the live site, a product domain or the test server).
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('192.168.') ? 'http' : 'https');
  return host ? `${proto}://${host}` : publicAppUrl();
}

export async function intakeUrl(token: string): Promise<string> {
  return `${await appOrigin()}/q/${token}`;
}

// The public booking page, "Rezerviraj termin" (same token as the door code).
export async function bookingUrl(token: string): Promise<string> {
  return `${await appOrigin()}/termin/${token}`;
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B1120', light: '#FFFFFF' } });
}
