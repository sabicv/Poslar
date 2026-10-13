'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui';
import { uploadFile } from '@/lib/upload';

// A photograph belongs to the function that needs it (damage, meter, part).
// The file is a job attachment and shows up later in the job's trail.
export function ShotButton({
  tenantId,
  jobId,
  tag,
  caption,
  stage = null,
  zone = null,
  label,
  count = 0,
  accept = 'image/*',
  capture = true,
}: {
  tenantId: string;
  jobId: string;
  tag: string;
  caption: string;
  stage?: 'before' | 'during' | 'after' | null;
  zone?: string | null;
  label: string;
  count?: number;
  accept?: string;
  capture?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function send(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadFile({ tenantId, jobId, file, tag, caption, stage, zone, visibility: 'customer' });
      if (result && 'queued' in result && result.queued) toast.success('Spremljeno na telefonu. Šalje se kad se veza vrati.');
      else toast.success('Fotografija spremljena');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Slanje nije uspjelo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <Camera className="size-4" />
        {count ? `${label} · ${count}` : label}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        capture={capture ? 'environment' : undefined}
        className="hidden"
        onChange={(event) => {
          void send(event.target.files);
          event.target.value = '';
        }}
      />
    </>
  );
}
