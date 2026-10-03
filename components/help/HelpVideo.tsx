import { helpVideo } from '@/lib/help';
import { VideoChip } from './VideoChip';

// The "Video" button for one topic, or nothing while it has no link.
export async function HelpVideo({ topic, label, className }: { topic: string; label?: string; className?: string }) {
  return <VideoChip href={await helpVideo(topic)} label={label} className={className} />;
}
