// IRS standard mileage rates for business use, in cents per mile. Used to
// suggest a default rate when logging a trip; the chosen rate is stored on
// each trip so it never shifts when a new year's rate is published.
export const IRS_MILEAGE_RATE_CENTS: Record<number, number> = {
  2021: 56,
  2022: 58.5,
  2023: 65.5,
  2024: 67,
  2025: 70,
  2026: 72.5,
};

// Best rate for a year: exact match if known, otherwise the most recent known
// year at or before it (so future years default to the latest published rate),
// falling back to the earliest known rate for very old dates.
export function mileageRateForYear(year: number): number {
  if (IRS_MILEAGE_RATE_CENTS[year] != null) return IRS_MILEAGE_RATE_CENTS[year];
  const years = Object.keys(IRS_MILEAGE_RATE_CENTS).map(Number).sort((a, b) => a - b);
  if (year < years[0]) return IRS_MILEAGE_RATE_CENTS[years[0]];
  const lower = years.filter((y) => y <= year).pop();
  return IRS_MILEAGE_RATE_CENTS[lower ?? years[years.length - 1]];
}

// Deductible amount in whole cents for a trip.
export function tripDeductionCents(miles: number, rateCents: number): number {
  return Math.round(miles * rateCents);
}

// Trip purposes offered in the logger. Stored as free text so any value is
// accepted, but these cover the common deductible reasons to drive to a rental.
export const MILEAGE_PURPOSES = [
  'Inspection',
  'Repair / maintenance',
  'Lawn care / landscaping',
  'Showing',
  'Tenant meeting',
  'Supply / hardware run',
  'Bank / admin errand',
  'Other',
] as const;

export type MileagePurpose = (typeof MILEAGE_PURPOSES)[number];
