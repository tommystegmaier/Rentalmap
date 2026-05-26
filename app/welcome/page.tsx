'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Logo } from '@/components/logo';
import { CheckCircle2 } from 'lucide-react';

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
      // If they've already set a password, skip straight to their portal.
      if (user.user_metadata?.password_set === true) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        router.replace(data?.role === 'landlord' ? '/landlord' : '/tenant');
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
  }, [router]);

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
    const { error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
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
  const isTenant = profile.role === 'tenant';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <header className="flex items-center gap-2">
        <Logo size={32} showWordmark />
      </header>

      <div className="mt-10 flex-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
          <CheckCircle2 size={14} />
          You're signed in
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {firstName ? `Welcome, ${firstName}.` : 'Welcome to It Rents.'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{profile.email}</span>.
          {isTenant
            ? ' Set a password below so you can sign in from any device — or skip and we\'ll email a one-time link whenever you need to sign in.'
            : ''}
        </p>

        <Card className="mt-8">
          <CardContent className="pt-6">
            {savedPassword ? (
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
                <div>
                  <p className="font-medium">Password saved.</p>
                  <p className="mt-0.5 text-muted-foreground">
                    You can now sign in with your email and password from any device.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={setUpPassword} className="space-y-4 text-sm">
                <div>
                  <h2 className="text-base font-semibold">Set a password</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recommended. Lets you sign in without waiting for an email link.
                  </p>
                </div>
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
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Button onClick={goToPortal} className="mt-6 w-full" size="lg" variant={savedPassword ? 'default' : 'outline'}>
        {savedPassword ? 'Continue to my portal' : 'Skip for now and continue'}
      </Button>
    </main>
  );
}
