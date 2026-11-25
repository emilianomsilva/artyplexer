<script lang="ts">
  import {
    services,
    settings,
    media,
    activeServiceId,
    guestRuntime,
    dialogs,
    askConfirm,
    flash,
  } from '../lib/store';
  import type { ServiceConfig } from '../lib/electron';
  import { api } from '../lib/api';
  import { brandIcon, uiIcon } from '../lib/icons';
  import { isDarkTheme } from '../lib/theme';
  import { t } from '../lib/i18n';
  import {
    reloadGuest,
    removeGuest,
    hibernateGuest,
    wakeGuest,
    hasLiveGuest,
    toggleGuestAudioMute,
  } from '../lib/guests';

  $: mutedTone = $isDarkTheme ? '#94a3b8' : '#5b6b84';
  $: activeTone = $isDarkTheme ? '#60a5fa' : '#2563eb';

  let failedIcons: Record<string, string> = {};
  let dragFromId: string | null = null;
  let dragOverId: string | null = null;

  function selectService(svc: ServiceConfig): void {
    if (svc.enabled !== false && $guestRuntime[svc.id]?.hibernated) {
      wakeGuest(svc.id);
    }
    activeServiceId.set(svc.id);
    if ($dialogs.downloads) {
      dialogs.update((d) => ({ ...d, downloads: false }));
    }
  }

  function onAudioBadgeClick(e: MouseEvent, id: string): void {
    e.stopPropagation();
    toggleGuestAudioMute(id);
  }

  async function toggleDND(): Promise<void> {
    try {
      await api.saveSettings({ ...$settings, global_dnd: !$settings.global_dnd });
    } catch (e) {
      flash((e as Error).message, 4500, 'error');
    }
  }

  async function toggleNavBar(): Promise<void> {
    try {
      await api.saveSettings({
        ...$settings,
        show_navigation_bar: !$settings.show_navigation_bar,
      });
    } catch (e) {
      flash((e as Error).message, 4500, 'error');
    }
  }

  function toggleDownloads(): void {
    dialogs.update((d) => ({ ...d, downloads: !d.downloads }));
  }

  function openQuickSwitcher(): void {
    dialogs.update((d) => ({ ...d, quickSwitcher: true }));
  }

  function unreadText(n: number): string {
    return n > 99 ? '99+' : String(n);
  }

  // ---- Drag & drop service reordering ----
  function onDragStart(e: DragEvent, id: string): void {
    dragFromId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
  }

  function onDragOver(e: DragEvent, id: string): void {
    if (!dragFromId || dragFromId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverId = id;
  }

  async function onDrop(e: DragEvent, targetId: string): Promise<void> {
    e.preventDefault();
    const fromId = dragFromId;
    dragFromId = null;
    dragOverId = null;
    if (!fromId || fromId === targetId) return;
    const current = [...$services];
    const fromIdx = current.findIndex((s) => s.id === fromId);
    const toIdx = current.findIndex((s) => s.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = current.splice(fromIdx, 1);
    if (!moved) return;
    current.splice(toIdx, 0, moved);
    try {
      await api.reorderServices(current.map((s) => s.id));
    } catch (err) {
      flash((err as Error).message, 4500, 'error');
    }
  }

  function onDragEnd(): void {
    dragFromId = null;
    dragOverId = null;
  }

  // ---- Context menu ----
  interface CtxState {
    x: number;
    y: number;
    service: ServiceConfig;
  }
  let ctx: CtxState | null = null;

  function onContext(e: MouseEvent, svc: ServiceConfig): void {
    e.preventDefault();
    ctx = { x: e.clientX, y: e.clientY, service: svc };
  }

  function closeCtx(): void {
    ctx = null;
  }

  function ctxReload(): void {
    if (!ctx) return;
    const id = ctx.service.id;
    closeCtx();
    if ($guestRuntime[id]?.hibernated) {
      wakeGuest(id);
      activeServiceId.set(id);
    } else {
      reloadGuest(id);
    }
  }

  function ctxHibernateToggle(): void {
    if (!ctx) return;
    const svc = ctx.service;
    closeCtx();
    if ($guestRuntime[svc.id]?.hibernated) {
      wakeGuest(svc.id);
      activeServiceId.set(svc.id);
    } else {
      hibernateGuest(svc.id);
      flash(`${$t.serviceHibernatedMsg} ${svc.name}`);
    }
  }

  function ctxToggleAudio(): void {
    if (!ctx) return;
    const id = ctx.service.id;
    closeCtx();
    toggleGuestAudioMute(id);
  }

  async function ctxToggleEnabled(): Promise<void> {
    if (!ctx) return;
    const svc = ctx.service;
    const nextEnabled = svc.enabled === false;
    closeCtx();
    try {
      if (!nextEnabled) {
        removeGuest(svc.id);
      }
      await api.updateService({ ...svc, enabled: nextEnabled });
    } catch (e) {
      flash((e as Error).message, 4500, 'error');
    }
  }

  async function ctxMuteNotif(): Promise<void> {
    if (!ctx) return;
    const svc = ctx.service;
    closeCtx();
    try {
      await api.updateService({ ...svc, muted: !svc.muted });
      flash(`${svc.muted ? $t.notifUnmutedMsg : $t.notifMutedMsg} ${svc.name}.`);
    } catch (e) {
      flash((e as Error).message, 4500, 'error');
    }
  }

  function ctxColor(): void {
    if (!ctx) return;
    const svc = ctx.service;
    closeCtx();
    const input = document.createElement('input');
    input.type = 'color';
    const current = svc.custom_color ?? '';
    input.value = /^#[0-9a-f]{6}$/i.test(current) ? current : '#25D366';
    input.onchange = () => {
      void (async () => {
        try {
          await api.updateService({ ...svc, custom_color: input.value });
        } catch (err) {
          flash((err as Error).message, 4500, 'error');
        }
      })();
    };
    input.click();
  }

  function ctxEdit(): void {
    if (!ctx) return;
    const svc = ctx.service;
    closeCtx();
    dialogs.update((d) => ({ ...d, service: { mode: 'edit', service: svc } }));
  }

  async function ctxDelete(): Promise<void> {
    if (!ctx) return;
    const svc = ctx.service;
    closeCtx();
    const ok = await askConfirm({
      title: $t.deleteServiceConfirmTitle,
      message: $t.deleteServiceConfirmMsg.replace('{name}', svc.name),
      confirmLabel: $t.deleteServiceBtn,
      cancelLabel: $t.cancelBtn,
      danger: true,
    });
    if (!ok) return;
    try {
      removeGuest(svc.id);
      if ($activeServiceId === svc.id) {
        const fallback = $services.find((s) => s.id !== svc.id && s.enabled !== false);
        activeServiceId.set(fallback?.id ?? null);
      }
      await api.deleteService(svc.id);
      flash(`${$t.serviceDeletedMsg} ${svc.name}`);
    } catch (e) {
      flash((e as Error).message, 4500, 'error');
    }
  }

  function onWindowKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && ctx) closeCtx();
  }

  function tooltipFor(svc: ServiceConfig, idx: number): string {
    const shortcut = idx < 9 ? ` (Ctrl+${idx + 1})` : '';
    const state =
      svc.enabled === false
        ? `\n[${$t.disabledBadge}]`
        : $guestRuntime[svc.id]?.hibernated
          ? `\n[${$t.hibernatedBadge}]`
          : '';
    return `${svc.name}${shortcut}\n${svc.url}${state}`;
  }
</script>

<svelte:window on:keydown={onWindowKey} on:click={closeCtx} />

<nav class="sidebar" aria-label={$t.sidebarAria}>
  <div class="scroll">
    {#each $services as svc, idx (svc.id)}
      {@const rt = $guestRuntime[svc.id]}
      {@const isHibernated = svc.enabled !== false && Boolean(rt?.hibernated)}
      {@const isDisabled = svc.enabled === false}
      <div
        class="svc-slot {dragOverId === svc.id ? 'drop-target' : ''}"
        draggable="true"
        role="listitem"
        on:dragstart={(e) => onDragStart(e, svc.id)}
        on:dragover={(e) => onDragOver(e, svc.id)}
        on:drop={(e) => onDrop(e, svc.id)}
        on:dragend={onDragEnd}
      >
        <button
          type="button"
          class="svc {$activeServiceId === svc.id ? 'active' : ''} {isHibernated ? 'hibernated' : ''} {isDisabled ? 'disabled' : ''}"
          title={tooltipFor(svc, idx)}
          on:click={() => selectService(svc)}
          on:contextmenu={(e) => onContext(e, svc)}
        >
          <span class="pill"></span>
          <span class="icon">
            {#if svc.custom_icon_path && failedIcons[svc.id] !== svc.custom_icon_path}
              <img
                src={`file://${svc.custom_icon_path}`}
                alt=""
                on:error={() => {
                  failedIcons = { ...failedIcons, [svc.id]: svc.custom_icon_path ?? '' };
                }}
              />
            {:else}
              {@html brandIcon(svc.icon_type, svc.custom_color)}
            {/if}
          </span>

          {#if rt?.loading}
            <span class="loadring" aria-hidden="true"></span>
          {/if}

          {#if isHibernated}
            <span class="sleepdot" title={$t.hibernatedBadge}></span>
          {:else if svc.muted}
            <span class="mutedot" title={$t.ctxUnmuteNotif}></span>
          {/if}

          {#if svc.unread && !isDisabled}
            <span class="badge">{unreadText(svc.unread)}</span>
          {/if}
        </button>

        {#if (rt?.playingAudio || rt?.audioMuted) && !isHibernated && !isDisabled}
          <button
            type="button"
            class="audiobtn {rt?.audioMuted ? 'muted' : ''}"
            title={rt?.audioMuted ? $t.audioMutedClickUnmute : $t.audioPlayingClickMute}
            aria-label={rt?.audioMuted ? $t.audioMutedClickUnmute : $t.audioPlayingClickMute}
            on:click={(e) => onAudioBadgeClick(e, svc.id)}
          >
            {@html uiIcon(rt?.audioMuted ? 'volume-x' : 'volume-2', rt?.audioMuted ? '#f87171' : '#38bdf8')}
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <div class="sep"></div>

  <button
    type="button"
    class="bottombtn add-service-btn"
    title={$t.addNewService}
    aria-label={$t.addNewService}
    on:click={() => dialogs.update((d) => ({ ...d, service: { mode: 'add' } }))}
  >
    {@html uiIcon('plus', mutedTone)}
  </button>

  <button
    type="button"
    class="bottombtn"
    title={$t.quickSwitchTitle}
    aria-label={$t.quickSwitchTitle}
    on:click={openQuickSwitcher}
  >
    {@html uiIcon('search', mutedTone)}
  </button>

  <button
    type="button"
    class="bottombtn {$dialogs.downloads ? 'on' : ''}"
    title={$t.downloadsTitle}
    aria-label={$t.downloadsTitle}
    on:click={toggleDownloads}
  >
    {@html uiIcon('download', $dialogs.downloads ? activeTone : mutedTone)}
    {#if $media.length > 0}
      <span class="mini-badge">{$media.length > 9 ? '9+' : $media.length}</span>
    {/if}
  </button>

  <button
    type="button"
    class="bottombtn {$settings.show_navigation_bar ? 'on' : ''}"
    title={$t.toggleNavBar}
    aria-label={$t.toggleNavBar}
    on:click={toggleNavBar}
  >
    {@html uiIcon('navbar', $settings.show_navigation_bar ? activeTone : mutedTone)}
  </button>

  <button
    type="button"
    class="bottombtn {$settings.global_dnd ? 'on' : ''}"
    title={$settings.global_dnd ? $t.dndEnabledTitle : $t.dndDisabledTitle}
    aria-label={$t.globalDnd}
    on:click={toggleDND}
  >
    {@html uiIcon($settings.global_dnd ? 'bell-slash' : 'bell', mutedTone)}
  </button>

  <button
    type="button"
    class="bottombtn settings-btn"
    title={$t.settingsTitle}
    aria-label={$t.settingsTitle}
    on:click={() => dialogs.update((d) => ({ ...d, settings: true }))}
  >
    {@html uiIcon('settings', mutedTone)}
  </button>
</nav>

{#if ctx}
  {@const ctxRt = $guestRuntime[ctx.service.id]}
  {@const ctxLive = hasLiveGuest(ctx.service.id)}
  <div class="ctx-wrap" role="presentation">
    <div
      class="ctxmenu"
      style={`left:${Math.min(ctx.x, window.innerWidth - 235)}px; top:${Math.min(ctx.y, window.innerHeight - 290)}px;`}
      role="menu"
    >
      {#if ctx.service.enabled !== false}
        <button type="button" on:click={ctxReload}>{$t.ctxReload} {ctx.service.name}</button>
        {#if ctxRt?.hibernated}
          <button type="button" on:click={ctxHibernateToggle}>{$t.ctxWake}</button>
        {:else if ctxLive}
          <button type="button" on:click={ctxHibernateToggle}>{$t.ctxHibernate}</button>
        {/if}
        {#if ctxLive}
          <button type="button" on:click={ctxToggleAudio}>
            {ctxRt?.audioMuted ? $t.ctxUnmuteAudio : $t.ctxMuteAudio}
          </button>
        {/if}
        <button type="button" on:click={ctxMuteNotif}>
          {ctx.service.muted ? $t.ctxUnmuteNotif : $t.ctxMuteNotif}
        </button>
        <div class="ctxsep"></div>
      {/if}
      <button type="button" on:click={ctxToggleEnabled}>
        {ctx.service.enabled === false ? $t.ctxEnable : $t.ctxDisable}
      </button>
      <button type="button" on:click={ctxColor}>{$t.ctxChangeColor}</button>
      <button type="button" on:click={ctxEdit}>{$t.ctxEdit}</button>
      <div class="ctxsep"></div>
      <button type="button" class="danger-item" on:click={ctxDelete}>{$t.ctxDelete}</button>
    </div>
  </div>
{/if}

<style>
  .sidebar {
    width: 66px;
    background: var(--gx-rail);
    border-right: 1px solid var(--gx-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0 10px;
    gap: 3px;
    z-index: 30;
    flex-shrink: 0;
  }
  .scroll {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
    padding: 2px 0;
  }
  .scroll::-webkit-scrollbar { display: none; }
  .sep { width: 32px; border-top: 1px solid var(--gx-separator); margin: 4px 0; }

  .svc-slot {
    position: relative;
    width: 66px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .svc-slot.drop-target::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 14px;
    right: 14px;
    height: 2px;
    border-radius: 2px;
    background: var(--gx-accent);
  }
  .svc {
    width: 66px;
    height: 52px;
    background: transparent;
    border: none;
    border-radius: 0;
    position: relative;
    cursor: pointer;
    padding: 0;
  }
  .svc:hover { background: transparent; }
  .svc .pill {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 10px;
    border-radius: 0 3px 3px 0;
    background: var(--gx-accent);
    transition: width 140ms ease, height 140ms ease;
  }
  .svc:hover .pill { width: 3px; height: 14px; opacity: 0.7; }
  .svc.active .pill { width: 3.5px; height: 26px; opacity: 1; }

  .svc .icon {
    position: absolute;
    left: 17px;
    top: 10px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    transition: opacity 150ms ease, filter 150ms ease;
  }
  .svc .icon::before {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 12px;
    background: transparent;
    z-index: -1;
    transition: background 130ms ease;
  }
  .svc:hover .icon::before { background: var(--gx-surface_hover); }
  .svc.active .icon::before { background: var(--gx-active); }

  .svc.hibernated .icon { opacity: 0.52; filter: saturate(0.65); }
  .svc.disabled .icon { opacity: 0.3; filter: grayscale(1); }

  .svc .icon :global(svg) { width: 32px; height: 32px; display: block; }
  .svc .icon img { width: 30px; height: 30px; border-radius: 7px; object-fit: contain; display: block; }

  .loadring {
    position: absolute;
    left: 13px;
    top: 6px;
    width: 40px;
    height: 40px;
    border-radius: 13px;
    border: 1.5px solid transparent;
    border-top-color: var(--gx-accent);
    animation: spin 0.9s linear infinite;
    pointer-events: none;
  }

  .svc .mutedot, .svc .sleepdot {
    position: absolute;
    left: 43px;
    top: 36px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--gx-rail);
    z-index: 2;
  }
  .svc .mutedot { border: 1.8px solid #ef4444; }
  .svc .sleepdot { background: #f59e0b; border: 1.5px solid var(--gx-rail); }

  .svc .badge {
    position: absolute;
    top: 3px;
    right: 6px;
    min-width: 19px;
    height: 17px;
    padding: 0 5px;
    border-radius: 999px;
    background: #ef4444;
    border: 1.5px solid var(--gx-rail);
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
  }

  .audiobtn {
    position: absolute;
    left: 8px;
    bottom: 3px;
    width: 19px;
    height: 19px;
    padding: 2px;
    border-radius: 50%;
    background: var(--gx-panel);
    border: 1px solid var(--gx-border);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 4;
  }
  .audiobtn :global(svg) { width: 12px; height: 12px; }

  .bottombtn {
    width: 44px;
    height: 38px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 9px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .bottombtn:hover { background: var(--gx-surface_hover); }
  .bottombtn :global(svg) { width: 19px; height: 19px; }
  .bottombtn.on { background: var(--gx-active); }

  .mini-badge {
    position: absolute;
    top: 3px;
    right: 3px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    border-radius: 999px;
    background: var(--gx-selection);
    color: #fff;
    font-size: 9.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ctxmenu {
    position: fixed;
    z-index: 120;
    min-width: 215px;
    background: var(--gx-panel);
    border: 1px solid var(--gx-border);
    box-shadow: var(--gx-shadow);
    border-radius: 9px;
    padding: 5px;
    display: flex;
    flex-direction: column;
    animation: popIn 100ms ease-out;
  }
  .ctxmenu button {
    text-align: left;
    background: transparent;
    border: none;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 13px;
  }
  .ctxmenu button:hover {
    background: var(--gx-selection);
    color: var(--gx-selection_text);
  }
  .ctxmenu button.danger-item { color: #f87171; }
  .ctxmenu button.danger-item:hover { background: #ef4444; color: #ffffff; }
  .ctxsep { border-top: 1px solid var(--gx-separator); margin: 4px 0; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
