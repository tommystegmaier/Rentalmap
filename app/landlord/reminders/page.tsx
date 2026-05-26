import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Bell } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { dismissReminder, syncMyReminders } from './actions';

const TYPE_LABELS: Record<string, string> = {
  rent_due: 'Rent due',
  lease_renewal: 'Lease renewal',
  quarterly_inspection: 'Quarterly inspection',
  appliance_service: 'Appliance service',
  // Legacy types — kept here so any pre-0010 rows still display nicely.
  hvac_annual: 'HVAC annual service',
  smoke_co_battery: 'Smoke / CO check',
  custom: 'Custom',
};

export default async function RemindersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*, properties:property_id(address)')
    .eq('user_id', user!.id)
    .eq('dismissed', false)
    .order('trigger_date', { ascending: true });

  const today = new Date();

  return (
    <div className="space-y-6">
      <PageHeader title="Reminders" description="Auto-generated nightly from your portfolio" />

      {reminders && reminders.length > 0 ? (
        <div className="space-y-2">
          {reminders.map((r: {
            id: string;
            type: string;
            message: string;
            trigger_date: string;
            recurrence: string | null;
            properties: { address: string } | { address: string }[] | null;
          }) => {
            const propObj = Array.isArray(r.properties) ? r.properties[0] : r.properties;
            const days = differenceInDays(parseISO(r.trigger_date), today);
            const label =
              days < 0 ? `${Math.abs(days)} days ago` : days === 0 ? 'today' : `in ${days} days`;
            const urgent = days <= 0;
            return (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[r.type] ?? r.type}
                        {propObj?.address ? ` · ${propObj.address}` : ''}
                      </p>
                    </div>
                    <Badge
                      className={
                        urgent
                          ? 'border-transparent bg-warning/10 text-warning'
                          : 'border-transparent bg-secondary'
                      }
                    >
                      {format(parseISO(r.trigger_date), 'MMM d')} · {label}
                    </Badge>
                  </div>
                  <form action={dismissReminder}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" size="sm" variant="outline">
                      Dismiss
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Bell size={32} />}
          title="No active reminders"
          description="The nightly job populates this list — check back tomorrow, or tap Sync below."
        />
      )}

      <form action={syncMyReminders}>
        <Button type="submit" variant="outline" className="w-full">
          Sync now
        </Button>
      </form>
    </div>
  );
}
