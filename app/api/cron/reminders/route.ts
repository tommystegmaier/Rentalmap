import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { syncRemindersForLandlord } from '@/lib/reminders-run';
import { sendPushToUser } from '@/lib/push';
import { createNotification, type NotificationType } from '@/lib/notifications';

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

  return NextResponse.json({ seedCount, pushed, due: dueToday?.length ?? 0 });
}
