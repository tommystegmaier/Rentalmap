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
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: wo } = await supabase
    .from('work_orders')
    .select('id, property_id, request_type, urgency, description')
    .eq('id', parsed.data.work_order_id)
    .maybeSingle();

  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Look up the landlord + their notify_maintenance_requests preference via
  // service role (the tenant making this call can't read the landlord's row).
  const admin = createServiceRoleClient();
  const { data: prop } = await admin
    .from('properties')
    .select('owner_id')
    .eq('id', wo.property_id)
    .maybeSingle();

  if (!prop?.owner_id) return NextResponse.json({ ok: true });

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
  } catch (err) {
    console.error('[work-order notify] failed to create in-app notification:', err);
  }

  const wantsPush = isEmergency || landlord?.notify_maintenance_requests !== false;
  if (wantsPush) {
    try {
      await sendPushToUser(prop.owner_id, {
        title,
        body,
        url,
        tag: `wo-${wo.id}`,
      });
    } catch (err) {
      console.error('[work-order notify] push failed:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
