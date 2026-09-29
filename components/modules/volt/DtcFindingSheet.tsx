'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Segmented, Sheet, useAction } from '@/components/client-ui';
import { Button, Field, Input } from '@/components/ui';
import { searchDtcCodes } from '@/config/packages/volt-dtc';
import { saveRecord } from '@/lib/actions/records';
import { cn } from '@/lib/utils';

const MODULES = ['ECM', 'TCM', 'ABS', 'BCM', 'SRS', 'IPC', 'HVAC', 'Gateway', 'IMMO', 'EPS', 'Radio'];

// Code entry with the built-in library: typing "0299" or "turbo" suggests
// P0299 with its Croatian description.
export function DtcFindingSheet({ jobId, scanId, custom }: { jobId: string; scanId: string; custom: { code: string; description: string }[] }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState('ECM');
  const [status, setStatus] = useState<'active' | 'stored' | 'intermittent'>('active');

  const suggestions = useMemo(() => {
    const own = code.trim().length >= 2 ? custom.filter((c) => c.code.startsWith(code.trim().toUpperCase())).slice(0, 3) : [];
    return [...own, ...searchDtcCodes(code, 6).map((e) => ({ code: e.code, description: e.description }))];
  }, [code, custom]);

  function reset() {
    setCode('');
    setDescription('');
  }

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Kod greške"
      trigger={
        <Button size="sm" variant="secondary">
          <Plus className="size-4" /> Kod
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Kod ili ključna riječ">
          <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono uppercase" placeholder="P0299, U0100, turbo…" autoFocus />
        </Field>
        {suggestions.length && !description ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {suggestions.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface2"
                  onClick={() => {
                    setCode(s.code);
                    setDescription(s.description);
                  }}
                >
                  <span className="font-mono text-sm font-bold">{s.code}</span>
                  <span className="text-sm text-muted">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Field label="Opis">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Modul</p>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModule(m)}
                className={cn('h-10 rounded-full border px-3.5 text-sm', module === m ? 'border-accent bg-accent/15' : 'border-line text-muted')}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Aktivan', tone: 'crit' },
            { value: 'stored', label: 'Memoriran', tone: 'warn' },
            { value: 'intermittent', label: 'Povremen', tone: 'warn' },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            disabled={pending || !code.trim()}
            onClick={() =>
              run(() => saveRecord('volt_dtc_findings', { scan_id: scanId, job_id: jobId, code: code.trim().toUpperCase(), description: description || null, module, status }, { revalidate: `/app/jobs/${jobId}` }), {
                success: 'Kod dodan',
                onDone: reset,
              })
            }
          >
            Spremi i sljedeći
          </Button>
          <Button
            size="lg"
            variant="primary"
            disabled={pending || !code.trim()}
            onClick={() =>
              run(() => saveRecord('volt_dtc_findings', { scan_id: scanId, job_id: jobId, code: code.trim().toUpperCase(), description: description || null, module, status }, { revalidate: `/app/jobs/${jobId}` }), {
                success: 'Kod dodan',
                onDone: () => {
                  reset();
                  setOpen(false);
                },
              })
            }
          >
            Spremi
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
