import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EditMaintenanceEventPage from './edit-form';

export default async function MaintenanceEventPage({
  params,
}: {
  params: { id: string; applianceId: string; eventId: string };
}) {
  const supabase = createClient();

  const [{ data: property }, { data: appliance }, { data: event }, { data: reminders }] =
    await Promise.all([
      supabase.from('properties').select('id, address').eq('id', params.id).maybeSingle(),
      supabase
        .from('appliances')
        .select('id, name')
        .eq('id', params.applianceId)
        .maybeSingle(),
      supabase
        .from('maintenance_events')
        .select('id, title, scheduled_date, scheduled_time, scheduled_time_end, notes, completed_at')
        .eq('id', params.eventId)
        .maybeSingle(),
      supabase
        .from('maintenance_reminders')
        .select('id, days_before, notify_landlord, notify_tenant, sent_at, send_time')
        .eq('event_id', params.eventId)
        .order('days_before', { ascending: false }),
    ]);

  if (!property || !appliance || !event) notFound();

  return (
    <div className="space-y-6 p-4">
      <EditMaintenanceEventPage
        eventId={params.eventId}
        propertyId={params.id}
        applianceId={params.applianceId}
        applianceName={appliance.name}
        propertyAddress={property.address}
        initial={{
          title: event.title,
          scheduled_date: event.scheduled_date,
          scheduled_time: event.scheduled_time ?? null,
          scheduled_time_end: (event as { scheduled_time_end?: string | null }).scheduled_time_end ?? null,
          notes: event.notes ?? null,
          completed_at: event.completed_at ?? null,
          reminders: (reminders ?? []).map((r) => ({
            id: r.id,
            days_before: r.days_before,
            notify_landlord: r.notify_landlord,
            notify_tenant: r.notify_tenant,
            sent_at: r.sent_at ?? null,
            send_time: (r as { send_time?: string | null }).send_time ?? null,
          })),
        }}
      />
    </div>
  );
}
