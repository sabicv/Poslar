'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { requireWorkshop } from '@/lib/session';
import { todayInZagreb } from '@/lib/time';

// A reminder sent on WhatsApp, or waved away ("Ne treba"): written to
// `reminders`, so the list leaves this customer alone for the season
// (tyres) or two months (service).
const schema = z.object({
  group: z.enum(['season', 'service', 'plan', 'compliance']),
  clientId: z.string().uuid().nullable(),
  assetId: z.string().uuid().nullable(),
  planId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
});

export async function markReminder(values: z.input<typeof schema>, outcome: 'sent' | 'cancelled'): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Podsjetnike šalje voditelj servisa.');
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail('Neispravan podsjetnik.');
  const v = parsed.data;
  if (v.group === 'plan' && v.planId) {
    // A plan keeps its own "last reminded" date (also shown in Servisni planovi).
    const { error } = await ctx.supabase.from('maintenance_plans').update({ last_reminded_at: new Date().toISOString() }).eq('id', v.planId);
    if (error) return fail(error);
  } else {
    const { error } = await ctx.supabase.from('reminders').insert({
      tenant_id: ctx.tenant.id,
      client_id: v.clientId,
      asset_id: v.assetId,
      kind: v.group === 'season' ? 'season' : v.group === 'compliance' ? 'compliance' : 'service',
      title: v.title,
      due_date: todayInZagreb(),
      channel: 'whatsapp',
      status: outcome,
      sent_at: outcome === 'sent' ? new Date().toISOString() : null,
    });
    if (error) return fail(error);
  }
  revalidatePath('/app/business/podsjetnici');
  revalidatePath('/app');
  return { ok: true };
}
