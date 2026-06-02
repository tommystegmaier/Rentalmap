'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

interface InspectionItemInput {
  room: string;
  item: string;
  condition: string;
  notes: string | null;
  photo_urls: string[];
  sort_order: number;
}

interface UpdateInspectionInput {
  propertyId: string;
  leaseId: string | null;
  type: string;
  date: string;
  notes: string | null;
  items: InspectionItemInput[];
}

export async function updateInspection(
  id: string,
  data: UpdateInspectionInput,
): Promise<{ error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Update the inspection header
  const { error: updErr } = await supabase
    .from('inspections')
    .update({
      property_id: data.propertyId,
      lease_id: data.leaseId,
      type: data.type,
      conducted_date: data.date,
      overall_notes: data.notes,
    })
    .eq('id', id);

  if (updErr) return { error: updErr.message };

  // Delete all existing items, then re-insert
  const { error: delErr } = await supabase
    .from('inspection_items')
    .delete()
    .eq('inspection_id', id);

  if (delErr) return { error: delErr.message };

  if (data.items.length > 0) {
    const { error: insErr } = await supabase.from('inspection_items').insert(
      data.items.map((item) => ({
        inspection_id: id,
        room: item.room,
        item: item.item,
        condition: item.condition,
        notes: item.notes,
        photo_urls: item.photo_urls,
        sort_order: item.sort_order,
      })),
    );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath('/landlord/inspections');
  revalidatePath(`/landlord/inspections/${id}`);

  return {};
}

export async function deleteInspection(id: string): Promise<void> {
  const supabase = createClient();
  const admin = createServiceRoleClient();

  // Fetch property_id so we can revalidate the property page too
  const { data: insp } = await admin
    .from('inspections')
    .select('property_id')
    .eq('id', id)
    .maybeSingle();

  await supabase.from('inspections').delete().eq('id', id);

  revalidatePath('/landlord/inspections');
  revalidatePath('/tenant/inspections');
  revalidatePath('/tenant');
  if (insp?.property_id) revalidatePath(`/landlord/properties/${insp.property_id}`);

  redirect('/landlord/inspections');
}
