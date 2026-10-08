import { logError } from '@/lib/errors';
import { applyPaddleEvent, paddleConfig, validPaddleSignature } from '@/lib/paddle';
import { createAdminClient } from '@/lib/supabase/admin';

// Paddle's notifications (docs/PADDLE.md): subscriptions and completed
// payments of workshops paying by card. Signed with the notification secret.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cfg = paddleConfig();
  const raw = await request.text();
  if (!cfg || !validPaddleSignature(raw, request.headers.get('paddle-signature'))) return new Response('Unauthorized', { status: 401 });
  try {
    const done = await applyPaddleEvent(createAdminClient(), cfg, JSON.parse(raw));
    return Response.json({ ok: true, done });
  } catch (error) {
    await logError({ source: 'server', message: `Paddle webhook: ${error instanceof Error ? error.message : String(error)}`, stack: error instanceof Error ? error.stack : null, url: '/api/paddle' });
    // Paddle retries anything but a 2xx: let it try again later.
    return new Response('Error', { status: 500 });
  }
}
