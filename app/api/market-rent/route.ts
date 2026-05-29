import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

const CACHE_DAYS = 7;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { property_id } = (await request.json()) as { property_id?: string };
  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });

  // Fetch property to get address and verify ownership
  const { data: property } = await supabase
    .from('properties')
    .select('id, address, owner_id, market_rent_cents, market_rent_fetched_at')
    .eq('id', property_id)
    .maybeSingle();

  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  if (property.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Check cache
  if (property.market_rent_fetched_at && property.market_rent_cents) {
    const fetchedAt = new Date(property.market_rent_fetched_at as string);
    const ageMs = Date.now() - fetchedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < CACHE_DAYS) {
      return NextResponse.json({
        market_rent_cents: property.market_rent_cents,
        fetched_at: property.market_rent_fetched_at,
        cached: true,
      });
    }
  }

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RENTCAST_API_KEY not configured', unconfigured: true },
      { status: 503 },
    );
  }

  try {
    const encoded = encodeURIComponent(property.address as string);
    const url = `https://api.rentcast.io/v1/avm/rent/long-term?address=${encoded}`;
    const resp = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`RentCast API error ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = (await resp.json()) as {
      rent?: number;
      rentRangeLow?: number;
      rentRangeHigh?: number;
    };

    const rentDollars = data.rent ?? ((data.rentRangeLow ?? 0) + (data.rentRangeHigh ?? 0)) / 2;
    if (!rentDollars) throw new Error('No rent estimate returned');

    const market_rent_cents = Math.round(rentDollars * 100);
    const now = new Date().toISOString();

    const svc = createServiceRoleClient();
    await svc
      .from('properties')
      .update({ market_rent_cents, market_rent_fetched_at: now })
      .eq('id', property_id);

    return NextResponse.json({
      market_rent_cents,
      fetched_at: now,
      cached: false,
      range_low_cents: data.rentRangeLow ? Math.round(data.rentRangeLow * 100) : null,
      range_high_cents: data.rentRangeHigh ? Math.round(data.rentRangeHigh * 100) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch market rent' },
      { status: 500 },
    );
  }
}
