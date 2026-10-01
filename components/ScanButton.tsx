'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type ScanKind = 'prometna' | 'plocica' | 'guma';

// Shrinks a phone photo to a size that reads well and uploads fast.
async function toJpeg(file: File, max = 1800): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

// "Slikaj prometnu": opens the camera, sends the photo to be read and hands
// the fields back to the form. Nothing is saved until the form is.
export function ScanButton({ kind, label, onResult, className }: { kind: ScanKind; label: string; onResult: (data: Record<string, unknown>) => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function read(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await toJpeg(file);
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, image }) });
      const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok || !body.data) throw new Error(body.error ?? 'Čitanje slike nije uspjelo.');
      onResult(body.data);
      toast.success('Pročitano. Provjerite podatke prije spremanja.');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cn(
          'flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/60 bg-accent/10 px-4 text-sm font-medium text-fg hover:bg-accent/15 disabled:opacity-70',
          className
        )}
      >
        {busy ? <Loader2 className="size-5 animate-spin text-accent" /> : <Camera className="size-5 text-accent" />}
        {busy ? 'Čitam sa slike…' : label}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => read(e.target.files?.[0])} />
    </>
  );
}
