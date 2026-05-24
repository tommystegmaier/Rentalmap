import {
  addDays,
  addMonths,
  addYears,
  differenceInDays,
  format,
  isBefore,
  parseISO,
  setDate,
} from 'date-fns';

export type ReminderType =
  | 'rent_due'
  | 'lease_renewal'
  | 'quarterly_inspection'
  | 'hvac_annual'
  | 'smoke_co_battery'
  | 'custom';

export interface ReminderSeed {
  user_id: string;
  property_id: string | null;
  type: ReminderType;
  trigger_date: string;
  message: string;
  recurrence: string | null;
}

/** Find the next "trigger" date for a fixed-day-of-month reminder. */
export function nextRentReminder(
  dueDay: number,
  leadDays: number,
  today = new Date(),
): Date {
  let target = setDate(today, dueDay);
  // Subtract lead days; if that's already past, jump to next month.
  let reminder = addDays(target, -leadDays);
  if (isBefore(reminder, today)) {
    target = addMonths(target, 1);
    reminder = addDays(target, -leadDays);
  }
  return reminder;
}

/** Quarterly inspection from lease start: next quarter mark in the future. */
export function nextQuarterlyDate(start: Date, today = new Date()): Date {
  let d = start;
  while (!isBefore(today, d)) d = addMonths(d, 3);
  return d;
}

/** Annual recurrence from a reference date: next yearly anniversary in the future. */
export function nextAnnualDate(reference: Date, today = new Date()): Date {
  let d = reference;
  while (!isBefore(today, d)) d = addYears(d, 1);
  return d;
}

/**
 * Compute a fresh set of reminder seeds for a landlord based on their portfolio.
 * Intended to be called by the cron route; existing un-dismissed rows of the same
 * (user_id, type, property_id) are replaced on each run.
 */
export interface PortfolioForReminders {
  ownerId: string;
  leases: Array<{
    id: string;
    property_id: string;
    start_date: string;
    end_date: string;
    due_day: number;
    status: 'active' | 'ended' | 'pending';
  }>;
  appliances: Array<{
    property_id: string;
    name: string;
    last_service_date: string | null;
    install_date: string | null;
  }>;
}

export function computeLandlordReminders(p: PortfolioForReminders): ReminderSeed[] {
  const out: ReminderSeed[] = [];
  const today = new Date();

  for (const lease of p.leases.filter((l) => l.status === 'active')) {
    // Rent due — 3 days before due_day
    const rent = nextRentReminder(lease.due_day, 3, today);
    out.push({
      user_id: p.ownerId,
      property_id: lease.property_id,
      type: 'rent_due',
      trigger_date: format(rent, 'yyyy-MM-dd'),
      message: `Rent due in 3 days (day ${lease.due_day} of month)`,
      recurrence: 'monthly',
    });

    // Lease renewal — 60 days before end_date
    const renewal = addDays(parseISO(lease.end_date), -60);
    if (!isBefore(renewal, today) || differenceInDays(parseISO(lease.end_date), today) > 0) {
      out.push({
        user_id: p.ownerId,
        property_id: lease.property_id,
        type: 'lease_renewal',
        trigger_date: format(renewal, 'yyyy-MM-dd'),
        message: `Lease renewal decision (lease ends ${format(parseISO(lease.end_date), 'PP')})`,
        recurrence: null,
      });
    }

    // Quarterly inspection
    const inspection = nextQuarterlyDate(parseISO(lease.start_date), today);
    out.push({
      user_id: p.ownerId,
      property_id: lease.property_id,
      type: 'quarterly_inspection',
      trigger_date: format(inspection, 'yyyy-MM-dd'),
      message: 'Quarterly inspection due',
      recurrence: 'quarterly',
    });
  }

  // Annual HVAC service & smoke/CO check — one per property based on appliance install/service.
  const propertyIds = new Set(p.leases.map((l) => l.property_id));
  for (const propertyId of propertyIds) {
    const hvac = p.appliances.find(
      (a) => a.property_id === propertyId && /hvac/i.test(a.name),
    );
    const ref =
      hvac?.last_service_date ?? hvac?.install_date ?? format(today, 'yyyy-MM-dd');
    const next = nextAnnualDate(parseISO(ref), today);
    out.push({
      user_id: p.ownerId,
      property_id: propertyId,
      type: 'hvac_annual',
      trigger_date: format(next, 'yyyy-MM-dd'),
      message: 'Annual HVAC service due',
      recurrence: 'annual',
    });

    const smoke = p.appliances.find(
      (a) => a.property_id === propertyId && /smoke|co\b/i.test(a.name),
    );
    const smokeRef =
      smoke?.last_service_date ?? smoke?.install_date ?? format(today, 'yyyy-MM-dd');
    const nextSmoke = nextAnnualDate(parseISO(smokeRef), today);
    out.push({
      user_id: p.ownerId,
      property_id: propertyId,
      type: 'smoke_co_battery',
      trigger_date: format(nextSmoke, 'yyyy-MM-dd'),
      message: 'Smoke / CO detector battery check',
      recurrence: 'annual',
    });
  }

  return out;
}
