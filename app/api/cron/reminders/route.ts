import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { syncRemindersForLandlord } from '@/lib/reminders-run';
import { sendPushToUser } from '@/lib/push';
import { createNotification, type NotificationType } from '@/lib/notifications';
import { addDays, getDaysInMonth, setDate, format, parseISO } from 'date-fns';

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
    .eq('trigger_date', today);

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
  }

  // ---- Auto-charge late fees ----
  // Find active leases with late_fee_enabled.  For each, determine if today is
  // past the grace period for the current rent period and rent hasn't been paid.
  const { data: lateLeases } = await supabase
    .from('leases')
    .select(
      'id, due_day, late_after_day, late_fee_cents, monthly_rent_cents, property_id, ' +
      'properties:property_id(owner_id)',
    )
    .eq('status', 'active')
    .eq('late_fee_enabled', true);

  let lateFeeCount = 0;
  const todayDate = parseISO(today);

  type LateLease = {
    id: string;
    due_day: number;
    late_after_day: number;
    late_fee_cents: number;
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
    if (todayDate <= graceDeadline) continue; // still within grace period

    const periodStart = format(dueDate, 'yyyy-MM-dd');

    // Check if rent was paid for this period.
    const { count: paidCount } = await supabase
      .from('rent_payments')
      .select('id', { count: 'exact', head: true })
      .eq('lease_id', lease.id)
      .eq('expected_date', periodStart)
      .in('status', ['settled', 'manual']);

    if ((paidCount ?? 0) > 0) continue; // paid — no late fee

    // Check if a late fee was already charged for this period.
    const { count: feeCount } = await supabase
      .from('late_fee_charges')
      .select('id', { count: 'exact', head: true })
      .eq('lease_id', lease.id)
      .eq('period_start', periodStart)
      .eq('waived', false);

    if ((feeCount ?? 0) > 0) continue; // already charged

    // Insert the late fee charge.
    await supabase.from('late_fee_charges').insert({
      lease_id: lease.id,
      charge_date: today,
      amount_cents: lease.late_fee_cents,
      period_start: periodStart,
    });
    lateFeeCount++;

    // Notify tenants on this lease.
    const { data: tenantLinks } = await supabase
      .from('lease_tenants')
      .select('user_id')
      .eq('lease_id', lease.id);

    for (const link of (tenantLinks ?? []) as { user_id: string }[]) {
      await createNotification(supabase, link.user_id, {
        type: 'tenant_rent_due',
        title: 'Late fee applied',
        body: `A late fee of $${(lease.late_fee_cents / 100).toFixed(0)} has been added to your account for the rent period starting ${periodStart}.`,
        url: '/tenant/pay',
      });
      await sendPushToUser(link.user_id, {
        title: 'Late fee applied',
        body: `A $${(lease.late_fee_cents / 100).toFixed(0)} late fee has been added to your account.`,
        url: '/tenant/pay',
      });
    }
  }

  return NextResponse.json({ seedCount, pushed, due: dueToday?.length ?? 0, lateFeeCount });
}
