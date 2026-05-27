import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApplianceForm } from '../_form';
import { deleteAppliance, markApplianceServiced, upsertAppliance } from '../actions';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { Plus, CalendarClock, CheckCircle2, ChevronRight, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

type EventRow = {
  id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  scheduled_time_end: string | null;
  completed_at: string | null;
  reminder_count: number;
};

export default async function EditAppliancePage({
  params,
  searchParams,
}: {
  params: { id: string; applianceId: string };
  searchParams: { tab?: string };
}) {
  const supabase = createClient();
  const [{ data: property }, { data: appliance }, { data: rawEvents }] = await Promise.all([
    supabase.from('properties').select('id, address').eq('id', params.id).maybeSingle(),
    supabase.from('appliances').select('*').eq('id', params.applianceId).maybeSingle(),
    supabase
      .from('maintenance_events')
      .select('id, title, scheduled_date, scheduled_time, scheduled_time_end, completed_at, maintenance_reminders(id)')
      .eq('appliance_id', params.applianceId)
      .order('scheduled_date', { ascending: true }),
  ]);
  if (!property || !appliance) notFound();

  const events: EventRow[] = (rawEvents ?? []).map((e: {
    id: string;
    title: string;
    scheduled_date: string;
    scheduled_time: string | null;
    scheduled_time_end: string | null;
    completed_at: string | null;
    maintenance_reminders: { id: string }[] | { id: string } | null;
  }) => ({
    id: e.id,
    title: e.title,
    scheduled_date: e.scheduled_date,
    scheduled_time: e.scheduled_time,
    scheduled_time_end: e.scheduled_time_end,
    completed_at: e.completed_at,
    reminder_count: Array.isArray(e.maintenance_reminders)
      ? e.maintenance_reminders.length
      : e.maintenance_reminders ? 1 : 0,
  }));

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  // "Upcoming" = not completed AND scheduled for today or later.
  // "Previous service" = completed OR scheduled date is in the past.
  const upcoming = events.filter(
    (e) => !e.completed_at && e.scheduled_date >= todayStr,
  );
  const previous = events
    .filter((e) => !!e.completed_at || e.scheduled_date < todayStr)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const tab = searchParams.tab === 'schedule' ? 'schedule' : 'details';
  const base = `/landlord/properties/${params.id}/appliances/${params.applianceId}`;

  async function action(formData: FormData) {
    'use server';
    await upsertAppliance(params.id, params.applianceId, formData);
  }

  async function del() {
    'use server';
    await deleteAppliance(params.id, params.applianceId);
  }

  async function markServiced() {
    'use server';
    await markApplianceServiced(params.id, params.applianceId);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={appliance.name} description={property.address} />

      {/* Tab bar */}
      <div className="flex overflow-hidden rounded-lg border text-sm font-medium">
        <Link
          href={base}
          className={cn(
            'flex-1 py-2 text-center transition',
            tab === 'details'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted/40',
          )}
        >
          Details
        </Link>
        <Link
          href={`${base}?tab=schedule`}
          className={cn(
            'flex-1 py-2 text-center transition',
            tab === 'schedule'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted/40',
          )}
        >
          Schedule
          {upcoming.length > 0 ? (
            <span className={cn(
              'ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-1 ring-background',
              tab === 'schedule'
                ? 'bg-primary-foreground text-primary'
                : 'bg-primary text-primary-foreground',
            )}>
              {upcoming.length}
            </span>
          ) : null}
        </Link>
      </div>

      {tab === 'details' ? (
        <ApplianceForm
          action={action}
          deleteAction={del}
          markServicedAction={appliance.service_interval_months ? markServiced : undefined}
          initial={{
            name: appliance.name,
            appliance_type: appliance.appliance_type ?? 'general',
            install_date: appliance.install_date,
            warranty_end: appliance.warranty_end,
            serial: appliance.serial,
            model: appliance.model,
            dimensions: appliance.dimensions,
            last_service_date: appliance.last_service_date,
            next_service_due: appliance.next_service_due,
            service_interval_months: appliance.service_interval_months,
            spring_startup_date: appliance.spring_startup_date,
            winterize_date: appliance.winterize_date,
            notes: appliance.notes,
          }}
          submitLabel="Save changes"
        />
      ) : (
        /* ── Schedule tab ──────────────────────────────────────────── */
        <div className="space-y-4">
          <Button asChild size="sm" className="w-full">
            <Link href={`${base}/maintenance/new`}>
              <Plus size={14} /> Schedule maintenance
            </Link>
          </Button>

          {upcoming.length === 0 && previous.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <CalendarClock size={28} className="mx-auto mb-2 opacity-40" />
                No maintenance scheduled yet.
              </CardContent>
            </Card>
          ) : null}

          {upcoming.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming
              </p>
              {upcoming.map((ev) => {
                const d = parseISO(ev.scheduled_date);
                const overdue = isPast(d) && !isToday(d);
                return (
                  <Link key={ev.id} href={`${base}/maintenance/${ev.id}`}>
                    <Card className={cn('transition hover:bg-muted/30', overdue && 'border-destructive/40')}>
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className={cn('truncate text-sm font-medium', overdue && 'text-destructive')}>
                            {ev.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(d, 'MMM d, yyyy')}
                            {ev.scheduled_time
                              ? ` · ${formatTime(ev.scheduled_time)}${ev.scheduled_time_end ? ` – ${formatTime(ev.scheduled_time_end)}` : ''}`
                              : ''}
                            {overdue ? ' · Overdue' : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {ev.reminder_count > 0 ? (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Bell size={12} />
                              {ev.reminder_count}
                            </span>
                          ) : null}
                          <ChevronRight size={16} className="text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {previous.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Previous service
              </p>
              {previous.map((ev) => {
                const isCompleted = !!ev.completed_at;
                return (
                  <Link key={ev.id} href={`${base}/maintenance/${ev.id}`}>
                    <Card className="opacity-70 transition hover:bg-muted/30">
                      <CardContent className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className={cn('truncate text-sm font-medium', isCompleted && 'line-through')}>
                            {ev.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(ev.scheduled_date), 'MMM d, yyyy')}
                            {ev.scheduled_time
                              ? ` · ${formatTime(ev.scheduled_time)}${ev.scheduled_time_end ? ` – ${formatTime(ev.scheduled_time_end)}` : ''}`
                              : ''}
                            {!isCompleted ? ' · Past' : ''}
                          </p>
                        </div>
                        {isCompleted ? (
                          <CheckCircle2 size={16} className="shrink-0 text-success" />
                        ) : (
                          <CalendarClock size={16} className="shrink-0 text-muted-foreground" />
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
