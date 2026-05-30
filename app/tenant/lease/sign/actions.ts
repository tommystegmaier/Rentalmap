'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { generateLeasePdf } from '@/lib/lease-pdf';

export async function tenantSignLease(leaseId: string, name: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('Please enter your full name to sign.');

  // Verify tenant is on this lease (using tenant session — RLS enforced)
  const { data: link } = await supabase
    .from('lease_tenants')
    .select('id')
    .eq('lease_id', leaseId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!link) throw new Error('You are not listed on this lease.');

  // Use admin to fetch full lease + property data so we reliably get
  // property_id, owner_id, and all PDF fields without tenant RLS edge cases.
  const admin = createServiceRoleClient();
  const { data: lease } = await admin
    .from('leases')
    .select(`
      id, start_date, end_date, monthly_rent_cents, due_day, late_after_day,
      late_fee_cents, security_deposit_cents, pets_allowed, utilities_paid_by,
      lawn_care_by, terms_notes,
      landlord_signed_at, landlord_signed_name,
      tenant_signed_at, tenant_signed_name,
      property_id,
      properties:property_id(id, address, owner_id)
    `)
    .eq('id', leaseId)
    .maybeSingle();

  if (!lease?.landlord_signed_at) {
    throw new Error('The landlord must sign first before the tenant can sign.');
  }
  if (lease.tenant_signed_at) {
    throw new Error('This lease has already been signed.');
  }

  const signedAt = new Date().toISOString();

  const { error: updateErr } = await admin
    .from('leases')
    .update({ tenant_signed_at: signedAt, tenant_signed_name: trimmed })
    .eq('id', leaseId);
  if (updateErr) throw updateErr;

  const prop = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  const propertyId = (prop as { id: string }).id;
  const address = (prop as { address: string }).address;
  const ownerId = (prop as { owner_id: string }).owner_id;

  // Generate signed PDF and store it in the documents bucket.
  // Best-effort — don't fail the whole signing if storage has an issue.
  try {
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
      landlordSignedAt: lease.landlord_signed_at as string,
      landlordSignedName: (lease.landlord_signed_name as string | null) ?? null,
      tenantSignedAt: signedAt,
      tenantSignedName: trimmed,
    });

    const storagePath = `${propertyId}/lease-signed-${leaseId}.pdf`;
    await admin.storage.from('documents').upload(storagePath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true,
    });

    await admin.from('documents').insert({
      property_id: propertyId,
      lease_id: leaseId,
      type: 'Lease',
      filename: 'Signed Lease Agreement.pdf',
      file_url: storagePath,
      visible_to_tenant: true,
      uploaded_by: user.id,
      date_added: signedAt.slice(0, 10),
    });
  } catch {
    // Don't let PDF storage failure block the signing confirmation
  }

  // Push notification direct to landlord owner_id (more reliable than
  // sendPushToLandlord which does a secondary properties lookup).
  await sendPushToUser(ownerId, {
    title: 'Lease fully signed',
    body: `${trimmed} has signed the lease for ${address}.`,
    url: `/landlord/properties/${propertyId}/leases/${leaseId}`,
    tag: `lease-signed-${leaseId}`,
  });

  revalidatePath('/tenant/lease');
  revalidatePath('/tenant');
  revalidatePath(`/landlord/properties/${propertyId}/leases/${leaseId}`);
  revalidatePath(`/landlord/properties/${propertyId}`);
}
