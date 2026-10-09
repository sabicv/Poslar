import type { WorkshopContext } from '@/lib/session';
import { DuePlans } from './DuePlans';

// The page of a trade without tables of its own: the recurring service that is due.
export function GenericPage({ ctx }: { ctx: WorkshopContext }) {
  return <DuePlans ctx={ctx} emptyHint={ctx.pkg.plan?.hint ?? 'Servisni plan se uključuje na nalogu. Mušterija se ovdje pojavi mjesec dana prije roka.'} />;
}
