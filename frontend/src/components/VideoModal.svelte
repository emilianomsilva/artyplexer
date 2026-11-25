<script lang="ts">
  import { dialogs, flash } from '../lib/store';
  import { t } from '../lib/i18n';
  import { api } from '../lib/api';

  $: v = $dialogs.video;
  $: src = v ? api.mediaUrl(v.directory, v.filename) : '';

  function close(): void {
    dialogs.update((d) => ({ ...d, video: null }));
  }
  async function openExternal(): Promise<void> {
    try {
      if (v) await api.openMedia(v.directory);
    } catch (e) {
      flash((e as Error).message);
    }
  }
  async function saveCopy(): Promise<void> {
    try {
      if (!v) return;
      const r = await api.saveMedia(v.directory);
      if (r) flash(`${$t.fileSavedIn} ${r.path}`);
    } catch (e) {
      flash((e as Error).message);
    }
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if v}
  <div class="overlay" on:click={(event) => { if (event.target === event.currentTarget) close(); }} role="presentation">
    <div class="dialog wide" role="dialog" aria-label={v.filename}>
      <h2>{v.filename}</h2>
      {#if v.mime_type && v.mime_type.startsWith('image/')}
        <img {src} alt={v.filename} />
      {:else}
        <!-- svelte-ignore a11y-media-has-caption -->
        <video {src} controls autoplay playsinline></video>
      {/if}
      <div class="actions">
        <button on:click={openExternal}>{$t.openPlayerBtn}</button>
        <button on:click={saveCopy}>{$t.saveAsBtn}</button>
        <button class="primary" on:click={close}>{$t.closeBtn}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog.wide { max-width: 760px; }
  video, img { width: 100%; max-height: 60vh; border-radius: 8px; background: #000; }
</style>
