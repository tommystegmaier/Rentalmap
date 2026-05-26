import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { syncRemindersForLandlord } from '@/lib/reminders-run';
import { sendPushToUser } from '@/lib/push';

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

  const { data: dueToday } = await supabase
    .from('reminders')
    .select('id, user_id, message, type')
    .eq('dismissed', false)
    .eq('trigger_date', today);

  let pushed = 0;
  for (const r of (dueToday ?? []) as Array<{
    id: string;
    user_id: string;
    message: string;
    type: string;
  }>) {
    const isTenant = r.type === 'tenant_rent_due';
    const result = await sendPushToUser(r.user_id, {
      title: isTenant ? 'Rent reminder' : 'Reminder',
      body: r.message,
      url: isTenant ? '/tenant/pay' : '/landlord/reminders',
      tag: `rem-${r.id}`,
    });
    if (result.sent) pushed++;
  }

  return NextResponse.json({ seedCount, pushed, due: dueToday?.length ?? 0 });
}
