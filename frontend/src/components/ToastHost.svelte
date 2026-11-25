<script lang="ts">
  import { toasts, dismissToast } from '../lib/store';
  import { uiIcon } from '../lib/icons';
  import { t } from '../lib/i18n';
</script>

{#if $toasts.length > 0}
  <div class="toast-stack" aria-live="polite">
    {#each $toasts as item (item.id)}
      <div class="toast {item.tone}">
        <span class="toast-text">{item.text}</span>
        <button
          type="button"
          class="toast-x"
          aria-label={$t.closeBtn}
          on:click={() => dismissToast(item.id)}
        >
          {@html uiIcon('close')}
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-stack {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 160;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 380px;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    border-radius: 9px;
    background: var(--gx-panel);
    border: 1px solid var(--gx-border);
    border-left: 3px solid var(--gx-accent);
    box-shadow: var(--gx-shadow);
    color: var(--gx-text);
    font-size: 13px;
    animation: slideUp 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .toast.error { border-left-color: #ef4444; }
  .toast.success { border-left-color: #22c55e; }
  .toast-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .toast-x {
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .toast-x :global(svg) { width: 14px; height: 14px; }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
