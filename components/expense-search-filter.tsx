'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { Search } from 'lucide-react';

export function ExpenseSearchFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function push(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/landlord/expenses?${next.toString()}`));
  }

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => push('q', e.target.value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vendor or notes…"
          defaultValue={params.get('q') ?? ''}
          onChange={handleSearch}
          className="pl-9"
        />
      </div>
      <Select
        aria-label="Filter by category"
        value={params.get('category') ?? ''}
        onChange={(e) => push('category', e.target.value)}
      >
        <option value="">All categories</option>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </div>
  );
}
