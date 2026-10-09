import 'server-only';
import type { WorkshopContext } from '@/lib/session';

// "Prvi koraci": what a new owner does in the first days, worked out from
// the data itself. Gone when everything is done or the owner hides it.

export interface FirstStep {
  id: 'workshop' | 'team' | 'job' | 'invoice';
  title: string;
  hint: string;
  href: string;
  done: boolean;
}

export async function loadFirstSteps(ctx: WorkshopContext): Promise<{ steps: FirstStep[]; sample: boolean } | null> {
  const settings = (ctx.tenant.settings ?? {}) as { demo?: boolean; onboarding_hidden?: boolean; onboarding_solo?: boolean };
  // Not during the 24-hour trial on examples: they are the first steps then.
  if (!ctx.isOwner || settings.demo || settings.onboarding_hidden || ctx.tenant.sample_until) return null;
  const s = ctx.supabase;
  const own = ctx.pkg.internalJobs;
  const [{ count: staff }, { count: jobs }, { count: invoices }, { count: stock }, { count: sample }] = await Promise.all([
    s.from('profiles').select('id', { count: 'exact', head: true }),
    s.from('jobs').select('id', { count: 'exact', head: true }).eq('is_demo', false),
    own ? Promise.resolve({ count: 0 }) : s.from('jobs').select('id', { count: 'exact', head: true }).eq('is_demo', false).not('invoice_number', 'is', null),
    own ? s.from('deal_stock').select('job_id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
    s.from('clients').select('id', { count: 'exact', head: true }).eq('is_demo', true),
  ]);
  const t = ctx.tenant;
  const steps: FirstStep[] = [
    { id: 'workshop', title: 'Podaci radionice', hint: 'Naziv, OIB, adresa i logo idu na račun', href: '/app/settings', done: Boolean(t.oib && t.address) },
    { id: 'team', title: 'Dodajte radnika', hint: 'Radnik vidi naloge, ali ne i cijene', href: '/app/settings', done: (staff ?? 0) > 1 || Boolean(settings.onboarding_solo) },
    { id: 'job', title: 'Prvi nalog', hint: 'Izgovorite kvar ili slikajte prometnu', href: '/app/jobs/new', done: (jobs ?? 0) > 0 },
    own
      ? { id: 'invoice', title: 'Prvi otkup', hint: 'Na nalogu, kartica „Otkup i prodaja”', href: '/app', done: (stock ?? 0) > 0 }
      : { id: 'invoice', title: 'Prvi račun', hint: 'Na nalogu: Radovi i cijena, pa Račun', href: '/app', done: (invoices ?? 0) > 0 },
  ];
  if (steps.every((x) => x.done)) return null;
  return { steps, sample: (sample ?? 0) > 0 };
}
