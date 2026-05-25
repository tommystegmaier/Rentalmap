import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // RLS limits this read to documents the user is allowed to see.
  const { data: doc, error } = await supabase
    .from('documents')
    .select('file_url, filename')
    .eq('id', params.id)
    .maybeSingle();
  if (error || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: signed, error: sigErr } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.file_url, 60 * 10, { download: doc.filename });
  if (sigErr || !signed?.signedUrl) {
    return NextResponse.json({ error: sigErr?.message ?? 'Failed to sign URL' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
