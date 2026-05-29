'use client';

import { useEffect } from 'react';
import { markAllWorkOrderUpdatesRead, markWorkOrderUpdatesRead } from './actions';

// Marks all work-order status updates read on mount (Work Orders list).
export function MarkAllWorkOrderUpdatesRead() {
  useEffect(() => {
    markAllWorkOrderUpdatesRead().catch(() => {});
  }, []);
  return null;
}

// Marks a single work order's updates read on mount (detail view).
export function MarkWorkOrderUpdatesRead({ workOrderId }: { workOrderId: string }) {
  useEffect(() => {
    markWorkOrderUpdatesRead(workOrderId).catch(() => {});
  }, [workOrderId]);
  return null;
}
