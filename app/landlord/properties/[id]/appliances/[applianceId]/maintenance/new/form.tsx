'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Bell } from 'lucide-react';
import { createMaintenanceEvent, type ReminderInput } from './actions';
import { differenceInDays, parseISO } from 'date-fns';

interface MaintenanceEventFormProps {
  applianceId: string;
  propertyId: string;
  applianceName: string;
}

const QUICK_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];

function dayLabel(days: number) {
  if (days === 0) return 'Day of';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

type ReminderUIRow = {
  days_before: number;
  notify_landlord: boolean;
  notify_tenant: boolean;
  use_date_picker: boolean;
  picked_date: string;
};

function toReminderInput(r: ReminderUIRow, eventDate: string): ReminderInput {
  let days = r.days_before;
  if (r.use_date_picker && r.picked_date && eventDate) {
    days = Math.max(0, differenceInDays(parseISO(eventDate), parseISO(r.picked_date)));
  }
  return { days_before: days, notify_landlord: r.notify_landlord, notify_tenant: r.notify_tenant };
}

export function MaintenanceEventForm({
  applianceId,
  propertyId,
  applianceName,
}: MaintenanceEventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(applianceName ? `${applianceName} service` : '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [reminders, setReminders] = useState<ReminderUIRow[]>([
    { days_before: 7, notify_landlord: true, notify_tenant: true, use_date_picker: false, picked_date: '' },
    { days_before: 1, notify_landlord: true, notify_tenant: false, use_date_picker: false, picked_date: '' },
  ]);
  const [error, setError] = useState<string | null>(null);

  function addReminder() {
    setReminders((prev) => [
      ...prev,
      { days_before: 1, notify_landlord: true, notify_tenant: true, use_date_picker: false, picked_date: '' },
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
    if (badRecipient !== undefined) {
      setError('Each reminder must notify at least one recipient.');
      return;
    }

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
      const result = await createMaintenanceEvent({
        appliance_id: applianceId,
        property_id: propertyId,
        title: title.trim(),
        scheduled_date: date,
        scheduled_time: time || null,
        scheduled_time_end: timeEnd || null,
        notes: notes.trim() || null,
        reminders: reminders.map((r) => toReminderInput(r, date)),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(
        `/landlord/properties/${propertyId}/appliances/${applianceId}?tab=schedule`,
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. HVAC filter replacement"
          required
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time_end">End time</Label>
          <Input
            id="time_end"
            type="time"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
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
          placeholder="Vendor contact, parts needed, access instructions…"
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
                className="flex flex-wrap items-start gap-2 rounded-lg border bg-muted/20 p-3"
              >
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

                {/* Recipient toggles */}
                <label className="flex cursor-pointer items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={r.notify_landlord}
                    onChange={(e) =>
                      updateReminder(i, { notify_landlord: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border"
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
                  />
                  Tenant
                </label>

                <button
                  type="button"
                  onClick={() => removeReminder(i)}
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove reminder"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={addReminder}>
          <Plus size={14} /> Add reminder
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving…' : 'Schedule maintenance'}
      </Button>
    </form>
  );
}
