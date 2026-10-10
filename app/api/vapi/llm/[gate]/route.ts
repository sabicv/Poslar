import { proxyVapiChat, vapiLlmGateOk } from '@/lib/openrouter';

// Same proxy, for a Vapi build that posts to the base URL itself.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ gate: string }> }) {
  const { gate } = await context.params;
  if (!vapiLlmGateOk(gate)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return proxyVapiChat(request);
}
