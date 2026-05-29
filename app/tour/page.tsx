import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import {
  ArrowRight,
  Wallet,
  Bell,
  Clock,
  ScanLine,
  Car,
  FileBarChart,
  FileSignature,
  ClipboardCheck,
  Wrench,
  MessageSquare,
  FolderOpen,
  TrendingUp,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Run your rentals like a pro',
  description:
    'It Rents is rental property management built for small landlords (1–20 units). Collect rent, stay tax-ready, and keep every lease, inspection, and receipt in one place.',
};

export default function TourPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
      />

      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <Logo size={32} showWordmark />
          <Button asChild size="sm" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>

        {/* Hero */}
        <section className="mx-auto mt-14 max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" />
            Built for small landlords — 1 to 20 units
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Run your rentals like a pro — from your phone.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Collect rent on time, stay ready for tax season without the shoebox of
            receipts, and keep every lease, inspection, and document in one place.
            No spreadsheets. No property-manager fees.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup">
                Get started free
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="#features">See everything it does</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Works on any phone — add it to your home screen, no App Store needed.
          </p>
        </section>

        {/* Three pillars */}
        <section id="features" className="mt-24 scroll-mt-8 space-y-16">
          <Pillar
            eyebrow="Get paid on time"
            title="Stop chasing rent."
            blurb="Tenants pay in two taps, autopay keeps it hands-off, and reminders plus automatic late fees do the nagging for you."
            features={[
              {
                icon: <Wallet size={18} />,
                title: 'Online rent collection',
                body: 'Free ACH bank transfers and card payments — or let tenants pay by Venmo, Cash App, or Zelle and confirm it in one tap.',
              },
              {
                icon: <Clock size={18} />,
                title: 'Autopay',
                body: 'Tenants set it once and rent shows up every month. You both get a receipt automatically.',
              },
              {
                icon: <Bell size={18} />,
                title: 'Automatic reminders',
                body: 'Push and email nudges before rent is due — so you never have to send the awkward text.',
              },
              {
                icon: <ShieldCheck size={18} />,
                title: 'Automatic late fees',
                body: 'Set a grace period and fee per lease. Late fees apply themselves, and you can waive any of them with one tap.',
              },
            ]}
          />

          <Pillar
            eyebrow="Tax & money"
            title="Be ready for tax season — all year."
            blurb="Snap a receipt and it files itself into the right IRS category. At tax time, your Schedule E report is one tap away."
            features={[
              {
                icon: <ScanLine size={18} />,
                title: 'Snap-a-receipt AI scanning',
                body: 'Photograph any receipt and AI reads the vendor, amount, date, and sorts it into the right Schedule E category automatically.',
              },
              {
                icon: <Car size={18} />,
                title: 'Mileage tracking',
                body: 'Tap "Start trip" and GPS logs the drive to your property. It applies the current IRS standard rate and books the deduction for you.',
              },
              {
                icon: <FileBarChart size={18} />,
                title: 'One-tap tax reports',
                body: 'A complete Schedule E profit & loss packet — income, deductible expenses, depreciation, and a full ledger — as a clean PDF for you or your accountant.',
              },
              {
                icon: <TrendingUp size={18} />,
                title: 'Income & expenses per property',
                body: 'Every dollar in and out, tracked per property, so you always know what each rental actually earns.',
              },
            ]}
          />

          <Pillar
            eyebrow="Stay organized"
            title="Everything in one place."
            blurb="Leases, e-signatures, inspections with photos, deposits, maintenance, documents, and tenant messages — no more digging through email and filing cabinets."
            features={[
              {
                icon: <FileSignature size={18} />,
                title: 'Leases + e-signature',
                body: 'Generate a clean lease PDF from your terms and have both you and your tenant sign electronically. Even analyze any lease with AI for red flags and missing clauses.',
              },
              {
                icon: <ClipboardCheck size={18} />,
                title: 'Move-in / move-out inspections',
                body: 'Room-by-room photo checklists your tenant signs off on — your protection when the deposit conversation comes up.',
              },
              {
                icon: <Wrench size={18} />,
                title: 'Maintenance & appliances',
                body: 'Tenants send requests with photos; you track appliances, warranties, and service schedules with reminders before things break.',
              },
              {
                icon: <MessageSquare size={18} />,
                title: 'Messaging & documents',
                body: 'Message tenants in-app and store every document — share the lease and insurance, keep the rest private.',
              },
            ]}
          />
        </section>

        {/* Tenant portal callout */}
        <section className="mt-24 rounded-3xl border bg-card p-8 sm:p-10">
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Smartphone size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                Your tenants get an app too.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A polished tenant portal where they pay rent, send maintenance
                requests, view their lease, and message you — all from their phone.
                It makes you look like a professional property manager, because now
                you are one.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                'Pay rent or set up autopay in seconds',
                'Send maintenance requests with photos',
                'Sign the lease electronically',
                'See payment history and shared documents',
                'No App Store — works right in the browser',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Bonus row */}
        <section className="mt-16 grid gap-3 sm:grid-cols-3">
          <MiniCard
            icon={<TrendingUp size={18} />}
            title="Market rent intelligence"
            body="See what comparable units rent for and spot when you're leaving money on the table."
          />
          <MiniCard
            icon={<FolderOpen size={18} />}
            title="Security deposits"
            body="Track what you're holding, where, and return it cleanly with a documented trail."
          />
          <MiniCard
            icon={<ShieldCheck size={18} />}
            title="Private by design"
            body="Your data, your tenants, your business — not sold, not shared, not advertised against."
          />
        </section>

        {/* Final CTA */}
        <section className="mt-24 rounded-3xl border bg-gradient-to-br from-primary/10 to-primary/5 p-10 text-center">
          <Logo size={48} className="mx-auto mb-4" />
          <h2 className="text-3xl font-semibold tracking-tight">
            Ready to run your rentals the easy way?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Set up your first property in a few minutes. Invite your tenant and you&apos;re
            collecting rent the same day.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/signup">
              Get started as a landlord
              <ArrowRight size={16} />
            </Link>
          </Button>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t pt-8 pb-4">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <Logo size={24} showWordmark />
            <p className="text-xs text-muted-foreground">
              {APP_NAME} · Rental management for small landlords.
            </p>
            <Link
              href="/login"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Pillar({
  eyebrow,
  title,
  blurb,
  features,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  features: { icon: React.ReactNode; title: string; body: string }[];
}) {
  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {f.icon}
            </span>
            <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
