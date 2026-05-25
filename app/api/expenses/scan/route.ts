import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanReceipt } from '@/lib/scan-receipt';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Anthropic caps incoming image content at 5MB. Base64 encoding inflates the
// payload by ~33%, so a raw 5MB image won't fit. Cap raw uploads at ~3.7MB.
const MAX_RAW_BYTES = Math.floor((5 * 1024 * 1024) / 1.34);

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          'Receipt scanning is not set up. Ask the app admin to add an ANTHROPIC_API_KEY env var.',
      },
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
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (file.size > MAX_RAW_BYTES) {
    return NextResponse.json(
      {
        error:
          'Photo too large — try a smaller photo or crop in tighter on the receipt.',
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  const mediaType = file.type || 'image/jpeg';

  try {
    const result = await scanReceipt(base64, mediaType);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OCR failed' },
      { status: 500 },
    );
  }
}
