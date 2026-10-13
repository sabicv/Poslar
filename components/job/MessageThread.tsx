'use client';

import { useState } from 'react';
import { HandHelping, Send } from 'lucide-react';
import { DictateButton, useAction } from '@/components/client-ui';
import { Badge, Button, EmptyState, Select, Textarea } from '@/components/ui';
import { sendMessage, setMessageStatus } from '@/lib/actions/jobs';
import { cn } from '@/lib/utils';

export interface MessageView {
  id: string;
  kind: 'task' | 'help';
  body: string;
  status: 'open' | 'taken' | 'done';
  mine: boolean;
  from: string;
  to: string | null;
  forMe: boolean;
  when: string;
}

const STATUS = { open: { label: 'Otvoreno', tone: 'warn' }, taken: { label: 'Preuzeto', tone: 'accent' }, done: { label: 'Riješeno', tone: 'ok' } } as const;

// Owner → worker tasks and worker → owner "Trebam pomoć", kept on the job.
export function MessageThread({
  jobId,
  me,
  isOwner,
  workers,
  messages,
}: {
  jobId: string | null;
  me: string;
  isOwner: boolean;
  workers: { id: string; name: string }[];
  messages: MessageView[];
}) {
  const { pending, run } = useAction();
  const [body, setBody] = useState('');
  const [receiver, setReceiver] = useState(workers[0]?.id ?? '');

  function send() {
    const kind = isOwner ? 'task' : 'help';
    run(() => sendMessage(jobId, kind, body, isOwner ? receiver || null : null), { success: isOwner ? 'Zadatak poslan' : 'Zahtjev za pomoć poslan', onDone: () => setBody('') });
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <EmptyState icon={<HandHelping className="size-8" />} title="Nema poruka">
          {isOwner ? (jobId ? 'Pošaljite radniku zadatak vezan uz ovaj nalog.' : 'Pošaljite radniku zadatak koji nije vezan uz nalog.') : 'Zapeli ste? Pošaljite voditelju „Trebam pomoć”.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={cn('max-w-[85%] rounded-2xl border px-4 py-3', m.mine ? 'ml-auto border-accent/30 bg-accent/10' : 'border-line bg-surface')}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-medium text-fg">{m.from}</span>
                {m.to ? <span>→ {m.to}</span> : null}
                <Badge tone={m.kind === 'help' ? 'crit' : 'neutral'}>{m.kind === 'help' ? 'Trebam pomoć' : 'Zadatak'}</Badge>
                <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-faint">{m.when}</span>
                {(m.forMe || m.mine || isOwner) && m.status !== 'done' ? (
                  <span className="flex gap-1.5">
                    {m.status === 'open' && m.forMe ? (
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setMessageStatus(m.id, jobId, 'taken'))}>
                        Preuzimam
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ok" disabled={pending} onClick={() => run(() => setMessageStatus(m.id, jobId, 'done'))}>
                      Riješeno
                    </Button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-line bg-surface p-3">
        {isOwner ? (
          workers.length ? (
            <Select value={receiver} onChange={(e) => setReceiver(e.target.value)} className="mb-2">
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  Za: {w.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="mb-2 text-xs text-muted">Dodajte radnike u Postavke → Tim da biste im slali zadatke.</p>
          )
        ) : null}
        <div className="flex items-start gap-2">
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={isOwner ? 'Zadatak…' : 'Opišite gdje ste zapeli…'} />
          <DictateButton compact onText={(text) => setBody((b) => (b ? `${b.trimEnd()} ${text}` : text))} />
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant={isOwner ? 'primary' : 'danger'} disabled={pending || !body.trim() || (isOwner && !receiver)} onClick={send} data-me={me}>
            {isOwner ? <Send className="size-4" /> : <HandHelping className="size-4" />}
            {isOwner ? 'Pošalji zadatak' : 'Trebam pomoć'}
          </Button>
        </div>
      </div>
    </div>
  );
}
