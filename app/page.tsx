import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

export default async function Home() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (configured) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      redirect(profile?.role === 'landlord' ? '/landlord' : '/tenant');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-muted-foreground">
          Private rental management for landlords and their tenants.
        </p>
      </div>

      <div className="mt-10 space-y-3">
        <Button asChild className="w-full">
          <Link href="/signup">Get started as landlord</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>

      {!configured ? (
        <div className="mt-10 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Setup needed</p>
          <p className="mt-1">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then run the
            migrations in <code>supabase/migrations/</code>.
          </p>
        </div>
      ) : null}
    </main>
  );
}
