import Link from 'next/link';
import { FlaskConical } from 'lucide-react';

// The open demo (lib/guest.ts): how long it lasts, that it is not for real
// data, and the way to a workshop of one's own.
export function GuestBanner({ hours, pkg }: { hours: number; pkg: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      <FlaskConical className="size-5 shrink-0 text-accent" />
      <span className="flex-1">Demo verzija: još {hours} h, onda se briše. Ne upisujte prave podatke mušterija.</span>
      <Link href={`/register?paket=${pkg}`} className="font-medium text-accent hover:underline">
        Otvorite svoju radionicu
      </Link>
    </div>
  );
}
