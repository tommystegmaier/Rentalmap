import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  computeApplianceServiceReminders,
  computeLandlordReminders,
  computeTenantRentReminders,
  type ApplianceForReminders,
  type LeaseWithTenants,
} from '@/lib/reminders';
import { sendPushToUser } from '@/lib/push';

/**
 * Daily cron. Vercel triggers this via vercel.json. To prevent random hits,
 * we accept either Vercel's "x-vercel-cron" header or a shared bearer token.
 */
function authorize(request: Request) {
  if (request.headers.get('x-vercel-cron') === '1') return true;
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  return !!expected && auth === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Sync seeds for every landlord (their reminders + tenant rent reminders)
  const { data: landlords } = await supabase
    .from('users')
    .select(
      'id, tenant_rent_reminder_enabled, tenant_rent_reminder_days_before',
    )
    .eq('role', 'landlord');

  let seedCount = 0;
  for (const owner of (landlords ?? []) as {
    id: string;
    tenant_rent_reminder_enabled: boolean;
    tenant_rent_reminder_days_before: number;
  }[]) {
    const ownerId = owner.id;
    const { data: properties } = await supabase
      .from('properties')
      .select('id, address')
      .eq('owner_id', ownerId);
    const propIds = (properties ?? []).map((p: { id: string }) => p.id);
    if (propIds.length === 0) continue;

    const addressById = new Map(
      (properties ?? []).map((p: { id: string; address: string }) => [p.id, p.address]),
    );

    const [{ data: leases }, { data: appliances }] = await Promise.all([
      supabase
        .from('leases')
        .select(
          'id, property_id, start_date, end_date, due_day, monthly_rent_cents, status, lease_tenants(user_id)',
        )
        .in('property_id', propIds),
      supabase
        .from('appliances')
        .select(
          'id, property_id, name, service_interval_months, last_service_date, next_service_due, install_date',
        )
        .in('property_id', propIds),
    ]);

    type LeaseRow = {
      id: string;
      property_id: string;
      start_date: string;
      end_date: string;
      due_day: number;
      monthly_rent_cents: number;
      status: 'active' | 'ended' | 'pending';
      lease_tenants: { user_id: string }[] | { user_id: string };
    };

    const leaseRows = (leases ?? []) as LeaseRow[];

    const landlordSeeds = computeLandlordReminders({
      ownerId,
      leases: leaseRows.map((l) => ({
        id: l.id,
        property_id: l.property_id,
        start_date: l.start_date,
        end_date: l.end_date,
        due_day: l.due_day,
        status: l.status,
      })),
    });

    const applianceSeeds = computeApplianceServiceReminders(
      ownerId,
      (appliances ?? []) as ApplianceForReminders[],
      addressById as Map<string, string>,
    );

    const leasesWithTenants: LeaseWithTenants[] = leaseRows.map((l) => {
      const lts = Array.isArray(l.lease_tenants) ? l.lease_tenants : [l.lease_tenants];
      return {
        id: l.id,
        property_id: l.property_id,
        due_day: l.due_day,
        monthly_rent_cents: l.monthly_rent_cents,
        status: l.status,
        tenant_ids: lts.filter(Boolean).map((t) => t.user_id),
        address: (addressById.get(l.property_id) as string) ?? '',
      };
    });

    const tenantSeeds = computeTenantRentReminders(
      {
        tenant_rent_reminder_enabled: owner.tenant_rent_reminder_enabled,
        tenant_rent_reminder_days_before: owner.tenant_rent_reminder_days_before,
      },
      leasesWithTenants,
    );

    for (const seed of [...landlordSeeds, ...applianceSeeds, ...tenantSeeds]) {
      let del = supabase
        .from('reminders')
        .delete()
        .eq('user_id', seed.user_id)
        .eq('type', seed.type)
        .eq('dismissed', false);
      // Appliance reminders dedupe per-appliance; everything else dedupes
      // per-property (or globally when no property is attached).
      if (seed.appliance_id) {
        del = del.eq('appliance_id', seed.appliance_id);
      } else if (seed.property_id) {
        del = del.eq('property_id', seed.property_id).is('appliance_id', null);
      } else {
        del = del.is('property_id', null).is('appliance_id', null);
      }
      await del;

      const { error } = await supabase.from('reminders').insert(seed);
      if (!error) seedCount++;
    }
  }

  // 2. Fire pushes for everything triggering today
  const { data: dueToday } = await supabase
    .from('reminders')
    .select('id, user_id, message, type')
    .eq('dismissed', false)
    .eq('trigger_date', today);

  let pushed = 0;
  for (const r of (dueToday ?? []) as Array<{
    id: string;
    user_id: string;
    message: string;
    type: string;
  }>) {
    const isTenant = r.type === 'tenant_rent_due';
    const result = await sendPushToUser(r.user_id, {
      title: isTenant ? 'Rent reminder' : 'Reminder',
      body: r.message,
      url: isTenant ? '/tenant/pay' : '/landlord/reminders',
      tag: `rem-${r.id}`,
    });
    if (result.sent) pushed++;
  }

  return NextResponse.json({ seedCount, pushed, due: dueToday?.length ?? 0 });
}
