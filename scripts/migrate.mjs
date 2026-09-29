// npm run db:migrate — applies supabase/migrations/*.sql to the database in
// SUPABASE_DB_URL, in order, each in its own transaction. Applied files are
// recorded in xfiles_meta.migrations (a schema the public API never
// exposes). The migrations are idempotent, so `--all` safely re-runs them.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const url = process.env.SUPABASE_DB_URL;
// The password may also be given on its own, so special characters in it
// (@ # / :) never have to be URL-encoded into the connection string.
const password = process.env.SUPABASE_DB_PASSWORD || undefined;
if (!url || /\[(YOUR-)?PASSWORD\]/.test(url) || (!password && !/:\/\/[^/]+:[^@]+@/.test(url))) {
  console.error('Upišite SUPABASE_DB_URL i lozinku baze (SUPABASE_DB_PASSWORD) u .env.local.');
  process.exit(1);
}

const all = process.argv.includes('--all');
const dir = path.join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: url, password, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query('create schema if not exists xfiles_meta');
await client.query('create table if not exists xfiles_meta.migrations (name text primary key, applied_at timestamptz not null default now())');
const { rows } = await client.query('select name from xfiles_meta.migrations');
const applied = new Set(rows.map((r) => r.name));

let count = 0;
for (const file of files) {
  if (applied.has(file) && !all) {
    console.log(`  = ${file} (već primijenjeno)`);
    continue;
  }
  const sql = readFileSync(path.join(dir, file), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into xfiles_meta.migrations (name) values ($1) on conflict (name) do update set applied_at = now()', [file]);
    await client.query('commit');
    console.log(`  ✓ ${file}`);
    count++;
  } catch (error) {
    await client.query('rollback');
    console.error(`  ✗ ${file}: ${error.message}`);
    await client.end();
    process.exit(1);
  }
}
// Let PostgREST see new tables and functions immediately.
await client.query(`notify pgrst, 'reload schema'`);
await client.end();
console.log(count ? `Gotovo: ${count} migracija primijenjeno.` : 'Baza je već ažurna.');
