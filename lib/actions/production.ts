'use server';

import { revalidatePath } from 'next/cache';
import { BODY_PHASES, nextBodyPhase } from '@/config/production';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop } from '@/lib/session';

// "Next stage" from the production board, without opening the job: the
// stage in progress is closed now and the next one starts with the person
// who tapped. Row Level Security keeps it inside the caller's workshop.
export async function advanceBodyPhase(jobId: string): Promise<ActionResult<{ phase: string | null }>> {
  try {
    const ctx = await requireWorkshop();
    if (ctx.pkg.id !== 'body') return fail('Proizvodnja je samo za limare i lakirere.');
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return fail('Nalog nije pronađen.');

    const { data: job } = await ctx.supabase.from('jobs').select('id, locked_at, phase').eq('id', jobId).maybeSingle();
    if (!job) return fail('Nalog nije pronađen.');
    if (job.locked_at) return fail('Nalog je zaključan.');

    const { data: last } = await ctx.supabase
      .from('body_production_phases')
      .select('id, phase, finished_at')
      .eq('job_id', jobId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = nextBodyPhase((last?.phase as string | undefined) ?? null);
    const now = new Date().toISOString();

    if (last && !last.finished_at) {
      const { error } = await ctx.supabase.from('body_production_phases').update({ finished_at: now }).eq('id', last.id);
      if (error) return fail(error);
    }
    if (next) {
      const { error } = await ctx.supabase.from('body_production_phases').insert({ tenant_id: ctx.tenant.id, job_id: jobId, phase: next, worker_id: ctx.user.id, started_at: now });
      if (error) return fail(error);
    }

    revalidatePath('/app/module');
    revalidatePath(`/app/jobs/${jobId}`);
    return { ok: true, data: { phase: next ? BODY_PHASES[next] : null } };
  } catch (error) {
    return fail(error);
  }
}
