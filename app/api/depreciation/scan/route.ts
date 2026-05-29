import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanPurchaseDocument } from '@/lib/scan-receipt';

export const runtime = 'nodejs';
export const maxDuration = 45;

const MAX_RAW_BYTES = Math.floor((5 * 1024 * 1024) / 1.34);

function resolveMediaType(file: File): string {
  const t = (file.type || '').toLowerCase();
  if (t === 'application/pdf') return 'application/pdf';
  if (t.startsWith('image/')) return t;
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Document scanning is not set up. Add ANTHROPIC_API_KEY and redeploy.' },
      { status: 503 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
  } catch {
    return NextResponse.json({ error: 'Invalid form upload' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (file.size > MAX_RAW_BYTES) {
    return NextResponse.json({ error: 'File too large — try a smaller scan.' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');

  try {
    const result = await scanPurchaseDocument(base64, resolveMediaType(file));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scan failed' },
      { status: 500 },
    );
  }
}
