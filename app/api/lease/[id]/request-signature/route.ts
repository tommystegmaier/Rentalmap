import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const leaseId = params.id;

  const { data: lease } = await supabase
    .from('leases')
    .select('id, properties:property_id(owner_id, address)')
    .eq('id', leaseId)
    .maybeSingle();

  if (!lease) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  if (!prop || (prop as { owner_id: string }).owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const { data: tenants } = await admin
    .from('lease_tenants')
    .select('user_id')
    .eq('lease_id', leaseId);

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ error: 'No tenants on this lease' }, { status: 422 });
  }

  const address = (prop as { address: string }).address;

  const results = await Promise.all(
    tenants.map((t: { user_id: string }) =>
      sendPushToUser(t.user_id, {
        title: 'Lease signature needed',
        body: `Please review and sign your lease for ${address}.`,
        url: '/tenant/lease',
        tag: `lease-sign-${leaseId}`,
      }),
    ),
  );

  const totalSent = results.reduce((n, r) => n + (r.sent ?? 0), 0);
  return NextResponse.json({ ok: true, sent: totalSent, tenants: tenants.length });
}
