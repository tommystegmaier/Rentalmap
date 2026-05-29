'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function ExpenseSortToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get('sort') ?? 'created';

  function go(sort: string) {
    const next = new URLSearchParams(params.toString());
    next.set('sort', sort);
    router.push(`/landlord/expenses?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1 text-xs font-medium">
      <button
        type="button"
        onClick={() => go('created')}
        className={`flex-1 rounded-md px-3 py-1.5 transition ${
          current === 'created'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Entry date
      </button>
      <button
        type="button"
        onClick={() => go('expense')}
        className={`flex-1 rounded-md px-3 py-1.5 transition ${
          current === 'expense'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Expense date
      </button>
    </div>
  );
}
