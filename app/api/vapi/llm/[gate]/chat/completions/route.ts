import { proxyVapiChat, vapiLlmGateOk } from '@/lib/openrouter';

// Vapi posts the conversation here (it adds /chat/completions to the base URL).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ gate: string }> }) {
  const { gate } = await context.params;
  if (!vapiLlmGateOk(gate)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return proxyVapiChat(request);
}
