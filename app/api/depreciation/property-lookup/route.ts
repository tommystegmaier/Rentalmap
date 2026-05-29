import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Pulls a property's last sale price + date and the county land-to-total
// assessment ratio from RentCast property records — so a landlord can fill the
// depreciation inputs straight from the address, no document upload needed.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { property_id } = (await request.json()) as { property_id?: string };
  if (!property_id) return NextResponse.json({ error: 'property_id required' }, { status: 400 });

  const { data: property } = await supabase
    .from('properties')
    .select('id, address, owner_id')
    .eq('id', property_id)
    .maybeSingle();
  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  if (property.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RENTCAST_API_KEY not configured', unconfigured: true },
      { status: 503 },
    );
  }

  try {
    const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(
      property.address as string,
    )}`;
    const resp = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`RentCast error ${resp.status}: ${body.slice(0, 160)}`);
    }

    const json = (await resp.json()) as unknown;
    const rec = (Array.isArray(json) ? json[0] : json) as
      | {
          lastSalePrice?: number;
          lastSaleDate?: string;
          history?: Record<string, { event?: string; date?: string; price?: number }>;
          taxAssessments?: Record<
            string,
            { year?: number; value?: number; land?: number; improvements?: number }
          >;
        }
      | undefined;

    // --- Last sale ---
    let lastSalePrice = Number(rec?.lastSalePrice ?? 0) || null;
    let lastSaleDate =
      typeof rec?.lastSaleDate === 'string' ? rec.lastSaleDate.slice(0, 10) : null;

    // Fall back to the most recent priced sale event in the history.
    if ((!lastSalePrice || !lastSaleDate) && rec?.history) {
      let best: { price: number; date: string } | null = null;
      for (const key of Object.keys(rec.history)) {
        const h = rec.history[key] || {};
        const price = Number(h.price ?? 0);
        const date = String(h.date ?? key);
        const event = String(h.event ?? '').toLowerCase();
        if (price > 0 && (event.includes('sale') || event.includes('sold') || event === '')) {
          if (!best || date > best.date) best = { price, date };
        }
      }
      if (best) {
        if (!lastSalePrice) lastSalePrice = best.price;
        if (!lastSaleDate) lastSaleDate = best.date.slice(0, 10);
      }
    }

    // --- Land ratio (most recent assessment with a land + improvements split) ---
    const assessments = rec?.taxAssessments ?? {};
    let bestAssess: { year: number; land: number; improvements: number; value: number } | null = null;
    for (const key of Object.keys(assessments)) {
      const a = assessments[key] || {};
      const land = Number(a.land ?? 0);
      const improvements = Number(a.improvements ?? 0);
      const value = Number(a.value ?? 0);
      if (land > 0 && (improvements > 0 || value > 0)) {
        const yr = Number(a.year ?? key);
        if (!bestAssess || yr > bestAssess.year) bestAssess = { year: yr, land, improvements, value };
      }
    }
    let landRatio: number | null = null;
    let assessedYear: number | null = null;
    if (bestAssess) {
      const total =
        bestAssess.improvements > 0 ? bestAssess.land + bestAssess.improvements : bestAssess.value;
      if (total > 0) {
        landRatio = bestAssess.land / total;
        assessedYear = bestAssess.year;
      }
    }

    return NextResponse.json({
      found: !!(lastSalePrice || landRatio),
      lastSalePriceCents: lastSalePrice ? Math.round(lastSalePrice * 100) : null,
      lastSaleDate,
      landRatio,
      assessedYear,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 },
    );
  }
}
