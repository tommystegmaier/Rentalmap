'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer runs only on the client, so we get the correct theme
  // immediately on first render without waiting for a useEffect — this
  // prevents the provider from ever briefly applying 'system' when the
  // user has explicitly chosen 'dark'.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('theme') as Theme | null;
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;

    function apply(t: Theme) {
      if (t === 'dark') {
        root.classList.add('dark');
      } else if (t === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) root.classList.add('dark');
        else root.classList.remove('dark');
      }
    }

    apply(theme);

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function setTheme(t: Theme) {
    localStorage.setItem('theme', t);
    // Cookie lets the server pre-render the correct theme on next load,
    // eliminating the flash of light mode when the user prefers dark.
    document.cookie = `theme=${t};path=/;max-age=31536000;SameSite=Lax`;
    setThemeState(t);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
