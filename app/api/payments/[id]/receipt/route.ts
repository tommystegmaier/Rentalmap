import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { generateReceipt } from '@/lib/pdf/receipt';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // RLS gates the read.
  const { data: payment } = await supabase
    .from('rent_payments')
    .select('*, leases:lease_id(property_id, properties:property_id(address, owner_id))')
    .eq('id', params.id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const leaseObj = Array.isArray(payment.leases) ? payment.leases[0] : payment.leases;
  const propObj = leaseObj
    ? Array.isArray(leaseObj.properties)
      ? leaseObj.properties[0]
      : leaseObj.properties
    : null;
  if (!propObj) return NextResponse.json({ error: 'Property missing' }, { status: 500 });

  const admin = createServiceRoleClient();
  const [{ data: landlord }, { data: tenant }] = await Promise.all([
    admin
      .from('users')
      .select('name, email')
      .eq('id', propObj.owner_id)
      .maybeSingle(),
    payment.recorded_by
      ? admin
          .from('users')
          .select('name, email')
          .eq('id', payment.recorded_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const bytes = generateReceipt({
    payment: {
      id: payment.id,
      amount_cents: payment.amount_cents,
      expected_date: payment.expected_date,
      received_date: payment.received_date,
      method: payment.method,
      status: payment.status,
      notes: payment.notes,
    },
    property: { address: propObj.address },
    landlord: {
      name: landlord?.name ?? null,
      email: landlord?.email ?? '—',
    },
    tenant: {
      name: tenant?.name ?? null,
      email: tenant?.email ?? null,
    },
  });

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rent-receipt-${payment.id}.pdf"`,
    },
  });
}
