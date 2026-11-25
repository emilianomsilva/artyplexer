<script lang="ts">
  import {
    services,
    settings,
    media,
    activeServiceId,
    guestRuntime,
    dialogs,
    flash,
  } from '../lib/store';
  import { api } from '../lib/api';
  import {
    reloadGuest,
    goBackGuest,
    goForwardGuest,
    hibernateGuest,
    hasLiveGuest,
  } from '../lib/guests';
  import { uiIcon } from '../lib/icons';
  import { isDarkTheme } from '../lib/theme';
  import { t } from '../lib/i18n';

  $: tone = $isDarkTheme ? '#94a3b8' : '#5b6b84';
  $: active = ($services || []).find((s) => s.id === $activeServiceId);
  $: rt = active ? $guestRuntime[active.id] : undefined;
  $: displayUrl = rt?.currentUrl || active?.url || '';

  async function hideBar(): Promise<void> {
    try {
      await api.saveSettings({ ...$settings, show_navigation_bar: false });
    } catch (e) {
      flash((e as Error).message, 4500, 'error');
    }
  }

  function openExternal(): void {
    if (displayUrl && /^https?:\/\//i.test(displayUrl)) {
      void api.openExternal(displayUrl);
    }
  }

  function hibernateActive(): void {
    if (!active) return;
    hibernateGuest(active.id);
    flash(`${$t.serviceHibernatedMsg} ${active.name}`);
  }
</script>

{#if $settings.show_navigation_bar}
  <header class="navbar">
    <div class="nav-controls">
      <button
        type="button"
        class="navbtn"
        title={$t.navBack}
        aria-label={$t.navBack}
        disabled={!active || !rt?.canGoBack}
        on:click={() => active && goBackGuest(active.id)}
      >
        {@html uiIcon('arrow-left', tone)}
      </button>
      <button
        type="button"
        class="navbtn"
        title={$t.navForward}
        aria-label={$t.navForward}
        disabled={!active || !rt?.canGoForward}
        on:click={() => active && goForwardGuest(active.id)}
      >
        {@html uiIcon('arrow-right', tone)}
      </button>
      <button
        type="button"
        class="navbtn {rt?.loading ? 'spinning' : ''}"
        title={$t.navReload}
        aria-label={$t.navReload}
        disabled={!active}
        on:click={() => active && reloadGuest(active.id)}
      >
        {@html uiIcon('refresh', tone)}
      </button>
    </div>

    <div class="address-pill" title={displayUrl}>
      {#if active}
        <span class="svc-name">{active.name}</span>
        <span class="dot">•</span>
        <span class="url-text">{displayUrl}</span>
      {:else}
        <span class="url-text">{$t.noActiveService}</span>
      {/if}
    </div>

    <div class="nav-controls">
      {#if active && hasLiveGuest(active.id)}
        <button
          type="button"
          class="navbtn"
          title={$t.navHibernate}
          aria-label={$t.navHibernate}
          on:click={hibernateActive}
        >
          {@html uiIcon('moon', tone)}
        </button>
      {/if}
      {#if active}
        <button
          type="button"
          class="navbtn"
          title={$t.navOpenExternal}
          aria-label={$t.navOpenExternal}
          on:click={openExternal}
        >
          {@html uiIcon('external', tone)}
        </button>
      {/if}
      <button
        type="button"
        class="navbtn"
        title={$t.downloadsTitle}
        aria-label={$t.downloadsTitle}
        on:click={() => dialogs.update((d) => ({ ...d, downloads: !d.downloads }))}
      >
        {@html uiIcon('download', tone)}
        {#if $media.length > 0}
          <span class="count">{$media.length}</span>
        {/if}
      </button>
      <button
        type="button"
        class="navbtn"
        title={$t.navHide}
        aria-label={$t.navHide}
        on:click={hideBar}
      >
        {@html uiIcon('close', tone)}
      </button>
    </div>
  </header>
{/if}

<style>
  .navbar {
    height: 38px;
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px;
    background: var(--gx-panel);
    border-bottom: 1px solid var(--gx-border);
    flex-shrink: 0;
  }
  .nav-controls {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .navbtn {
    height: 28px;
    min-width: 28px;
    padding: 0 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .navbtn:hover:not(:disabled) { background: var(--gx-surface_hover); }
  .navbtn :global(svg) { width: 15px; height: 15px; }
  .navbtn.spinning :global(svg) { animation: spin 0.9s linear infinite; }

  .address-pill {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    background: var(--gx-surface);
    border: 1px solid var(--gx-border);
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    overflow: hidden;
  }
  .svc-name {
    font-weight: 600;
    color: var(--gx-text);
    white-space: nowrap;
  }
  .dot { color: var(--gx-muted); }
  .url-text {
    color: var(--gx-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .count {
    font-size: 11px;
    font-weight: 600;
    color: var(--gx-accent);
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
