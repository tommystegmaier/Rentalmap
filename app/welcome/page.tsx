'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Logo } from '@/components/logo';

interface Profile {
  email: string;
  name: string | null;
  role: 'landlord' | 'tenant';
}

export default function WelcomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPassword, setSavedPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setChecked(true);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('email, name, role')
        .eq('id', user.id)
        .maybeSingle();
      setProfile((data as Profile | null) ?? null);
      setChecked(true);
    });
  }, []);

  async function setUpPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSavedPassword(true);
  }

  function goToPortal() {
    router.push(profile?.role === 'landlord' ? '/landlord' : '/tenant');
    router.refresh();
  }

  if (!checked) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
        <Logo size={48} className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your sign-in link is no longer valid. They expire after 1 hour or after one use. Ask
          your landlord to resend your invitation, or request a new sign-in link below.
        </p>
        <Button asChild className="mt-6 w-full">
          <a href="/login">Get a new sign-in link</a>
        </Button>
      </main>
    );
  }

  const firstName = profile.name?.split(' ')[0] ?? '';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <header className="flex items-center gap-2">
        <Logo size={32} showWordmark />
      </header>

      <div className="mt-12 flex-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re signed in as <span className="font-medium text-foreground">{profile.email}</span>.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Set a password (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            {savedPassword ? (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                Password saved. You can now sign in with email + password from any device.
              </div>
            ) : (
              <form onSubmit={setUpPassword} className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Or skip — we&apos;ll just email you a one-time link any time you need to sign in.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                {error ? <p className="text-destructive">{error}</p> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Button onClick={goToPortal} className="mt-6 w-full" size="lg">
        Continue to my portal
      </Button>
    </main>
  );
}
