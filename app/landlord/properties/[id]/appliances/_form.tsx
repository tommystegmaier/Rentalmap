import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ApplianceFormValues {
  name: string;
  install_date: string | null;
  warranty_end: string | null;
  serial: string | null;
  model: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  service_interval_months: number | null;
  notes: string | null;
}

const INTERVAL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No recurring schedule' },
  { value: '1', label: 'Monthly' },
  { value: '3', label: 'Every 3 months (quarterly)' },
  { value: '6', label: 'Every 6 months' },
  { value: '12', label: 'Yearly' },
  { value: '24', label: 'Every 2 years' },
  { value: '60', label: 'Every 5 years' },
];

export function ApplianceForm({
  action,
  initial,
  deleteAction,
  markServicedAction,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<ApplianceFormValues>;
  deleteAction?: (formData: FormData) => Promise<void>;
  markServicedAction?: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const intervalValue = initial?.service_interval_months
    ? String(initial.service_interval_months)
    : '';

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="install_date">Install date</Label>
            <Input
              id="install_date"
              name="install_date"
              type="date"
              defaultValue={initial?.install_date ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="warranty_end">Warranty end</Label>
            <Input
              id="warranty_end"
              name="warranty_end"
              type="date"
              defaultValue={initial?.warranty_end ?? ''}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="service_interval_months">Service interval</Label>
          <Select
            id="service_interval_months"
            name="service_interval_months"
            defaultValue={intervalValue}
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Reminders fire 7 days before the next service is due. Set the interval and a last
            service date, and the next service date fills itself in.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="last_service_date">Last service</Label>
            <Input
              id="last_service_date"
              name="last_service_date"
              type="date"
              defaultValue={initial?.last_service_date ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_service_due">Next service due</Label>
            <Input
              id="next_service_due"
              name="next_service_due"
              type="date"
              defaultValue={initial?.next_service_due ?? ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" defaultValue={initial?.model ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">Serial</Label>
            <Input id="serial" name="serial" defaultValue={initial?.serial ?? ''} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ''}
          />
        </div>

        <Button type="submit" className="w-full">
          {submitLabel}
        </Button>
      </form>

      {markServicedAction ? (
        <form action={markServicedAction}>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            title="Sets last service to today and advances next service by the interval"
          >
            Mark serviced today
          </Button>
        </form>
      ) : null}

      {deleteAction ? (
        <form action={deleteAction}>
          <Button type="submit" variant="outline" className="w-full text-destructive">
            Delete appliance
          </Button>
        </form>
      ) : null}
    </div>
  );
}
