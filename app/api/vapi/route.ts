import { timingSafeEqual } from 'node:crypto';
import { PHONE_CALL_MAX_SECONDS, PHONE_PACK } from '@/config/plans';
import { appOrigin } from '@/lib/qr';
import { sendMail } from '@/lib/mail';
import { agentVariables, book, callerContext, offerSlots, openJobsText, ownerEmail, tenantForNumber } from '@/lib/phone-agent';
import { phoneUsage } from '@/lib/phone-usage';
import { createAdminClient } from '@/lib/supabase/admin';
import { todayInZagreb } from '@/lib/time';

// The one server address of the AI phone agent at Vapi (docs/VAPI.md).
// Vapi sends: "assistant-request" when a call comes in (we answer with the
// workshop and the caller as variables for the assistant's prompt),
// "tool-calls" when the assistant needs free slots, a booking or the state
// of a job, and "end-of-call-report" with the summary and transcript.
// Every request must carry the shared secret (VAPI_SERVER_SECRET).
// Vapi's payloads have moved between versions, so fields are read from
// the places they have been seen in.

export const dynamic = 'force-dynamic';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function authorized(request: Request): boolean {
  const secret = process.env.VAPI_SERVER_SECRET?.trim();
  if (!secret) return false;
  const given = request.headers.get('x-vapi-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function argsOf(fn: Json): Json {
  const raw = fn.arguments ?? fn.parameters;
  if (typeof raw === 'string') {
    try {
      return obj(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return obj(raw);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = obj(await request.json().catch(() => null));
  const message = obj(body.message);
  const call = obj(message.call);
  const type = str(message.type);
  const numberId = str(obj(message.phoneNumber).id) ?? str(call.phoneNumberId) ?? str(obj(call.phoneNumber).id);
  const caller = str(obj(message.customer).number) ?? str(obj(call.customer).number);
  const callId = str(call.id);
  const admin = createAdminClient();
  const at = await tenantForNumber(admin, numberId);

  if (type === 'assistant-request') {
    const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
    if (!assistantId) return Response.json({ error: 'Asistent nije podešen (VAPI_ASSISTANT_ID).' });
    if (!at) {
      return Response.json({
        assistantId,
        assistantOverrides: {
          firstMessage: 'Dobar dan, ovdje virtualni asistent. Ovaj broj još nije povezan s radionicom. Pokušajte kasnije.',
          variableValues: { radionica: 'radionica', zanat: '', danas: '', radno_vrijeme: '', pozivatelj: '', sto_pitati: '', rezervacije: 'ne', pozdrav: '' },
        },
      });
    }
    const variables = agentVariables(at, await callerContext(admin, at, caller));
    // The month's minutes are used up: a short message and the call ends,
    // so a busy month never runs up a bill (the owner was warned by e-mail).
    const usage = await phoneUsage(admin, at.tenant);
    if (usage.used >= usage.quota) {
      return Response.json({
        assistantId,
        assistantOverrides: {
          firstMessage: `Dobar dan, ${at.tenant.name}. Majstor se trenutno ne može javiti. Nazvat će Vas čim stigne. Doviđenja.`,
          variableValues: { ...variables, rezervacije: 'ne' },
          maxDurationSeconds: 20,
        },
      });
    }
    return Response.json({ assistantId, assistantOverrides: { firstMessage: variables.pozdrav, variableValues: variables, maxDurationSeconds: PHONE_CALL_MAX_SECONDS } });
  }

  if (type === 'tool-calls') {
    const list = (Array.isArray(message.toolCallList) ? message.toolCallList : Array.isArray(message.toolCalls) ? message.toolCalls : Array.isArray(message.toolWithToolCallList) ? message.toolWithToolCallList.map((t) => obj(t).toolCall) : []) as unknown[];
    const results: { toolCallId: string; result: string }[] = [];
    for (const item of list) {
      const tc = obj(item);
      const fn = obj(tc.function);
      const name = str(fn.name) ?? str(tc.name);
      const args = argsOf(Object.keys(fn).length ? fn : tc);
      const toolCallId = str(tc.id) ?? '';
      if (!at) {
        results.push({ toolCallId, result: 'Ovaj broj nije povezan s radionicom. Ispričaj se i zamoli pozivatelja da nazove kasnije.' });
        continue;
      }
      if (name === 'slobodni_termini') {
        const slots = await offerSlots(admin, at, str(args.dan));
        results.push({
          toolCallId,
          result: slots.length
            ? JSON.stringify({ termini: slots.map((s) => ({ termin: s.start, opis: s.label })), uputa: 'Ponudi dva ili tri termina. Za rezervaciju pošalji točno vrijednost "termin".' })
            : 'U sljedeća tri tjedna nema slobodnog termina. Zapiši ime, broj i poruku; majstor će nazvati.',
        });
      } else if (name === 'rezerviraj_termin') {
        const r = await book(admin, at, {
          start: str(args.termin) ?? '',
          name: str(args.ime_prezime) ?? '',
          phone: str(args.telefon) ?? caller ?? '',
          identifier: str(args.registracija) ?? undefined,
          complaint: str(args.opis) ?? '',
          address: str(args.adresa) ?? undefined,
          city: str(args.mjesto) ?? undefined,
          callId,
        });
        if (r.ok) {
          results.push({ toolCallId, result: `Rezervirano: ${r.label}. Broj naloga ${r.number}. Reci pozivatelju termin i da će majstor poslati potvrdu porukom.` });
          const to = await ownerEmail(admin, at.tenant.id);
          if (to) {
            const link = `${process.env.NEXT_PUBLIC_APP_URL || (await appOrigin())}/app/jobs/${r.jobId}`;
            await sendMail(to, `Novi termin: ${r.label}`, `AI telefon je dogovorio termin.\n\nTermin: ${r.label}\nMušterija: ${str(args.ime_prezime) ?? ''}, ${str(args.telefon) ?? caller ?? ''}\nPosao: ${str(args.opis) ?? ''}\n\nNalog #${r.number}: ${link}\nPotvrdite termin mušteriji iz naloga.`);
          }
        } else {
          results.push({ toolCallId, result: r.message });
        }
      } else if (name === 'stanje_naloga') {
        results.push({ toolCallId, result: await openJobsText(admin, at, caller) });
      } else {
        results.push({ toolCallId, result: 'Nepoznat alat.' });
      }
    }
    return Response.json({ results });
  }

  if (type === 'end-of-call-report' && at && callId) {
    const artifact = obj(message.artifact);
    const analysis = obj(message.analysis);
    const started = str(message.startedAt) ?? str(call.startedAt);
    const ended = str(message.endedAt) ?? str(call.endedAt);
    const duration =
      typeof message.durationSeconds === 'number'
        ? Math.round(message.durationSeconds)
        : started && ended
          ? Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000)
          : null;
    const row = {
      caller,
      started_at: started,
      ended_at: ended,
      duration_s: duration,
      ended_reason: str(message.endedReason),
      summary: (str(analysis.summary) ?? str(message.summary))?.slice(0, 4000) ?? null,
      transcript: (str(artifact.transcript) ?? str(message.transcript))?.slice(0, 50000) ?? null,
      recording_url: str(artifact.recordingUrl) ?? str(obj(artifact.recording).url) ?? str(message.recordingUrl),
      cost: typeof message.cost === 'number' ? message.cost : typeof call.cost === 'number' ? call.cost : null,
    };
    const { data: existing } = await admin.from('phone_calls').select('id, job_id').eq('provider_call_id', callId).maybeSingle();
    if (existing) await admin.from('phone_calls').update(row).eq('id', existing.id);
    else await admin.from('phone_calls').insert({ ...row, tenant_id: at.tenant.id, provider_call_id: callId });
    if (existing?.job_id && row.summary) {
      await admin.from('job_events').insert({ tenant_id: at.tenant.id, job_id: existing.job_id, event_type: 'note', message: `Sažetak poziva: ${row.summary}`.slice(0, 2000) });
    }
    await warnAboutMinutes(admin, at.tenant);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

// The owner hears once a month at 80 % and once at 100 % of the AI phone
// minutes (settings.phone_warned remembers "2026-10:80"), with the add-on.
async function warnAboutMinutes(admin: ReturnType<typeof createAdminClient>, tenant: { id: string; name: string; plan: string | null; ai_quota: unknown; settings: Record<string, unknown> | null }) {
  const usage = await phoneUsage(admin, tenant);
  if (usage.pct === null || usage.pct < 80) return;
  const level = usage.pct >= 100 ? 100 : 80;
  const month = todayInZagreb().slice(0, 7);
  const warned = String((tenant.settings ?? {}).phone_warned ?? '');
  const [warnedMonth, warnedLevel] = warned.split(':');
  if (warnedMonth === month && Number(warnedLevel) >= level) return;
  await admin.from('tenants').update({ settings: { ...(tenant.settings ?? {}), phone_warned: `${month}:${level}` } }).eq('id', tenant.id);
  const to = await ownerEmail(admin, tenant.id);
  if (!to) return;
  const link = `${appOrigin()}/app/settings/telefon`;
  await sendMail(
    to,
    level === 100 ? 'AI tajnik: minute za ovaj mjesec su potrošene' : 'AI tajnik: potrošeno 80 % minuta',
    level === 100
      ? `AI tajnik je ovaj mjesec potrošio ${usage.used} od ${usage.quota} minuta. Do kraja mjeseca pozivatelji čuju kratku poruku da ćete ih nazvati.\n\nDodatnih ${PHONE_PACK.minutes} minuta mjesečno: ${PHONE_PACK.price} €. Zatražite u aplikaciji: ${link}`
      : `AI tajnik je ovaj mjesec potrošio ${usage.used} od ${usage.quota} minuta.\n\nDodatnih ${PHONE_PACK.minutes} minuta mjesečno: ${PHONE_PACK.price} €. Zatražite u aplikaciji: ${link}`
  );
}
