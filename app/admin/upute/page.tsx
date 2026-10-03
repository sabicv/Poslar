import type { Metadata } from 'next';
import { VideoChip } from '@/components/help/VideoChip';
import { Badge, Card, PageHeader } from '@/components/ui';
import { HELP_TOPICS } from '@/config/help';
import { formatDate } from '@/lib/format';
import { requireTower } from '@/lib/tower';
import { VideoRow } from './VideoRow';

export const metadata: Metadata = { title: 'Upute' };

// How-to videos: one link per topic. The app shows a "Video" button in
// Pomoć and next to that screen as soon as a link is saved.
export default async function TowerVideos() {
  const admin = await requireTower();
  const { data } = await admin.from('help_videos').select('topic, url, updated_at');
  const saved = new Map((data ?? []).map((r) => [r.topic as string, { url: r.url as string, at: r.updated_at as string }]));

  return (
    <>
      <PageHeader title="Video upute" subtitle="Snimite kratki video, stavite ga na YouTube (može kao „Neizlistano”) i zalijepite poveznicu." />
      <Card>
        <ul className="divide-y divide-line">
          {HELP_TOPICS.map((t) => {
            const v = saved.get(t.id);
            return (
              <li key={t.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  {t.owner ? <Badge tone="muted">samo voditelj</Badge> : null}
                  {v ? <VideoChip href={v.url} label="Pogledaj" className="ml-auto" /> : null}
                </div>
                <p className="text-xs text-muted">
                  Gdje se vidi: {t.where}
                  {v ? ` · spremljeno ${formatDate(v.at)}` : ''}
                </p>
                <VideoRow topic={t.id} url={v?.url ?? ''} />
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
