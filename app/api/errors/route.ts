import { headers } from 'next/headers';
import { logError } from '@/lib/errors';

// POST { message, stack?, url?, digest? } from the browser (ErrorReporter
// and the error pages). Anyone may report, signed in or not, so the body
// is capped and each address gets a handful of reports a minute.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const recent = new Map<string, number[]>();
const PER_MINUTE = 20;

function allowed(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= PER_MINUTE) return false;
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return true;
}

export async function POST(request: Request) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  if (!allowed(ip)) return new Response(null, { status: 429 });
  const raw = await request.text();
  if (raw.length > 20_000) return new Response(null, { status: 413 });
  let body: { message?: unknown; stack?: unknown; url?: unknown; digest?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : null);
  const message = str(body.message, 1000);
  if (!message) return new Response(null, { status: 400 });
  await logError({ source: 'client', message, stack: str(body.stack, 8000), url: str(body.url, 500), digest: str(body.digest, 100), userAgent: h.get('user-agent') });
  return new Response(null, { status: 204 });
}
