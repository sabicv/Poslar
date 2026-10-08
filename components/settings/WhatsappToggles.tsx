'use client';

import { useAction } from '@/components/client-ui';
import type { WaKind } from '@/config/whatsapp';
import { setWhatsappKind } from '@/lib/actions/whatsapp';

// One switch per automatic message, with the text the customer gets.
export function WhatsappToggles({ kinds }: { kinds: { kind: WaKind; label: string; hint: string; example: string; on: boolean }[] }) {
  const { pending, run } = useAction();
  return (
    <ul className="space-y-3">
      {kinds.map((k) => (
        <li key={k.kind} className="rounded-xl border border-line p-3">
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>
              <span className="block font-medium">{k.label}</span>
              <span className="block text-xs text-muted">{k.hint}</span>
            </span>
            <input
              type="checkbox"
              className="size-6 shrink-0 accent-[rgb(var(--accent))]"
              checked={k.on}
              disabled={pending}
              onChange={(e) => run(() => setWhatsappKind(k.kind, e.target.checked), { success: e.target.checked ? `${k.label}: uključeno` : `${k.label}: isključeno` })}
            />
          </label>
          <p className="mt-2 rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">{k.example}</p>
        </li>
      ))}
    </ul>
  );
}
