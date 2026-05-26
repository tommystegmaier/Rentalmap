'use server';

import { createClient } from '@/lib/supabase/server';

export async function signInspection(inspectionId: string): Promise<{ error?: string }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('inspections')
    .update({
      tenant_signed_at: new Date().toISOString(),
      tenant_signed_by: user.id,
    })
    .eq('id', inspectionId);

  if (error) return { error: error.message };

  return {};
}
