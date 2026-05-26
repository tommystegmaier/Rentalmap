import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Body = z.object({
  enabled: z.boolean().optional(),
  daysBefore: z.number().int().min(0).max(14).optional(),
  notify_appliance_service: z.boolean().optional(),
  notify_hvac_filter: z.boolean().optional(),
  notify_maintenance_requests: z.boolean().optional(),
  notify_messages: z.boolean().optional(),
});

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

  const update: Record<string, unknown> = {};
  if (parsed.data.enabled !== undefined) {
    update.tenant_rent_reminder_enabled = parsed.data.enabled;
  }
  if (parsed.data.daysBefore !== undefined) {
    update.tenant_rent_reminder_days_before = parsed.data.daysBefore;
  }
  if (parsed.data.notify_appliance_service !== undefined) {
    update.notify_appliance_service = parsed.data.notify_appliance_service;
  }
  if (parsed.data.notify_hvac_filter !== undefined) {
    update.notify_hvac_filter = parsed.data.notify_hvac_filter;
  }
  if (parsed.data.notify_maintenance_requests !== undefined) {
    update.notify_maintenance_requests = parsed.data.notify_maintenance_requests;
  }
  if (parsed.data.notify_messages !== undefined) {
    update.notify_messages = parsed.data.notify_messages;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from('users').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
