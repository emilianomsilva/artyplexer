<script lang="ts">
  import Sidebar from './components/Sidebar.svelte';
  import TopBar from './components/TopBar.svelte';
  import ServiceViews from './components/ServiceViews.svelte';
  import DownloadsPanel from './components/DownloadsPanel.svelte';
  import VideoModal from './components/VideoModal.svelte';
  import SettingsDialog from './components/SettingsDialog.svelte';
  import ServiceDialog from './components/ServiceDialog.svelte';
  import QuickSwitcher from './components/QuickSwitcher.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import { t } from './lib/i18n';
  import { onMount } from 'svelte';
  import { api } from './lib/api';
  import type { AppSettings, BusMessage, MediaEntry, ServiceConfig } from './lib/electron';
  import { applyTheme } from './lib/theme';
  import { services, settings, media, activeServiceId, dialogs, flash, DEFAULT_SETTINGS } from './lib/store';
  import { reloadGuest, wakeGuest } from './lib/guests';

  $: document.documentElement.lang = $settings.language;

  function castServices(v: unknown): ServiceConfig[] {
    return Array.isArray(v) ? (v as ServiceConfig[]) : [];
  }
  function castMedia(v: unknown): MediaEntry[] {
    return Array.isArray(v) ? (v as MediaEntry[]) : [];
  }
  function castSettings(v: unknown): AppSettings | null {
    return v !== null && typeof v === 'object' ? (v as AppSettings) : null;
  }

  async function reload(): Promise<void> {
    try {
      const st = await api.state();
      services.set(st.services || []);
      settings.set({ ...DEFAULT_SETTINGS, ...st.settings });
      media.set(st.media || []);
      applyTheme(st.settings?.theme_mode || 'system');
      const ids = (st.services || []).map((s) => s.id);
      activeServiceId.update((cur) => {
        if (cur && ids.includes(cur)) return cur;
        const last = st.settings?.last_active_service_id;
        if (last && ids.includes(last)) return last;
        return ids[0] ?? null;
      });
    } catch (e) {
      flash(`${$t.backendError} ${(e as Error).message}`);
    }
  }

  function onEvent(msg: BusMessage): void {
    if (!msg || msg.type === 'hello') return;
    if (msg.type === 'shell-shortcut') {
      onKey(new KeyboardEvent('keydown', msg.payload as KeyboardEventInit));
      return;
    }
    const payload = msg.payload as { directory?: string; path?: string; text?: string; file?: string; reason?: string; id?: string };
    if (msg.type === 'service-status') {
      services.set(castServices(msg.payload));
    } else if (msg.type === 'services-changed') {
      const next = castServices(msg.payload);
      services.set(next);
      if (!$activeServiceId || !next.some((service) => service.id === $activeServiceId)) {
        activeServiceId.set(next.find((service) => service.enabled !== false)?.id ?? next[0]?.id ?? null);
      }
    } else if (msg.type === 'settings-changed') {
      const s = castSettings(msg.payload);
      if (s) {
        settings.set({ ...DEFAULT_SETTINGS, ...s });
        applyTheme(s.theme_mode || 'system');
      }
    } else if (msg.type === 'media-added') {
      media.set(castMedia(msg.payload));
      dialogs.update((d) => ({ ...d, downloads: true }));
    } else if (msg.type === 'open-preview') {
      const dir = payload.directory;
      let list: MediaEntry[] = [];
      const unsub = media.subscribe((m) => (list = m));
      unsub();
      const found = dir !== undefined ? list.find((m) => m.directory === dir) : undefined;
      if (found) {
        dialogs.update((d) => ({ ...d, video: found }));
        dialogs.update((d) => ({ ...d, downloads: true }));
      }
    } else if (msg.type === 'media-saved') {
      flash(`${$t.fileSavedIn} ${payload.path ?? ''}`);
    } else if (msg.type === 'media-notice') {
      flash(payload.text ?? '');
    } else if (msg.type === 'media-error') {
      flash(`${$t.downloadFailed} ${payload.file ?? ''} (${payload.reason ?? ''})`);
    } else if (msg.type === 'open-settings') {
      dialogs.update((d) => ({ ...d, settings: true }));
    } else if (msg.type === 'activate-service') {
      if (payload.id) {
        selectService(payload.id);
      }
    }
  }

  function selectService(id: string): void {
    wakeGuest(id);
    activeServiceId.set(id);
    dialogs.update((d) => ({ ...d, downloads: false }));
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !$dialogs.video && !$dialogs.quickSwitcher && !$dialogs.settings && !$dialogs.service && !$dialogs.confirm) {
      dialogs.update((d) => ({ ...d, downloads: false }));
    }
    if (e.key === 'F11') {
      e.preventDefault();
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => {});
      return;
    }
    if (e.repeat || e.altKey || (!e.ctrlKey && !e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '9') {
      const idx = parseInt(k, 10) - 1;
      const svc = $services[idx];
      if (svc) {
        e.preventDefault();
        selectService(svc.id);
      }
    } else if (k === 'k') {
      e.preventDefault();
      dialogs.update((d) => ({ ...d, quickSwitcher: !d.quickSwitcher }));
    } else if (k === 'j') {
      e.preventDefault();
      dialogs.update((d) => ({ ...d, downloads: !d.downloads }));
    } else if (k === 'b' && e.shiftKey) {
      e.preventDefault();
      void api.saveSettings({ ...$settings, show_navigation_bar: !$settings.show_navigation_bar })
        .catch((error) => flash(error.message));
    } else if (k === ',') {
      e.preventDefault();
      dialogs.update((d) => ({ ...d, settings: true }));
    } else if (k === 'n') {
      e.preventDefault();
      dialogs.update((d) => ({ ...d, service: { mode: 'add' } }));
    } else if (k === 'r') {
      e.preventDefault();
      if ($activeServiceId) {
        wakeGuest($activeServiceId);
        reloadGuest($activeServiceId);
      }
    }
  }

  onMount(() => {
    void reload();
    let initialized = false;
    const unsubActive = activeServiceId.subscribe((id) => {
      if (initialized) void api.setActive(id ?? '').catch(() => {});
      initialized = true;
    });
    const off = api.onEvent(onEvent);
    window.addEventListener('keydown', onKey);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const relayout = (): void => {
      applyTheme($settings.theme_mode || 'system');
    };
    mq.addEventListener?.('change', relayout);
    return () => {
      off();
      unsubActive();
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener?.('change', relayout);
    };
  });
</script>

<div class="shell">
  <Sidebar />
  <div class="right">
    {#if $settings.show_navigation_bar}<TopBar />{/if}
    <ServiceViews />
    <DownloadsPanel />
  </div>
</div>

<VideoModal />
<SettingsDialog />
<ServiceDialog />
<QuickSwitcher />
<ConfirmDialog />
<ToastHost />

<style>
  .shell {
    display: flex;
    height: 100vh;
    background: var(--gx-window);
    color: var(--gx-text);
  }
  .right {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }
</style>
