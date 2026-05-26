import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Bell, X } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { dismissNotification, dismissAllNotifications } from './actions';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Mark all unread as read on visit (badge clears). Rows stay visible until
  // explicitly dismissed.
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user!.id)
    .is('read_at', null)
    .is('dismissed_at', null);
  revalidatePath('/landlord', 'layout');

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, url, read_at, dismissed_at, created_at')
    .eq('user_id', user!.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (notifications ?? []) as NotificationRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Recent activity across your portfolio"
        action={
          rows.length > 0 ? (
            <form action={dismissAllNotifications}>
              <Button type="submit" size="sm" variant="outline">
                Clear all
              </Button>
            </form>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Bell size={32} />}
          title="You're all caught up"
          description="New work orders, reminders, and rent activity will show up here."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => {
            const inner = (
              <CardContent className="space-y-1 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <form action={dismissNotification}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button
                      type="submit"
                      size="icon"
                      variant="ghost"
                      aria-label="Dismiss"
                      className="-m-1 h-8 w-8 shrink-0"
                    >
                      <X size={16} />
                    </Button>
                  </form>
                </div>
              </CardContent>
            );

            return (
              <Card key={n.id}>
                {n.url ? (
                  <Link href={n.url} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
