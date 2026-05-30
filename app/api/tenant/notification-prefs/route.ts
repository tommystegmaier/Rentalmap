import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const PrefsSchema = z.object({
  rent_reminders: z.boolean().optional(),
  maintenance_updates: z.boolean().optional(),
  lease_signing: z.boolean().optional(),
  inspection_signatures: z.boolean().optional(),
  messages: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PrefsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  await supabase.from('users').update({ notification_prefs: parsed.data }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}
