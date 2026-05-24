import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushToLandlord } from '@/lib/push';
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

  // RLS ensures the tenant can only see their own work order.
  const { data: wo } = await supabase
    .from('work_orders')
    .select('id, property_id, request_type, urgency, description')
    .eq('id', parsed.data.work_order_id)
    .maybeSingle();

  if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isEmergency = wo.urgency === 'emergency';
  await sendPushToLandlord(wo.property_id, {
    title: isEmergency ? '🚨 Emergency work order' : `New work order · ${wo.request_type}`,
    body:
      wo.description.length > 90
        ? wo.description.slice(0, 87) + '…'
        : wo.description,
    url: `/landlord/maintenance/${wo.id}`,
    tag: `wo-${wo.id}`,
  });

  return NextResponse.json({ ok: true });
}
