'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type ApplianceType = 'general' | 'hvac_filter' | 'sprinkler';

interface ApplianceFormValues {
  name: string;
  appliance_type: ApplianceType;
  install_date: string | null;
  warranty_end: string | null;
  serial: string | null;
  model: string | null;
  dimensions: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  service_interval_months: number | null;
  spring_startup_date: string | null;
  winterize_date: string | null;
  notes: string | null;
}

const TYPE_OPTIONS: { value: ApplianceType; label: string }[] = [
  { value: 'general', label: 'Generic appliance' },
  { value: 'hvac_filter', label: 'HVAC filter' },
  { value: 'sprinkler', label: 'Sprinkler system' },
];

const INTERVAL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No recurring schedule' },
  { value: '1', label: 'Monthly' },
  { value: '2', label: 'Every 2 months' },
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
  const [type, setType] = useState<ApplianceType>(
    (initial?.appliance_type as ApplianceType) ?? 'general',
  );
  const intervalValue = initial?.service_interval_months
    ? String(initial.service_interval_months)
    : '';

  const showWarranty = type === 'general';
  const showModelSerial = type === 'general';
  const showDimensions = type === 'hvac_filter';
  const showServiceInterval = type !== 'sprinkler';
  const showSeasonalDates = type === 'sprinkler';

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appliance_type">Type</Label>
          <Select
            id="appliance_type"
            name="appliance_type"
            value={type}
            onChange={(e) => setType(e.target.value as ApplianceType)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

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
          {showWarranty ? (
            <div className="space-y-2">
              <Label htmlFor="warranty_end">Warranty end</Label>
              <Input
                id="warranty_end"
                name="warranty_end"
                type="date"
                defaultValue={initial?.warranty_end ?? ''}
              />
            </div>
          ) : null}
        </div>

        {showDimensions ? (
          <div className="space-y-2">
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input
              id="dimensions"
              name="dimensions"
              defaultValue={initial?.dimensions ?? ''}
              placeholder="e.g. 16x25x1"
            />
            <p className="text-xs text-muted-foreground">
              Width x height x thickness in inches. Helps you remember which size to buy.
            </p>
          </div>
        ) : null}

        {showServiceInterval ? (
          <>
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
                {type === 'hvac_filter'
                  ? 'HVAC filters are typically replaced every 1–3 months. Reminders fire 7 days before the next change is due.'
                  : 'Reminders fire 7 days before the next service is due.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="last_service_date">
                  {type === 'hvac_filter' ? 'Last replaced' : 'Last service'}
                </Label>
                <Input
                  id="last_service_date"
                  name="last_service_date"
                  type="date"
                  defaultValue={initial?.last_service_date ?? ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next_service_due">
                  {type === 'hvac_filter' ? 'Next replacement' : 'Next service due'}
                </Label>
                <Input
                  id="next_service_due"
                  name="next_service_due"
                  type="date"
                  defaultValue={initial?.next_service_due ?? ''}
                />
              </div>
            </div>
          </>
        ) : null}

        {showSeasonalDates ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="spring_startup_date">Spring start-up</Label>
              <Input
                id="spring_startup_date"
                name="spring_startup_date"
                type="date"
                defaultValue={initial?.spring_startup_date ?? ''}
              />
              <p className="text-xs text-muted-foreground">
                The date you typically open the system in spring.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="winterize_date">Winterize</Label>
              <Input
                id="winterize_date"
                name="winterize_date"
                type="date"
                defaultValue={initial?.winterize_date ?? ''}
              />
              <p className="text-xs text-muted-foreground">
                The date you typically blow it out for winter.
              </p>
            </div>
          </div>
        ) : null}

        {showModelSerial ? (
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
        ) : null}

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

      {markServicedAction && type !== 'sprinkler' ? (
        <form action={markServicedAction}>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            title="Sets last service to today and advances next service by the interval"
          >
            {type === 'hvac_filter' ? 'Mark replaced today' : 'Mark serviced today'}
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
