import Link from 'next/link';
import { buttonClass } from '@/components/ui';
import { PERIODS, PERIOD_ORDER } from '@/lib/archive';
import { cn } from '@/lib/utils';

export type PeriodKey = keyof typeof PERIODS;

// The same period choice on every tab of Poslovanje (Pregled, Arhiva):
// Ovaj mjesec, Prošli mjesec, Zadnjih 90 dana, Ova godina, Prošla godina, Sve.
export function PeriodChips({ active, href }: { active: string; href: (key: PeriodKey) => string }) {
  return (
    <nav aria-label="Razdoblje" className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {PERIOD_ORDER.map((key) => (
        <Link key={key} href={href(key)} aria-current={active === key ? 'page' : undefined} className={cn(buttonClass(active === key ? 'primary' : 'secondary', 'sm'), 'shrink-0 rounded-full')}>
          {PERIODS[key]}
        </Link>
      ))}
    </nav>
  );
}
