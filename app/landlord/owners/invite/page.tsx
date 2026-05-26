import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { inviteOwner } from './actions';

export default async function InviteOwnerPage() {
  const supabase = createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, address')
    .order('created_at');

  async function action(formData: FormData) {
    'use server';
    await inviteOwner(formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invite property owner" description="They'll receive a link to set up their account" />

      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        The owner gets <strong className="text-foreground">read-only</strong> access — they can see rent payments,
        expenses, and P&L for their property. They cannot make changes.
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="property_id">Property *</Label>
          <Select id="property_id" name="property_id" required>
            <option value="">— Select property —</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.address}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Owner&apos;s email *</Label>
          <Input id="email" name="email" type="email" required placeholder="investor@example.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownership_pct">Ownership % *</Label>
          <Input
            id="ownership_pct"
            name="ownership_pct"
            type="number"
            min={1}
            max={100}
            step={0.01}
            defaultValue={100}
            required
          />
        </div>

        <Button type="submit" className="w-full">Send invitation</Button>
      </form>
    </div>
  );
}
