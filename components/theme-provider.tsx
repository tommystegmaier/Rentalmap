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
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemeState(stored);
    }
  }, []);

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
    setThemeState(t);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
