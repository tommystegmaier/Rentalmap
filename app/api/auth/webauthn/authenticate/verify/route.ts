import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  getRpConfig,
  publicKeyFromString,
  AUTH_CHALLENGE_COOKIE,
} from '@/lib/webauthn';

// Step 2 of passkey login. Verifies the assertion against the stored public
// key, then mints a Supabase session by generating a magic-link token_hash
// (no email is sent — the client immediately verifies it to set cookies).
export async function POST(request: Request) {
  const expectedChallenge = cookies().get(AUTH_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Challenge expired — try again.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.credential?.id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // No session yet — use service role to look up the credential.
  const admin = createServiceRoleClient();
  const { data: passkey } = await admin
    .from('user_passkeys')
    .select('id, user_id, credential_id, public_key, counter, transports')
    .eq('credential_id', body.credential.id)
    .maybeSingle();

  if (!passkey) {
    return NextResponse.json({ error: 'Passkey not recognized.' }, { status: 404 });
  }

  const { rpID, origin } = getRpConfig(request);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: publicKeyFromString(passkey.public_key),
        counter: Number(passkey.counter),
        transports: passkey.transports
          ? (passkey.transports.split(',') as ('internal' | 'hybrid' | 'usb' | 'nfc' | 'ble')[])
          : undefined,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 400 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Could not verify passkey' }, { status: 401 });
  }

  // Advance the signature counter to guard against cloned authenticators.
  await admin
    .from('user_passkeys')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', passkey.id);

  // Look up the user's email to mint a session.
  const { data: profile } = await admin
    .from('users')
    .select('email')
    .eq('id', passkey.user_id)
    .maybeSingle();

  if (!profile?.email) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });

  if (linkError || !link.properties?.hashed_token) {
    return NextResponse.json({ error: 'Could not start session.' }, { status: 500 });
  }

  // Client verifies this token_hash to establish the session cookies.
  const res = NextResponse.json({ tokenHash: link.properties.hashed_token });
  res.cookies.delete(AUTH_CHALLENGE_COOKIE);
  return res;
}
