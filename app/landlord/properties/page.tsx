import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCents } from '@/lib/utils';
import { Building2, Home as HomeIcon } from 'lucide-react';

export default async function PropertiesPage() {
  const supabase = createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('*, leases(monthly_rent_cents, status)')
    .order('created_at');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        action={
          <Button asChild size="sm">
            <Link href="/landlord/properties/new">Add</Link>
          </Button>
        }
      />

      {properties && properties.length > 0 ? (
        properties.map((p: {
          id: string;
          address: string;
          purchase_price_cents: number | null;
          photo_url: string | null;
          leases: { monthly_rent_cents: number; status: string }[];
        }) => {
          const activeLease = p.leases?.find((l) => l.status === 'active');
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
                      className="h-28 w-28 shrink-0 object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-28 shrink-0 items-center justify-center bg-muted text-muted-foreground">
                      <HomeIcon size={32} />
                    </div>
                  )}
                  <div className="flex-1 py-3 pr-4">
                    <p className="text-sm font-medium">{p.address}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Purchase price</p>
                        <p className="font-medium">{formatCents(p.purchase_price_cents)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly rent</p>
                        <p className="font-medium">
                          {activeLease
                            ? formatCents(activeLease.monthly_rent_cents)
                            : 'No active lease'}
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
          icon={<Building2 size={32} />}
          title="No properties yet"
          description="Add your first property to start tracking rent, expenses, and maintenance."
          action={
            <Button asChild>
              <Link href="/landlord/properties/new">Add property</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
