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
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Run your rentals like a pro',
  description:
    'It Rents is rental property management made simple. Collect rent, stay tax-ready, and keep every lease, inspection, and receipt in one place.',
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
        <section className="mx-auto mt-16 max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
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

        {/* Showcase — device-framed app screens */}
        <section className="mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              A peek inside
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">See it in action.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The same clean, fast experience for you and your tenants — right in the browser,
              on any phone.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <Figure caption="See what's paid at a glance.">
              <PhoneFrame>
                <PhoneRent />
              </PhoneFrame>
            </Figure>
            <Figure caption="Snap a receipt — AI files it for taxes.">
              <PhoneFrame>
                <PhoneScan />
              </PhoneFrame>
            </Figure>
            <Figure caption="A Schedule E tax report in one tap.">
              <PhoneFrame>
                <PhoneTax />
              </PhoneFrame>
            </Figure>
            <Figure caption="Your tenant pays in two taps.">
              <PhoneFrame>
                <PhoneTenant />
              </PhoneFrame>
            </Figure>
          </div>
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
              {APP_NAME} · Rental property management made simple.
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

/* ---------- Device showcase ---------- */

function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      {children}
      <figcaption className="mt-4 text-center text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[248px]">
      <div className="rounded-[2.3rem] border-[10px] border-gray-900 bg-gray-900 shadow-xl">
        <div className="relative h-[486px] overflow-hidden rounded-[1.6rem] bg-background">
          {/* notch */}
          <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-gray-900" />
          <div className="h-full overflow-hidden px-3.5 pb-3 pt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FieldMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium">{value}</span>
    </div>
  );
}

function PhoneRent() {
  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground">Good morning</p>
          <p className="text-sm font-semibold">Your dashboard</p>
        </div>
        <Logo size={22} />
      </div>

      <div className="rounded-xl bg-primary/10 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-primary">
          Rent · May 2026
        </p>
        <p className="mt-1 text-2xl font-semibold">$2,900</p>
        <p className="text-[10px] text-muted-foreground">collected of $2,900</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-primary/20">
          <div className="h-1.5 w-full rounded-full bg-primary" />
        </div>
      </div>

      <div className="space-y-2">
        {[
          { addr: '412 Oak St', sub: 'Paid · May 1' },
          { addr: '118 Pine Ave', sub: 'Paid · May 1' },
        ].map((r) => (
          <div
            key={r.addr}
            className="flex items-center justify-between rounded-lg border bg-card px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium">{r.addr}</p>
              <p className="text-[9px] text-muted-foreground">{r.sub}</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success">
              <CheckCircle2 size={9} /> Paid
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg border bg-card px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium">9 Maple Ct</p>
            <p className="text-[9px] text-muted-foreground">Due in 3 days</p>
          </div>
          <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-medium text-warning">
            Upcoming
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-[10px] text-muted-foreground">
        <Bell size={11} className="text-primary" /> Reminder sent to 9 Maple Ct
      </div>
    </div>
  );
}

function PhoneScan() {
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm font-semibold">Add expense</p>

      <div className="flex h-20 items-center justify-center rounded-xl border border-dashed bg-muted/40">
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ScanLine size={20} className="text-primary" />
          <span className="text-[9px]">Receipt photo</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
          <Sparkles size={11} /> Read from your photo
        </div>
        <div className="mt-1.5">
          <FieldMini label="Vendor" value="Lowe's" />
          <FieldMini label="Amount" value="$39.00" />
          <FieldMini label="Category" value="Supplies" />
          <FieldMini label="Date" value="May 29, 2026" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-2 text-[10px] font-medium text-success">
        <CheckCircle2 size={11} /> Saved &amp; tagged for taxes
      </div>
    </div>
  );
}

function MiniTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg p-1.5 text-center ${accent ? 'bg-primary/10' : 'bg-muted/50'}`}>
      <p className="text-[7px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-[11px] font-semibold ${accent ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function PhoneTax() {
  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Tax report</p>
        <span className="text-[10px] text-muted-foreground">2026</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MiniTile label="Income" value="$34.8k" />
        <MiniTile label="Deduct." value="$12.4k" />
        <MiniTile label="Net" value="$22.4k" accent />
      </div>

      <div className="rounded-xl border bg-card p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule E
        </p>
        <div className="mt-1">
          <FieldMini label="Repairs" value="$3,210" />
          <FieldMini label="Supplies" value="$1,840" />
          <FieldMini label="Auto &amp; Travel" value="$612" />
          <FieldMini label="Insurance" value="$2,150" />
          <FieldMini label="Depreciation" value="$4,600" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground">
        <FileBarChart size={12} /> Download Schedule E PDF
      </div>
    </div>
  );
}

function PhoneTenant() {
  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Pay rent</p>
        <Logo size={20} />
      </div>

      <div className="rounded-xl border bg-card p-3 text-center">
        <p className="text-[10px] text-muted-foreground">Due June 1</p>
        <p className="mt-0.5 text-3xl font-semibold">$1,450</p>
        <p className="text-[9px] text-muted-foreground">412 Oak St</p>
      </div>

      <div className="rounded-lg bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground">
        Pay with bank · free
      </div>
      <div className="rounded-lg border py-2.5 text-center text-xs font-medium">Pay by card</div>

      <div className="flex items-center justify-between rounded-lg border px-2.5 py-2">
        <div>
          <p className="text-[11px] font-medium">Autopay</p>
          <p className="text-[9px] text-muted-foreground">On · pays the 1st</p>
        </div>
        <span className="flex h-4 w-7 items-center justify-end rounded-full bg-success px-0.5">
          <span className="h-3 w-3 rounded-full bg-white" />
        </span>
      </div>

      <p className="text-center text-[9px] text-muted-foreground">
        or pay by Venmo · Cash App · Zelle
      </p>
    </div>
  );
}
