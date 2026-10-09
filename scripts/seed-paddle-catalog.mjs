// Sandbox catalog for Poslar: one product, six monthly prices (VAT included).
// Reads PADDLE_SANDBOX_API_KEY from .env.local. Safe to run again: a product
// named Poslar and a price with the same description are reused, not duplicated.
// Writes the price ids back into .env.local. Never prints the API key.

import { readFileSync, writeFileSync } from 'node:fs';

const ENV_PATH = new URL('../.env.local', import.meta.url);
const envText = readFileSync(ENV_PATH, 'utf8');
const key = envText.match(/^PADDLE_SANDBOX_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key?.startsWith('pdl_sdbx_')) {
  console.error('U .env.local nema probnog ključa (PADDLE_SANDBOX_API_KEY).');
  process.exit(1);
}

const PRICES = [
  { env: 'PADDLE_PRICE_BASIC', description: 'Basic', amount: '4000', plan: 'basic', founder: '0' },
  { env: 'PADDLE_PRICE_STANDARD', description: 'Standard', amount: '7000', plan: 'standard', founder: '0' },
  { env: 'PADDLE_PRICE_PREMIUM', description: 'Premium', amount: '12000', plan: 'premium', founder: '0' },
  { env: 'PADDLE_PRICE_BASIC_FOUNDER', description: 'Basic, osnivačka cijena', amount: '3000', plan: 'basic', founder: '1' },
  { env: 'PADDLE_PRICE_STANDARD_FOUNDER', description: 'Standard, osnivačka cijena', amount: '5000', plan: 'standard', founder: '1' },
  { env: 'PADDLE_PRICE_PREMIUM_FOUNDER', description: 'Premium, osnivačka cijena', amount: '9000', plan: 'premium', founder: '1' },
];

async function paddle(path, body) {
  const res = await fetch(`https://sandbox-api.paddle.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.error?.detail ?? json?.error?.code ?? res.status;
    throw new Error(`${path} ${res.status}: ${detail}`);
  }
  return json;
}

async function listAll(path) {
  const rows = [];
  let after = '';
  for (;;) {
    const q = new URLSearchParams({ per_page: '50' });
    if (after) q.set('after', after);
    const sep = path.includes('?') ? '&' : '?';
    const page = await paddle(`${path}${sep}${q}`);
    rows.push(...(page.data ?? []));
    if (!page.meta?.pagination?.has_more) return rows;
    after = page.meta.pagination.next;
    if (!after) return rows;
  }
}

const products = await listAll('/products');
let product = products.find((p) => p.name === 'Poslar' && p.status !== 'archived');
if (!product) {
  product = (await paddle('/products', { name: 'Poslar', tax_category: 'saas', description: 'Aplikacija za radionice i servise na terenu.' })).data;
  console.log('proizvod novi', product.id);
} else {
  console.log('proizvod postoji', product.id, product.tax_category);
}

const existing = await listAll(`/prices?product_id=${product.id}`);
const ids = {};
for (const price of PRICES) {
  const found = existing.find((p) => p.description === price.description && p.status !== 'archived');
  if (found) {
    ids[price.env] = found.id;
    console.log('cijena postoji', price.description, found.id, found.unit_price.amount, found.unit_price.currency_code);
    continue;
  }
  const created = (
    await paddle('/prices', {
      product_id: product.id,
      description: price.description,
      unit_price: { amount: price.amount, currency_code: 'EUR' },
      billing_cycle: { interval: 'month', frequency: 1 },
      tax_mode: 'internal',
      quantity: { minimum: 1, maximum: 1 },
      custom_data: { plan: price.plan, founder: price.founder },
    })
  ).data;
  ids[price.env] = created.id;
  console.log('cijena nova', price.description, created.id);
}

let next = envText;
for (const [name, id] of Object.entries(ids)) {
  if (new RegExp(`^${name}=`, 'm').test(next)) next = next.replace(new RegExp(`^${name}=.*$`, 'm'), `${name}=${id}`);
  else {
    if (!next.endsWith('\n')) next += '\n';
    next += `${name}=${id}\n`;
  }
}
writeFileSync(ENV_PATH, next);
console.log('upisano u .env.local');
