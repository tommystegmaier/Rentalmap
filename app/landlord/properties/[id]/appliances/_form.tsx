import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ApplianceFormValues {
  name: string;
  install_date: string | null;
  warranty_end: string | null;
  serial: string | null;
  model: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  notes: string | null;
}

export function ApplianceForm({
  action,
  initial,
  deleteAction,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<ApplianceFormValues>;
  deleteAction?: (formData: FormData) => Promise<void>;
  submitLabel: string;
}) {
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
