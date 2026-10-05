'use client';

// Unsaved typing (new job form, dictated notes) is mirrored into
// localStorage so a closed tab, dead battery or lost signal doesn't lose
// it. Storage can be unavailable (private mode, quota) — every call is
// best-effort and never throws.
//
// A draft carries the time it was saved; one older than `maxAgeMs` (or
// saved before drafts carried a time) is dropped, so yesterday's half-typed
// job never turns up in today's form.

interface Envelope<T> {
  at: number;
  data: T;
}

export function readDraft<T>(key: string, maxAgeMs = Infinity): { data: T; at: number } | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Envelope<T> | null;
    if (!parsed || typeof parsed.at !== 'number' || !('data' in parsed) || Date.now() - parsed.at > maxAgeMs) {
      window.localStorage.removeItem(key);
      return null;
    }
    return { data: parsed.data, at: parsed.at };
  } catch {
    return null;
  }
}

export function writeDraft(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: value }));
  } catch {
    // Ignore — the in-memory form still works.
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}
