import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeTaxReportData } from '@/lib/tax-report-data';
import { buildTaxReportPacket } from '@/lib/pdf/tax-packet';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tax-report-${year}.pdf"`,
    },
  });
}
