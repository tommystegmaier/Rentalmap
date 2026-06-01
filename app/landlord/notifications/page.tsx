import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { NotificationList } from './notification-list';

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Mark all unread as read on visit so the badge clears.
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user!.id)
    .is('read_at', null)
    .is('dismissed_at', null);

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, url, created_at')
    .eq('user_id', user!.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Recent activity across your portfolio"
      />
      <NotificationList initialRows={notifications ?? []} />
    </div>
  );
}
