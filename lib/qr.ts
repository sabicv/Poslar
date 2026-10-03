import 'server-only';
import { headers } from 'next/headers';
import QRCode from 'qrcode';

// The full address of the door page, from the address the owner is using
// right now (the live site, a product domain or the test server).
export async function intakeUrl(token: string): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('192.168.') ? 'http' : 'https');
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '');
  return `${origin}/q/${token}`;
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B1120', light: '#FFFFFF' } });
}
