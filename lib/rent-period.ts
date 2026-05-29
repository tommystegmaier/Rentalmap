import { getDaysInMonth, setDate } from 'date-fns';

/**
 * The due date of the rent period a tenant is currently paying for.
 *
 * Payments are attributed to the month they are *for*. We use the current
 * calendar month's due date and never roll forward — so a payment made after
 * the due day (a late payment) still counts toward the month it was due, not
 * the upcoming month.
 *
 * The day is clamped to the length of the month, so a due_day of 31 in a
 * 30-day month resolves to the 30th instead of spilling into the next month.
 */
export function currentRentPeriodDue(dueDay: number, today: Date = new Date()): Date {
  const clampedDay = Math.min(Math.max(Math.floor(dueDay) || 1, 1), getDaysInMonth(today));
  return setDate(today, clampedDay);
}
