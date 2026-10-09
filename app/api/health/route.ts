import { NextResponse } from 'next/server';

// Public liveness for UptimeRobot (and similar). No auth, no database:
// if this answers, the app is up. Deeper checks live in /api/cron.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, t: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
