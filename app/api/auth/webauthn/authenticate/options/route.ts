import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRpConfig, AUTH_CHALLENGE_COOKIE, challengeCookieOptions } from '@/lib/webauthn';

// Step 1 of passkey login. Usernameless / discoverable-credential flow:
// allowCredentials is empty, so the platform offers whatever resident
// passkeys it holds for this RP (Face ID picker).
export async function POST(request: Request) {
  const { rpID } = getRpConfig(request);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: [],
  });

  const res = NextResponse.json(options);
  res.cookies.set(AUTH_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions);
  return res;
}
