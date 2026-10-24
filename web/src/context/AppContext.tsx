import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';

export interface User {
  id: number; name: string; email: string; role: string; permissions: string[];
  locale: string; dailyGoal: number;
}

export interface SiteSettings {
  site_name?: string; site_tagline?: string; site_description?: string; contact_email?: string;
  contact_phone?: string; address?: string; footer_about?: string; primary_color?: string;
  accent_color?: string; default_language?: string; allow_registration?: boolean;
  guest_tests_enabled?: boolean; maintenance_mode?: boolean; hero_badge?: string;
  result_visibility?: string;
  disclaimer?: string; logo_url?: string; demo_mode?: boolean; site_url?: string;
}

interface AppState {
  user: User | null;
  settings: SiteSettings;
  ready: boolean;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [me, site] = await Promise.allSettled([api.get<{ user: User | null; settings: SiteSettings }>('/auth/me'), api.get<SiteSettings>('/settings')]);
    if (me.status === 'fulfilled') { setUser(me.value.user); setSettings((prev) => ({ ...prev, ...me.value.settings })); }
    if (site.status === 'fulfilled') setSettings((prev) => ({ ...prev, ...site.value }));
    setReady(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (settings.primary_color) document.documentElement.style.setProperty('--primary', settings.primary_color);
    if (settings.accent_color) document.documentElement.style.setProperty('--accent', settings.accent_color);
  }, [settings.primary_color, settings.accent_color]);

  const value = useMemo(() => ({ user, settings, ready, refresh, setUser }), [user, settings, ready, refresh]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
