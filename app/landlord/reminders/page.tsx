import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Bell } from 'lucide-react';

export default function RemindersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reminders" />
      <EmptyState
        icon={<Bell size={32} />}
        title="Reminders coming next"
        description="Rent due, lease renewal, inspections, HVAC service, smoke/CO detector checks."
      />
    </div>
  );
}
