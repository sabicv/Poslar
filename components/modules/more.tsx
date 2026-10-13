import type { ReactNode } from 'react';
import { Fold } from '@/components/Fold';

// One optional function of a trade tab. Closed until it holds something.
// The card inside keeps its own heading; the frame around it is the row.
export function Offer({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  // Accepted so a caller can say the row already holds data. The summary
  // shows that; the row itself stays closed until someone asks for it.
  filled?: boolean;
  children: ReactNode;
}) {
  return (
    <Fold title={title} summary={summary}>
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
