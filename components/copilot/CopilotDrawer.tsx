'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Info, RefreshCw, Sparkles, Square } from 'lucide-react';
import { DictateButton, Sheet } from '@/components/client-ui';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Markdown } from './Markdown';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

// Reads a plain-text stream from /api/copilot, calling onText with the
// growing answer. Errors come back as JSON with a message.
async function streamCopilot(body: object, onText: (text: string) => void, signal: AbortSignal) {
  const res = await fetch('/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? 'Kopilot trenutno nije dostupan.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return { text, cached: res.headers.get('X-Copilot-Cached') === '1' };
}

export function CopilotDrawer({ jobId, enabled }: { jobId: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [briefingState, setBriefingState] = useState<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [briefing, turns]);

  useEffect(() => {
    if (!open || loadedRef.current || !enabled) return;
    loadedRef.current = true;
    void loadHistory();
    void loadBriefing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enabled]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function loadHistory() {
    try {
      const res = await fetch(`/api/copilot?jobId=${jobId}`);
      const data = await res.json();
      if (res.ok) setTurns((data.messages as { id: string; role: 'user' | 'assistant'; content: string }[]).map((m) => ({ id: m.id, role: m.role, content: m.content })));
    } catch {
      // History is a convenience; the briefing still loads.
    }
  }

  async function loadBriefing(refresh: boolean) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setBriefing('');
    setBriefingState('loading');
    try {
      await streamCopilot(
        { jobId, mode: 'briefing', refresh },
        (text) => {
          setBriefing(text);
          setBriefingState('streaming');
        },
        controller.signal
      );
      setBriefingState('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
      setBriefingState('error');
    }
  }

  async function ask(text = question) {
    const q = text.trim();
    if (q.length < 2 || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const answerId = `a-${Date.now()}`;
    setQuestion('');
    setError(null);
    setBusy(true);
    setTurns((t) => [...t, { id: `q-${Date.now()}`, role: 'user', content: q }, { id: answerId, role: 'assistant', content: '', streaming: true }]);
    try {
      await streamCopilot(
        { jobId, mode: 'question', question: q },
        (answer) => setTurns((t) => t.map((turn) => (turn.id === answerId ? { ...turn, content: answer } : turn))),
        controller.signal
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      setTurns((t) => t.filter((turn) => turn.id !== answerId || turn.content));
    } finally {
      setTurns((t) => t.map((turn) => (turn.id === answerId ? { ...turn, streaming: false } : turn)));
      setBusy(false);
    }
  }

  async function showContext() {
    if (context) return setContext(null);
    const res = await fetch(`/api/copilot?jobId=${jobId}&context=1`);
    const data = await res.json().catch(() => null);
    setContext(data?.context ? JSON.stringify(data.context, null, 2) : 'Podaci nisu dostupni.');
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="AI Kopilot"
      trigger={
        <Button variant="secondary" className="border-accent/40 bg-accent/10 text-fg hover:bg-accent/20">
          <Sparkles className="size-4 text-accent" /> Kopilot
        </Button>
      }
    >
      {!enabled ? (
        <div className="space-y-2 pb-4 text-sm text-muted">
          <p>AI Kopilot još nije uključen za ovu instalaciju.</p>
          <p className="text-xs text-faint">Administrator treba upisati ANTHROPIC_API_KEY u postavke poslužitelja.</p>
        </div>
      ) : (
        <div className="flex min-h-[60dvh] flex-col">
          <div className="flex-1 space-y-5 pb-4">
            <section className="rounded-2xl border border-line bg-bg p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  <Sparkles className="size-3.5" /> Uputa za nalog
                </p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={showContext} className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface2 hover:text-fg" aria-label="Podaci koje Kopilot koristi">
                    <Info className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => loadBriefing(true)}
                    disabled={briefingState === 'loading' || briefingState === 'streaming'}
                    className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-surface2 hover:text-fg disabled:opacity-40"
                    aria-label="Osvježi uputu"
                  >
                    <RefreshCw className={cn('size-4', (briefingState === 'loading' || briefingState === 'streaming') && 'animate-spin')} />
                  </button>
                </div>
              </div>
              {context ? (
                <pre className="mb-3 max-h-64 overflow-auto rounded-xl border border-line bg-surface p-3 font-mono text-[11px] leading-snug text-muted">{context}</pre>
              ) : null}
              {briefingState === 'loading' ? (
                <div className="space-y-2">
                  {[92, 80, 86, 60].map((w) => (
                    <div key={w} className="h-3 animate-pulse rounded bg-surface2" style={{ width: `${w}%` }} />
                  ))}
                  <p className="pt-1 text-xs text-faint">Čitam nalog, kodove i nalaze…</p>
                </div>
              ) : briefing ? (
                <Markdown text={briefing} />
              ) : null}
            </section>

            {turns.map((turn) =>
              turn.role === 'user' ? (
                <div key={turn.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-[15px] text-fg">
                  {turn.content}
                </div>
              ) : (
                <div key={turn.id} className="max-w-[95%]">
                  {turn.content ? <Markdown text={turn.content} /> : <div className="h-3 w-24 animate-pulse rounded bg-surface2" />}
                </div>
              )
            )}
            {error ? <p className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-sm text-crit">{error}</p> : null}
            <p className="text-[11px] text-faint">AI može pogriješiti. Vrijednosti označene „tipično — provjeriti” potvrdite u servisnoj dokumentaciji ili na pločici uređaja.</p>
            <div ref={endRef} />
          </div>

          <form
            className="sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pb-2 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Pitajte, npr. „Koji je moment pritezanja glave?”"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-fg outline-none placeholder:text-faint focus:border-accent"
              />
              {busy ? (
                <Button size="md" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Zaustavi" className="px-3">
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button type="submit" size="md" variant="primary" disabled={question.trim().length < 2} aria-label="Pošalji" className="px-3">
                  <ArrowUp className="size-5" />
                </Button>
              )}
            </div>
            <div className="mt-1">
              <DictateButton onText={(text) => setQuestion((q) => (q ? `${q.trimEnd()} ${text}` : text))} />
            </div>
          </form>
        </div>
      )}
    </Sheet>
  );
}
