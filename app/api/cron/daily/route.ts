import { daySummary, sendDailySummaries, summaryMail } from '@/lib/daily-summary';
import { logError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInZagreb } from '@/lib/time';
import type { Tenant } from '@/types/db';

// The evening run (vercel.json crons, 17:00 UTC = 19:00 summer, 18:00
// winter time in Zagreb). Vercel sends "Authorization: Bearer CRON_SECRET";
// without the secret set, nothing runs. With ?pregled=<workshop id> it
// sends nothing and returns that workshop's summary (for checking).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const admin = createAdminClient();
  const preview = new URL(request.url).searchParams.get('pregled');
  if (preview) {
    const { data } = await admin.from('tenants').select('*').eq('id', preview).maybeSingle();
    if (!data) return Response.json({ error: 'missing' }, { status: 404 });
    const day = todayInZagreb();
    const summary = await daySummary(admin, data as Tenant, day);
    return Response.json({ quiet: summary.quiet, ...summaryMail(null, day, [summary]) });
  }
  const result: Record<string, unknown> = {};
  try {
    result.summaries = await sendDailySummaries(admin);
  } catch (error) {
    await logError({ source: 'server', message: `Dnevni sažetak: ${error instanceof Error ? error.message : String(error)}`, stack: error instanceof Error ? error.stack : null, url: '/api/cron/daily' });
    result.summaries = 'failed';
  }
  return Response.json(result);
}
