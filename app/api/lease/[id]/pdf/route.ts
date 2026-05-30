import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateLeasePdf } from '@/lib/lease-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: lease } = await supabase
    .from('leases')
    .select(
      `id, start_date, end_date, monthly_rent_cents, due_day, late_after_day,
       late_fee_cents, security_deposit_cents, pets_allowed, utilities_paid_by,
       lawn_care_by, terms_notes,
       landlord_signed_at, landlord_signed_name,
       tenant_signed_at, tenant_signed_name,
       properties:property_id(address, owner_id)`,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!lease) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  if ((prop as { owner_id: string } | null)?.owner_id !== user.id) {
    // Also allow the tenant to download
    const { data: link } = await supabase
      .from('lease_tenants')
      .select('id')
      .eq('lease_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const address = (prop as { address: string } | null)?.address ?? 'Unknown property';

  const pdfBytes = generateLeasePdf({
    propertyAddress: address,
    startDate: lease.start_date as string,
    endDate: lease.end_date as string,
    monthlyRentCents: lease.monthly_rent_cents as number,
    dueDay: lease.due_day as number,
    lateAfterDay: lease.late_after_day as number,
    lateFeeCents: lease.late_fee_cents as number,
    securityDepositCents: lease.security_deposit_cents as number,
    petsAllowed: lease.pets_allowed as boolean,
    utilitiesPaidBy: (lease.utilities_paid_by as string) ?? 'tenant',
    lawnCareBy: (lease.lawn_care_by as string) ?? 'tenant',
    termsNotes: (lease.terms_notes as string | null) ?? null,
    landlordSignedAt: (lease.landlord_signed_at as string | null) ?? null,
    landlordSignedName: (lease.landlord_signed_name as string | null) ?? null,
    tenantSignedAt: (lease.tenant_signed_at as string | null) ?? null,
    tenantSignedName: (lease.tenant_signed_name as string | null) ?? null,
  });

  const isSigned = lease.landlord_signed_at && lease.tenant_signed_at;
  const filename = isSigned ? 'lease-signed.pdf' : 'lease-draft.pdf';

  return new Response(pdfBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
