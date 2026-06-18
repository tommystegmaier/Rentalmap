import { addMonths, getDaysInMonth, setDate, format } from 'date-fns';

/**
 * The due date of the current calendar month's rent period, day-clamped to
 * avoid spilling into the next month (e.g. due_day=31 in a 30-day month → 30).
 */
export function currentRentPeriodDue(dueDay: number, today: Date = new Date()): Date {
  const clampedDay = Math.min(Math.max(Math.floor(dueDay) || 1, 1), getDaysInMonth(today));
  return setDate(today, clampedDay);
}

function rentDueForMonth(dueDay: number, month: Date): Date {
  const day = Math.min(Math.max(Math.floor(dueDay) || 1, 1), getDaysInMonth(month));
  return setDate(month, day);
}

/**
 * Returns the due date of the first rent period that has no settled or manual
 * payment yet. Starts from the current calendar month and advances forward,
 * so a tenant who pays early (or pays twice in one month) is always shown the
 * correct next-unpaid period rather than re-paying the same month.
 *
 * paidExpectedDates should contain the expected_date strings of all
 * settled/manual payments for the lease.
 */
export function nextUnpaidRentPeriod(
  dueDay: number,
  paidExpectedDates: string[],
  today: Date = new Date(),
): Date {
  const paid = new Set(paidExpectedDates);
  let candidate = rentDueForMonth(dueDay, today);

  for (let i = 0; i < 13; i++) {
    if (!paid.has(format(candidate, 'yyyy-MM-dd'))) return candidate;
    candidate = rentDueForMonth(dueDay, addMonths(candidate, 1));
  }
  return candidate;
}
