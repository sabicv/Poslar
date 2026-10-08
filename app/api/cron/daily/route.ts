import { daySummary, sendDailySummaries, summaryMail } from '@/lib/daily-summary';
import { logError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, todayInZagreb, zagrebMidnight } from '@/lib/time';
import { sendAppointmentReminders } from '@/lib/whatsapp';
import type { Tenant } from '@/types/db';

// The evening run (vercel.json crons, 17:00 UTC = 19:00 summer, 18:00
// winter time in Zagreb): the owners' daily summary and the customers'
// WhatsApp reminders for tomorrow. Vercel sends "Authorization: Bearer
// CRON_SECRET"; without the secret set, nothing runs. For checking one
// workshop: ?pregled=<id> returns its summary without sending, and
// ?samo=<id> sends only that workshop's reminders.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const tomorrowBounds = () => {
  const tomorrow = addDays(todayInZagreb(), 1);
  return [zagrebMidnight(tomorrow).toISOString(), zagrebMidnight(addDays(tomorrow, 1)).toISOString()] as const;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const admin = createAdminClient();
  const params = new URL(request.url).searchParams;
  const preview = params.get('pregled');
  if (preview) {
    const { data } = await admin.from('tenants').select('*').eq('id', preview).maybeSingle();
    if (!data) return Response.json({ error: 'missing' }, { status: 404 });
    const day = todayInZagreb();
    const summary = await daySummary(admin, data as Tenant, day);
    return Response.json({ quiet: summary.quiet, ...summaryMail(null, day, [summary]) });
  }
  const only = params.get('samo');
  if (only) return Response.json({ reminders: await sendAppointmentReminders(admin, ...tomorrowBounds(), only) });

  const result: Record<string, unknown> = {};
  // Each task on its own: one failing does not stop the others.
  const tasks: [string, () => Promise<unknown>][] = [
    ['summaries', () => sendDailySummaries(admin)],
    ['reminders', () => sendAppointmentReminders(admin, ...tomorrowBounds())],
  ];
  for (const [name, run] of tasks) {
    try {
      result[name] = await run();
    } catch (error) {
      await logError({ source: 'server', message: `Dnevni zadatak ${name}: ${error instanceof Error ? error.message : String(error)}`, stack: error instanceof Error ? error.stack : null, url: '/api/cron/daily' });
      result[name] = 'failed';
    }
  }
  return Response.json(result);
}
