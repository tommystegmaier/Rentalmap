import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // RLS limits this to reports the caller owns.
  const { data: report } = await supabase
    .from('tax_reports')
    .select('file_path, year')
    .eq('id', params.id)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = createServiceRoleClient();
  const { data: blob, error } = await admin.storage
    .from('tax-reports')
    .download(report.file_path);
  if (error || !blob) return NextResponse.json({ error: 'File missing' }, { status: 404 });

  const arr = new Uint8Array(await blob.arrayBuffer());
  return new NextResponse(arr as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tax-report-${report.year}.pdf"`,
    },
  });
}
