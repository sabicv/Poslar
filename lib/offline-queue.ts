'use client';

import { saveRecord } from '@/lib/actions/records';
import { uploadNow, type UploadOptions } from '@/lib/upload';

// Photos and field timestamps taken with no signal stay on the phone and
// go out when the connection returns. IndexedDB, not the service worker:
// a work order must never be served stale, but a photo must not be lost.

const DB_NAME = 'poslar-offline';
const STORE = 'queue';

export type QueuedPhoto = {
  kind: 'photo';
  id: string;
  tenantId: string;
  jobId: string | null;
  assetId: string | null;
  name: string;
  type: string;
  blob: Blob;
  tag: string | null;
  caption: string | null;
  stage: 'before' | 'during' | 'after' | null;
  zone: string | null;
  visibility: 'internal' | 'customer' | 'insurer';
};

export type QueuedField = {
  kind: 'field';
  id: string;
  jobId: string;
  column: string;
  lat: number | null;
  lng: number | null;
};

export type Queued = QueuedPhoto | QueuedField;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    if (req) req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: Queued): Promise<void> {
  await withStore('readwrite', (store) => store.put(item));
  notify();
}

export async function listQueued(): Promise<Queued[]> {
  const rows = await withStore<Queued[]>('readonly', (store) => store.getAll());
  return rows ?? [];
}

export async function queuedCount(): Promise<number> {
  const n = await withStore<number>('readonly', (store) => store.count());
  return n ?? 0;
}

async function remove(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
  notify();
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|network|slanje nije uspjelo|veze/i.test(msg);
}

export async function enqueuePhoto(opts: UploadOptions): Promise<{ id: string; path: string; queued: true }> {
  const id = `photo-${crypto.randomUUID()}`;
  await enqueue({
    kind: 'photo',
    id,
    tenantId: opts.tenantId,
    jobId: opts.jobId,
    assetId: opts.assetId ?? null,
    name: opts.file.name,
    type: opts.file.type,
    blob: opts.file,
    tag: opts.tag ?? null,
    caption: opts.caption ?? null,
    stage: opts.stage ?? null,
    zone: opts.zone ?? null,
    visibility: opts.visibility ?? 'internal',
  });
  return { id, path: '', queued: true };
}

export async function enqueueFieldStep(jobId: string, column: string, gps: { lat: number; lng: number } | null): Promise<void> {
  await enqueue({
    kind: 'field',
    id: `field-${jobId}-${column}`,
    jobId,
    column,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
  });
}

export async function flushQueue(): Promise<{ sent: number; left: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const left = await queuedCount();
    return { sent: 0, left };
  }
  const items = await listQueued();
  let sent = 0;
  for (const item of items) {
    try {
      if (item.kind === 'photo') {
        const file = new File([item.blob], item.name, { type: item.type });
        await uploadNow({
          tenantId: item.tenantId,
          jobId: item.jobId,
          assetId: item.assetId,
          file,
          tag: item.tag,
          caption: item.caption,
          stage: item.stage,
          zone: item.zone,
          visibility: item.visibility ?? 'internal',
        });
      } else {
        await saveRecord(
          'fleet_field_jobs',
          { job_id: item.jobId, [item.column]: '__now__', ...(item.lat != null && item.lng != null ? { lat: item.lat, lng: item.lng } : {}) },
          { upsertOn: 'job_id', revalidate: `/app/jobs/${item.jobId}` }
        );
      }
      await remove(item.id);
      sent++;
    } catch {
      break;
    }
  }
  const left = await queuedCount();
  return { sent, left };
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((fn) => fn());
}
export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
