'use client';

import { useEffect } from 'react';
import { markRelatedNotificationsRead } from '@/app/landlord/maintenance/[id]/actions';

export function MarkNotificationRead({ workOrderId }: { workOrderId: string }) {
  useEffect(() => {
    markRelatedNotificationsRead(workOrderId).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
