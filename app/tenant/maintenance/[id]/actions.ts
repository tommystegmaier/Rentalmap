'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function appendWorkOrderPhotos(workOrderId: string, newPaths: string[]) {
  if (!newPaths.length) return;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: wo } = await supabase
    .from('work_orders')
    .select('id, submitted_by_user_id, photo_urls')
    .eq('id', workOrderId)
    .maybeSingle();

  if (!wo || wo.submitted_by_user_id !== user.id) throw new Error('Forbidden');

  const existing = (wo.photo_urls as string[] | null) ?? [];
  const merged = [...existing, ...newPaths];

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('work_orders')
    .update({ photo_urls: merged })
    .eq('id', workOrderId);
  if (error) throw error;

  revalidatePath(`/tenant/maintenance/${workOrderId}`);
}
