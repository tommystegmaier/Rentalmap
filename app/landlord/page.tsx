import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StripeSetupBanner } from '@/components/stripe-setup-banner';
import { formatCents } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { Wrench, ReceiptText, Send, MessageSquare, Home as HomeIcon, Car, Calculator } from 'lucide-react';

export default async function LandlordDashboard() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const yearStart = `${new Date().getFullYear()}-01-01`;

  const [
    { data: properties },
    { data: leases },
    { data: openWorkOrders },
    { data: ytdPayments },
    { data: ytdExpenses },
    { count: unreadMessages },
    { count: unviewedMaintenance },
  ] = await Promise.all([
    supabase.from('properties').select('*').order('created_at'),
    supabase
      .from('leases')
      .select('*, lease_tenants(user_id), properties(address)')
      .eq('status', 'active'),
    supabase.from('work_orders').select('id, urgency').neq('status', 'closed'),
    supabase
      .from('rent_payments')
      .select('amount_cents, status, received_date')
      .gte('received_date', yearStart),
    supabase.from('expenses').select('amount_cents').gte('date', yearStart),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .is('read_at', null),
    supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .is('landlord_viewed_at', null)
      .neq('status', 'closed'),
  ]);

  const ytdIncomeCents = (ytdPayments ?? [])
    .filter((p: { status: string }) => p.status === 'settled' || p.status === 'manual')
    .reduce((s: number, p: { amount_cents: number | null }) => s + (p.amount_cents ?? 0), 0);
  const ytdExpenseCents = (ytdExpenses ?? []).reduce(
    (s: number, e: { amount_cents: number | null }) => s + (e.amount_cents ?? 0),
    0,
  );
  const ytdNet = ytdIncomeCents - ytdExpenseCents;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your portfolio at a glance" />

      <StripeSetupBanner variant="dashboard" />

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="YTD Income" value={formatCents(ytdIncomeCents)} />
        <StatTile
          label="YTD Expenses"
          value={formatCents(ytdExpenseCents)}
          href="/landlord/expenses"
        />
        <StatTile
          label="Net Cash Flow"
          value={formatCents(ytdNet)}
          accent={ytdNet >= 0 ? 'success' : 'destructive'}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QuickAction href="/landlord/expenses/new" icon={<ReceiptText size={20} />} label="Add expense" />
        <QuickAction href="/landlord/mileage/new" icon={<Car size={20} />} label="Log mileage" />
        <QuickAction
          href="/landlord/maintenance"
          icon={<Wrench size={20} />}
          label="Work orders"
          badge={unviewedMaintenance ?? 0}
        />
        <QuickAction
          href="/landlord/messages"
          icon={<MessageSquare size={20} />}
          label="Messages"
          badge={unreadMessages ?? 0}
        />
        <QuickAction href="/landlord/invite" icon={<Send size={20} />} label="Invite tenant" />
        <QuickAction href="/landlord/tax" icon={<Calculator size={20} />} label="Tax Center" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Properties</h2>
        {properties && properties.length > 0 ? (
          properties.map((p: { id: string; address: string; photo_url: string | null }) => {
            const lease = leases?.find(
              (l: { property_id: string }) => l.property_id === p.id,
            ) as
              | { monthly_rent_cents: number; end_date: string }
              | undefined;
            const daysToEnd = lease
              ? differenceInDays(parseISO(lease.end_date), new Date())
              : null;
            const photoUrl = p.photo_url
              ? supabase.storage.from('property-photos').getPublicUrl(p.photo_url).data.publicUrl
              : null;
            return (
              <Link key={p.id} href={`/landlord/properties/${p.id}`}>
                <Card className="overflow-hidden transition hover:bg-muted/30">
                  <div className="flex items-stretch gap-3">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt=""
                        className="h-24 w-24 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-muted text-muted-foreground">
                        <HomeIcon size={28} />
                      </div>
                    )}
                    <div className="flex-1 py-3 pr-4">
                      <p className="line-clamp-2 text-sm font-medium">{p.address}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Rent</p>
                          <p className="font-medium">
                            {lease ? formatCents(lease.monthly_rent_cents) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Lease ends</p>
                          <p className="font-medium">
                            {lease ? `${daysToEnd} days` : 'No lease'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })
        ) : (
          <EmptyState
            icon={<HomeIcon size={32} />}
            title="No properties yet"
            description="Add your first property to start tracking rent, expenses, and maintenance."
            action={
              <Button asChild>
                <Link href="/landlord/properties/new">Add property</Link>
              </Button>
            }
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Open work orders</h2>
          <Badge className="border-transparent bg-muted text-muted-foreground">
            {openWorkOrders?.length ?? 0}
          </Badge>
        </div>
        {openWorkOrders && openWorkOrders.length > 0 ? (
          <Button asChild variant="outline" className="w-full">
            <Link href="/landlord/maintenance">View work orders</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">No open work orders.</p>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent?: 'success' | 'destructive';
  href?: string;
}) {
  const inner = (
    <CardContent className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-base font-semibold ${
          accent === 'success'
            ? 'text-success'
            : accent === 'destructive'
              ? 'text-destructive'
              : ''
        }`}
      >
        {value}
      </p>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="h-full transition hover:bg-muted/30">{inner}</Card>
      </Link>
    );
  }
  return <Card>{inner}</Card>;
}

function QuickAction({
  href,
  icon,
  label,
  badge = 0,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-1 rounded-2xl border bg-card p-3 text-center text-xs hover:bg-muted/30 tap-44"
    >
      {badge > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      <span className="text-primary" aria-hidden>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
