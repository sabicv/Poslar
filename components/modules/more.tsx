import type { ReactNode } from 'react';
import { Fold } from '@/components/Fold';

// One optional function of a trade tab. Closed until it holds something.
// The card inside keeps its own heading; the frame around it is the row.
export function Offer({
  title,
  summary,
  filled = false,
  children,
}: {
  title: string;
  summary: string;
  // A row that already holds data starts open. An empty one stays a single line.
  filled?: boolean;
  children: ReactNode;
}) {
  return (
    <Fold title={title} summary={summary} startOpen={filled}>
      <div className="[&>*]:rounded-none [&>*]:border-0 [&>*]:bg-transparent [&>*]:shadow-none">{children}</div>
    </Fold>
  );
}

// Every offered section is on the page. `open` is true when it already
// holds data, so that row starts open and nothing entered disappears.
export function foldable(_extras?: boolean) {
  const filled = new Map<string, boolean>();
  const show = (name: string, hasData: boolean) => {
    filled.set(name, Boolean(hasData));
    return true;
  };
  const open = (name: string) => filled.get(name) ?? false;
  return { show, open };
}
