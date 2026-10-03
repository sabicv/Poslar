// Supabase returns at most 1000 rows per request ("max rows"), and a long
// list of ids does not fit in one address. These two read past both, so
// counts and sums stay right as workshops and the platform grow.
// Every query given here needs a stable order (end it with .order('id')),
// so pages neither repeat nor skip rows.

const PAGE = 1000;

type Result<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

// Every row of a query, a page at a time.
export async function allRows<T>(page: (from: number, to: number) => Result<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

// The same query for many ids, 100 ids per request, every row of each.
export async function inChunks<T>(ids: string[], query: (chunk: string[]) => { range(from: number, to: number): Result<T> }): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const results = await Promise.all(chunks.map((chunk) => allRows<T>((from, to) => query(chunk).range(from, to))));
  return results.flat();
}
