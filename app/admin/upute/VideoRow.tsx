'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAction } from '@/components/client-ui';
import { Button, Input } from '@/components/ui';
import { adminSetHelpVideo } from '@/lib/actions/admin';

// One topic: paste the link, save; save an empty field to take it down.
export function VideoRow({ topic, url }: { topic: string; url: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [value, setValue] = useState(url);
  const changed = value.trim() !== url;
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://youtu.be/…" inputMode="url" aria-label="Poveznica na video" className="min-w-0 flex-1" />
      <Button
        variant={changed ? 'primary' : 'secondary'}
        disabled={pending || !changed}
        onClick={() => run(() => adminSetHelpVideo(topic, value), { success: value.trim() ? 'Video spremljen' : 'Video maknut', onDone: () => router.refresh() })}
      >
        Spremi
      </Button>
    </div>
  );
}
