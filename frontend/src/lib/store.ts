import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { AppSettings, MediaEntry, ServiceConfig } from './electron';

export const DEFAULT_SETTINGS: AppSettings = {
  minimize_to_tray: true,
  start_minimized: false,
  global_dnd: false,
  is_maximized: false,
  last_active_service_id: '',
  window_width: 1200,
  window_height: 800,
  theme_mode: 'system',
  download_dir: '',
  always_ask_download: false,
  notify_download_complete: true,
  language: 'en-US',
  show_navigation_bar: false,
  auto_hibernate: false,
  hibernate_minutes: 15,
};

export const services: Writable<ServiceConfig[]> = writable([]);
export const settings: Writable<AppSettings> = writable({ ...DEFAULT_SETTINGS });
export const media: Writable<MediaEntry[]> = writable([]);
export const activeServiceId: Writable<string | null> = writable(null);

export interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}
export const toasts: Writable<ToastItem[]> = writable([]);

export interface GuestRuntime {
  loading: boolean;
  playingAudio: boolean;
  audioMuted: boolean;
  hibernated: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  currentUrl: string;
  lastActiveAt: number;
}

export const guestRuntime: Writable<Record<string, GuestRuntime>> = writable({});

export function patchGuestRuntime(id: string, patch: Partial<GuestRuntime>): void {
  guestRuntime.update((map) => {
    const prev: GuestRuntime = map[id] ?? {
      loading: false,
      playingAudio: false,
      audioMuted: false,
      hibernated: false,
      canGoBack: false,
      canGoForward: false,
      currentUrl: '',
      lastActiveAt: Date.now(),
    };
    return { ...map, [id]: { ...prev, ...patch } };
  });
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (accepted: boolean) => void;
}

export interface DialogState {
  settings: boolean;
  downloads: boolean;
  quickSwitcher: boolean;
  service: { mode: 'add' } | { mode: 'edit'; service: ServiceConfig } | null;
  video: MediaEntry | null;
  confirm: ConfirmOptions | null;
}

export const dialogs: Writable<DialogState> = writable({
  settings: false,
  downloads: false,
  quickSwitcher: false,
  service: null,
  video: null,
  confirm: null,
});

export function askConfirm(opts: Omit<ConfirmOptions, 'resolve'>): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    dialogs.update((d) => ({
      ...d,
      confirm: { ...opts, resolve },
    }));
  });
}

let toastSeq = 0;

export function flash(text: string, ms = 4200, tone: 'info' | 'success' | 'error' = 'info'): void {
  if (!text) return;
  const id = ++toastSeq;
  toasts.update((list) => [...list.slice(-3), { id, text, tone }]);
  setTimeout(() => {
    toasts.update((list) => list.filter((t) => t.id !== id));
  }, ms);
}

export function dismissToast(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}
