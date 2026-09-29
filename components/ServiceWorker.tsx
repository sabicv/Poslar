'use client';

import { useEffect } from 'react';

// Registers public/sw.js in production (installable app + offline page).
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal: the site still works as a normal web page.
    });
  }, []);
  return null;
}
