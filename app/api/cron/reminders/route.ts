import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { syncRemindersForLandlord } from '@/lib/reminders-run';
import { runScheduledTaxReports } from '@/lib/tax-report-run';
import { sendPushToUser } from '@/lib/push';
import { createNotification, type NotificationType } from '@/lib/notifications';
import { addDays, addMonths, differenceInCalendarDays, getDaysInMonth, setDate, format, parseISO, subDays } from 'date-fns';

/**
 * Daily cron. Vercel triggers this via vercel.json. To prevent random hits,
 * we accept either Vercel's "x-vercel-cron" header or a shared bearer token.
 */
function authorize(request: Request) {
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return !!expected && auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: landlords } = await supabase
    .from('users')
    .select(
      'id, tenant_rent_reminder_enabled, tenant_rent_reminder_days_before',
    )
    .eq('role', 'landlord');

  let seedCount = 0;
  for (const owner of (landlords ?? []) as {
    id: string;
    tenant_rent_reminder_enabled: boolean;
    tenant_rent_reminder_days_before: number;
  }[]) {
    seedCount += await syncRemindersForLandlord(supabase, owner);
  }

  // Pull reminders firing today along with the appliance_type when present,
  // so we can route appliance reminders through the per-type toggle.
  const { data: dueToday } = await supabase
    .from('reminders')
    .select(
      'id, user_id, message, type, appliance_id, appliances:appliance_id(appliance_type)',
    )
    .eq('dismissed', false)
    .eq('trigger_date', today)
    .is('sent_at', null);

  type DueRow = {
    id: string;
    user_id: string;
    message: string;
    type: string;
    appliance_id: string | null;
    appliances:
      | { appliance_type: 'general' | 'hvac_filter' | 'sprinkler' | null }
      | { appliance_type: 'general' | 'hvac_filter' | 'sprinkler' | null }[]
      | null;
  };

  // Cache per-user prefs so we don't re-query for every reminder.
  const prefsCache = new Map<
    string,
    {
      notify_appliance_service: boolean;
      notify_hvac_filter: boolean;
    }
  >();
  async function prefsFor(userId: string) {
    const cached = prefsCache.get(userId);
    if (cached) return cached;
    const { data } = await supabase
      .from('users')
      .select('notify_appliance_service, notify_hvac_filter')
      .eq('id', userId)
      .maybeSingle();
    const prefs = {
      notify_appliance_service: data?.notify_appliance_service ?? true,
      notify_hvac_filter: data?.notify_hvac_filter ?? true,
    };
    prefsCache.set(userId, prefs);
    return prefs;
  }

  let pushed = 0;
  for (const r of (dueToday ?? []) as DueRow[]) {
    const isTenant = r.type === 'tenant_rent_due';
    const applianceMeta = Array.isArray(r.appliances) ? r.appliances[0] : r.appliances;
    const applianceType = applianceMeta?.appliance_type ?? null;
    const isHvacFilter = r.type === 'appliance_service' && applianceType === 'hvac_filter';

    let wantsPush = true;
    if (r.type === 'appliance_service') {
      const prefs = await prefsFor(r.user_id);
      wantsPush = isHvacFilter ? prefs.notify_hvac_filter : prefs.notify_appliance_service;
    }

    const title = isTenant
      ? 'Rent reminder'
      : isHvacFilter
        ? 'HVAC filter replacement'
        : 'Reminder';
    const url = isTenant ? '/tenant/pay' : '/landlord/reminders';

    // In-app inbox entry (always). Push (conditional).
    const notifType: NotificationType = isTenant
      ? 'tenant_rent_due'
      : r.type === 'appliance_service'
        ? isHvacFilter
          ? 'reminder_hvac_filter'
          : 'reminder_appliance_service'
        : r.type === 'rent_due'
          ? 'reminder_rent_due'
          : r.type === 'lease_renewal'
            ? 'reminder_lease_renewal'
            : r.type === 'quarterly_inspection'
              ? 'reminder_quarterly_inspection'
              : 'reminder_custom';

    await createNotification(supabase, r.user_id, {
      type: notifType,
      title,
      body: r.message,
      url,
      related_id: r.id,
    });

    if (wantsPush) {
      const result = await sendPushToUser(r.user_id, {
        title,
        body: r.message,
        url,
        tag: `rem-${r.id}`,
      });
      if (result.sent) pushed++;
    }

    // Mark as sent so subsequent cron runs don't fire it again.
    await supabase
      .from('reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', r.id);
  }

  // ---- Auto-charge late fees ----
  // Find active leases with late_fee_enabled.  For each, determine if today is
  // past the grace period for the current rent period and rent hasn't been paid.
  const { data: lateLeases } = await supabase
    .from('leases')
    .select(
      'id, due_day, late_after_day, late_fee_cents, late_fee_frequency, monthly_rent_cents, property_id, ' +
      'properties:property_id(owner_id)',
    )
    .eq('status', 'active')
    .eq('late_fee_enabled', true);

  let lateFeeCount = 0;
  const todayDate = parseISO(today);

  // Safety caps so an unpaid lease can't create an unbounded number of charges.
  const DAILY_CAP = 90;
  const WEEKLY_CAP = 26;

  type LateLease = {
    id: string;
    due_day: number;
    late_after_day: number;
    late_fee_cents: number;
    late_fee_frequency: 'once' | 'weekly' | 'daily' | null;
    monthly_rent_cents: number;
    property_id: string;
    properties: { owner_id: string } | { owner_id: string }[] | null;
  };
  for (const lease of (lateLeases ?? []) as unknown as LateLease[]) {
    const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
    if (!prop?.owner_id) continue;

    // Determine the rent period: due date this month, fall back to last month if
    // we're still in the same month as the due date.
    const daysThisMonth = getDaysInMonth(todayDate);
    const safeDueDay = Math.min(lease.due_day, daysThisMonth);
    let dueDate = setDate(todayDate, safeDueDay);
    if (dueDate > todayDate) {
      // Due date hasn't come yet this month — check last month.
      const lastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
      const daysLastMonth = getDaysInMonth(lastMonth);
      const safeDueDayLast = Math.min(lease.due_day, daysLastMonth);
      dueDate = setDate(lastMonth, safeDueDayLast);
    }

    const graceDeadline = addDays(dueDate, lease.late_after_day);
    const daysLate = differenceInCalendarDays(todayDate, graceDeadline);
    if (daysLate <= 0) continue; // still within grace period

    const periodStart = format(dueDate, 'yyyy-MM-dd');

    // Check if rent was paid for this period.
    const { count: paidCount } = await supabase
      .from('rent_payments')
      .select('id', { count: 'exact', head: true })
      .eq('lease_id', lease.id)
      .eq('expected_date', periodStart)
      .in('status', ['settled', 'manual']);

    if ((paidCount ?? 0) > 0) continue; // paid — no late fee

    // How many fees SHOULD exist by now for this period, given the frequency:
    //   once   → 1 flat fee
    //   weekly → one per 7 days past the grace deadline
    //   daily  → one per day past the grace deadline
    const frequency = lease.late_fee_frequency ?? 'once';
    let expectedCount = 1;
    if (frequency === 'daily') expectedCount = Math.min(daysLate, DAILY_CAP);
    else if (frequency === 'weekly') expectedCount = Math.min(Math.ceil(daysLate / 7), WEEKLY_CAP);

    // How many non-waived fees are already on record for this period.
    const { count: feeCount } = await supabase
      .from('late_fee_charges')
      .select('id', { count: 'exact', head: true })
      .eq('lease_id', lease.id)
      .eq('period_start', periodStart)
      .eq('waived', false);

    const toAdd = expectedCount - (feeCount ?? 0);
    if (toAdd <= 0) continue; // already up to date for this period

    // Insert the missing late-fee charges (usually 1 — more only if the cron
    // missed days). period_start groups them to the rent period they belong to.
    await supabase.from('late_fee_charges').insert(
      Array.from({ length: toAdd }, () => ({
        lease_id: lease.id,
        charge_date: today,
        amount_cents: lease.late_fee_cents,
        period_start: periodStart,
      })),
    );
    lateFeeCount += toAdd;

    // Notify tenants on this lease.
    const { data: tenantLinks } = await supabase
      .from('lease_tenants')
      .select('user_id')
      .eq('lease_id', lease.id);

    const eachLabel = `$${(lease.late_fee_cents / 100).toFixed(0)}`;
    const feeLabel = toAdd > 1 ? `${toAdd} × ${eachLabel}` : eachLabel;
    for (const link of (tenantLinks ?? []) as { user_id: string }[]) {
      await createNotification(supabase, link.user_id, {
        type: 'late_fee_applied',
        title: 'Late fee applied',
        body: `A late fee of ${feeLabel} has been added to your account for the rent period starting ${periodStart}.`,
        url: '/tenant/pay',
      });
      await sendPushToUser(link.user_id, {
        title: 'Late fee applied',
        body: `A ${feeLabel} late fee has been added to your account.`,
        url: '/tenant/pay',
      });
    }

    // Also notify the landlord.
    if (prop?.owner_id) {
      await createNotification(supabase, prop.owner_id, {
        type: 'late_fee_applied',
        title: 'Late fee auto-charged',
        body: `A ${feeLabel} late fee was automatically applied for the rent period starting ${periodStart}.`,
        url: '/landlord/late-fees',
      });
      await sendPushToUser(prop.owner_id, {
        title: 'Late fee auto-charged',
        body: `A ${feeLabel} late fee was auto-applied for period ${periodStart}.`,
        url: '/landlord/late-fees',
      });
    }
  }

  // ---- Maintenance event reminders ----
  // Driven by cron-job.org hitting this endpoint hourly. For each unsent
  // maintenance_reminder, fire when:
  //   today == scheduled_date - days_before  AND  current UTC hour >= send_time hour.
  // sent_at is set after firing, so each reminder fires only once.
  const currentHourUtc = new Date().getUTCHours();

  const { data: pendingMaintenanceReminders } = await supabase
    .from('maintenance_reminders')
    .select(
      'id, days_before, notify_landlord, notify_tenant, send_time, ' +
      'maintenance_events:event_id(id, title, scheduled_date, scheduled_time, scheduled_time_end, property_id, completed_at, ' +
      'properties:property_id(owner_id))',
    )
    .is('sent_at', null);

  type MaintenanceReminderRow = {
    id: string;
    days_before: number;
    notify_landlord: boolean;
    notify_tenant: boolean;
    send_time: string | null; // e.g. "09:00:00"
    maintenance_events:
      | {
          id: string;
          title: string;
          scheduled_date: string;
          scheduled_time: string | null;
          scheduled_time_end: string | null;
          property_id: string;
          completed_at: string | null;
          properties: { owner_id: string } | { owner_id: string }[] | null;
        }
      | null;
  };

  let maintenanceReminderCount = 0;

  for (const mr of (pendingMaintenanceReminders ?? []) as unknown as MaintenanceReminderRow[]) {
    const event = mr.maintenance_events;
    if (!event || event.completed_at) continue;

    // Fire when today == scheduled_date - days_before
    const triggerDate = format(subDays(parseISO(event.scheduled_date), mr.days_before), 'yyyy-MM-dd');
    if (triggerDate !== today) continue;

    // Only fire once we've reached or passed the reminder's send_time hour (UTC).
    // Defaults to hour 9 if send_time is missing.
    const sendHour = mr.send_time ? parseInt(mr.send_time.slice(0, 2), 10) : 9;
    if (currentHourUtc < sendHour) continue;

    const prop = Array.isArray(event.properties) ? event.properties[0] : event.properties;
    if (!prop?.owner_id) continue;

    const dayLabel =
      mr.days_before === 0
        ? 'today'
        : mr.days_before === 1
          ? 'tomorrow'
          : `in ${mr.days_before} days`;
    function fmtTime(t: string) {
      const [h, m] = t.split(':').map(Number);
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    }
    const timeStr = event.scheduled_time
      ? ` at ${fmtTime(event.scheduled_time)}${event.scheduled_time_end ? ` – ${fmtTime(event.scheduled_time_end)}` : ''}`
      : '';
    const body = `"${event.title}" is scheduled ${dayLabel}${timeStr}.`;

    if (mr.notify_landlord) {
      await createNotification(supabase, prop.owner_id, {
        type: 'maintenance_reminder',
        title: 'Maintenance reminder',
        body,
        url: `/landlord/properties/${event.property_id}`,
        related_id: event.id,
      });
      await sendPushToUser(prop.owner_id, {
        title: 'Maintenance reminder',
        body,
        url: `/landlord/properties/${event.property_id}`,
        tag: `maint-${mr.id}`,
      });
    }

    if (mr.notify_tenant) {
      // Find active tenants for this property.
      const { data: activeLeases } = await supabase
        .from('leases')
        .select('lease_tenants(user_id)')
        .eq('property_id', event.property_id)
        .eq('status', 'active');

      const tenantIds = (activeLeases ?? []).flatMap((l: { lease_tenants: { user_id: string }[] | null }) =>
        Array.isArray(l.lease_tenants) ? l.lease_tenants.map((t) => t.user_id) : [],
      );

      for (const tenantId of tenantIds) {
        await createNotification(supabase, tenantId, {
          type: 'maintenance_reminder',
          title: 'Maintenance reminder',
          body,
          url: '/tenant/pay',
          related_id: event.id,
        });
        await sendPushToUser(tenantId, {
          title: 'Maintenance reminder',
          body,
          url: '/tenant/pay',
          tag: `maint-${mr.id}`,
        });
      }
    }

    // Mark this reminder as sent.
    await supabase
      .from('maintenance_reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', mr.id);

    maintenanceReminderCount++;
  }

  // ---- Auto-post recurring expenses ----
  const { data: dueRecurring } = await supabase
    .from('recurring_expenses')
    .select('id, property_id, amount_cents, category, vendor, notes, tax_deductible, frequency, day_of_month, next_due_date, properties:property_id(owner_id)')
    .eq('active', true)
    .lte('next_due_date', today);

  let recurringCount = 0;
  for (const rec of (dueRecurring ?? []) as {
    id: string;
    property_id: string;
    amount_cents: number;
    category: string;
    vendor: string | null;
    notes: string | null;
    tax_deductible: boolean;
    frequency: 'monthly' | 'quarterly' | 'annually';
    day_of_month: number;
    next_due_date: string;
    properties: { owner_id: string } | { owner_id: string }[] | null;
  }[]) {
    const prop = Array.isArray(rec.properties) ? rec.properties[0] : rec.properties;
    if (!prop?.owner_id) continue;

    await supabase.from('expenses').insert({
      property_id: rec.property_id,
      date: rec.next_due_date,
      amount_cents: rec.amount_cents,
      category: rec.category,
      vendor: rec.vendor,
      notes: rec.notes,
      tax_deductible: rec.tax_deductible,
      created_by: prop.owner_id,
    });

    // Advance next_due_date by the frequency interval, preserving day_of_month.
    const months = rec.frequency === 'monthly' ? 1 : rec.frequency === 'quarterly' ? 3 : 12;
    const next = addMonths(parseISO(rec.next_due_date), months);
    const nextDate = format(
      setDate(next, Math.min(rec.day_of_month, getDaysInMonth(next))),
      'yyyy-MM-dd',
    );
    await supabase
      .from('recurring_expenses')
      .update({ next_due_date: nextDate, updated_at: new Date().toISOString() })
      .eq('id', rec.id);

    recurringCount++;
  }

  // Generate any scheduled tax reports due today (best-effort; never blocks).
  let taxReportsGenerated = 0;
  try {
    taxReportsGenerated = await runScheduledTaxReports(supabase);
  } catch (err) {
    console.error('[cron] scheduled tax reports failed:', err);
  }

  return NextResponse.json({
    seedCount,
    pushed,
    due: dueToday?.length ?? 0,
    lateFeeCount,
    recurringCount,
    maintenanceReminderCount,
    taxReportsGenerated,
  });
}
