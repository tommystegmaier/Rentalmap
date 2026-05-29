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

  const { data: profile } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle();
  const ownerLabel = profile?.name ?? profile?.email ?? 'Landlord';

  const data = await computeTaxReportData(supabase, user.id, year);
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
    });
  }

  return NextResponse.redirect(
    new URL(`/landlord/tax?year=${year}&generated=1`, request.url),
  );
}
