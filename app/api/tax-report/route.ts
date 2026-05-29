import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { computeTaxReportData } from '@/lib/tax-report-data';
import { buildTaxReportPacket } from '@/lib/pdf/tax-packet';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Manual "Generate report": builds the full packet, saves it so it appears
// under Saved reports in the Tax Center, then redirects back there.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const url = new URL(request.url);
  const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
  const propertyId = url.searchParams.get('property_id') || null;

  const { data: profile } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle();
  const baseLabel = profile?.name ?? profile?.email ?? 'Landlord';

  const data = await computeTaxReportData(supabase, user.id, year, propertyId);

  // When scoped to one property, label the report by its address.
  const propertyLabel = propertyId ? data.properties[0]?.address ?? null : null;
  const ownerLabel = propertyLabel ? `${baseLabel} · ${propertyLabel}` : baseLabel;

  const pdf = await buildTaxReportPacket(supabase, data, ownerLabel);

  // Persist (service role — the tax-reports bucket has no per-user policy).
  const admin = createServiceRoleClient();
  const filePath = `${user.id}/${year}-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage
    .from('tax-reports')
    .upload(filePath, pdf, { contentType: 'application/pdf', upsert: false });

  if (!upErr) {
    await admin.from('tax_reports').insert({
      owner_id: user.id,
      year,
      file_path: filePath,
      total_income_cents: data.totalIncomeCents,
      total_deductible_cents: data.totalDeductibleCents,
      total_nondeductible_cents: data.totalNonDeductibleCents,
      net_cents: data.netCents,
      generated_by: 'manual',
      property_label: propertyLabel,
    });
  }

  const redirectUrl = `/landlord/tax?year=${year}&generated=1${
    propertyId ? `&property_id=${propertyId}` : ''
  }`;
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
