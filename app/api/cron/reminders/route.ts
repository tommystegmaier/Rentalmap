import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { computeLandlordReminders } from '@/lib/reminders';
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

  // 1. Sync seeds for every landlord
  const { data: landlords } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'landlord');

  let seedCount = 0;
  for (const { id: ownerId } of (landlords ?? []) as { id: string }[]) {
    const { data: properties } = await supabase
      .from('properties')
      .select('id')
      .eq('owner_id', ownerId);
    const propIds = (properties ?? []).map((p: { id: string }) => p.id);
    if (propIds.length === 0) continue;

    const [{ data: leases }, { data: appliances }] = await Promise.all([
      supabase
        .from('leases')
        .select('id, property_id, start_date, end_date, due_day, status')
        .in('property_id', propIds),
      supabase
        .from('appliances')
        .select('property_id, name, last_service_date, install_date')
        .in('property_id', propIds),
    ]);

    const seeds = computeLandlordReminders({
      ownerId,
      leases: (leases ?? []) as Array<{
        id: string;
        property_id: string;
        start_date: string;
        end_date: string;
        due_day: number;
        status: 'active' | 'ended' | 'pending';
      }>,
      appliances: (appliances ?? []) as Array<{
        property_id: string;
        name: string;
        last_service_date: string | null;
        install_date: string | null;
      }>,
    });

    for (const seed of seeds) {
      // Replace any non-dismissed reminder of the same kind for this property.
      let del = supabase
        .from('reminders')
        .delete()
        .eq('user_id', seed.user_id)
        .eq('type', seed.type)
        .eq('dismissed', false);
      del = seed.property_id
        ? del.eq('property_id', seed.property_id)
        : del.is('property_id', null);
      await del;

      const { error } = await supabase.from('reminders').insert(seed);
      if (!error) seedCount++;
    }
  }

  // 2. Fire pushes for everything triggering today
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
    const result = await sendPushToUser(r.user_id, {
      title: 'Reminder',
      body: r.message,
      url: '/landlord/reminders',
      tag: `rem-${r.id}`,
    });
    if (result.sent) pushed++;
  }

  return NextResponse.json({ seedCount, pushed, due: dueToday?.length ?? 0 });
}
