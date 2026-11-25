/* Global bridges injected by Electron preload scripts + shared models. */

export type SupportedLocale = 'en-US' | 'pt-BR';

export interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  icon_type: string;
  custom_color?: string;
  custom_icon_path?: string;
  enabled: boolean;
  notifications_enabled: boolean;
  muted: boolean;
  user_agent: string;
  online?: boolean;
  unread?: number;
}

export interface AppSettings {
  minimize_to_tray: boolean;
  start_minimized: boolean;
  global_dnd: boolean;
  is_maximized: boolean;
  last_active_service_id: string;
  window_width: number;
  window_height: number;
  theme_mode: 'system' | 'light' | 'dark' | string;
  download_dir: string;
  always_ask_download: boolean;
  notify_download_complete: boolean;
  language: SupportedLocale | string;
  show_navigation_bar: boolean;
  auto_hibernate: boolean;
  hibernate_minutes: number;
}

export interface MediaEntry {
  directory: string;
  filename: string;
  service_name: string;
  completed_at: string | number;
  expires_at: string | number;
  mime_type: string;
  is_video: boolean;
  size: number;
}

export interface StateSnapshot {
  services: ServiceConfig[];
  settings: AppSettings;
  media: MediaEntry[];
}

export interface BusMessage {
  type: string;
  payload?: unknown;
}

export interface ElectronAPI {
  getState(): Promise<StateSnapshot>;
  saveSettings(s: AppSettings): Promise<AppSettings>;
  addService(s: Partial<ServiceConfig>): Promise<ServiceConfig>;
  updateService(s: Partial<ServiceConfig> & { id: string }): Promise<ServiceConfig>;
  deleteService(id: string): Promise<unknown>;
  reorderServices(ids: string[]): Promise<ServiceConfig[]>;
  attachWebview(id: string): Promise<{ partition: string; preload: string }>;
  detachWebview(id: string): Promise<unknown>;
  getOverlaySrc(): Promise<string>;
  openExternal(url: string): Promise<void>;
  openMedia(dir: string): Promise<unknown>;
  saveMedia(dir: string): Promise<{ path: string } | null>;
  fetchIcon(url: string): Promise<string>;
  clearServiceData(id: string): Promise<unknown>;
  openDirDialog(current: string): Promise<string | null>;
  setTitle(title: string): Promise<void>;
  setActive(id: string): Promise<void>;
  quitApp(): Promise<void>;
  onEvent(cb: (msg: BusMessage) => void): () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
