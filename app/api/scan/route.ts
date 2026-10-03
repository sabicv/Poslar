import { aiQuotaBlock, recordAiUsage } from '@/lib/ai-usage';
import { parseScanRequest, readPhoto, scanJson } from '@/lib/scan';
import { getWorkshop } from '@/lib/session';

// POST { kind: 'prometna' | 'plocica' | 'guma', image: 'data:image/jpeg;base64,…' }
// → the text read from the photo as fields the forms understand (lib/scan.ts).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Whether the camera buttons can read yet (true once the AI key is set).
export async function GET() {
  return scanJson({ status: 200, body: { enabled: Boolean(process.env.ANTHROPIC_API_KEY) } });
}

export async function POST(request: Request) {
  const state = await getWorkshop();
  if (state.kind !== 'active') return scanJson({ status: 401, body: { error: 'Prijavite se ponovno.' } });
  if (!process.env.ANTHROPIC_API_KEY) return scanJson({ status: 503, body: { error: 'Čitanje slika još nije uključeno.' } });
  let body: { kind?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return scanJson({ status: 400, body: { error: 'Neispravan zahtjev.' } });
  }
  const parsed = parseScanRequest(body);
  if ('status' in parsed) return scanJson(parsed);
  const blocked = await aiQuotaBlock(state, 'scan');
  if (blocked) return scanJson({ status: 429, body: { error: blocked } });
  return scanJson(await readPhoto(parsed, (u) => recordAiUsage(state, 'scan', u)));
}
