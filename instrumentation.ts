// Server errors that reach Next.js (a page or a route that throws) go to
// the tower's error list, with the address and the digest the error page
// shows, so a report from a workshop can be matched to its cause.
export async function onRequestError(error: unknown, request: { path: string; headers: Record<string, string | string[] | undefined> }) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportRequestError } = await import('./lib/request-error');
    await reportRequestError(error, request);
  }
}
