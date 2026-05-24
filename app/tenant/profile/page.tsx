import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { revalidatePath } from 'next/cache';

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle();

  async function save(formData: FormData) {
    'use server';
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates = {
      name: (formData.get('name') as string) || null,
      phone: (formData.get('phone') as string) || null,
      emergency_contact: (formData.get('emergency_contact') as string) || null,
      employer: (formData.get('employer') as string) || null,
      vehicle_info: (formData.get('vehicle_info') as string) || null,
    };
    await supabase.from('users').update(updates).eq('id', user.id);
    revalidatePath('/tenant/profile');
    redirect('/tenant/profile');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />

      <form action={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={profile?.name ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergency">Emergency contact</Label>
          <Input
            id="emergency"
            name="emergency_contact"
            defaultValue={profile?.emergency_contact ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employer">Employer</Label>
          <Input id="employer" name="employer" defaultValue={profile?.employer ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle">Vehicle info</Label>
          <Textarea
            id="vehicle"
            name="vehicle_info"
            rows={2}
            defaultValue={profile?.vehicle_info ?? ''}
          />
        </div>
        <Button type="submit" className="w-full">
          Save profile
        </Button>
      </form>
    </div>
  );
}
