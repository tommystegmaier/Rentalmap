import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import {
  Home as HomeIcon,
  Wallet,
  Wrench,
  FileText,
  Bell,
  Mail,
  Sparkles,
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
      {/* Soft background wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
      />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <HomeIcon size={18} strokeWidth={2.4} />
            </span>
            <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline tap-44"
          >
            Sign in
          </Link>
        </header>

        {/* Hero */}
        <section className="mt-16 sm:mt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles size={12} className="text-primary" />
            For renters and their landlords
          </span>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome home.
          </h1>

          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pay rent, send maintenance requests, and access your lease — all from your phone.
            No app store, no clutter. Just the things you actually need as a renter.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/login">
                Sign in to your portal
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            New here? Look for an invitation email from your landlord.
          </p>
        </section>

        {/* Feature cards */}
        <section className="mt-20 grid gap-3 sm:grid-cols-3">
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

        {/* How it works */}
        <section id="how-it-works" className="mt-20 sm:mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Three steps. Under a minute, total.
          </p>

          <ol className="mt-8 space-y-5">
            <Step
              num={1}
              icon={<Mail size={18} />}
              title="Check your inbox"
              body="Your landlord sends an invitation email tied to your lease."
            />
            <Step
              num={2}
              icon={<Sparkles size={18} />}
              title="Tap the magic link"
              body="No password to remember. The link signs you in to your private portal."
            />
            <Step
              num={3}
              icon={<Smartphone size={18} />}
              title="Add to your home screen"
              body="In Safari, tap Share → Add to Home Screen. Opens like a real app, no App Store needed."
            />
          </ol>
        </section>

        {/* Notifications callout */}
        <section className="mt-20 rounded-2xl border bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell size={20} />
            </span>
            <div>
              <h3 className="text-base font-semibold">Stay in the loop</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional push notifications keep you posted on rent confirmations and updates
                from your landlord. Turn them on in your profile after you sign in.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto pt-16">
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

          <p className="mt-8 text-center text-xs text-muted-foreground">
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

function Step({
  num,
  icon,
  title,
  body,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {num}
      </span>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
