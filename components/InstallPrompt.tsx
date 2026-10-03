'use client';

import { useEffect, useState } from 'react';
import { Share, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const KEY = 'install-prompt-dismissed';

// "Stavite aplikaciju na početni zaslon": on Android one tap (the browser's
// own install prompt), on iPhone a two-step hint, since Safari has no
// button for it. Hidden once installed or once closed.
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === '1';
    } catch {
      // Private mode: just show it.
    }
    if (standalone || dismissed) return;
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setIos(true);
      setHidden(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function close() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Nothing to remember it in.
    }
  }

  if (hidden || (!event && !ios)) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
      <Smartphone className="mt-0.5 size-6 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Stavite aplikaciju na početni zaslon</p>
        {ios ? (
          <p className="mt-1 text-sm text-muted">
            Dodirnite <Share className="inline size-4 align-text-bottom" /> Dijeli, zatim „Dodaj na početni zaslon”.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Otvara se preko cijelog ekrana, kao prava aplikacija.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await event?.prompt();
                const choice = await event?.userChoice;
                if (choice?.outcome === 'accepted') close();
              }}
            >
              Instaliraj
            </Button>
          </>
        )}
      </div>
      <button type="button" onClick={close} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface2" aria-label="Zatvori">
        <X className="size-4" />
      </button>
    </div>
  );
}
