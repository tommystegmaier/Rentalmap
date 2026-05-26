import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';

const Body = z.object({ work_order_id: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error('[work-order notify] unauthenticated request');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    console.error('[work-order notify] invalid payload');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: wo, error: woErr } = await supabase
    .from('work_orders')
    .select('id, property_id, request_type, urgency, description')
    .eq('id', parsed.data.work_order_id)
    .maybeSingle();

  if (!wo) {
    console.error('[work-order notify] work order not found:', parsed.data.work_order_id, woErr);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Look up the landlord + their notify_maintenance_requests preference via
  // service role (the tenant making this call can't read the landlord's row).
  const admin = createServiceRoleClient();
  const { data: prop, error: propErr } = await admin
    .from('properties')
    .select('owner_id')
    .eq('id', wo.property_id)
    .maybeSingle();

  if (!prop?.owner_id) {
    console.error('[work-order notify] property or owner not found for property_id:', wo.property_id, propErr);
    return NextResponse.json({ ok: true });
  }

  const { data: landlord } = await admin
    .from('users')
    .select('notify_maintenance_requests')
    .eq('id', prop.owner_id)
    .maybeSingle();

  const isEmergency = wo.urgency === 'emergency';
  const title = isEmergency
    ? '🚨 Emergency work order'
    : `New work order · ${wo.request_type}`;
  const body =
    wo.description.length > 90 ? wo.description.slice(0, 87) + '…' : wo.description;
  const url = `/landlord/maintenance/${wo.id}`;

  // Always log to the in-app inbox so it's visible from the bell even if push
  // is off. Emergencies bypass the toggle.
  try {
    await createNotification(admin, prop.owner_id, {
      type: 'work_order_submitted',
      title,
      body,
      url,
      related_id: wo.id,
    });
    console.log('[work-order notify] in-app notification created for landlord:', prop.owner_id);
  } catch (err) {
    console.error('[work-order notify] failed to create in-app notification:', err);
  }

  const wantsPush = isEmergency || landlord?.notify_maintenance_requests !== false;
  if (wantsPush) {
    try {
      const { count: badgeCount } = await admin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', prop.owner_id)
        .is('read_at', null)
        .is('dismissed_at', null);
      const result = await sendPushToUser(prop.owner_id, {
        title,
        body,
        url,
        tag: `wo-${wo.id}`,
        badgeCount: badgeCount ?? 1,
      });
      console.log('[work-order notify] push result:', result);
    } catch (err) {
      console.error('[work-order notify] push failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
