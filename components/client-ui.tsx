'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, MapPin, Mic, MicOff, Trash2, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { ActionResult } from '@/lib/action-result';
import { spokenDigits, spokenNumber, spokenPhone } from '@/lib/spokenNumbers';
import { useSpeechToText } from '@/lib/useSpeechToText';
import { cn } from '@/lib/utils';

// Runs a Server Action with a pending flag and one toast for the outcome.
// The action's revalidatePath refreshes the page in the same round trip.
// On a slow connection a tap must never look ignored: after half a second
// a "Spremam…" toast appears and turns into the result.
let actionSeq = 0;
export function useAction() {
  const [pending, start] = useTransition();
  // quiet: autosave that shows its own status — only an error pops up.
  function run<T>(fn: () => Promise<ActionResult<T>>, options: { success?: string; onDone?: (data: T | undefined) => void; quiet?: boolean } = {}) {
    const id = `action-${++actionSeq}`;
    let shown = false;
    const timer = window.setTimeout(() => {
      if (options.quiet) return;
      shown = true;
      toast.loading('Spremam…', { id });
    }, 500);
    start(async () => {
      try {
        const result = await fn();
        window.clearTimeout(timer);
        if (!result.ok) {
          toast.error(result.error, { id });
          return;
        }
        if (options.success) toast.success(options.success, { id });
        else if (shown) toast.success('Spremljeno', { id, duration: 1500 });
        options.onDone?.(result.data);
      } catch (error) {
        window.clearTimeout(timer);
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        toast.error(offline ? 'Nema veze s internetom. Pokušajte ponovno kad se veza vrati.' : 'Nije uspjelo. Pokušajte ponovno.', {
          id,
          description: offline ? undefined : (error as Error)?.message?.slice(0, 140),
        });
      }
    });
  }
  return { pending, run };
}

// Android and browser Back close the open sheet. They do not leave the page.
function useSheetBack(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const token = Date.now() + Math.random();
    let alive = true;
    window.history.pushState({ ...(window.history.state as object | null), poslarSheet: token }, '');
    function onPop() {
      if (!alive) return;
      const state = window.history.state as { poslarSheet?: number } | null;
      if (state?.poslarSheet === token) return;
      alive = false;
      closeRef.current();
    }
    window.addEventListener('popstate', onPop);
    return () => {
      alive = false;
      window.removeEventListener('popstate', onPop);
      queueMicrotask(() => {
        if ((window.history.state as { poslarSheet?: number } | null)?.poslarSheet === token) window.history.back();
      });
    };
  }, [open]);
}

// Bottom sheet on phones, the natural place for a thumb.
export function Sheet({
  open: openProp,
  onOpenChange,
  title,
  children,
  trigger,
  action,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  children: ReactNode;
  trigger?: ReactNode;
  // A small button beside the title (e.g. the camera), where it takes no room.
  action?: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = openProp !== undefined ? openProp : uncontrolled;
  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  }
  useSheetBack(Boolean(open), () => setOpen(false));
  return (
    // handleOnly: only the grip at the top drags the sheet down, so
    // scrolling a long form never pulls it shut by accident.
    <Drawer.Root open={open} onOpenChange={setOpen} handleOnly>
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]" />
        <Drawer.Content className="accent-scope fixed inset-x-0 bottom-0 z-[80] mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-2xl border border-line bg-surface outline-none">
          <Drawer.Handle className="!mt-2.5 !h-1.5 !w-12 shrink-0 !bg-line" />
          <div className="flex items-center justify-between gap-3 pl-5 pr-2">
            <Drawer.Title className="min-w-0 flex-1 pb-2 pt-3 text-base font-semibold">{title}</Drawer.Title>
            {action}
            <Drawer.Close className="flex size-12 items-center justify-center rounded-full text-muted hover:bg-surface2 hover:text-fg" aria-label="Zatvori">
              <X className="size-5" />
            </Drawer.Close>
          </div>
          <Drawer.Description className="sr-only">{title}</Drawer.Description>
          <div
            className="overflow-y-auto overscroll-contain px-5 pb-safe"
            // Once the keyboard is up, bring the field being typed into the middle.
            onFocusCapture={(event) => {
              const el = event.target as HTMLElement;
              if (el.matches('input, textarea, select')) window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
            }}
          >
            <div className="pb-5">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  tone?: 'ok' | 'warn' | 'crit' | 'accent' | 'neutral';
}

const SEGMENT_ACTIVE: Record<string, string> = {
  ok: 'bg-ok text-black',
  warn: 'bg-warn text-black',
  crit: 'bg-crit text-white',
  accent: 'bg-accent text-accent-fg',
  neutral: 'bg-fg text-bg',
};

// Big one-tap choice (OK / Pratiti / Hitno), usable with gloves.
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  disabled,
}: {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: 'md' | 'lg';
  disabled?: boolean;
}) {
  return (
    <div className={cn('grid gap-1 rounded-xl border border-line bg-bg p-1', disabled && 'opacity-60')} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
              size === 'lg' ? 'h-14' : 'h-12 sm:h-9',
              active ? SEGMENT_ACTIVE[option.tone ?? 'accent'] : 'text-muted hover:bg-surface2 hover:text-fg'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Confirms in place instead of a browser dialog: first tap arms, second acts.
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Sigurno?',
  variant = 'danger',
  size = 'sm',
  disabled,
  className,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'secondary' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      variant={armed ? 'danger' : variant}
      size={size}
      disabled={disabled}
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

// Deleting, asked in plain words: the first tap opens a short question
// with "Da, obriši" and "Odustani", which stays until answered (no
// countdown to miss on a phone).
export function DeleteConfirm({
  label,
  question,
  detail,
  confirmLabel = 'Da, obriši',
  onConfirm,
  disabled,
  size = 'lg',
  className,
}: {
  label: string;
  question: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant="danger" size={size} disabled={disabled} className={className} onClick={() => setAsking(true)}>
        <Trash2 className="size-4" /> {label}
      </Button>
    );
  }
  return (
    <div className={cn('space-y-3 rounded-xl border border-crit/40 bg-crit/10 p-3', className)}>
      <p className="text-sm font-medium">{question}</p>
      {detail ? <p className="text-xs text-muted">{detail}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size={size}
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" size={size} onClick={() => setAsking(false)}>
          Odustani
        </Button>
      </div>
    </div>
  );
}

// Appends dictated Croatian speech to a text field. compact: a microphone
// icon that sits beside a one-line field. onInterim: the words heard so far,
// for a field that shows them itself (the button then shows only itself).
export function DictateButton({ onText, compact = false, onInterim }: { onText: (text: string) => void; compact?: boolean; onInterim?: (text: string) => void }) {
  const { isSupported, isRecording, interimText, toggleRecording } = useSpeechToText({ onFinalText: onText });
  useEffect(() => {
    onInterim?.(isRecording ? interimText : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interimText, isRecording]);
  if (!isSupported) return null;
  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleRecording}
        aria-label={isRecording ? 'Zaustavi diktiranje' : 'Diktiraj'}
        className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl border', isRecording ? 'border-crit/40 bg-crit/15 text-crit' : 'border-line text-muted hover:text-fg')}
      >
        {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </button>
    );
  }
  const button = (
    <Button size="sm" variant={isRecording ? 'danger' : 'secondary'} onClick={toggleRecording} aria-label={isRecording ? 'Zaustavi diktiranje' : 'Diktiraj'} className="shrink-0">
      {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      {isRecording ? 'Stop' : 'Diktiraj'}
    </Button>
  );
  if (onInterim) return button;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {button}
      {interimText ? <span className="min-w-0 break-words text-xs text-faint">{interimText}</span> : null}
    </div>
  );
}

// A one-line field with a microphone inside it. One dictation fills the
// field: the phone hands over what was said piece by piece ("091", then
// "234", then "5678"), and the pieces are joined, never written over each
// other. Tidied for the field: names get capitals, a phone and an OIB keep
// only digits (spoken words become digits too), a plate becomes
// "ZG-1234-AB", a VIN loses its spaces.
export type DictateMode = 'text' | 'name' | 'phone' | 'plate' | 'number' | 'digits' | 'vin' | 'email';
function tidySpoken(text: string, mode: DictateMode): string {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (mode === 'name') return t.replace(/(^|\s|-)(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
  // Numbers come as digits or as words ("pet", "dvanaest i pol").
  if (mode === 'phone') return spokenPhone(t);
  if (mode === 'digits') return spokenDigits(t);
  if (mode === 'number') return spokenNumber(t);
  if (mode === 'vin') return t.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (mode === 'email') return t.toLowerCase().replace(/\s+/g, '');
  if (mode === 'plate')
    return t
      .toUpperCase()
      .replace(/[^A-Z0-9ČĆŽŠĐ ]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function DictateInput({
  value,
  onValue,
  mode = 'text',
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValue: (value: string) => void; mode?: DictateMode }) {
  // Everything heard since the microphone was switched on.
  const spoken = useRef('');
  const { isSupported, isRecording, toggleRecording } = useSpeechToText({
    onFinalText: (text) => {
      spoken.current = `${spoken.current} ${text}`.trim();
      onValue(tidySpoken(spoken.current, mode));
    },
  });
  return (
    <div className="relative">
      <Input {...props} value={value} onChange={(e) => onValue(e.target.value)} className={cn(isSupported && 'pr-12', className)} />
      {isSupported ? (
        <button
          type="button"
          onClick={() => {
            // A new dictation starts the field afresh.
            if (!isRecording) spoken.current = '';
            toggleRecording();
          }}
          aria-label={isRecording ? 'Zaustavi diktiranje' : 'Diktiraj'}
          className={cn('absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg', isRecording ? 'bg-crit/15 text-crit' : 'text-faint hover:text-fg')}
        >
          {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
      ) : null}
    </div>
  );
}

// Finger signature → PNG. Pointer events cover mouse, pen and touch.
export function SignaturePad({ onChange, height = 160 }: { onChange: (blob: Blob | null) => void; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
  }, [height]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current?.toBlob((blob) => onChange(blob), 'image/png');
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-line bg-white">
        <canvas
          ref={canvasRef}
          style={{ height, width: '100%', touchAction: 'none' }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = true;
            setEmpty(false);
            const ctx = canvasRef.current?.getContext('2d');
            const p = point(event);
            ctx?.beginPath();
            ctx?.moveTo(p.x, p.y);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current?.getContext('2d');
            const p = point(event);
            ctx?.lineTo(p.x, p.y);
            ctx?.stroke();
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
        {empty ? <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Potpis prstom</span> : null}
      </div>
      <Button size="sm" variant="ghost" onClick={clear} disabled={empty}>
        Obriši potpis
      </Button>
    </div>
  );
}

export interface LightboxItem {
  id: string;
  url: string;
  label: string;
  caption?: string | null;
  when?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
}

// Full-screen viewer with pinch-zoom, pan and double-tap.
export function Lightbox({ items, index: startIndex, onClose }: { items: LightboxItem[]; index: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  });

  function go(step: number) {
    setScale(1);
    setShift({ x: 0, y: 0 });
    setIndex((i) => (i + step + items.length) % items.length);
  }

  const item = items[index];
  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex animate-fade-in flex-col bg-black pb-safe pt-safe text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.label}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-white/60">
            {item.when ? <span>{item.when}</span> : null}
            {item.gpsLat != null && item.gpsLng != null ? (
              <a href={`https://www.google.com/maps?q=${item.gpsLat},${item.gpsLng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                <MapPin className="size-3.5" /> Lokacija
              </a>
            ) : null}
            <span>
              {index + 1} / {items.length}
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} className="flex size-12 items-center justify-center rounded-full hover:bg-white/10" aria-label="Zatvori">
          <X className="size-6" />
        </button>
      </div>
      <div
        className="relative flex-1 touch-none select-none overflow-hidden"
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            const [a, b] = [event.touches[0], event.touches[1]];
            pinch.current = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale };
          } else if (event.touches.length === 1) {
            const now = Date.now();
            if (now - lastTap.current < 300) {
              setScale((s) => (s > 1 ? 1 : 2.5));
              setShift({ x: 0, y: 0 });
            }
            lastTap.current = now;
            drag.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, ox: shift.x, oy: shift.y };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2 && pinch.current) {
            const [a, b] = [event.touches[0], event.touches[1]];
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            setScale(Math.min(4, Math.max(1, (pinch.current.scale * distance) / pinch.current.distance)));
          } else if (event.touches.length === 1 && drag.current && scale > 1) {
            setShift({ x: drag.current.ox + event.touches[0].clientX - drag.current.x, y: drag.current.oy + event.touches[0].clientY - drag.current.y });
          }
        }}
        onTouchEnd={(event) => {
          if (event.touches.length === 0) {
            pinch.current = null;
            drag.current = null;
            if (scale < 1.05) {
              setScale(1);
              setShift({ x: 0, y: 0 });
            }
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.caption ?? item.label}
          draggable={false}
          className="h-full w-full object-contain"
          style={{ transform: `translate(${shift.x}px, ${shift.y}px) scale(${scale})`, transition: pinch.current ? 'none' : 'transform 150ms ease-out' }}
        />
        {items.length > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50" aria-label="Prethodna">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50" aria-label="Sljedeća">
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>
      {item.caption ? <p className="px-4 py-3 text-center text-sm text-white/80">{item.caption}</p> : null}
    </div>,
    document.body
  );
}

// Saves on blur: text fields on a job save themselves, no "Spremi" button.
// The label row carries the microphone, so dictating is one tap from the
// top of the field; under it the words being heard and when it was saved.
export function AutoSaveTextarea({
  label,
  initial,
  onSave,
  placeholder,
  rows = 3,
  disabled,
  dictate = true,
}: {
  label?: ReactNode;
  initial: string;
  onSave: (value: string) => Promise<ActionResult>;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  dictate?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [heard, setHeard] = useState('');
  const { pending, run } = useAction();

  function save(next = value) {
    if (next === saved) return;
    run(() => onSave(next), {
      onDone: () => {
        setSaved(next);
        setSavedAt(new Date());
      },
      quiet: true,
    });
  }

  // Saved a moment after the last keystroke too, not only on leaving the
  // field: closing the app mid-sentence loses nothing.
  useEffect(() => {
    if (value === saved || disabled) return;
    const timer = window.setTimeout(() => save(value), 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, saved, disabled]);

  const status = pending
    ? 'Spremam…'
    : value !== saved
      ? 'Upisujem…'
      : savedAt
        ? `Spremljeno u ${savedAt.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`
        : '';
  const mic =
    dictate && !disabled ? (
      <DictateButton
        onInterim={setHeard}
        onText={(text) => {
          const next = value ? `${value.trimEnd()} ${text}` : text;
          setValue(next);
          save(next);
        }}
      />
    ) : null;

  return (
    <div className="space-y-2">
      {label || mic ? (
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-xs font-medium text-muted">{label}</span>
          {mic}
        </div>
      ) : null}
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => save()}
        className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 leading-relaxed text-fg outline-none placeholder:text-faint focus:border-accent disabled:opacity-60"
      />
      {heard || status ? (
        <div className="flex items-start justify-between gap-3 text-xs">
          <span className="min-w-0 break-words text-faint">{heard}</span>
          <span className="shrink-0 text-faint" aria-live="polite">
            {status}
          </span>
        </div>
      ) : null}
    </div>
  );
}
