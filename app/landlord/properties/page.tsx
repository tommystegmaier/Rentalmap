import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { Building2 } from 'lucide-react';

export default async function PropertiesPage() {
  const supabase = createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('*, leases(monthly_rent_cents, status)')
    .order('created_at');

  return (
    <div className="space-y-6">
      <PageHeader title="Properties" />

      {properties && properties.length > 0 ? (
        properties.map((p: {
          id: string;
          address: string;
          purchase_price_cents: number | null;
          leases: { monthly_rent_cents: number; status: string }[];
        }) => {
          const activeLease = p.leases?.find((l) => l.status === 'active');
          return (
            <Link key={p.id} href={`/landlord/properties/${p.id}`}>
              <Card className="transition hover:bg-muted/30">
                <CardHeader>
                  <CardTitle>{p.address}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Purchase price</p>
                    <p className="font-medium">{formatCents(p.purchase_price_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Monthly rent</p>
                    <p className="font-medium">
                      {activeLease ? formatCents(activeLease.monthly_rent_cents) : 'No active lease'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })
      ) : (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No properties yet"
          description="Run supabase/seed.sql with your auth user id."
        />
      )}
    </div>
  );
}
