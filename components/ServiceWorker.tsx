'use client';

import { useEffect, useState } from 'react';
import { flushQueue, onQueueChange, queuedCount } from '@/lib/offline-queue';

// Registers public/sw.js in production (installable app + offline page).
// The queue of photos and field steps flushes whenever the phone is back
// online, including in development.
export function ServiceWorker() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Not fatal: the site still works as a normal web page.
      });
    }

    let cancelled = false;
    const refresh = () => {
      queuedCount()
        .then((n) => {
          if (!cancelled) setWaiting(n);
        })
        .catch(() => {
          if (!cancelled) setWaiting(0);
        });
    };
    refresh();
    const off = onQueueChange(refresh);
    const onOnline = () => {
      flushQueue()
        .then((r) => {
          if (!cancelled) setWaiting(r.left);
        })
        .catch(() => refresh());
    };
    window.addEventListener('online', onOnline);
    if (navigator.onLine) onOnline();
    return () => {
      cancelled = true;
      off();
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-3 sm:bottom-4">
      <p className="pointer-events-auto rounded-full border border-warn/40 bg-surface px-4 py-2 text-center text-xs text-warn shadow-lg">
        {waiting === 1 ? '1 stavka čeka vezu' : `${waiting} stavki čeka vezu`}. Šalje se samo.
      </p>
    </div>
  );
}
