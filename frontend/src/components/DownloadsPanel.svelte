<script lang="ts">
  import { settings, media, dialogs, flash } from '../lib/store';
  import type { MediaEntry } from '../lib/electron';
  import { api } from '../lib/api';
  import { t } from '../lib/i18n';
  import { formatExpiry } from '../lib/icons';

  async function openIt(m: MediaEntry): Promise<void> {
    try {
      await api.openMedia(m.directory);
    } catch (e) {
      flash(`${$t.couldNotOpenMsg} ${m.filename}: ${(e as Error).message}`);
    }
  }
  function watch(m: MediaEntry): void {
    if (!m.is_video) return;
    dialogs.update((d) => ({ ...d, video: m }));
  }
  async function save(m: MediaEntry): Promise<void> {
    try {
      const r = await api.saveMedia(m.directory);
      if (r) flash(`${$t.fileSavedIn} ${r.path}`);
    } catch (e) {
      flash(`${$t.failedToSaveMsg} ${m.filename}: ${(e as Error).message}`);
    }
  }
</script>

{#if $dialogs.downloads}
<aside class="dl" aria-label={$t.downloadsHeader}>
  <header><h2>{$t.downloadsHeader}</h2><button aria-label={$t.closeBtn} on:click={() => dialogs.update((d) => ({ ...d, downloads: false }))}>×</button></header>
  {#if !$media.length}
    <div class="empty">{$t.downloadsEmpty}</div>
  {:else}
    <table class="grid">
      <thead><tr><th>{$t.colFile}</th><th>{$t.colService}</th><th>{$t.colExpires}</th><th></th></tr></thead>
      <tbody>
        {#each $media as m (m.directory)}
          <tr>
            <td title={m.filename}>{m.filename}</td>
            <td>{m.service_name}</td>
            <td>{formatExpiry(m.expires_at, $settings.language)}</td>
            <td class="ops">
              {#if m.is_video}
                <button on:click={() => watch(m)} title={$t.watchTitle}>{$t.watchBtn}</button>
                <button on:click={() => openIt(m)} title={$t.openPlayerTitle}>{$t.openPlayerBtn}</button>
              {/if}
              <button on:click={() => save(m)}>{$t.saveBtn}</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="hint">{$t.downloadsHint}</p>
  {/if}
</aside>
{/if}

<style>
  .dl { position: absolute; inset: 0 0 0 auto; z-index: 5; width: min(660px, 100%); overflow: auto; padding: 18px; background: var(--gx-window); border-left: 1px solid var(--gx-border); box-shadow: -10px 0 28px #0003; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h2 { font-size: 17px; }
  .ops { white-space: nowrap; text-align: right; }
  .ops button { margin-left: 6px; }
  .hint { color: var(--gx-muted); font-size: 12.5px; }
</style>
