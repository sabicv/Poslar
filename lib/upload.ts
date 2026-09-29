'use client';

import { registerAttachment } from '@/lib/actions/jobs';
import { compressImage, uploadThumbnail } from '@/lib/compressImage';
import { randomId } from '@/lib/ids';
import { readPhotoMetadata } from '@/lib/photoMetadata';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { thumbPath } from '@/lib/thumbnails';

async function sha256(file: Blob): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export interface UploadOptions {
  tenantId: string;
  jobId: string | null;
  assetId?: string | null;
  file: File;
  tag?: string | null;
  caption?: string | null;
  stage?: 'before' | 'during' | 'after' | null;
  zone?: string | null;
}

// Straight from the phone to storage (the server never carries the bytes),
// then one small call records it. EXIF time/GPS and the SHA-256 come from
// the ORIGINAL file, before compression strips them — that hash is the
// proof an insurer can check.
const MAX_BYTES = 25 * 1024 * 1024; // same limit as the job-files bucket

export async function uploadFile({ tenantId, jobId, assetId = null, file, tag = null, caption = null, stage = null, zone = null }: UploadOptions) {
  // Checked before hashing, so a huge file never gets read into memory.
  if (file.size > MAX_BYTES) throw new Error(`Datoteka „${file.name}” je veća od 25 MB.`);
  const supabase = createBrowserSupabaseClient();
  const [meta, hash] = await Promise.all([readPhotoMetadata(file), sha256(file)]);
  const body = await compressImage(file);
  const ext = body.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
  const path = `${tenantId}/${jobId ?? assetId}/${randomId()}.${ext}`;
  const bucket = supabase.storage.from('job-files');

  const { error } = await bucket.upload(path, body, { contentType: body.type || 'application/octet-stream', upsert: false });
  if (error) throw new Error('Slanje nije uspjelo. Provjerite vezu.');
  const hasThumb = body.type.startsWith('image/') ? await uploadThumbnail(bucket, path, body) : false;

  const result = await registerAttachment({
    jobId,
    assetId,
    path,
    mime: body.type || null,
    sizeBytes: body.size,
    tag,
    caption,
    stage,
    zone,
    hasThumb,
    takenAt: meta.takenAt,
    gpsLat: meta.gpsLat,
    gpsLng: meta.gpsLng,
    sha256: hash,
  });
  if (!result.ok) {
    await bucket.remove(hasThumb ? [path, thumbPath(path)] : [path]);
    throw new Error(result.error);
  }
  return { id: result.data!.id, path };
}

// Signatures and other generated PNGs.
export async function uploadBlob(tenantId: string, folder: string, blob: Blob, name: string) {
  const path = `${tenantId}/${folder}/${name}-${randomId()}.png`;
  const { error } = await createBrowserSupabaseClient().storage.from('job-files').upload(path, blob, { contentType: 'image/png', upsert: false });
  if (error) throw new Error('Slanje nije uspjelo. Provjerite vezu.');
  return path;
}
