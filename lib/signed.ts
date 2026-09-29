import 'server-only';

import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { signWithThumbnails, type SignedMedia } from '@/lib/thumbnails';

// Signed URLs (1 h) for private job files, with thumbnails where they exist.
export async function signPaths(supabase: ServerSupabaseClient, paths: string[]): Promise<Map<string, SignedMedia>> {
  return signWithThumbnails(supabase.storage.from('job-files'), paths);
}
