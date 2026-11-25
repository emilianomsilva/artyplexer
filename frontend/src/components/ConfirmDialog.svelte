<script lang="ts">
  import { tick } from 'svelte';
  import { dialogs } from '../lib/store';
  import { t } from '../lib/i18n';

  let cancelButton: HTMLButtonElement;
  $: c = $dialogs.confirm;
  $: if (c) void tick().then(() => cancelButton?.focus());

  function answer(accepted: boolean): void {
    const current = $dialogs.confirm;
    dialogs.update((d) => ({ ...d, confirm: null }));
    if (current) current.resolve(accepted);
  }

  function onKey(e: KeyboardEvent): void {
    if (!$dialogs.confirm) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      answer(false);
    }
  }
</script>

<svelte:window on:keydown={onKey} />

{#if c}
  <div class="overlay confirm-layer" role="presentation">
    <button type="button" class="backdrop-btn" tabindex="-1" aria-label={$t.cancelBtn} on:click={() => answer(false)}></button>
    <div class="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-label={c.title}>
      <h2>{c.title}</h2>
      <p class="msg">{c.message}</p>
      <div class="actions">
        <button type="button" bind:this={cancelButton} on:click={() => answer(false)}>{c.cancelLabel || $t.cancelBtn}</button>
        <button
          type="button"
          class={c.danger ? 'danger' : 'primary'}
          on:click={() => answer(true)}
        >
          {c.confirmLabel || $t.confirmBtn}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-layer { z-index: 140; }
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
  .confirm-dialog {
    position: relative;
    z-index: 1;
    max-width: 440px;
  }
  .msg {
    color: var(--gx-muted);
    white-space: pre-line;
    margin: 8px 0 0;
    line-height: 1.5;
  }
</style>
