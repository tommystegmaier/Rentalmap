'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';

export function ExpensePropertyFilter({
  properties,
  current,
}: {
  properties: { id: string; address: string }[];
  current: string | null;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label="Filter expenses by property"
      value={current ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/landlord/expenses?property_id=${v}` : '/landlord/expenses');
      }}
    >
      <option value="">All properties</option>
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.address}
        </option>
      ))}
    </Select>
  );
}
