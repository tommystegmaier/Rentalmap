import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Estimates the land portion of a property using the county's assessed
// land-to-total ratio (an IRS-accepted allocation method), pulled from
// RentCast property records. The client applies the ratio to the actual
// purchase price to get the land value.
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
      | { taxAssessments?: Record<string, { year?: number; value?: number; land?: number; improvements?: number }> }
      | undefined;

    const assessments = rec?.taxAssessments ?? {};
    let best: { year: number; land: number; improvements: number; value: number } | null = null;
    for (const key of Object.keys(assessments)) {
      const a = assessments[key] || {};
      const land = Number(a.land ?? 0);
      const improvements = Number(a.improvements ?? 0);
      const value = Number(a.value ?? 0);
      if (land > 0 && (improvements > 0 || value > 0)) {
        const yr = Number(a.year ?? key);
        if (!best || yr > best.year) best = { year: yr, land, improvements, value };
      }
    }

    if (!best) {
      return NextResponse.json({ available: false });
    }

    const total = best.improvements > 0 ? best.land + best.improvements : best.value;
    const landRatio = total > 0 ? best.land / total : null;
    if (!landRatio) return NextResponse.json({ available: false });

    return NextResponse.json({
      available: true,
      landRatio,
      assessedYear: best.year,
      assessedLand: best.land,
      assessedImprovements: best.improvements || (best.value - best.land),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed' },
      { status: 500 },
    );
  }
}
