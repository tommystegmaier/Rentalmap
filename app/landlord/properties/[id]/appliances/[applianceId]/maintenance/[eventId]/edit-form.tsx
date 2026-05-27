'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Bell, CheckCircle2 } from 'lucide-react';
import {
  updateMaintenanceEvent,
  completeMaintenanceEvent,
  deleteMaintenanceEvent,
  type UpdateMaintenanceEventInput,
} from './actions';
import type { ReminderInput } from '../new/actions';
import { differenceInDays, parseISO, format, subDays } from 'date-fns';

// 0 = day of, 1..7 = days before
const QUICK_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];

function dayLabel(days: number) {
  if (days === 0) return 'Day of event';
  if (days === 1) return '1 day before';
  if (days === 7) return '1 week before';
  return `${days} days before`;
}

/** Normalise DB time value to HH:MM for input[type=time]. */
function toTimeInput(t: string | undefined | null) {
  if (!t) return '09:00';
  return t.slice(0, 5); // "09:00:00" → "09:00"
}

type ReminderUIRow = {
  days_before: number;
  notify_landlord: boolean;
  notify_tenant: boolean;
  use_date_picker: boolean;
  picked_date: string;
  send_time: string; // HH:MM
};

function toReminderInput(r: ReminderUIRow, eventDate: string): ReminderInput {
  let days = r.days_before;
  if (r.use_date_picker && r.picked_date && eventDate) {
    days = Math.max(0, differenceInDays(parseISO(eventDate), parseISO(r.picked_date)));
  }
  return {
    days_before: days,
    notify_landlord: r.notify_landlord,
    notify_tenant: r.notify_tenant,
    send_time: r.send_time || '09:00',
  };
}

function loadReminders(
  initial: { days_before: number; notify_landlord: boolean; notify_tenant: boolean; send_time?: string | null }[],
  scheduledDate: string,
): ReminderUIRow[] {
  return initial.map((r) => {
    const useDatePicker = !QUICK_DAYS.includes(r.days_before);
    const pickedDate = useDatePicker
      ? format(subDays(parseISO(scheduledDate), r.days_before), 'yyyy-MM-dd')
      : '';
    return {
      days_before: r.days_before,
      notify_landlord: r.notify_landlord,
      notify_tenant: r.notify_tenant,
      use_date_picker: useDatePicker,
      picked_date: pickedDate,
      send_time: toTimeInput(r.send_time),
    };
  });
}

interface ExistingReminder {
  id: string;
  days_before: number;
  notify_landlord: boolean;
  notify_tenant: boolean;
  sent_at: string | null;
  send_time?: string | null;
}

interface EditMaintenanceEventClientProps {
  eventId: string;
  propertyId: string;
  applianceId: string;
  applianceName: string;
  propertyAddress: string;
  initial: {
    title: string;
    scheduled_date: string;
    scheduled_time: string | null;
    scheduled_time_end: string | null;
    notes: string | null;
    completed_at: string | null;
    reminders: ExistingReminder[];
  };
}

// This is a full client page because the edit form requires dynamic reminder rows.
export default function EditMaintenanceEventPage({
  eventId,
  propertyId,
  applianceId,
  applianceName,
  propertyAddress,
  initial,
}: EditMaintenanceEventClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.scheduled_date);
  const [time, setTime] = useState((initial.scheduled_time ?? '').slice(0, 5));
  const [timeEnd, setTimeEnd] = useState((initial.scheduled_time_end ?? '').slice(0, 5));
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [reminders, setReminders] = useState<ReminderUIRow[]>(
    loadReminders(initial.reminders, initial.scheduled_date),
  );
  const [error, setError] = useState<string | null>(null);
  const isCompleted = !!initial.completed_at;

  function addReminder() {
    setReminders((prev) => [
      ...prev,
      { days_before: 1, notify_landlord: true, notify_tenant: true, use_date_picker: false, picked_date: '', send_time: '09:00' },
    ]);
  }

  function removeReminder(i: number) {
    setReminders((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateReminder(i: number, patch: Partial<ReminderUIRow>) {
    setReminders((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!date) { setError('Date is required.'); return; }

    const badRecipient = reminders.find((r) => !r.notify_landlord && !r.notify_tenant);
    if (badRecipient) { setError('Each reminder must notify at least one recipient.'); return; }

    const badDate = reminders.find(
      (r) =>
        r.use_date_picker &&
        (!r.picked_date || (date && differenceInDays(parseISO(date), parseISO(r.picked_date)) < 0)),
    );
    if (badDate) {
      setError('Notification dates must be on or before the event date.');
      return;
    }

    startTransition(async () => {
      const result = await updateMaintenanceEvent(eventId, propertyId, applianceId, {
        title: title.trim(),
        scheduled_date: date,
        scheduled_time: time || null,
        scheduled_time_end: timeEnd || null,
        notes: notes.trim() || null,
        reminders: reminders.map((r) => toReminderInput(r, date)),
      } satisfies UpdateMaintenanceEventInput);
      if (result.error) { setError(result.error); return; }
      router.push(`/landlord/properties/${propertyId}/appliances/${applianceId}?tab=schedule`);
      router.refresh();
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeMaintenanceEvent(eventId, propertyId, applianceId);
      if (result.error) { setError(result.error); return; }
      router.push(`/landlord/properties/${propertyId}/appliances/${applianceId}?tab=schedule`);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm('Delete this maintenance event? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteMaintenanceEvent(eventId, propertyId, applianceId);
      if (result.error) { setError(result.error); return; }
      router.push(`/landlord/properties/${propertyId}/appliances/${applianceId}?tab=schedule`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{initial.title}</h1>
        <p className="text-sm text-muted-foreground">{applianceName} · {propertyAddress}</p>
        {isCompleted ? (
          <Badge className="mt-2 border-transparent bg-success/10 text-success">
            <CheckCircle2 size={12} className="mr-1" /> Completed
          </Badge>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isCompleted}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={isCompleted}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="time">Start time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={isCompleted}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time_end">End time</Label>
            <Input
              id="time_end"
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              disabled={isCompleted}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isCompleted}
          />
        </div>

        {/* Reminders */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-muted-foreground" />
            <span className="text-sm font-medium">Reminders</span>
          </div>

          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders set.</p>
          ) : (
            <div className="space-y-2">
              {reminders.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-muted/20 p-3 space-y-2"
                >
                  {/* Row 1: when + who + delete */}
                  <div className="flex flex-wrap items-start gap-2">
                    {/* Timing selector */}
                    <div className="flex flex-col gap-1">
                      <select
                        value={r.use_date_picker ? 'pick' : String(r.days_before)}
                        onChange={(e) => {
                          if (e.target.value === 'pick') {
                            updateReminder(i, { use_date_picker: true, picked_date: '' });
                          } else {
                            updateReminder(i, { use_date_picker: false, days_before: Number(e.target.value) });
                          }
                        }}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        disabled={isCompleted}
                        aria-label="Days before"
                      >
                        {QUICK_DAYS.map((d) => (
                          <option key={d} value={String(d)}>{dayLabel(d)}</option>
                        ))}
                        <option value="pick">Pick a date…</option>
                      </select>
                      {r.use_date_picker ? (
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="date"
                            value={r.picked_date}
                            max={date || undefined}
                            onChange={(e) => updateReminder(i, { picked_date: e.target.value })}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            disabled={isCompleted}
                            aria-label="Notification date"
                          />
                          {r.picked_date && date ? (
                            <p className="text-xs text-muted-foreground">
                              {Math.max(0, differenceInDays(parseISO(date), parseISO(r.picked_date)))} days before event
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <label className="flex cursor-pointer items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={r.notify_landlord}
                        onChange={(e) =>
                          updateReminder(i, { notify_landlord: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-border"
                        disabled={isCompleted}
                      />
                      Landlord
                    </label>
                    <label className="flex cursor-pointer items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={r.notify_tenant}
                        onChange={(e) =>
                          updateReminder(i, { notify_tenant: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-border"
                        disabled={isCompleted}
                      />
                      Tenant
                    </label>

                    {!isCompleted ? (
                      <button
                        type="button"
                        onClick={() => removeReminder(i)}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>

                  {/* Row 2: send time */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`send_time_${i}`} className="text-xs text-muted-foreground whitespace-nowrap">
                      Send at
                    </Label>
                    <input
                      id={`send_time_${i}`}
                      type="time"
                      value={toTimeInput(r.send_time)}
                      onChange={(e) => updateReminder(i, { send_time: e.target.value })}
                      className="h-7 rounded-md border border-input bg-background px-2 text-sm"
                      disabled={isCompleted}
                      aria-label="Reminder send time"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isCompleted ? (
            <Button type="button" variant="outline" size="sm" onClick={addReminder}>
              <Plus size={14} /> Add reminder
            </Button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!isCompleted ? (
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        ) : null}
      </form>

      {!isCompleted ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleComplete}
          disabled={isPending}
        >
          <CheckCircle2 size={14} /> Mark complete
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        <Trash2 size={14} /> Delete event
      </Button>
    </div>
  );
}
