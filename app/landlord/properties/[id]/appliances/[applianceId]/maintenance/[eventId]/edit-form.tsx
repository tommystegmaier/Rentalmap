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

const QUICK_DAYS = [0, 1, 3, 7, 14, 30];

function dayLabel(days: number) {
  if (days === 0) return 'Day of';
  if (days === 1) return '1 day before';
  return `${days} days before`;
}

interface ExistingReminder extends ReminderInput {
  id: string;
  sent_at: string | null;
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
  const [time, setTime] = useState(initial.scheduled_time ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [reminders, setReminders] = useState<ReminderInput[]>(
    initial.reminders.map((r) => ({
      days_before: r.days_before,
      notify_landlord: r.notify_landlord,
      notify_tenant: r.notify_tenant,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const isCompleted = !!initial.completed_at;

  function addReminder() {
    setReminders((prev) => [
      ...prev,
      { days_before: 1, notify_landlord: true, notify_tenant: true },
    ]);
  }

  function removeReminder(i: number) {
    setReminders((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateReminder(i: number, patch: Partial<ReminderInput>) {
    setReminders((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!date) { setError('Date is required.'); return; }
    const bad = reminders.find((r) => !r.notify_landlord && !r.notify_tenant);
    if (bad) { setError('Each reminder must notify at least one recipient.'); return; }

    startTransition(async () => {
      const result = await updateMaintenanceEvent(eventId, propertyId, applianceId, {
        title: title.trim(),
        scheduled_date: date,
        scheduled_time: time || null,
        notes: notes.trim() || null,
        reminders,
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

        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-2">
            <Label htmlFor="time">Time (optional)</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
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
                  className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3"
                >
                  <select
                    value={r.days_before}
                    onChange={(e) =>
                      updateReminder(i, { days_before: Number(e.target.value) })
                    }
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    disabled={isCompleted}
                    aria-label="Days before"
                  >
                    {QUICK_DAYS.map((d) => (
                      <option key={d} value={d}>{dayLabel(d)}</option>
                    ))}
                    {!QUICK_DAYS.includes(r.days_before) && (
                      <option value={r.days_before}>{dayLabel(r.days_before)}</option>
                    )}
                  </select>

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
