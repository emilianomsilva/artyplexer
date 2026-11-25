/* Renderer-owned <webview> guests (single-window embedding + Ferdium-style hibernation & audio/nav tracking). */
import { api } from './api';
import { get } from 'svelte/store';
import { patchGuestRuntime, guestRuntime, settings } from './store';

/** Subset of Electron's <webview> DOM API used by Artyplexer. */
export interface GuestWebviewElement extends HTMLElement {
  src: string;
  executeJavaScript<T>(code: string, userGesture?: boolean): Promise<T>;
  reload(): void;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  getURL(): string;
  setAudioMuted(muted: boolean): void;
  isAudioMuted(): boolean;
}

const guests = new Map<string, GuestWebviewElement>();
const overlayTimers = new WeakMap<GuestWebviewElement, ReturnType<typeof setInterval>>();
let overlaySrc: string | null = null;

function syncNavState(id: string, wv: GuestWebviewElement): void {
  try {
    patchGuestRuntime(id, {
      canGoBack: typeof wv.canGoBack === 'function' ? wv.canGoBack() : false,
      canGoForward: typeof wv.canGoForward === 'function' ? wv.canGoForward() : false,
      currentUrl: typeof wv.getURL === 'function' ? wv.getURL() : wv.src,
    });
  } catch {
    // webview not yet attached to guest webContents
  }
}

export async function ensureGuest(id: string, url: string, container: HTMLElement): Promise<GuestWebviewElement> {
  const existing = guests.get(id);
  if (existing && existing.isConnected) {
    patchGuestRuntime(id, { hibernated: false, lastActiveAt: Date.now() });
    return existing;
  }
  if (existing) guests.delete(id);

  patchGuestRuntime(id, {
    loading: true,
    hibernated: false,
    playingAudio: false,
    currentUrl: url,
    lastActiveAt: Date.now(),
  });

  const { partition, preload } = await api.attachWebview(id);
  if (!container.isConnected) throw new Error('Service view was closed');
  const wv = document.createElement('webview') as unknown as GuestWebviewElement;
  wv.setAttribute('partition', partition);
  wv.setAttribute('preload', 'file://' + preload);
  wv.setAttribute('allowpopups', '');
  wv.className = 'guest';
  container.appendChild(wv);
  guests.set(id, wv);

  if (!overlaySrc) {
    try {
      overlaySrc = await api.getOverlaySrc();
    } catch {
      overlaySrc = '';
    }
  }

  const inject = (): void => {
    if (overlaySrc) {
      const language = get(settings).language;
      void wv.executeJavaScript(
        `document.documentElement.dataset.artyplexerLocale = ${JSON.stringify(language)};
${overlaySrc}`
      ).catch(() => {});
    }
  };

  wv.addEventListener('did-start-loading', () => {
    patchGuestRuntime(id, { loading: true, hibernated: false });
  });

  wv.addEventListener('did-stop-loading', () => {
    patchGuestRuntime(id, { loading: false });
    syncNavState(id, wv);
  });

  wv.addEventListener('did-fail-load', () => {
    patchGuestRuntime(id, { loading: false });
  });

  wv.addEventListener('did-navigate', () => syncNavState(id, wv));
  wv.addEventListener('did-navigate-in-page', () => syncNavState(id, wv));

  wv.addEventListener('media-started-playing', () => {
    patchGuestRuntime(id, { playingAudio: true });
  });

  wv.addEventListener('media-paused', () => {
    patchGuestRuntime(id, { playingAudio: false });
  });

  wv.addEventListener('dom-ready', () => {
    inject();
    syncNavState(id, wv);
    // Re-apply per-tab audio mute if user muted before reload
    let shouldMute = false;
    const u = guestRuntime.subscribe((m) => {
      shouldMute = m[id]?.audioMuted ?? false;
    });
    u();
    if (shouldMute && typeof wv.setAudioMuted === 'function') {
      try {
        wv.setAudioMuted(true);
      } catch {}
    }
  });

  const timer = setInterval(() => {
    if (!wv.isConnected) {
      clearInterval(timer);
      return;
    }
    void wv
      .executeJavaScript<string>('window.__artyplexerOverlay ? "yes" : "no"')
      .then((present) => {
        if (present !== 'yes') inject();
      })
      .catch(() => {});
  }, 20000);

  overlayTimers.set(wv, timer);

  wv.addEventListener('new-window', ((e: Event) => {
    const targetUrl = (e as CustomEvent & { url?: string }).url ?? (e as unknown as { url: string }).url;
    if (typeof targetUrl === 'string') void api.openExternal(targetUrl);
  }) as EventListener);

  if (wv.isConnected) wv.src = url;
  else clearInterval(timer);
  return wv;
}

export function getGuest(id: string): GuestWebviewElement | null {
  const wv = guests.get(id);
  return wv && wv.isConnected ? wv : null;
}

export function hasLiveGuest(id: string): boolean {
  return getGuest(id) !== null;
}

export function reloadGuest(id: string): void {
  const wv = getGuest(id);
  if (wv) wv.reload();
}

export function goBackGuest(id: string): void {
  const wv = getGuest(id);
  if (wv && typeof wv.canGoBack === 'function' && wv.canGoBack()) wv.goBack();
}

export function goForwardGuest(id: string): void {
  const wv = getGuest(id);
  if (wv && typeof wv.canGoForward === 'function' && wv.canGoForward()) wv.goForward();
}

export function toggleGuestAudioMute(id: string): boolean {
  const wv = getGuest(id);
  let nextMuted = false;
  const u = guestRuntime.subscribe((m) => {
    nextMuted = !(m[id]?.audioMuted ?? false);
  });
  u();
  if (wv && typeof wv.setAudioMuted === 'function') {
    try {
      wv.setAudioMuted(nextMuted);
    } catch {}
  }
  patchGuestRuntime(id, { audioMuted: nextMuted });
  return nextMuted;
}

/** Unload the <webview> process to free RAM while keeping session partition intact. */
export function hibernateGuest(id: string): void {
  const wv = guests.get(id);
  if (wv) {
    clearInterval(overlayTimers.get(wv));
    if (wv.isConnected) wv.remove();
  }
  guests.delete(id);
  patchGuestRuntime(id, {
    loading: false,
    playingAudio: false,
    hibernated: true,
    canGoBack: false,
    canGoForward: false,
  });
  void api.detachWebview(id).catch(() => {});
}

export function wakeGuest(id: string): void {
  patchGuestRuntime(id, { hibernated: false, lastActiveAt: Date.now() });
}

export function removeGuest(id: string): void {
  const wv = guests.get(id);
  if (wv) {
    clearInterval(overlayTimers.get(wv));
    if (wv.isConnected) wv.remove();
  }
  guests.delete(id);
  guestRuntime.update((m) => {
    const copy = { ...m };
    delete copy[id];
    return copy;
  });
  void api.detachWebview(id).catch(() => {});
}
