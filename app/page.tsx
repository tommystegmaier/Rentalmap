import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { APP_NAME } from '@/lib/constants';
import {
  Wallet,
  Wrench,
  FileText,
  Smartphone,
  ArrowRight,
} from 'lucide-react';

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
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
      />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-6">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <Logo size={32} showWordmark />
        </header>

        {/* Hero — compact so the landlord card lands above the fold */}
        <section className="mt-8">
          <Logo size={56} className="mb-4" />
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome home.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pay rent, send maintenance requests, and access your lease — all from
            your phone.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button asChild size="lg" className="w-full">
              <Link href="/login">
                Tenant sign in
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link href="/login">
                Landlord sign in
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </section>

        {/* Landlord setup — promoted to the initial viewport */}
        <section className="mt-6">
          <div className="rounded-2xl border bg-muted/30 p-5 text-sm">
            <p className="font-medium">Are you a landlord?</p>
            <p className="mt-1 text-muted-foreground">
              Set up your properties, leases, and tenant invitations.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/signup">
                Get started as landlord
                <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </section>

        {/* Feature cards */}
        <section className="mt-16 grid gap-3 sm:grid-cols-3">
          <FeatureCard
            icon={<Wallet size={20} />}
            title="Pay rent"
            body="Bank transfer or card, in two taps. ACH is free. Receipt arrives in your inbox."
          />
          <FeatureCard
            icon={<Wrench size={20} />}
            title="Request maintenance"
            body="Snap a photo, pick urgency, hit send. Your landlord gets a push instantly."
          />
          <FeatureCard
            icon={<FileText size={20} />}
            title="Your lease, your records"
            body="Lease terms, payment history, shared documents — always with you."
          />
        </section>

        {/* Add to home screen */}
        <section className="mt-16 rounded-2xl border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone size={20} />
            </span>
            <div>
              <h3 className="text-base font-semibold">Add to your home screen</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                In Safari, tap <strong>Share → Add to Home Screen</strong>. Opens
                like a real app, no App Store needed.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto pt-16">
          <p className="text-center text-xs text-muted-foreground">
            {APP_NAME} · Private rental management for one household at a time.
          </p>

          {!configured ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Setup needed: configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and
              <code> NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
