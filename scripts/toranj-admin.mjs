// node scripts/toranj-admin.mjs e-mail [lozinka]   (or: npm run toranj -- e-mail lozinka)
// Opens the tower (/admin) for one account. A new e-mail gets an account
// with that password; an existing account only gets access (its password
// stays, unless --nova-lozinka is added). `--ukloni` takes access away.
// Run it in your own terminal: the password never leaves your computer.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [email, password] = args.filter((a) => !a.startsWith('--'));
if (!email || !/@/.test(email)) {
  console.error("Upotreba: node scripts/toranj-admin.mjs 'tvoj@email.hr' 'Lozinka'  (lozinka samo za novi račun)");
  process.exit(1);
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 1000) break;
}

if (flags.has('--ukloni')) {
  if (user) await sb.from('platform_admins').delete().eq('user_id', user.id);
  console.log(`Pristup Tornju uklonjen: ${email}`);
  process.exit(0);
}

if (!user) {
  if (!password || password.length < 10) {
    console.error('Za novi račun upišite i lozinku od barem 10 znakova.');
    process.exit(1);
  }
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Toranj' } });
  if (error) throw error;
  user = data.user;
  console.log(`Novi račun: ${email}`);
} else if (flags.has('--nova-lozinka')) {
  if (!password || password.length < 10) {
    console.error('Nova lozinka mora imati barem 10 znakova.');
    process.exit(1);
  }
  const { error } = await sb.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
  console.log('Lozinka promijenjena.');
}

const { error } = await sb.from('platform_admins').upsert({ user_id: user.id }, { onConflict: 'user_id' });
if (error) throw error;
console.log(`Toranj otvoren za ${email}. Ulaz: /admin, ili Postavke → Toranj ako račun ima i radionicu.`);
