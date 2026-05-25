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
import { formatCents } from '@/lib/utils';

export type ReminderType =
  | 'rent_due'
  | 'tenant_rent_due'
  | 'lease_renewal'
  | 'quarterly_inspection'
  | 'appliance_service'
  | 'custom';

export interface ReminderSeed {
  user_id: string;
  property_id: string | null;
  type: ReminderType;
  trigger_date: string;
  message: string;
  recurrence: string | null;
  appliance_id?: string | null;
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
 * Lease-driven only — appliance reminders come from computeApplianceServiceReminders.
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

  return out;
}

/**
 * Reminders driven by per-appliance service intervals. One reminder per
 * appliance with service_interval_months set. The reminder fires 7 days
 * before the next_service_due date.
 */
export interface ApplianceForReminders {
  id: string;
  property_id: string;
  name: string;
  appliance_type?: 'general' | 'hvac_filter' | 'sprinkler' | null;
  service_interval_months: number | null;
  last_service_date: string | null;
  next_service_due: string | null;
  install_date: string | null;
  spring_startup_date?: string | null;
  winterize_date?: string | null;
}

const APPLIANCE_LEAD_DAYS = 7;

export function nextServiceDate(
  appliance: ApplianceForReminders,
  today = new Date(),
): Date | null {
  if (!appliance.service_interval_months) return null;
  if (appliance.next_service_due) {
    return parseISO(appliance.next_service_due);
  }
  // Fall back to last_service_date + interval, then install_date + interval.
  const reference = appliance.last_service_date ?? appliance.install_date;
  if (!reference) return null;
  let d = addMonths(parseISO(reference), appliance.service_interval_months);
  // Roll forward in interval steps if it's already in the past.
  while (isBefore(d, today)) {
    d = addMonths(d, appliance.service_interval_months);
  }
  return d;
}

function buildApplianceMessage(
  applianceName: string,
  eventLabel: string,
  daysToDue: number,
  address: string,
): string {
  const addrSuffix = address ? ` · ${address}` : '';
  if (daysToDue < 0) {
    const days = Math.abs(daysToDue);
    return `${applianceName} ${eventLabel} is ${days} day${days === 1 ? '' : 's'} overdue${addrSuffix}`;
  }
  if (daysToDue === 0) return `${applianceName} ${eventLabel} due today${addrSuffix}`;
  return `${applianceName} ${eventLabel} due in ${daysToDue} day${daysToDue === 1 ? '' : 's'}${addrSuffix}`;
}

export function computeApplianceServiceReminders(
  ownerId: string,
  appliances: ApplianceForReminders[],
  addressById: Map<string, string>,
  today = new Date(),
): ReminderSeed[] {
  const out: ReminderSeed[] = [];

  for (const a of appliances) {
    const addr = addressById.get(a.property_id) ?? '';

    // Sprinkler systems: surface the next upcoming seasonal event (spring
    // start-up OR winterize, whichever comes first). One reminder per
    // appliance at a time — once the date passes, nextAnnualDate naturally
    // rolls it forward to the following year.
    if (a.appliance_type === 'sprinkler') {
      const candidates: Array<{ date: Date; label: string }> = [];
      if (a.spring_startup_date) {
        candidates.push({
          date: nextAnnualDate(parseISO(a.spring_startup_date), today),
          label: 'spring start-up',
        });
      }
      if (a.winterize_date) {
        candidates.push({
          date: nextAnnualDate(parseISO(a.winterize_date), today),
          label: 'winterization',
        });
      }
      if (candidates.length === 0) continue;
      candidates.sort((x, y) => x.date.getTime() - y.date.getTime());
      const upcoming = candidates[0];

      const daysToDue = differenceInDays(upcoming.date, today);
      if (daysToDue > 30) continue;

      out.push({
        user_id: ownerId,
        property_id: a.property_id,
        type: 'appliance_service',
        trigger_date: format(addDays(upcoming.date, -APPLIANCE_LEAD_DAYS), 'yyyy-MM-dd'),
        message: buildApplianceMessage(a.name, upcoming.label, daysToDue, addr),
        recurrence: 'seasonal',
        appliance_id: a.id,
      });
      continue;
    }

    // Generic + HVAC filter: interval-based service schedule.
    if (!a.service_interval_months) continue;
    const nextDue = nextServiceDate(a, today);
    if (!nextDue) continue;
    const daysToDue = differenceInDays(nextDue, today);
    if (daysToDue > 30) continue;

    const eventLabel = a.appliance_type === 'hvac_filter' ? 'replacement' : 'service';
    out.push({
      user_id: ownerId,
      property_id: a.property_id,
      type: 'appliance_service',
      trigger_date: format(addDays(nextDue, -APPLIANCE_LEAD_DAYS), 'yyyy-MM-dd'),
      message: buildApplianceMessage(a.name, eventLabel, daysToDue, addr),
      recurrence:
        a.service_interval_months === 12
          ? 'annual'
          : a.service_interval_months >= 24
            ? 'multi_year'
            : 'monthly',
      appliance_id: a.id,
    });
  }

  return out;
}

export interface LandlordReminderSettings {
  tenant_rent_reminder_enabled: boolean;
  tenant_rent_reminder_days_before: number;
}

export interface LeaseWithTenants {
  id: string;
  property_id: string;
  due_day: number;
  monthly_rent_cents: number;
  status: 'active' | 'ended' | 'pending';
  tenant_ids: string[];
  address: string;
}

/**
 * Reminders we send to each *tenant* before rent is due. Driven by the
 * landlord's preference (enabled + lead days). One reminder per (tenant, lease).
 */
export function computeTenantRentReminders(
  settings: LandlordReminderSettings,
  leases: LeaseWithTenants[],
  today = new Date(),
): ReminderSeed[] {
  if (!settings.tenant_rent_reminder_enabled) return [];
  const out: ReminderSeed[] = [];

  for (const lease of leases.filter((l) => l.status === 'active')) {
    if (lease.tenant_ids.length === 0) continue;

    const trigger = nextRentReminder(
      lease.due_day,
      settings.tenant_rent_reminder_days_before,
      today,
    );
    const rent = formatCents(lease.monthly_rent_cents);
    const days = settings.tenant_rent_reminder_days_before;
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    const message = `Rent due ${when} · ${rent} · ${lease.address}`;

    for (const tenantId of lease.tenant_ids) {
      out.push({
        user_id: tenantId,
        property_id: lease.property_id,
        type: 'tenant_rent_due',
        trigger_date: format(trigger, 'yyyy-MM-dd'),
        message,
        recurrence: 'monthly',
      });
    }
  }
  return out;
}
