import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { z } from 'zod';

const Body = z.object({ inspection_id: z.string().uuid() });

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { inspection_id } = parsed.data;

  // Verify landlord owns the property attached to this inspection.
  const { data: insp } = await supabase
    .from('inspections')
    .select('id, type, lease_id, properties:property_id(owner_id, address)')
    .eq('id', inspection_id)
    .maybeSingle();

  if (!insp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const prop = Array.isArray(insp.properties) ? insp.properties[0] : insp.properties;
  if (!prop || (prop as { owner_id: string }).owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!insp.lease_id) {
    return NextResponse.json({ error: 'Inspection has no linked lease' }, { status: 422 });
  }

  // Get all tenants on the lease.
  const admin = createServiceRoleClient();
  const { data: tenants } = await admin
    .from('lease_tenants')
    .select('user_id')
    .eq('lease_id', insp.lease_id);

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ error: 'No tenants on this lease' }, { status: 422 });
  }

  const TYPE_LABEL: Record<string, string> = {
    move_in: 'Move-in',
    move_out: 'Move-out',
    periodic: 'Periodic',
  };
  const typeLabel = TYPE_LABEL[insp.type as string] ?? 'Inspection';
  const address = (prop as { address: string }).address;

  const results = await Promise.all(
    tenants.map((t: { user_id: string }) =>
      sendPushToUser(t.user_id, {
        title: `Signature needed · ${typeLabel} inspection`,
        body: `Please review and sign the ${typeLabel.toLowerCase()} inspection for ${address}.`,
        url: `/tenant/inspections/${inspection_id}`,
        tag: `insp-sign-${inspection_id}`,
      }),
    ),
  );

  const totalSent = results.reduce((n, r) => n + (r.sent ?? 0), 0);
  return NextResponse.json({ ok: true, sent: totalSent, tenants: tenants.length });
}
