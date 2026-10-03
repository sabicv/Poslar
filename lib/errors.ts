import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type ErrorSource = 'client' | 'server' | 'action';

export interface ErrorReport {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  url?: string | null;
  digest?: string | null;
  userAgent?: string | null;
  tenantId?: string | null;
  userId?: string | null;
}

// The same bug from different people and pages is one row: numbers, ids
// and file hashes are taken out before hashing, and only the first frame
// of the stack counts.
export function fingerprint(source: ErrorSource, message: string, stack?: string | null): string {
  const tidy = (s: string) =>
    s
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\b[0-9a-f]{12,}\b/gi, ':hash')
      .replace(/\d+/g, '0')
      .trim();
  const frame = (stack ?? '').split('\n').find((line) => /\bat\b|@/.test(line) && !line.includes(message)) ?? '';
  return createHash('sha1').update(`${source}|${tidy(message).slice(0, 300)}|${tidy(frame.replace(/\?[^:)]*/, ''))}`).digest('hex');
}

// Never throws: an error while reporting an error must not hurt anyone.
export async function logError(report: ErrorReport): Promise<void> {
  try {
    const message = (report.message || 'Nepoznata greška').slice(0, 1000);
    let { tenantId = null, userId = null } = report;
    if (!userId) {
      try {
        const { getAuth } = await import('@/lib/session');
        const { user } = await getAuth();
        userId = user?.id ?? null;
      } catch {
        // Outside a request (or no cookies): the error is logged without a person.
      }
    }
    const admin = createAdminClient();
    if (userId && !tenantId) {
      const { data } = await admin.from('profiles').select('tenant_id').eq('id', userId).maybeSingle();
      tenantId = (data?.tenant_id as string | undefined) ?? null;
    }
    await admin.rpc('log_app_error', {
      p_fingerprint: fingerprint(report.source, message, report.stack),
      p_source: report.source,
      p_message: message,
      p_stack: report.stack ?? null,
      p_url: report.url ?? null,
      p_digest: report.digest ?? null,
      p_user_agent: report.userAgent ?? null,
      p_tenant: tenantId,
      p_user: userId,
    });
    // Resolved errors are kept 12 months (privacy policy).
    await admin.from('app_errors').delete().eq('status', 'resolved').lt('last_seen', new Date(Date.now() - 365 * 86400_000).toISOString());
  } catch (error) {
    console.error('[errors] not logged', error);
  }
}
