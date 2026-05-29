import type { SupabaseClient } from '@supabase/supabase-js';
import { getDaysInMonth } from 'date-fns';
import { computeTaxReportData } from '@/lib/tax-report-data';
import { generateTaxReport } from '@/lib/pdf/tax-report';
import { createNotification } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push';

// Generates and stores the scheduled tax report for any landlord whose
// configured date is today. Targets the PREVIOUS calendar year (you file the
// prior year's taxes). Guarded by tax_report_last_run so it fires once per day.
// Best-effort: each landlord is wrapped in try/catch so one failure can't stop
// the others (or the surrounding cron).
export async function runScheduledTaxReports(admin: SupabaseClient): Promise<number> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const lastDayOfMonth = getDaysInMonth(now);
  const todayISO = now.toISOString().slice(0, 10);
  const targetYear = now.getFullYear() - 1;

  const { data: landlords } = await admin
    .from('users')
    .select('id, name, email, tax_report_month, tax_report_day, tax_report_last_run')
    .eq('role', 'landlord')
    .eq('tax_report_enabled', true)
    .eq('tax_report_month', month);

  let generated = 0;
  for (const owner of (landlords ?? []) as {
    id: string;
    name: string | null;
    email: string | null;
    tax_report_month: number | null;
    tax_report_day: number | null;
    tax_report_last_run: string | null;
  }[]) {
    // Fire on the configured day, or on the last day of the month if the
    // configured day exceeds it (e.g. day 31 in a 30-day month).
    const scheduledDay = owner.tax_report_day ?? 1;
    const fireToday = day === scheduledDay || (day === lastDayOfMonth && scheduledDay > lastDayOfMonth);
    if (!fireToday) continue;

    // Already ran today?
    if (owner.tax_report_last_run && owner.tax_report_last_run.slice(0, 10) === todayISO) continue;

    try {
      const data = await computeTaxReportData(admin, owner.id, targetYear);
      const ownerLabel = owner.name ?? owner.email ?? 'Landlord';
      const pdf = generateTaxReport(data, ownerLabel);

      const filePath = `${owner.id}/${targetYear}-${Date.now()}.pdf`;
      const { error: upErr } = await admin.storage
        .from('tax-reports')
        .upload(filePath, pdf, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      await admin.from('tax_reports').insert({
        owner_id: owner.id,
        year: targetYear,
        file_path: filePath,
        total_income_cents: data.totalIncomeCents,
        total_deductible_cents: data.totalDeductibleCents,
        total_nondeductible_cents: data.totalNonDeductibleCents,
        net_cents: data.netCents,
        generated_by: 'scheduled',
      });

      await admin
        .from('users')
        .update({ tax_report_last_run: new Date().toISOString() })
        .eq('id', owner.id);

      const title = `Your ${targetYear} tax report is ready`;
      const body = 'Your scheduled tax report has been generated. Tap to view and download it.';
      try {
        await createNotification(admin, owner.id, {
          type: 'tax_report_ready',
          title,
          body,
          url: '/landlord/tax',
        });
      } catch {}
      await sendPushToUser(owner.id, { title, body, url: '/landlord/tax', tag: `tax-${targetYear}` });

      generated++;
    } catch (err) {
      console.error(`[tax-report] failed for landlord ${owner.id}:`, err);
    }
  }

  return generated;
}
