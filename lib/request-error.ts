import { logError } from './errors';

export async function reportRequestError(error: unknown, request: { path: string; headers: Record<string, string | string[] | undefined> }) {
  const err = error as { message?: string; stack?: string; digest?: string };
  // Redirects and "not found" travel as errors too; they are not bugs.
  if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR/.test(err.digest ?? err.message ?? '')) return;
  const agent = request.headers['user-agent'];
  await logError({
    source: 'server',
    message: err.message ?? String(error),
    stack: err.stack ?? null,
    url: request.path,
    digest: err.digest ?? null,
    userAgent: Array.isArray(agent) ? agent[0] : (agent ?? null),
  });
}
