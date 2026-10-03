import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// The video links by topic, kept for ten minutes; the tower clears the
// cache when it saves one, so a new link shows at once.
export const loadHelpVideos = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const { data } = await createAdminClient().from('help_videos').select('topic, url');
    return Object.fromEntries((data ?? []).map((r) => [r.topic as string, r.url as string]));
  },
  ['help-videos'],
  { revalidate: 600, tags: ['help-videos'] }
);

export async function helpVideo(topic: string): Promise<string | null> {
  return (await loadHelpVideos())[topic] ?? null;
}
