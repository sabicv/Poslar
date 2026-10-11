import Anthropic from '@anthropic-ai/sdk';
import { aiQuotaBlock, recordAiUsage } from '@/lib/ai-usage';
import { buildCopilotContext } from '@/lib/copilot/context';
import { BRIEFING_REQUEST, copilotSystemPrompt } from '@/lib/copilot/prompt';
import { getWorkshop, type WorkshopContext } from '@/lib/session';

// "Pitaj Poslara" endpoint (the Kopilot).
//   GET  ?jobId=…[&context=1]  → earlier questions/answers (and, on request,
//                                 the exact data the assistant sees)
//   POST { jobId, mode: 'briefing' | 'question', question?, refresh? }
//                               → the answer as a plain-text stream
// The work-order context is always rebuilt on the server from the database
// under the user's own permissions; the browser only sends the question.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.AI_COPILOT_MODEL || 'claude-sonnet-5';
const DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT) || 150);
const UUID = /^[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

async function session(): Promise<WorkshopContext | Response> {
  const state = await getWorkshop();
  if (state.kind !== 'active') return json({ error: 'Prijavite se ponovno.' }, 401);
  return state;
}

export async function GET(request: Request) {
  const ctx = await session();
  if (ctx instanceof Response) return ctx;
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId') ?? '';
  if (!UUID.test(jobId)) return json({ error: 'Neispravan nalog.' }, 400);

  const { data } = await ctx.supabase
    .from('copilot_messages')
    .select('id, role, kind, content, created_at, user_id')
    .eq('job_id', jobId)
    .neq('kind', 'briefing')
    .order('created_at', { ascending: false })
    .limit(30);
  const result: Record<string, unknown> = { enabled: Boolean(process.env.ANTHROPIC_API_KEY), messages: (data ?? []).reverse() };
  if (url.searchParams.get('context') === '1') {
    const built = await buildCopilotContext(ctx, jobId);
    result.context = built?.context ?? null;
  }
  return json(result);
}

function friendlyError(error: unknown): string {
  const status = (error as { status?: number }).status;
  const message = String((error as { message?: string }).message ?? '');
  if (status === 401) return 'Poslar nije ispravno spojen (neispravan API ključ). Javite administratoru.';
  if (/credit balance|billing/i.test(message)) return 'Na AI računu nema kredita. Javite administratoru.';
  if (status === 429 || status === 529) return 'AI servis je trenutno preopterećen. Pokušajte za minutu.';
  return 'Poslar trenutno ne može odgovoriti. Pokušajte ponovno.';
}

export async function POST(request: Request) {
  const ctx = await session();
  if (ctx instanceof Response) return ctx;
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Poslar još ne odgovara na pitanja (nedostaje ANTHROPIC_API_KEY).' }, 503);

  let body: { jobId?: string; mode?: string; question?: string; refresh?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Neispravan zahtjev.' }, 400);
  }
  const jobId = body.jobId ?? '';
  const mode = body.mode === 'question' ? 'question' : 'briefing';
  const question = (body.question ?? '').trim();
  if (!UUID.test(jobId)) return json({ error: 'Neispravan nalog.' }, 400);
  if (mode === 'question' && (question.length < 2 || question.length > 1000)) return json({ error: 'Pitanje mora imati između 2 i 1000 znakova.' }, 400);

  const built = await buildCopilotContext(ctx, jobId);
  if (!built) return json({ error: 'Nalog nije pronađen.' }, 404);

  const { data: briefings } = await ctx.supabase
    .from('copilot_messages')
    .select('content, context_hash')
    .eq('job_id', jobId)
    .eq('kind', 'briefing')
    .order('created_at', { ascending: false })
    .limit(1);
  const lastBriefing = briefings?.[0] ?? null;

  // Same job data as last time: hand back the stored briefing instantly
  // (and without paying for it twice).
  if (mode === 'briefing' && !body.refresh && lastBriefing?.context_hash === built.hash) {
    return new Response(lastBriefing.content as string, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Copilot-Cached': '1' } });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await ctx.supabase
    .from('copilot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'assistant')
    .gte('created_at', startOfDay.toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Dosegnut je dnevni limit pitanja Poslaru za radionicu (${DAILY_LIMIT}). Sutra se obnavlja.` }, 429);
  const blocked = await aiQuotaBlock(ctx, 'copilot');
  if (blocked) return json({ error: blocked }, 429);

  // Conversation: the briefing first, then earlier question/answer pairs.
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: BRIEFING_REQUEST }];
  if (mode === 'question') {
    if (lastBriefing) messages.push({ role: 'assistant', content: lastBriefing.content as string });
    else messages.push({ role: 'assistant', content: '(Uputa za nalog još nije izrađena.)' });
    const { data: history } = await ctx.supabase
      .from('copilot_messages')
      .select('role, kind, content')
      .eq('job_id', jobId)
      .neq('kind', 'briefing')
      .order('created_at', { ascending: false })
      .limit(12);
    const ordered = (history ?? []).reverse();
    for (let i = 0; i < ordered.length - 1; i++) {
      if (ordered[i].kind === 'question' && ordered[i + 1].kind === 'answer') {
        messages.push({ role: 'user', content: ordered[i].content as string }, { role: 'assistant', content: ordered[i + 1].content as string });
        i++;
      }
    }
    messages.push({ role: 'user', content: question });
    await ctx.supabase.from('copilot_messages').insert({ tenant_id: ctx.tenant.id, job_id: jobId, user_id: ctx.user.id, role: 'user', kind: 'question', content: question });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: mode === 'briefing' ? 1800 : 800,
    system: [
      { type: 'text', text: copilotSystemPrompt(ctx.pkg.product) },
      // Cached: follow-up questions on the same job reuse this block.
      { type: 'text', text: `<radni_nalog>\n${JSON.stringify(built.context, null, 1)}\n</radni_nalog>`, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = '';
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        const input = (final.usage.input_tokens ?? 0) + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0);
        await recordAiUsage(ctx, 'copilot', { model: final.model, input, output: final.usage.output_tokens }, mode === 'question');
        if (text.trim()) {
          await ctx.supabase.from('copilot_messages').insert({
            tenant_id: ctx.tenant.id,
            job_id: jobId,
            user_id: ctx.user.id,
            role: 'assistant',
            kind: mode === 'briefing' ? 'briefing' : 'answer',
            content: text.slice(0, 20000),
            model: final.model,
            context_hash: built.hash,
            input_tokens: input,
            output_tokens: final.usage.output_tokens,
          });
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`${text ? '\n\n' : ''}⚠️ ${friendlyError(error)}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
