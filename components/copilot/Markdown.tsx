import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Minimal, safe renderer for the assistant's answers: headings, numbered
// and bullet lists, tables, **bold** and `code`. No HTML is ever injected,
// so a malicious answer can't run script. Works on a partial (streaming)
// text too.

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    parts.push(
      token.startsWith('**') ? (
        <strong key={match.index} className="font-semibold text-fg">
          {token.slice(2, -2)}
        </strong>
      ) : (
        <code key={match.index} className="rounded bg-surface2 px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      )
    );
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Block =
  | { type: 'heading'; text: string }
  | { type: 'ol' | 'ul'; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'p'; text: string };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    const last = blocks[blocks.length - 1];
    if (!trimmed) continue;
    if (/^#{1,4}\s/.test(trimmed)) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^#{1,4}\s+/, '') });
    } else if (/^\d+[.)]\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+[.)]\s+/, '');
      if (last?.type === 'ol') last.items.push(text);
      else blocks.push({ type: 'ol', items: [text] });
    } else if (/^[-*•]\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*•]\s+/, '');
      if (last?.type === 'ul') last.items.push(text);
      else blocks.push({ type: 'ul', items: [text] });
    } else if (trimmed.startsWith('|')) {
      const cells = trimmed.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      if (last?.type === 'table') last.rows.push(cells);
      else blocks.push({ type: 'table', rows: [cells] });
    } else if (last?.type === 'p') {
      last.text += `\n${trimmed}`;
    } else {
      blocks.push({ type: 'p', text: trimmed });
    }
  }
  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('space-y-3 text-sm leading-relaxed text-muted', className)}>
      {parse(text).map((block, i) => {
        if (block.type === 'heading') {
          return (
            <h3 key={i} className="pt-2 text-sm font-semibold tracking-wide text-fg first:pt-0">
              {inline(block.text)}
            </h3>
          );
        }
        if (block.type === 'ol' || block.type === 'ul') {
          const List = block.type === 'ol' ? 'ol' : 'ul';
          return (
            <List key={i} className={cn('space-y-1.5 pl-5', block.type === 'ol' ? 'list-decimal' : 'list-disc')}>
              {block.items.map((item, j) => (
                <li key={j} className={cn(item.startsWith('⚠️') && 'text-warn')}>
                  {inline(item)}
                </li>
              ))}
            </List>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={i} className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {block.rows.map((row, r) => (
                    <tr key={r} className={cn(r === 0 && 'bg-surface2 font-medium text-fg')}>
                      {row.map((cell, c) => (
                        <td key={c} className="px-3 py-1.5 align-top">
                          {inline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type !== 'p') return null;
        return (
          <p key={i} className={cn('whitespace-pre-line', block.text.startsWith('⚠️') && 'text-warn')}>
            {block.text.split('\n').map((line, j) => (
              <Fragment key={j}>
                {j > 0 ? '\n' : null}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
