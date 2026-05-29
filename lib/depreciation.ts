// Straight-line MACRS depreciation for residential (27.5-yr) and commercial
// (39-yr) rental real estate, using the IRS mid-month convention. Land is not
// depreciable, so the basis is purchase price minus land value.

export const DEPRECIATION_RECOVERY_YEARS = {
  residential: 27.5,
  commercial: 39,
} as const;

export type DepreciationKind = keyof typeof DEPRECIATION_RECOVERY_YEARS;

// Fraction of a full year's depreciation allowed in the first calendar year,
// based on the month (1-12) the property was placed in service. Mid-month
// convention: property is treated as placed in service mid-month.
export function firstYearFraction(month: number): number {
  const m = Math.min(12, Math.max(1, month));
  return (12 - m + 0.5) / 12;
}

export interface DepreciationRow {
  year: number;
  amountCents: number;
}

export interface DepreciationSummary {
  basisCents: number;
  recoveryYears: number; // 27.5 or 39
  annualCents: number; // full-year straight-line amount
  firstYearCents: number; // prorated first calendar year
  startYear: number;
  finalYear: number;
  totalTaxYears: number; // number of calendar years with a deduction
  schedule: DepreciationRow[];
}

// Builds the full year-by-year schedule. Returns null if inputs are incomplete.
export function buildDepreciationSchedule(
  basisCents: number,
  placedInService: string, // ISO yyyy-mm-dd
  recoveryYears: number,
): DepreciationSummary | null {
  if (!basisCents || basisCents <= 0 || !placedInService || !recoveryYears) return null;
  const d = new Date(`${placedInService}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const startYear = d.getFullYear();
  const startMonth = d.getMonth() + 1;

  const annualCents = Math.round(basisCents / recoveryYears);
  const firstYearCents = Math.min(
    Math.round(annualCents * firstYearFraction(startMonth)),
    basisCents,
  );

  const schedule: DepreciationRow[] = [{ year: startYear, amountCents: firstYearCents }];
  let remaining = basisCents - firstYearCents;
  let y = startYear + 1;
  let guard = 0;
  while (remaining > 0 && guard < 60) {
    const amt = Math.min(annualCents, remaining);
    schedule.push({ year: y, amountCents: amt });
    remaining -= amt;
    y += 1;
    guard += 1;
  }

  return {
    basisCents,
    recoveryYears,
    annualCents,
    firstYearCents,
    startYear,
    finalYear: schedule[schedule.length - 1].year,
    totalTaxYears: schedule.length,
    schedule,
  };
}

// Deductible depreciation for a single tax year (0 before placed-in-service or
// after the recovery period ends).
export function depreciationForYear(
  basisCents: number,
  placedInService: string,
  recoveryYears: number,
  taxYear: number,
): number {
  const s = buildDepreciationSchedule(basisCents, placedInService, recoveryYears);
  if (!s) return 0;
  return s.schedule.find((r) => r.year === taxYear)?.amountCents ?? 0;
}
