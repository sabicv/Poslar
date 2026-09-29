import { ASSET_TYPE_LABELS, METER_LABELS, type MeterUnit } from '@/config/tenant.config';
import type { Asset, Client } from '@/types/db';

const euro = new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 1 });

export function formatEuro(amount: number | null | undefined): string {
  return euro.format(Number(amount ?? 0));
}

// Up to maxDigits decimals, trailing zeros dropped: 1.8 → "1,8", 12 → "12".
const numbers = new Map<number, Intl.NumberFormat>([[1, number]]);
export function formatNumber(value: number | null | undefined, maxDigits = 1): string {
  if (value === null || value === undefined) return '—';
  if (!numbers.has(maxDigits)) numbers.set(maxDigits, new Intl.NumberFormat('hr-HR', { maximumFractionDigits: maxDigits }));
  return numbers.get(maxDigits)!.format(Number(value));
}

// Croatian count forms: 1 nalog, 2 naloga, 5 naloga, 21 nalog, 12 naloga.
export function plural(n: number, one: string, few: string, many: string): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

export function countJobs(n: number): string {
  return `${n} ${plural(n, 'nalog', 'naloga', 'naloga')}`;
}

// Fixed decimals with a Croatian comma: 17.748 → "17,75", 1.3 → "1,3".
const decimals = new Map<number, Intl.NumberFormat>();
export function formatDecimal(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  if (!decimals.has(digits)) decimals.set(digits, new Intl.NumberFormat('hr-HR', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return decimals.get(digits)!.format(Number(value));
}

export function formatMeter(value: number | null | undefined, unit: MeterUnit | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${number.format(Number(value))} ${METER_LABELS[unit ?? 'km'].short}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Zagreb' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('hr-HR', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zagreb',
  });
}

// "prije 3 h", "jučer", "12. 9." — for lists.
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'upravo';
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `prije ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'jučer';
  if (days < 7) return `prije ${days} dana`;
  return formatDate(value);
}

export function clientName(client: Pick<Client, 'kind' | 'first_name' | 'last_name' | 'company_name'> | null | undefined): string {
  if (!client) return '—';
  if (client.kind === 'company' && client.company_name) return client.company_name;
  const person = [client.first_name, client.last_name].filter(Boolean).join(' ');
  return person || client.company_name || '—';
}

export function assetTitle(asset: Pick<Asset, 'make' | 'model' | 'asset_type'> | null | undefined): string {
  if (!asset) return '—';
  const name = [asset.make, asset.model].filter(Boolean).join(' ');
  return name || ASSET_TYPE_LABELS[asset.asset_type];
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = new Date(new Date().toDateString()).getTime();
  return Math.round((new Date(date).getTime() - today) / 86400000);
}

export function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith('.pdf');
}

// Vocative for a friendly "Poštovani Ivane" in customer messages.
export function vocativeHR(firstName: string): string {
  const name = firstName.trim();
  if (!name) return name;
  const last = name.slice(-1).toLowerCase();
  if ('aeiou'.includes(last)) return name;
  if (last === 'k') return `${name.slice(0, -1)}če`;
  if (last === 'j') return `${name}u`;
  return `${name}e`;
}
