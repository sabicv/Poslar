import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

// The one "Više" button of a package tab: names what is folded away and
// opens it all in one tap (?vise=1). Sections that already hold data are
// never folded, so nothing entered ever disappears.
export function MoreSections({ href, hidden }: { href: string; hidden: string[] }) {
  if (!hidden.length) return null;
  return (
    <Link
      href={href}
      replace
      scroll={false}
      prefetch={false}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-muted hover:text-fg"
    >
      <ChevronDown className="size-4 shrink-0" />
      Više: {hidden.join(', ')}
    </Link>
  );
}

// Collects which sections are shown: a section shows when "Više" is open or
// when it already has data.
export function foldable(extras: boolean) {
  const hidden: string[] = [];
  const show = (name: string, hasData: boolean) => {
    const visible = extras || hasData;
    if (!visible) hidden.push(name);
    return visible;
  };
  return { show, hidden };
}
