import 'server-only';
import { allRows, inChunks } from '@/lib/paged';
import { createAdminClient } from '@/lib/supabase/admin';

// Zbirni promet: the owner's workshops side by side for one period. Read
// with the service role, only for workshops the caller owns (the caller
// passes them from myWorkshops).

type Row = Record<string, unknown>;
export interface WorkshopRevenue {
  id: string;
  name: string;
  active: boolean;
  jobs: number;
  revenue: number;
  outstanding: number;
}

export async function groupRevenue(workshops: { id: string; name: string; active: boolean }[], from: string | null, to: string | null): Promise<WorkshopRevenue[]> {
  const admin = createAdminClient();
  return Promise.all(
    workshops.map(async (w) => {
      const [done, unpaid] = await Promise.all([
        allRows<Row>((a, b) => {
          let q = admin.from('jobs').select('id').eq('tenant_id', w.id).not('collected_at', 'is', null);
          if (from) q = q.gte('collected_at', from);
          if (to) q = q.lt('collected_at', to);
          return q.order('id').range(a, b);
        }),
        allRows<Row>((a, b) => admin.from('jobs').select('id').eq('tenant_id', w.id).in('phase', ['ready', 'collected']).eq('payment_status', 'unpaid').order('id').range(a, b)),
      ]);
      const doneIds = done.map((j) => j.id as string);
      const unpaidIds = unpaid.map((j) => j.id as string);
      const totals = await inChunks<Row>([...new Set([...doneIds, ...unpaidIds])], (chunk) => admin.from('job_totals').select('job_id, gross_total').in('job_id', chunk).order('job_id'));
      const gross = new Map(totals.map((t) => [t.job_id as string, Number(t.gross_total)]));
      const sum = (ids: string[]) => ids.reduce((s, id) => s + (gross.get(id) ?? 0), 0);
      return { ...w, jobs: doneIds.length, revenue: sum(doneIds), outstanding: sum(unpaidIds) };
    })
  );
}
