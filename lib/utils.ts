import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCents(cents: number | null | undefined, opts?: { withCents?: boolean }) {
  if (cents == null) return '—';
  return (opts?.withCents ? usdCents : usd).format(cents / 100);
}

// Supabase returns nested PostgREST joins as either an object or an array
// depending on the relationship cardinality; normalize to one optional record.
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Card charge so that after Stripe's 2.9% + $0.30 fee, the landlord nets the
 * full rent amount. X * 0.971 - 30 ≥ rentCents → X ≥ (rentCents + 30) / 0.971.
 */
export function cardChargeCents(rentCents: number): number {
  return Math.ceil((rentCents + 30) / 0.971);
}
