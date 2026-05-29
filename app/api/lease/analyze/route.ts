import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_RAW_BYTES = Math.floor((5 * 1024 * 1024) / 1.34);

const SYSTEM_PROMPT = `You are a real estate attorney's assistant helping a small landlord understand a residential lease agreement.

Analyze the lease and return a JSON object with exactly these keys:
- "summary": array of 3-6 plain-English strings describing the key terms (rent, dates, responsibilities, restrictions)
- "flags": array of strings for red flags, unusual clauses, or tenant-unfavorable terms worth questioning
- "missing": array of strings for standard residential lease clauses that appear absent (e.g. entry notice, repairs, mold disclosure)
- "goodClauses": array of strings for landlord-protective or tenant-protective clauses done well

Keep each item concise (1-2 sentences). Focus on practical implications, not legal citations.
Respond ONLY with the JSON object, no other text.`;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI analysis is not configured. Ask the app admin to add ANTHROPIC_API_KEY.' },
      { status: 503 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (file.size > MAX_RAW_BYTES) {
    return NextResponse.json({ error: 'File too large. Try a smaller PDF.' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const mediaType = isPdf ? 'application/pdf' : 'image/jpeg';

  const contentBlock =
    mediaType === 'application/pdf'
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as Anthropic.DocumentBlockParam)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
        } as Anthropic.ImageBlockParam);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: 'Analyze this lease agreement and return the JSON object.' },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse analysis response');

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      summary: Array.isArray(parsed.summary) ? parsed.summary : [],
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      goodClauses: Array.isArray(parsed.goodClauses) ? parsed.goodClauses : [],
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}
