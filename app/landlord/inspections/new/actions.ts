'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface InspectionItemInput {
  room: string;
  item: string;
  condition: string;
  notes: string | null;
  photo_urls: string[];
  sort_order: number;
}

interface CreateInspectionInput {
  propertyId: string;
  leaseId: string | null;
  type: string;
  date: string;
  notes: string | null;
  items: InspectionItemInput[];
}

export async function createInspection(
  data: CreateInspectionInput,
): Promise<{ inspectionId?: string; error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: inspection, error: inspErr } = await supabase
    .from('inspections')
    .insert({
      property_id: data.propertyId,
      lease_id: data.leaseId,
      type: data.type,
      conducted_date: data.date,
      conducted_by: user.id,
      overall_notes: data.notes,
    })
    .select('id')
    .single();

  if (inspErr || !inspection) {
    return { error: inspErr?.message ?? 'Failed to create inspection' };
  }

  if (data.items.length > 0) {
    const { error: itemsErr } = await supabase.from('inspection_items').insert(
      data.items.map((item) => ({
        inspection_id: inspection.id,
        room: item.room,
        item: item.item,
        condition: item.condition,
        notes: item.notes,
        photo_urls: item.photo_urls,
        sort_order: item.sort_order,
      })),
    );

    if (itemsErr) {
      // Clean up the orphaned inspection row
      await supabase.from('inspections').delete().eq('id', inspection.id);
      return { error: itemsErr.message };
    }
  }

  revalidatePath('/landlord/inspections');
  // Revalidate the property detail page so the inspections card shows the new entry immediately.
  if (data.propertyId) {
    revalidatePath(`/landlord/properties/${data.propertyId}`);
  }

  return { inspectionId: inspection.id };
}
