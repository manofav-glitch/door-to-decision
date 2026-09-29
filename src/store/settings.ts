import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type TextSize = 'normal' | 'large' | 'xlarge';

interface SettingsState {
  theme: Theme;
  textSize: TextSize;
  reduceMotion: boolean;
  /** Cases containing unverified clinical items are hidden unless this is on. */
  showDrafts: boolean;
  disclaimerAccepted: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const defaults = {
  theme: 'system' as Theme,
  textSize: 'normal' as TextSize,
  reduceMotion: false,
  // On for local dev / preview so the owner can play draft cases; off in the deployed build.
  showDrafts: import.meta.env.DEV,
  disclaimerAccepted: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (patch) => set(patch),
      reset: () => set({ ...defaults }),
    }),
    { name: 'd2d.settings' },
  ),
);
