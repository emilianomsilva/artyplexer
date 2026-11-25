/* Typed IPC client for the Artyplexer main process (via preload-shell). */
import type {
  AppSettings,
  BusMessage,
  MediaEntry,
  ServiceConfig,
  StateSnapshot,
} from './electron';

const e = window.electronAPI;

if (!e) {
  throw new Error('electronAPI bridge missing — running outside Electron?');
}

async function req<T>(p: Promise<T>): Promise<T> {
  return p;
}

export interface SaveResult {
  path: string;
}

export const api = {
  state: (): Promise<StateSnapshot> => req(e.getState()),
  saveSettings: (s: AppSettings): Promise<AppSettings> => req(e.saveSettings(s)),
  addService: (s: Partial<ServiceConfig>): Promise<ServiceConfig> => req(e.addService(s)),
  updateService: (s: Partial<ServiceConfig> & { id: string }): Promise<ServiceConfig> =>
    req(e.updateService(s)),
  deleteService: (id: string): Promise<unknown> => req(e.deleteService(id)),
  reorderServices: (ids: string[]): Promise<ServiceConfig[]> => req(e.reorderServices(ids)),
  attachWebview: (id: string): Promise<{ partition: string; preload: string }> =>
    req(e.attachWebview(id)),
  detachWebview: (id: string): Promise<unknown> => req(e.detachWebview(id)),
  getOverlaySrc: (): Promise<string> => req(e.getOverlaySrc()),
  openExternal: (url: string): Promise<void> => req(e.openExternal(url)),
  openMedia: (dir: string): Promise<unknown> => req(e.openMedia(dir)),
  saveMedia: (dir: string): Promise<SaveResult | null> => req(e.saveMedia(dir)),
  fetchIcon: (url: string): Promise<string> => req(e.fetchIcon(url)),
  clearServiceData: (id: string): Promise<unknown> => req(e.clearServiceData(id)),
  openDirDialog: (current: string): Promise<string | null> => req(e.openDirDialog(current)),
  setTitle: (title: string): Promise<void> => req(e.setTitle(title)),
  setActive: (id: string): Promise<void> => req(e.setActive(id)),
  quit: (): Promise<void> => req(e.quitApp()),
  mediaUrl: (dir: string, file: string): string =>
    `media://${encodeURIComponent(dir)}/${encodeURIComponent(file)}`,
  onEvent: (cb: (msg: BusMessage) => void): (() => void) => e.onEvent(cb),
};

export type { MediaEntry, ServiceConfig, AppSettings, StateSnapshot };
