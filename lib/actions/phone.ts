'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { readHours } from '@/lib/calendar';
import { internationalDigits } from '@/lib/contact';
import { isGuestTenant } from '@/lib/guest';
import { requireWorkshop } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.tuple([time, time]).nullable();
const hoursSchema = z.object({
  days: z.object({ '1': day, '2': day, '3': day, '4': day, '5': day, '6': day, '7': day }),
  slotMinutes: z.number().int().min(15).max(480),
  perSlot: z.number().int().min(1).max(20),
  leadHours: z.number().int().min(0).max(72),
});

// Working hours and slots for appointments the phone agent books.
export async function saveCalendar(values: z.input<typeof hoursSchema>): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Radno vrijeme uređuje voditelj servisa.');
  const parsed = hoursSchema.safeParse(values);
  if (!parsed.success) return fail('Provjerite radno vrijeme.');
  for (const d of Object.values(parsed.data.days)) if (d && d[0] >= d[1]) return fail('Početak radnog vremena mora biti prije kraja.');
  const calendar = readHours({ calendar: parsed.data });
  const settings = { ...((ctx.tenant.settings as Record<string, unknown> | null) ?? {}), calendar };
  const { error } = await ctx.supabase.from('tenants').update({ settings }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/settings/telefon');
  return { ok: true };
}

// Zajednički Poslar broj: the mobile whose unanswered calls the owner
// forwards. One workshop per mobile; empty switches it off. Saved by the
// server (not in the owner's column grant) after the check.
export async function setForwardFrom(phone: string): Promise<ActionResult> {
  const ctx = await requireWorkshop();
  if (!ctx.isOwner) return fail('Broj upisuje voditelj servisa.');
  if (isGuestTenant(ctx.tenant) || (ctx.tenant.settings as { demo?: unknown } | null)?.demo === true) return fail('U demo verziji se broj ne sprema.');
  const trimmed = phone.trim();
  const digits = trimmed ? internationalDigits(trimmed) : null;
  if (trimmed && (!digits || digits.length < 10 || digits.length > 15)) return fail('Upišite broj mobitela, npr. 091 234 5678.');
  const admin = createAdminClient();
  if (digits) {
    const { data: taken } = await admin.from('tenants').select('id').eq('phone_forward_from', digits).neq('id', ctx.tenant.id).maybeSingle();
    if (taken) return fail('Taj broj već koristi druga radionica. Za svaku radionicu treba svoj mobitel; javite se podršci ako je to greška.');
  }
  const { error } = await admin.from('tenants').update({ phone_forward_from: digits }).eq('id', ctx.tenant.id);
  if (error) return fail(error);
  revalidatePath('/app/settings/telefon');
  return { ok: true };
}
