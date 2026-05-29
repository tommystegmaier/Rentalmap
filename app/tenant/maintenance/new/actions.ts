'use server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Link uploaded photos to a work order the tenant just created.
//
// Tenants can INSERT work orders but have no UPDATE policy on the table, so a
// direct client-side update of photo_urls is silently blocked by RLS. This
// action verifies the caller actually submitted the work order, then records
// the photo paths with the service role (column-scoped to photo_urls only).
export async function saveWorkOrderPhotos(workOrderId: string, paths: string[]) {
  if (!paths.length) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: wo } = await supabase
    .from('work_orders')
    .select('id, submitted_by_user_id')
    .eq('id', workOrderId)
    .maybeSingle();
  if (!wo || wo.submitted_by_user_id !== user.id) throw new Error('Forbidden');

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('work_orders')
    .update({ photo_urls: paths })
    .eq('id', workOrderId);
  if (error) throw error;
}
