import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Auto-link any pending invitation that matches this user's email.
    if (data.user) {
      await supabase.rpc('accept_pending_invitations', { uid: data.user.id });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
