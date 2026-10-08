'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type ScanKind = 'prometna' | 'plocica' | 'guma';

// Whether photo reading is switched on, asked once per page load and
// shared by every camera button (the answer is needed before the tap, so
// the camera can open within it).
let enabledOnce: Promise<boolean> | null = null;
function useScanEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    enabledOnce ??= fetch('/api/scan')
      .then((r) => r.json())
      .then((b: { enabled?: boolean }) => Boolean(b.enabled))
      .catch(() => false);
    let live = true;
    enabledOnce.then((v) => live && setEnabled(v));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}

// Shrinks a phone photo to a size that reads well and uploads fast.
export async function toJpeg(file: File, max = 1800): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

// The camera: opens the phone's camera, sends the photo to be read and
// hands the fields back to the form. Nothing is saved until the form is.
// "icon" is a square button that fits beside a field or in a sheet's title
// bar, where a phone has room for it.
export function ScanButton({
  kind,
  label,
  onResult,
  variant = 'icon',
  className,
  endpoint = '/api/scan',
  extra,
  hideWhenOff = false,
}: {
  kind: ScanKind;
  label: string;
  onResult: (data: Record<string, unknown>) => void;
  variant?: 'icon' | 'full';
  className?: string;
  // The door QR page reads through its own endpoint, with its token.
  endpoint?: string;
  extra?: Record<string, unknown>;
  // A customer never sees a camera that can't read yet.
  hideWhenOff?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const enabled = useScanEnabled();

  async function read(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await toJpeg(file);
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extra, kind, image }) });
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

  function open() {
    if (enabled === false) {
      toast.info('Slikanje se uključuje uskoro.', { description: 'Podaci će se sa slike upisati sami.' });
      return;
    }
    input.current?.click();
  }

  if (hideWhenOff && !enabled) return null;
  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          disabled={busy}
          onClick={open}
          aria-label={label}
          title={label}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-70',
            enabled === false && 'border-line bg-transparent text-muted',
            className
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={open}
          className={cn(
            'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/60 bg-accent/10 px-4 text-sm font-medium text-fg hover:bg-accent/15 disabled:opacity-70',
            className
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-accent" /> : <Camera className="size-5 text-accent" />}
          {busy ? 'Čitam sa slike…' : label}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => read(e.target.files?.[0])} />
    </>
  );
}
