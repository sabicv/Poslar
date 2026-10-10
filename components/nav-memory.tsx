'use client';

import { useLayoutEffect, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export const NAV_PREV = 'poslar:nav:prev';
export const NAV_CURR = 'poslar:nav:curr';

export function urlPath(url: string) {
  return url.split('?')[0];
}

function here(pathname: string, query: string) {
  return query ? `${pathname}?${query}` : pathname;
}

// Remembers the last distinct page (tabs and list filters stay on the same
// path, so they do not steal the "where I came from" entry).
export function NavMemory() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    const now = here(pathname, query);
    const curr = sessionStorage.getItem(NAV_CURR) ?? '';
    if (urlPath(curr) === pathname) {
      sessionStorage.setItem(NAV_CURR, now);
      return;
    }
    if (curr !== now) {
      sessionStorage.setItem(NAV_PREV, curr);
      sessionStorage.setItem(NAV_CURR, now);
    }
  }, [pathname, query]);
  return null;
}

// Puts the jobs board back where the thumb left it after opening a nalog.
export function RestoreScroll() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const id = here(pathname, query);

  useLayoutEffect(() => {
    const key = `poslar:scroll:${id}`;
    const apply = () => {
      const y = Number(sessionStorage.getItem(key));
      if (Number.isFinite(y) && y > 0) window.scrollTo(0, y);
    };
    apply();
    const frame = requestAnimationFrame(apply);
    const soon = window.setTimeout(apply, 0);
    const later = window.setTimeout(apply, 50);
    const save = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(soon);
      window.clearTimeout(later);
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [id]);

  return null;
}
