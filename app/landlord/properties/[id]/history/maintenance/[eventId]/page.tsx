import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, CheckCircle2, CalendarClock } from 'lucide-react';

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default async function HistoryMaintenanceEventView({
  params,
}: {
  params: { id: string; eventId: string };
}) {
  const supabase = createClient();

  const [{ data: property }, { data: event }] = await Promise.all([
    supabase.from('properties').select('id, address').eq('id', params.id).maybeSingle(),
    supabase
      .from('maintenance_events')
      .select(
        'id, title, scheduled_date, scheduled_time, scheduled_time_end, notes, completed_at, appliance_id, appliances:appliance_id(name)',
      )
      .eq('id', params.eventId)
      .eq('property_id', params.id)
      .maybeSingle(),
  ]);

  if (!property || !event) notFound();

  const appl = Array.isArray(event.appliances) ? event.appliances[0] : event.appliances;
  const isCompleted = !!event.completed_at;
  const dateLine = format(parseISO(event.scheduled_date), 'EEEE, MMMM d, yyyy');
  const timeLine = event.scheduled_time
    ? `${formatTime(event.scheduled_time)}${event.scheduled_time_end ? ` – ${formatTime(event.scheduled_time_end)}` : ''}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title={event.title} description="Read-only · Previous service" />

      <Link
        href={`/landlord/properties/${params.id}/history`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Back to previous service & work orders
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        {isCompleted ? (
          <Badge className="border-transparent bg-success/10 text-success">
            Completed {format(parseISO(event.completed_at as string), 'PP')}
          </Badge>
        ) : (
          <Badge className="border-transparent bg-muted text-muted-foreground">Past · not marked complete</Badge>
        )}
        {appl?.name ? (
          <Badge className="border-transparent bg-muted text-muted-foreground">{appl.name}</Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>When</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <CalendarClock size={14} className="text-muted-foreground" />
            <span>{dateLine}</span>
          </p>
          {timeLine ? (
            <p className="text-muted-foreground pl-6">{timeLine}</p>
          ) : null}
          {isCompleted ? (
            <p className="flex items-center gap-2 pt-1">
              <CheckCircle2 size={14} className="text-success" />
              <span className="text-muted-foreground">
                Marked complete on {format(parseISO(event.completed_at as string), 'PP')}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {event.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{event.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
