import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { GUEST_AI_TOTAL } from '@/lib/guest';

// The open demo (lib/guest.ts): it does not expire. The taste of photo
// reading and Poslar's answers is shared, and the way out is a workshop
// of one's own.
export function GuestBanner({ pkg, left }: { pkg: string; left: number }) {
  const taste = left > 0 ? `Slikanje i odgovori Poslara: još ${left} od ${GUEST_AI_TOTAL}.` : `Slikanje i odgovori Poslara su potrošeni (${GUEST_AI_TOTAL} ukupno).`;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      <FlaskConical className="size-5 shrink-0 text-accent" />
      <span className="flex-1">Demo verzija s izmišljenim podacima. Ne upisujte prave podatke mušterija. {taste}</span>
      <Link href={`/register?paket=${pkg}`} className="font-medium text-accent hover:underline">
        Otvorite svoju radionicu
      </Link>
    </div>
  );
}
