import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Folds case and Croatian diacritics so "sabic" finds "Šabić".
export function fold(value: string): string {
  return value.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Escapes a user search for PostgREST .or() / .ilike() filters.
export function toIlike(value: string): string {
  return `%${value.replace(/[%_,()\\]/g, ' ').trim()}%`;
}
