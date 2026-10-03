import { aiQuotaBlockFor, recordAiUsageFor } from '@/lib/ai-usage';
import { loadIntake, overLimit, senderHash } from '@/lib/intake';
import { parseScanRequest, readPhoto, scanJson } from '@/lib/scan';

// The door QR page reads a registration card or nameplate photo. No
// account: the token names the workshop, its AI quota pays, and each
// sender gets a few reads an hour.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { token?: string; kind?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return scanJson({ status: 400, body: { error: 'Neispravan zahtjev.' } });
  }
  const state = await loadIntake(body.token ?? '');
  if (state.kind !== 'ok') return scanJson({ status: 404, body: { error: 'Prijava preko ovog koda nije dostupna.' } });
  if (body.kind !== 'prometna' && body.kind !== 'plocica') return scanJson({ status: 400, body: { error: 'Neispravna slika.' } });
  const parsed = parseScanRequest(body);
  if ('status' in parsed) return scanJson(parsed);
  if (await overLimit(state.tenant.id, await senderHash(), 'scan')) return scanJson({ status: 429, body: { error: 'Previše slikanja. Upišite podatke ručno.' } });
  if (await aiQuotaBlockFor(state.tenant, 'scan')) return scanJson({ status: 429, body: { error: 'Slikanje trenutno nije dostupno. Upišite podatke ručno.' } });
  return scanJson(await readPhoto(parsed, (u) => recordAiUsageFor(state.tenant.id, null, 'scan', u)));
}
