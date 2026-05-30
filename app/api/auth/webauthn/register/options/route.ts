import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createClient } from '@/lib/supabase/server';
import { getRpConfig, REG_CHALLENGE_COOKIE, challengeCookieOptions } from '@/lib/webauthn';

// Step 1 of passkey registration. The user must already be signed in (this is
// invoked from Settings). Returns creation options + stashes the challenge.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { rpID, rpName } = getRpConfig(request);

  // Exclude already-registered credentials so the same device isn't enrolled twice.
  const { data: existing } = await supabase
    .from('user_passkeys')
    .select('credential_id, transports')
    .eq('user_id', user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    attestationType: 'none',
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id as string,
      transports: c.transports
        ? (c.transports.split(',') as ('internal' | 'hybrid' | 'usb' | 'nfc' | 'ble')[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  const res = NextResponse.json(options);
  res.cookies.set(REG_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions);
  return res;
}
