'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { NAV_PREV, urlPath } from '@/components/nav-memory';

// "← Nalozi" must pop the list you came from (same scroll), not push a
// fresh /app at the top. If you opened this page from somewhere else, the
// href still takes you to the named parent.
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className="-ml-2 mb-1 inline-flex h-12 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-fg"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const prev = sessionStorage.getItem(NAV_PREV) ?? '';
        if (!prev || urlPath(prev) !== urlPath(href)) return;
        const idx = (window.history.state as { idx?: number } | null)?.idx;
        if (typeof idx === 'number' && idx <= 0) return;
        e.preventDefault();
        router.back();
      }}
    >
      <span aria-hidden>←</span> {children}
    </Link>
  );
}
