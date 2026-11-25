<script lang="ts">
  import { onMount } from 'svelte';
  import { services, settings, activeServiceId, guestRuntime, patchGuestRuntime, flash } from '../lib/store';
  import { ensureGuest, removeGuest, hibernateGuest, wakeGuest, hasLiveGuest } from '../lib/guests';
  import { api } from '../lib/api';
  import { t } from '../lib/i18n';

  let visited = new Set<string>();
  let previous: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  // Keep guest DOM order stable when the sidebar order changes.
  $: servicesById = new Map($services.map((service) => [service.id, service]));
  $: mountedServices = [...visited].map((id) => servicesById.get(id)).filter((service) => service !== undefined);
  $: active = $services.find((service) => service.id === $activeServiceId);
  $: runtime = active ? $guestRuntime[active.id] : undefined;
  $: if ($activeServiceId !== previous) {
    if (previous) patchGuestRuntime(previous, { lastActiveAt: Date.now() });
    previous = $activeServiceId;
    if (previous) visited = new Set([...visited, previous]);
  }

  function mountGuest(host: HTMLElement, service: { id: string; url: string }) {
    void ensureGuest(service.id, service.url, host).catch((error: Error) => {
      if (host.isConnected) {
        patchGuestRuntime(service.id, { loading: false });
        flash(error.message, 4500, 'error');
      }
    });
    return {
      destroy() {
        if (host.querySelector('webview')) removeGuest(service.id);
      },
    };
  }

  function checkIdle(): void {
    const cutoff = Date.now() - $settings.hibernate_minutes * 60_000;
    for (const service of $services) {
      const state = $guestRuntime[service.id];
      if (service.id !== $activeServiceId && state && state.lastActiveAt <= cutoff &&
          !state.loading && !state.playingAudio && hasLiveGuest(service.id)) {
        hibernateGuest(service.id);
      }
    }
  }

  onMount(() => {
    const unsubscribe = settings.subscribe(({ auto_hibernate }) => {
      if (auto_hibernate && !timer) timer = setInterval(checkIdle, 5000);
      if (!auto_hibernate && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  });
</script>

<main class="stage">
  {#each mountedServices as service (service.id)}
    {#if service.enabled !== false && !$guestRuntime[service.id]?.hibernated}
      {#key service.url}
        <div class="guesthost" data-service-id={service.id} hidden={service.id !== $activeServiceId} use:mountGuest={service}></div>
      {/key}
    {/if}
  {/each}
  {#if !active}
    <div class="state"><strong>{$t.emptyStageTitle}</strong><p>{$t.emptyStageSubtitle}</p></div>
  {:else if active.enabled === false}
    <div class="state">
      <strong>{$t.disabledStageTitle}</strong><p>{$t.disabledStageSubtitle}</p>
      <button on:click={() => active && api.updateService({ id: active.id, enabled: true }).catch((error) => flash(error.message))}>{$t.enableServiceBtn}</button>
    </div>
  {:else if runtime?.hibernated}
    <div class="state">
      <strong>{$t.hibernatedStageTitle}</strong><p>{$t.hibernatedStageSubtitle}</p>
      <button on:click={() => active && wakeGuest(active.id)}>{$t.wakeServiceBtn}</button>
    </div>
  {:else if runtime?.loading}
    <div class="state loading" role="status"><span class="spinner"></span>{$t.loadingService}</div>
  {/if}
</main>

<style>
  .stage, .guesthost, .guesthost :global(.guest) { flex: 1; display: flex; min-height: 0; min-width: 0; }
  .stage { position: relative; }
  .guesthost[hidden] { display: none; }
  .state { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; text-align: center; color: var(--gx-muted); background: var(--gx-window); padding: 24px; }
  .state p { margin: 0; }
  .loading { z-index: 1; pointer-events: none; }
  .spinner { width: 22px; height: 22px; border: 2px solid var(--gx-border); border-top-color: var(--gx-accent); border-radius: 50%; animation: spin .75s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
