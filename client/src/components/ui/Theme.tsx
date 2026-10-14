import { createContext, useContext, useLayoutEffect, useState, ReactNode } from 'react';
import { Monitor } from 'lucide-react';

type ThemePreference = 'system' | 'light' | 'dark';
const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (value: ThemePreference) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('rozain-theme');
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    } catch { return 'system'; }
  });

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    };
    apply();
    media.addEventListener('change', apply);
    try { localStorage.setItem('rozain-theme', preference); } catch {}
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function ThemePicker() {
  const theme = useContext(ThemeContext);
  if (!theme) return null;
  return (
    <label className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-soft">
      <Monitor className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Appearance</span>
      <select aria-label="Appearance" value={theme.preference} onChange={(event) => theme.setPreference(event.target.value as ThemePreference)} className="min-w-0 cursor-pointer bg-transparent text-ink focus:outline-none">
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </label>
  );
}
