import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { publicAppUrl } from '@/lib/qr';

// WhatsApp drafts and the phone assistant go through OpenRouter.
// The key stays in OPENROUTER_API_KEY (server only, never in git).
// Claude 3.5 Sonnet and Claude 3.5 Haiku no longer have endpoints.
// WhatsApp uses Claude Sonnet 4. The phone uses Claude Haiku 4.5.
export const WHATSAPP_MODEL = 'anthropic/claude-sonnet-4';
export const VAPI_MODEL = 'anthropic/claude-haiku-4.5';
// Registration cards and nameplates. Same Sonnet as WhatsApp, through the same key.
export const SCAN_MODEL = 'anthropic/claude-sonnet-4';

export function openRouterKey(): string | null {
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

export function whatsappModel(): string {
  return process.env.AI_WHATSAPP_MODEL?.trim() || WHATSAPP_MODEL;
}

export function vapiModel(): string {
  return process.env.AI_VAPI_MODEL?.trim() || VAPI_MODEL;
}

export function scanModel(): string {
  const raw = process.env.AI_SCAN_MODEL?.trim() || '';
  // An old Anthropic id (claude-sonnet-5) is not an OpenRouter model.
  if (!raw.includes('/')) return SCAN_MODEL;
  return raw;
}

export function scanReadingOn(): boolean {
  return Boolean(openRouterKey() || process.env.ANTHROPIC_API_KEY?.trim());
}

function llmGate(secret: string): string {
  return createHash('sha256').update(`poslar-vapi-llm:${secret}`).digest('hex');
}

export function vapiLlmGateOk(gate: string): boolean {
  const secret = process.env.VAPI_SERVER_SECRET?.trim();
  if (!secret || !gate) return false;
  const expected = Buffer.from(llmGate(secret));
  const given = Buffer.from(gate);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Per-call model for Vapi. The key stays here: Vapi calls our address,
// and we talk to OpenRouter. Empty when the key or the phone secret is missing,
// so an old assistant in the Vapi dashboard keeps its own model.
export function vapiModelOverride(): { model: { provider: 'custom-llm'; url: string; model: string; temperature: number; maxTokens: number } } | Record<string, never> {
  const secret = process.env.VAPI_SERVER_SECRET?.trim();
  if (!secret || !openRouterKey()) return {};
  return {
    model: {
      provider: 'custom-llm',
      url: `${publicAppUrl()}/api/vapi/llm/${llmGate(secret)}`,
      model: vapiModel(),
      temperature: 0.4,
      maxTokens: 300,
    },
  };
}

export type OpenRouterReply = { text: string; model: string; input: number; output: number } | { error: string; status: number };

// A photo plus a prompt. OpenRouter takes the same image shape as OpenAI.
export async function openRouterVision(options: { model: string; prompt: string; mediaType: string; data: string; maxTokens: number }): Promise<OpenRouterReply> {
  const key = openRouterKey();
  if (!key) return { error: 'Čitanje slika još nije uključeno.', status: 503 };
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://poslar.eu',
        'X-Title': 'Poslar',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${options.mediaType};base64,${options.data}` } },
              { type: 'text', text: options.prompt },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(50000),
    });
  } catch {
    return { error: 'Čitanje slike nije uspjelo. Pokušajte ponovno.', status: 502 };
  }
  const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string; error?: { message?: string } };
  if (!res.ok) return { error: data.error?.message || 'Čitanje slike nije uspjelo.', status: res.status };
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return { text, model: data.model || options.model, input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 };
}

export async function openRouterChat(options: { model: string; messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; maxTokens: number }): Promise<string | null> {
  const key = openRouterKey();
  if (!key) return null;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://poslar.eu',
      'X-Title': 'Poslar',
    },
    body: JSON.stringify({ model: options.model, messages: options.messages, max_tokens: options.maxTokens, temperature: 0.3 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
}

// OpenAI-compatible stream for Vapi. The model is always ours, so the
// caller cannot pick a more expensive one.
export async function proxyVapiChat(request: Request): Promise<Response> {
  const key = openRouterKey();
  if (!key) return Response.json({ error: 'OpenRouter nije podešen.' }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Neispravan zahtjev.' }, { status: 400 });
  }
  body.model = vapiModel();
  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://poslar.eu',
      'X-Title': 'Poslar',
    },
    body: JSON.stringify(body),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}
