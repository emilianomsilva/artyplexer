/* Ferdium-inspired refined dark & light theme tokens; applied as CSS vars + reactive store. */
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

interface ThemeTokens {
  window: string;
  rail: string;
  panel: string;
  surface: string;
  surface_hover: string;
  active: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  selection: string;
  selection_text: string;
  separator: string;
  shadow: string;
}

type ThemeName = 'dark' | 'light';

export const THEMES: Record<ThemeName, ThemeTokens> = {
  dark: {
    window: '#0f1117',
    rail: '#141720',
    panel: '#191d28',
    surface: '#222736',
    surface_hover: '#2c3347',
    active: '#283044',
    text: '#e6edf7',
    muted: '#8b98b1',
    border: '#2b3245',
    accent: '#60a5fa',
    selection: '#3b82f6',
    selection_text: '#ffffff',
    separator: '#252b3b',
    shadow: '0 18px 48px rgba(0, 0, 0, 0.52)',
  },
  light: {
    window: '#f3f5f9',
    rail: '#e9edf4',
    panel: '#ffffff',
    surface: '#f1f4f9',
    surface_hover: '#e3e8f2',
    active: '#dce5f7',
    text: '#162033',
    muted: '#5b6b84',
    border: '#d3dbe8',
    accent: '#2563eb',
    selection: '#2563eb',
    selection_text: '#ffffff',
    separator: '#dde4ef',
    shadow: '0 18px 44px rgba(15, 23, 42, 0.16)',
  },
};

export type ThemeMode = 'system' | 'light' | 'dark';

export const isDarkTheme: Writable<boolean> = writable(true);

export function applyTheme(mode: string | undefined): boolean {
  let dark = mode === 'dark';
  if (mode === 'system' || !mode) {
    dark = window.matchMedia !== undefined && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  const t = THEMES[dark ? 'dark' : 'light'];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t) as Array<[keyof ThemeTokens, string]>) {
    root.style.setProperty(`--gx-${k}`, v);
  }
  root.dataset.theme = dark ? 'dark' : 'light';
  isDarkTheme.set(dark);
  return dark;
}
