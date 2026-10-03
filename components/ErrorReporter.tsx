'use client';

import { useEffect } from 'react';

const sent = new Set<string>();

// After a new version goes live, a page (or the installed app) opened
// before it asks for script files that no longer exist. One quiet reload
// fetches the new version; a second failure in the same minute is reported.
const STALE = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;
function reloadOnceIfStale(message: string): boolean {
  if (!STALE.test(message)) return false;
  try {
    const last = Number(sessionStorage.getItem('stale-reload') ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem('stale-reload', String(Date.now()));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

// Sends one error to the tower. Quiet by design: a few per page load, each
// message once, and noise from browser extensions or a dropped connection
// is left out.
export function reportError(error: { message?: string; stack?: string; digest?: string } | string) {
  try {
    const e = typeof error === 'string' ? { message: error } : error;
    const message = String(e.message ?? '').slice(0, 1000);
    if (reloadOnceIfStale(`${(e as { name?: string }).name ?? ''} ${message}`)) return;
    if (!message || sent.size >= 8 || sent.has(message)) return;
    if (/ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|AbortError|Load failed|Failed to fetch|NetworkError|cancelled|NEXT_REDIRECT|NEXT_NOT_FOUND/i.test(`${message} ${e.stack ?? ''}`)) return;
    sent.add(message);
    const body = JSON.stringify({ message, stack: e.stack?.slice(0, 8000), url: location.pathname + location.search, digest: e.digest });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/errors', new Blob([body], { type: 'application/json' }));
    else void fetch('/api/errors', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
  } catch {
    // Reporting must never break the page.
  }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; stack?: string } | string | undefined;
      reportError(typeof reason === 'string' ? reason : { message: reason?.message ?? 'Unhandled rejection', stack: reason?.stack });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
