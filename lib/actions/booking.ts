'use server';

import { z } from 'zod';
import { fail, type ActionResult } from '@/lib/action-result';
import { bookSlot, loadBookingPage } from '@/lib/booking';
import { isGuestTenant } from '@/lib/guest';
import { digitsOf, overLimit, senderHash } from '@/lib/intake';
import { sendMail } from '@/lib/mail';
import { ownerEmail } from '@/lib/phone-agent';
import { appOrigin } from '@/lib/qr';
import { createAdminClient } from '@/lib/supabase/admin';

// "Rezerviraj termin": the customer books a free slot on the workshop's
// public page. The job lands in Prijem with the slot (source 'booking') and
// the owner confirms it with one tap on WhatsApp, as with Poslar's calls.

const GENERIC = 'Rezervacija se sada ne može poslati. Pokušajte ponovno za nekoliko minuta ili nazovite radionicu.';

const schema = z.object({
  start: z.string().min(10).max(40),
  name: z.string().trim().min(2, 'Upišite ime i prezime.').max(120),
  phone: z.string().trim().min(6, 'Upišite broj telefona.').max(30),
  complaint: z.string().trim().min(3, 'Napišite ili izgovorite što treba.').max(1500),
  identifier: z.string().trim().max(20).optional().default(''),
  address: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  // A field people never see; bots fill it.
  website: z.string().max(200).optional().default(''),
  elapsedMs: z.number().int().min(0).max(86_400_000),
});

export async function submitBooking(token: string, values: z.input<typeof schema>): Promise<ActionResult<{ label: string; number: number; again: boolean }>> {
  try {
    const page = await loadBookingPage(token);
    if (page.kind !== 'ok') return fail('Rezervacija preko ove poveznice trenutno nije uključena.');
    const at = page.at;
    const parsed = schema.safeParse(values);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Provjerite podatke.');
    const v = parsed.data;
    if (v.website !== '' || v.elapsedMs < 4000) return fail(GENERIC);
    const phone = digitsOf(v.phone);
    if (phone.length < 8 || phone.length > 15) return fail('Upišite broj telefona na koji Vas majstor može nazvati.');
    if (await overLimit(at.tenant.id, await senderHash(), 'booking')) return fail(GENERIC);

    const admin = createAdminClient();
    // The same person a second time within half an hour: the first booking stands.
    const { data: recent } = await admin
      .from('jobs')
      .select('number, scheduled_start, client:clients!inner(phone)')
      .eq('tenant_id', at.tenant.id)
      .eq('source', 'booking')
      .gte('created_at', new Date(Date.now() - 30 * 60000).toISOString())
      .limit(20);
    const again = (recent ?? []).find((j) => digitsOf(((j.client as unknown as { phone: string | null }).phone ?? '') as string) === phone);
    if (again) {
      return { ok: true, data: { number: again.number as number, label: new Date(again.scheduled_start as string).toLocaleString('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zagreb' }), again: true } };
    }

    const r = await bookSlot(admin, at, { start: v.start, name: v.name, phone: v.phone, identifier: v.identifier, complaint: v.complaint, address: v.address, city: v.city }, { source: 'booking', event: 'Rezervirano preko poveznice' });
    if (!r.ok) return fail(/nije slobodan/.test(r.message) ? 'Taj termin je upravo zauzet. Odaberite drugi.' : r.message.replace('Zapiši poruku za majstora.', 'Nazovite radionicu.'));

    // The owner hears of it by e-mail too (when e-mail is set up; never
    // from the demo, whose accounts are throwaway).
    const to = isGuestTenant(at.tenant) ? null : await ownerEmail(admin, at.tenant.id);
    if (to) {
      const link = `${process.env.NEXT_PUBLIC_APP_URL || (await appOrigin())}/app/jobs/${r.jobId}`;
      await sendMail(to, `Nova rezervacija: ${r.label}`, `Mušterija je rezervirala termin preko poveznice.\n\nTermin: ${r.label}\nMušterija: ${v.name}, ${v.phone}\nPosao: ${v.complaint}\n\nNalog #${r.number}: ${link}\nPotvrdite termin mušteriji iz naloga.`).catch(() => {});
    }
    return { ok: true, data: { label: r.label, number: r.number, again: false } };
  } catch (error) {
    return fail(error);
  }
}
