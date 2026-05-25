import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createProperty } from './actions';

export default function NewPropertyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add property"
        description="Address only is required. Everything else can be filled in later."
      />

      <form action={createProperty} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Address *</Label>
          <Input
            id="address"
            name="address"
            placeholder="16303 Holmes St, Omaha, NE 68135"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue="single_family">
            <option value="single_family">Single-family</option>
            <option value="multi_family">Multi-family</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_price">Purchase price ($)</Label>
          <Input
            id="purchase_price"
            name="purchase_price"
            inputMode="decimal"
            placeholder="248000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="placed_in_service">Placed in service</Label>
          <Input id="placed_in_service" name="placed_in_service" type="date" />
          <p className="text-xs text-muted-foreground">
            The first day rent could be collected. Used for depreciation.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="depreciable_basis">Depreciable basis ($)</Label>
          <Input
            id="depreciable_basis"
            name="depreciable_basis"
            inputMode="decimal"
            placeholder="218984"
          />
          <p className="text-xs text-muted-foreground">
            Purchase price minus land value. Ask your accountant if unsure.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="annual_depreciation">Annual depreciation ($)</Label>
          <Input
            id="annual_depreciation"
            name="annual_depreciation"
            inputMode="decimal"
            placeholder="7963"
          />
          <p className="text-xs text-muted-foreground">
            27.5-year straight-line for residential rental: basis ÷ 27.5.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} />
        </div>

        <Button type="submit" className="w-full">
          Create property
        </Button>
      </form>
    </div>
  );
}
