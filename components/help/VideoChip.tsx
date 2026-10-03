import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// A small "Video" button next to a screen's title; opens the how-to video
// (YouTube app on the phone). Works on the server and in client components.
export function VideoChip({ href, label = 'Video', className }: { href: string | null | undefined; label?: string; className?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted hover:border-accent/60 hover:text-fg', className)}
    >
      <PlayCircle className="size-4 text-accent" /> {label}
    </a>
  );
}
