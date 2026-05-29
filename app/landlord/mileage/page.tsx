import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents, one } from '@/lib/utils';
import { tripDeductionCents } from '@/lib/mileage';
import { format, parseISO } from 'date-fns';
import { Car } from 'lucide-react';
import { MileageYearPicker, DeleteMileageButton } from './controls';

interface TripRow {
  id: string;
  trip_date: string;
  miles: number;
  rate_cents: number;
  purpose: string | null;
  notes: string | null;
  properties: { address: string } | { address: string }[] | null;
}

export default async function MileagePage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentYear = new Date().getFullYear();
  const year = Number(searchParams.year ?? currentYear) || currentYear;
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { data: rawTrips } = await supabase
    .from('mileage_trips')
    .select('id, trip_date, miles, rate_cents, purpose, notes, properties:property_id(address)')
    .gte('trip_date', start)
    .lte('trip_date', end)
    .order('trip_date', { ascending: false });

  const trips = (rawTrips ?? []) as TripRow[];
  const totalMiles = trips.reduce((s, t) => s + Number(t.miles), 0);
  const totalDeductionCents = trips.reduce(
    (s, t) => s + tripDeductionCents(Number(t.miles), Number(t.rate_cents)),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mileage"
        description="Deductible miles driven for your rentals"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/mileage/new">Log a trip</Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Year</span>
        <MileageYearPicker year={year} years={years} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total miles</p>
            <p className="mt-1 text-base font-semibold tabular-nums">
              {totalMiles.toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Deduction</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-success">
              {formatCents(totalDeductionCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Mileage flows into your tax report under <strong>Auto and Travel</strong> (Schedule E).
      </p>

      {trips.length === 0 ? (
        <EmptyState
          icon={<Car size={32} />}
          title="No trips logged"
          description={`Log the miles you drive for inspections, repairs, and showings in ${year} to capture the deduction.`}
          action={
            <Button asChild>
              <Link href="/landlord/mileage/new">Log a trip</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {trips.map((t) => {
            const addr = one(t.properties)?.address ?? '—';
            const miles = Number(t.miles);
            const rate = Number(t.rate_cents);
            const deduction = tripDeductionCents(miles, rate);
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {miles.toLocaleString('en-US', { maximumFractionDigits: 1 })} mi
                      {t.purpose ? ` · ${t.purpose}` : ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {addr} · {format(parseISO(t.trip_date), 'MMM d, yyyy')} · {rate}¢/mi
                    </p>
                    {t.notes ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-success">
                      {formatCents(deduction)}
                    </span>
                    <DeleteMileageButton id={t.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
