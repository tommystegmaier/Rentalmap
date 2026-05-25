export const APP_NAME = 'It Rents';

export const EXPENSE_CATEGORIES = [
  'Advertising',
  'Auto and Travel',
  'Cleaning and Maintenance',
  'Commissions',
  'Insurance',
  'Legal and Professional Fees',
  'Management Fees',
  'Mortgage Interest',
  'Other Interest',
  'Repairs',
  'Supplies',
  'Taxes',
  'Utilities',
  'Depreciation',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const WORK_ORDER_REQUEST_TYPES = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Appliance',
  'Structural',
  'Pest Control',
  'Exterior',
  'Lawn and Landscaping',
  'Locks, Keys, Security',
  'Smoke or CO Detector',
  'Other',
] as const;

export type WorkOrderRequestType = (typeof WORK_ORDER_REQUEST_TYPES)[number];

export type Urgency = 'emergency' | 'urgent' | 'normal' | 'low';

export const URGENCY_LABELS: Record<
  Urgency,
  { label: string; help: string; color: string }
> = {
  emergency: {
    label: 'Emergency',
    help: 'Immediate safety or health concern (gas smell, no heat in winter, flooding, no water).',
    color: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  },
  urgent: {
    label: 'Urgent',
    help: 'Needs attention within 24 hours (no hot water, AC out in summer, broken lock).',
    color: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  },
  normal: {
    label: 'Normal',
    help: 'Within a week (minor leak, broken appliance, slow drain).',
    color: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  },
  low: {
    label: 'Low',
    help: 'When convenient (cosmetic, paint touch-up).',
    color: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200',
  },
};
