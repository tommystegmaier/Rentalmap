'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function saveTaxSchedule(
  enabled: boolean,
  month: number | null,
  day: number | null,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('users')
    .update({
      tax_report_enabled: enabled,
      tax_report_month: enabled ? month : null,
      tax_report_day: enabled ? day : null,
    })
    .eq('id', user.id);
  if (error) throw error;

  revalidatePath('/landlord/tax');
}

export async function deleteTaxReport(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // RLS limits this to the caller's own reports.
  const { data: report } = await supabase
    .from('tax_reports')
    .select('file_path')
    .eq('id', id)
    .maybeSingle();
  if (!report) return;

  if (report.file_path) {
    const admin = createServiceRoleClient();
    await admin.storage.from('tax-reports').remove([report.file_path]);
  }

  const { error } = await supabase.from('tax_reports').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/landlord/tax');
}
