import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import {
  computeApplianceServiceReminders,
  computeLandlordReminders,
  computeTenantRentReminders,
  type ApplianceForReminders,
  type LeaseWithTenants,
  type ReminderSeed,
} from '@/lib/reminders';

export interface LandlordForSync {
  id: string;
  tenant_rent_reminder_enabled: boolean;
  tenant_rent_reminder_days_before: number;
}

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

export async function syncRemindersForLandlord(
  admin: SupabaseClient,
  owner: LandlordForSync,
): Promise<number> {
  const { data: properties } = await admin
    .from('properties')
    .select('id, address')
    .eq('owner_id', owner.id);
  const propIds = (properties ?? []).map((p: { id: string }) => p.id);
  if (propIds.length === 0) return 0;

  const addressById = new Map(
    (properties ?? []).map((p: { id: string; address: string }) => [p.id, p.address]),
  );

  const today = format(new Date(), 'yyyy-MM-dd');

  const [{ data: leases }, { data: appliances }, { data: upcomingEvents }] = await Promise.all([
    admin
      .from('leases')
      .select(
        'id, property_id, start_date, end_date, due_day, monthly_rent_cents, status, lease_tenants(user_id)',
      )
      .in('property_id', propIds),
    admin
      .from('appliances')
      .select(
        'id, property_id, name, appliance_type, service_interval_months, last_service_date, next_service_due, install_date, spring_startup_date, winterize_date',
      )
      .in('property_id', propIds),
    // Fetch appliances that already have upcoming maintenance_events so we
    // don't create duplicate old-style reminders for the same service date.
    admin
      .from('maintenance_events')
      .select('appliance_id')
      .in('property_id', propIds)
      .is('completed_at', null)
      .gte('scheduled_date', today),
  ]);

  // Set of appliance IDs covered by the new maintenance_events system
  const appliancesWithEvents = new Set(
    (upcomingEvents ?? []).map((e: { appliance_id: string }) => e.appliance_id),
  );

  const leaseRows = (leases ?? []) as LeaseRow[];

  const landlordSeeds = computeLandlordReminders({
    ownerId: owner.id,
    leases: leaseRows.map((l) => ({
      id: l.id,
      property_id: l.property_id,
      start_date: l.start_date,
      end_date: l.end_date,
      due_day: l.due_day,
      status: l.status,
    })),
  });

  // Only compute old-style service reminders for appliances that don't already
  // have a maintenance_event scheduled — those use the maintenance_reminders system.
  const appliancesForOldReminders = (appliances ?? []).filter(
    (a: { id: string }) => !appliancesWithEvents.has(a.id),
  );

  const applianceSeeds = computeApplianceServiceReminders(
    owner.id,
    appliancesForOldReminders as ApplianceForReminders[],
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

  let seedCount = 0;
  for (const seed of [...landlordSeeds, ...applianceSeeds, ...tenantSeeds] as ReminderSeed[]) {
    // Never touch a reminder whose trigger date is today or already past.
    // Today's row is either being processed right now (don't recreate it and
    // reset the sent_at guard) or was already sent earlier in the day.
    if (seed.trigger_date <= today) continue;

    let del = admin
      .from('reminders')
      .delete()
      .eq('user_id', seed.user_id)
      .eq('type', seed.type)
      .eq('dismissed', false);
    if (seed.appliance_id) {
      del = del.eq('appliance_id', seed.appliance_id);
    } else if (seed.property_id) {
      del = del.eq('property_id', seed.property_id).is('appliance_id', null);
    } else {
      del = del.is('property_id', null).is('appliance_id', null);
    }
    await del;

    const { error } = await admin.from('reminders').insert(seed);
    if (!error) seedCount++;
  }

  return seedCount;
}
