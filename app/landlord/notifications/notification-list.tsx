'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Bell, X } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { dismissNotification, dismissAllNotifications } from './actions';

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  url: string | null;
  created_at: string;
}

export function NotificationList({ initialRows }: { initialRows: NotificationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [, startTransition] = useTransition();

  function dismiss(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    const fd = new FormData();
    fd.append('id', id);
    startTransition(() => dismissNotification(fd));
  }

  function dismissAll() {
    setRows([]);
    startTransition(() => dismissAllNotifications());
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={32} />}
        title="You're all caught up"
        description="New work orders, reminders, and rent activity will show up here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={dismissAll}>
          Clear all
        </Button>
      </div>
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
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Dismiss"
                className="-m-1 h-8 w-8 shrink-0"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(n.id); }}
              >
                <X size={16} />
              </Button>
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
  );
}
