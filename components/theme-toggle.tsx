'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const options: { value: Theme; label: string; Icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'Auto', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-lg border p-1 gap-1">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            theme === value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
