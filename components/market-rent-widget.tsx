'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/utils';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MarketRentWidgetProps {
  propertyId: string;
  askingRentCents: number | null;
  initialMarketRentCents: number | null;
  initialFetchedAt: string | null;
}

export function MarketRentWidget({
  propertyId,
  askingRentCents,
  initialMarketRentCents,
  initialFetchedAt,
}: MarketRentWidgetProps) {
  const [marketRentCents, setMarketRentCents] = useState(initialMarketRentCents);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/market-rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.unconfigured) {
          toast.error('Add RENTCAST_API_KEY to enable market rent data.');
        } else {
          toast.error(json.error ?? 'Failed to fetch market rent');
        }
        return;
      }
      setMarketRentCents(json.market_rent_cents);
      setFetchedAt(json.fetched_at);
      if (json.cached) {
        toast.info('Showing cached data — data is less than 7 days old.');
      } else {
        toast.success('Market rent updated');
      }
    } catch {
      toast.error('Failed to fetch market rent');
    } finally {
      setLoading(false);
    }
  }

  const diff =
    marketRentCents != null && askingRentCents != null
      ? marketRentCents - askingRentCents
      : null;

  return (
    <div className="space-y-3">
      {marketRentCents != null ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Market estimate</span>
            <span className="text-base font-semibold">{formatCents(marketRentCents)}/mo</span>
          </div>
          {askingRentCents != null && (
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Your asking rent</span>
              <span className="text-sm font-medium">{formatCents(askingRentCents)}/mo</span>
            </div>
          )}
          {diff != null && (
            <div
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                diff > 0
                  ? 'bg-green-50 text-green-700'
                  : diff < 0
                    ? 'bg-red-50 text-red-700'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {diff > 0 ? (
                <TrendingUp size={12} />
              ) : diff < 0 ? (
                <TrendingDown size={12} />
              ) : (
                <Minus size={12} />
              )}
              {diff > 0
                ? `+${formatCents(diff)}/mo opportunity`
                : diff < 0
                  ? `${formatCents(diff)}/mo above market`
                  : 'At market rate'}
            </div>
          )}
          {fetchedAt && (
            <p className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fetch a market rent estimate for this address via RentCast.
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={refresh}
        disabled={loading}
        className="w-full"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Fetching…' : marketRentCents != null ? 'Refresh estimate' : 'Get market rent'}
      </Button>
    </div>
  );
}
