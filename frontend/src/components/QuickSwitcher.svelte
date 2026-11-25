<script lang="ts">
  import { tick } from 'svelte';
  import {
    services,
    activeServiceId,
    guestRuntime,
    dialogs,
  } from '../lib/store';
  import type { ServiceConfig } from '../lib/electron';
  import { brandIcon, uiIcon } from '../lib/icons';
  import { wakeGuest } from '../lib/guests';
  import { t } from '../lib/i18n';

  let query = '';
  let selectedIdx = 0;
  let searchInput: HTMLInputElement | null = null;
  let wasOpen = false;

  $: open = $dialogs.quickSwitcher;

  $: if (open && !wasOpen) {
    wasOpen = true;
    query = '';
    selectedIdx = 0;
    void tick().then(() => searchInput?.focus());
  } else if (!open && wasOpen) {
    wasOpen = false;
  }

  $: filtered = $services.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q);
  });

  $: if (selectedIdx >= filtered.length) {
    selectedIdx = Math.max(0, filtered.length - 1);
  }

  function close(): void {
    dialogs.update((d) => ({ ...d, quickSwitcher: false }));
  }

  function pick(svc: ServiceConfig | undefined): void {
    if (!svc) return;
    if ($guestRuntime[svc.id]?.hibernated) {
      wakeGuest(svc.id);
    }
    activeServiceId.set(svc.id);
    dialogs.update((d) => ({ ...d, quickSwitcher: false, downloads: false }));

  }

  function onInputKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length > 0) selectedIdx = (selectedIdx + 1) % filtered.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length > 0) selectedIdx = (selectedIdx - 1 + filtered.length) % filtered.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(filtered[selectedIdx]);
    }
  }
</script>

{#if open}
  <div class="overlay top-aligned" role="presentation">
    <button type="button" class="backdrop-btn" tabindex="-1" aria-label={$t.closeBtn} on:click={close}></button>
    <div class="palette" role="dialog" aria-label={$t.quickSwitchTitle}>
      <div class="search-row">
        <span class="s-icon">{@html uiIcon('search')}</span>
        <input
          bind:this={searchInput}
          bind:value={query}
          on:keydown={onInputKey}
          placeholder={$t.quickSwitchPlaceholder}
        />
        <kbd>Esc</kbd>
      </div>

      <div class="results" role="listbox">
        {#each filtered as svc, i (svc.id)}
          {@const origIdx = $services.findIndex((x) => x.id === svc.id)}
          {@const rt = $guestRuntime[svc.id]}
          <button
            type="button"
            class="item {i === selectedIdx ? 'sel' : ''}"
            role="option"
            aria-selected={i === selectedIdx}
            on:mouseenter={() => (selectedIdx = i)}
            on:click={() => pick(svc)}
          >
            <span class="item-icon">{@html brandIcon(svc.icon_type, svc.custom_color)}</span>
            <span class="item-main">
              <span class="item-name">{svc.name}</span>
              <span class="item-url">{svc.url}</span>
            </span>
            {#if svc.unread}
              <span class="pill-unread">{svc.unread}</span>
            {/if}
            {#if svc.enabled === false}
              <span class="pill-state">{$t.disabledBadge}</span>
            {:else if rt?.hibernated}
              <span class="pill-state sleep">Zz</span>
            {/if}
            {#if origIdx >= 0 && origIdx < 9}
              <kbd>Ctrl+{origIdx + 1}</kbd>
            {/if}
          </button>
        {:else}
          <div class="empty-res">{$t.quickSwitchEmpty}</div>
        {/each}
      </div>

      <div class="footer">{$t.quickSwitchHint}</div>
    </div>
  </div>
{/if}

<style>
  .overlay.top-aligned {
    align-items: flex-start;
    padding-top: 12vh;
  }
  .backdrop-btn {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    padding: 0;
    cursor: default;
  }
  .palette {
    position: relative;
    z-index: 1;
    width: 500px;
    max-width: calc(100vw - 32px);
    background: var(--gx-panel);
    border: 1px solid var(--gx-border);
    border-radius: 12px;
    box-shadow: var(--gx-shadow);
    overflow: hidden;
    animation: popIn 110ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--gx-border);
  }
  .s-icon { display: inline-flex; }
  .s-icon :global(svg) { width: 18px; height: 18px; }
  .search-row input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 2px 0;
    font-size: 14.5px;
  }
  .search-row input:focus { outline: none; }
  .results {
    max-height: 320px;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item {
    width: 100%;
    border: none;
    background: transparent;
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left;
  }
  .item.sel {
    background: var(--gx-active);
  }
  .item-icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: inline-flex;
  }
  .item-icon :global(svg) { width: 28px; height: 28px; }
  .item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .item-name { font-weight: 600; color: var(--gx-text); }
  .item-url {
    font-size: 11.5px;
    color: var(--gx-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pill-unread {
    padding: 1px 7px;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
  }
  .pill-state {
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 11px;
    background: var(--gx-surface);
    color: var(--gx-muted);
  }
  .pill-state.sleep { color: #f59e0b; }
  .empty-res {
    padding: 26px 12px;
    text-align: center;
    color: var(--gx-muted);
  }
  .footer {
    padding: 7px 14px;
    border-top: 1px solid var(--gx-separator);
    font-size: 11.5px;
    color: var(--gx-muted);
    background: var(--gx-surface);
  }
</style>
