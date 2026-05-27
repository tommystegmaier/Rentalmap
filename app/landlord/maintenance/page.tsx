import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Wrench, Home as HomeIcon, ChevronLeft, FolderOpen, ChevronRight } from 'lucide-react';

function woStatus(status: string) {
  if (status === 'closed') {
    return { label: 'Completed', cls: 'border-transparent bg-success/10 text-success' };
  }
  if (status === 'in_progress') {
    return { label: 'In Progress', cls: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' };
  }
  // open
  return { label: 'Open', cls: 'border-transparent bg-muted text-muted-foreground' };
}

interface OrderRow {
  id: string;
  property_id: string;
  request_type: string;
  description: string;
  urgency: Urgency;
  status: 'open' | 'in_progress' | 'closed';
  submitted_at: string;
  properties: { id: string; address: string } | { id: string; address: string }[] | null;
  submitter: { name: string | null; email: string } | { name: string | null; email: string }[] | null;
}

interface PropertyRow {
  id: string;
  address: string;
  photoUrl: string | null;
}

export default async function LandlordMaintenancePage({
  searchParams,
}: {
  searchParams: { view?: string; property?: string; past?: string };
}) {
  const supabase = createClient();

  const propertyId = searchParams.property ?? null;
  const byProperty = searchParams.view === 'property' || !!propertyId;
  const showPast = searchParams.past === '1';

  const [{ data: rawOrders }, { data: rawProperties }] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, property_id, request_type, description, urgency, status, submitted_at, properties:property_id(id, address), submitter:submitted_by_user_id(name, email)')
      .order('submitted_at', { ascending: false })
      .limit(200),
    supabase
      .from('properties')
      .select('id, address, photo_url')
      .order('created_at'),
  ]);

  const orders = (rawOrders ?? []) as OrderRow[];

  const properties: PropertyRow[] = (rawProperties ?? []).map(
    (p: { id: string; address: string; photo_url: string | null }) => ({
      id: p.id,
      address: p.address,
      photoUrl: p.photo_url
        ? supabase.storage.from('property-photos').getPublicUrl(p.photo_url).data.publicUrl
        : null,
    }),
  );

  const selectedProperty = propertyId ? properties.find((p) => p.id === propertyId) : null;
  const displayedOrders = propertyId
    ? orders.filter((w) => w.property_id === propertyId)
    : orders;

  const pastBackHref = propertyId
    ? `/landlord/maintenance?property=${propertyId}&past=1`
    : '/landlord/maintenance?past=1';
  const backFromPastHref = propertyId
    ? `/landlord/maintenance?property=${propertyId}`
    : '/landlord/maintenance';

  return (
    <div className="space-y-4">
      <PageHeader
        title={showPast ? 'Past Work Orders' : 'Work Orders'}
        description={selectedProperty ? selectedProperty.address : undefined}
        action={
          showPast ? null : (
            <Button asChild size="sm">
              <Link href="/landlord/maintenance/new">Add</Link>
            </Button>
          )
        }
      />

      {/* Back navigation */}
      {showPast ? (
        <Link
          href={backFromPastHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Active work orders
        </Link>
      ) : propertyId ? (
        <Link
          href="/landlord/maintenance?view=property"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={16} />
          All properties
        </Link>
      ) : (
        /* View toggle — only on main active view */
        <div className="flex rounded-xl border bg-muted/20 p-0.5 text-sm font-medium">
          <Link
            href="/landlord/maintenance"
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-center transition-colors',
              !byProperty
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </Link>
          <Link
            href="/landlord/maintenance?view=property"
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-center transition-colors',
              byProperty
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            By Property
          </Link>
        </div>
      )}

      {/* Content */}
      {showPast ? (
        <PastOrderList orders={displayedOrders} showProperty={!propertyId} />
      ) : byProperty && !propertyId ? (
        <PropertyGrid properties={properties} orders={orders} />
      ) : (
        <OrderList orders={displayedOrders} showProperty={!propertyId} pastHref={pastBackHref} />
      )}
    </div>
  );
}

function PropertyGrid({
  properties,
  orders,
}: {
  properties: PropertyRow[];
  orders: OrderRow[];
}) {
  if (properties.length === 0) {
    return (
      <EmptyState
        icon={<HomeIcon size={32} />}
        title="No properties yet"
        description="Add a property to start tracking work orders by location."
      />
    );
  }

  return (
    <div className="space-y-2">
      {properties.map((p) => {
        const propOrders = orders.filter((w) => w.property_id === p.id);
        const openCount = propOrders.filter((w) => w.status !== 'closed').length;
        return (
          <Link key={p.id} href={`/landlord/maintenance?property=${p.id}`}>
            <Card className="relative overflow-hidden transition hover:bg-muted/30">
              {openCount > 0 ? (
                <span className="absolute right-2 top-2 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-none text-white">
                  {openCount}
                </span>
              ) : null}
              <CardContent className="flex items-center gap-3 p-3">
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <HomeIcon size={22} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.address}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {propOrders.length === 0
                      ? 'No work orders'
                      : `${openCount} open · ${propOrders.length} total`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function OrderCard({
  w,
  showProperty,
  showUrgency,
}: {
  w: OrderRow;
  showProperty: boolean;
  showUrgency: boolean;
}) {
  const props = Array.isArray(w.properties) ? w.properties[0] : w.properties;
  const sub = Array.isArray(w.submitter) ? w.submitter[0] : w.submitter;
  const urg = URGENCY_LABELS[w.urgency];
  const s = woStatus(w.status);
  return (
    <Link href={`/landlord/maintenance/${w.id}`}>
      <Card className="transition hover:bg-muted/30">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{w.request_type}</p>
            {showUrgency ? (
              <Badge className={`border-transparent ${urg.color}`}>{urg.label}</Badge>
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{w.description}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {showProperty ? `${props?.address ?? '—'} · ` : ''}
              {format(parseISO(w.submitted_at), 'MMM d')}
              {sub ? ` · ${sub.name ?? sub.email}` : ''}
            </span>
            <Badge className={s.cls}>{s.label}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function OrderList({
  orders,
  showProperty,
  pastHref,
}: {
  orders: OrderRow[];
  showProperty: boolean;
  pastHref: string;
}) {
  const active = orders.filter((w) => w.status !== 'closed');
  const pastCount = orders.filter((w) => w.status === 'closed').length;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Wrench size={32} />}
        title="No work orders yet"
        description="Tenants can submit from their portal, or log one yourself."
        action={
          <Button asChild>
            <Link href="/landlord/maintenance/new">Add work order</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <div className="space-y-2">
          {active.map((w) => (
            <OrderCard key={w.id} w={w} showProperty={showProperty} showUrgency={true} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No open work orders.</p>
      )}

      {pastCount > 0 ? (
        <Link href={pastHref}>
          <Card className="transition hover:bg-muted/30">
            <CardContent className="flex items-center gap-3 p-3">
              <FolderOpen size={18} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Past Work Orders</p>
                <p className="text-xs text-muted-foreground">{pastCount} completed</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}

function PastOrderList({
  orders,
  showProperty,
}: {
  orders: OrderRow[];
  showProperty: boolean;
}) {
  const past = orders.filter((w) => w.status === 'closed');

  if (past.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen size={32} />}
        title="No completed work orders"
        description="Completed work orders will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {past.map((w) => (
        <OrderCard key={w.id} w={w} showProperty={showProperty} showUrgency={false} />
      ))}
    </div>
  );
}
