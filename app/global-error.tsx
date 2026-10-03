'use client';

import { useEffect } from 'react';
import { reportError } from '@/components/ErrorReporter';

// The last resort, when even the root layout fails: plain HTML, reported.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="hr">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0F172A', color: '#F1F5F9', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 360, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>Nešto nije uspjelo</h1>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Greška je javljena TaktiX podršci. Pokušajte ponovno.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, height: 44, padding: '0 20px', borderRadius: 12, border: 0, background: '#6CC5EA', color: '#0B1120', fontWeight: 600 }}>
            Pokušaj ponovno
          </button>
        </div>
      </body>
    </html>
  );
}
