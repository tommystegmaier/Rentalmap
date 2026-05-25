import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendMessage } from '@/lib/messages';

const Body = z.object({
  recipient_id: z.string().uuid(),
  body: z.string().min(1).max(5000),
  lease_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  try {
    const id = await sendMessage(parsed.data);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send' },
      { status: 500 },
    );
  }
}
