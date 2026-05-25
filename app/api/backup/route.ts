import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const tables = [
    'properties',
    'leases',
    'lease_tenants',
    'rent_payments',
    'expenses',
    'work_orders',
    'appliances',
    'documents',
    'reminders',
    'tenant_invitations',
  ] as const;

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    exported_by: user.email,
  };
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      return NextResponse.json(
        { error: `Failed to export ${t}: ${error.message}` },
        { status: 500 },
      );
    }
    out[t] = data;
  }

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="it-rents-backup.json"',
    },
  });
}
