// Sandbox notification destination for Poslar. Reuses one whose URL already
// matches. Writes PADDLE_WEBHOOK_SECRET into .env.local. Never prints the secret.

import { readFileSync, writeFileSync } from 'node:fs';

const ENV_PATH = new URL('../.env.local', import.meta.url);
const envText = readFileSync(ENV_PATH, 'utf8');
const key = envText.match(/^PADDLE_SANDBOX_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key?.startsWith('pdl_sdbx_')) {
  console.error('U .env.local nema probnog ključa.');
  process.exit(1);
}

const DESTINATION = 'https://www.poslar.eu/api/paddle';
const EVENTS = ['subscription.created', 'subscription.updated', 'subscription.activated', 'subscription.canceled', 'transaction.completed'];

async function paddle(path, body) {
  const res = await fetch(`https://sandbox-api.paddle.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 800)}`);
  return json;
}

const existing = (await paddle('/notification-settings')).data ?? [];
let dest = existing.find((d) => d.destination === DESTINATION && d.active);
let secret = null;
if (dest) {
  console.log('odrediste postoji', dest.id);
} else {
  const created = await paddle('/notification-settings', {
    description: 'Poslar',
    type: 'url',
    destination: DESTINATION,
    api_version: 1,
    subscribed_events: EVENTS,
  });
  dest = created.data;
  secret = dest.endpoint_secret_key ?? null;
  console.log('odrediste novo', dest.id, 'tajna=' + (secret ? 'da' : 'ne'));
}

if (secret) {
  const line = `PADDLE_WEBHOOK_SECRET=${secret}`;
  let next = envText;
  if (/^PADDLE_WEBHOOK_SECRET=/m.test(next)) next = next.replace(/^PADDLE_WEBHOOK_SECRET=.*$/m, line);
  else {
    if (!next.endsWith('\n')) next += '\n';
    next += line + '\n';
  }
  writeFileSync(ENV_PATH, next);
  console.log('tajna upisana u .env.local');
}
console.log('dogadaji', (dest.subscribed_events ?? []).map((e) => e.name).join(', '));
