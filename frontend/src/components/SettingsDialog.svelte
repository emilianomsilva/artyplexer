<script lang="ts">
  import { services, settings, dialogs, flash, DEFAULT_SETTINGS, askConfirm } from '../lib/store';
  import type { AppSettings, ServiceConfig } from '../lib/electron';
  import { t, LOCALES } from '../lib/i18n';
  import { reloadGuest } from '../lib/guests';
  import { api } from '../lib/api';

  let tab: 'general' | 'downloads' | 'services' | 'about' = 'general';
  let form: AppSettings = { ...DEFAULT_SETTINGS };
  let selectedId: string | null = null;
  let dialogWasOpen = false;

  // Snapshot settings into a LOCAL form on open (never re-derived while
  // editing, so checkbox bindings can't be clobbered by reactive updates).
  $: {
    const open = $dialogs.settings;
    if (open && !dialogWasOpen) {
      dialogWasOpen = true;
      tab = 'general';
      form = { ...$settings };
    } else if (!open && dialogWasOpen) {
      dialogWasOpen = false;
    }
  }
  $: serviceList = $services;

  function defaultDir(): string {
    return form.download_dir || $t.systemDefaultFolder;
  }

  async function browse(): Promise<void> {
    try {
      const chosen = await api.openDirDialog(form.download_dir || '');
      if (chosen) form = { ...form, download_dir: chosen };
    } catch (e) {
      flash((e as Error).message);
    }
  }
  function resetDir(): void {
    form = { ...form, download_dir: '' };
  }
  async function save(): Promise<void> {
    try {
      await api.saveSettings(form);
      dialogs.update((d) => ({ ...d, settings: false }));
      flash($t.settingsSavedMsg);
    } catch (e) {
      flash((e as Error).message);
    }
  }
  function close(): void {
    dialogs.update((d) => ({ ...d, settings: false }));
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && $dialogs.settings && !$dialogs.confirm && !e.defaultPrevented) close();
  }
  function selectedService(): ServiceConfig | undefined {
    return serviceList.find((s) => s.id === selectedId);
  }
  async function clearCache(): Promise<void> {
    const svc = selectedService();
    if (!svc) return;
    if (!await askConfirm({
      title: $t.clearSessionConfirmTitle,
      message: $t.clearSessionConfirmMsg.replace('{name}', svc.name),
      confirmLabel: $t.clearSessionBtn,
      cancelLabel: $t.cancelBtn,
      danger: true,
    })) return;
    try {
      await api.clearServiceData(svc.id);
      reloadGuest(svc.id);
      flash($t.sessionClearedMsg);
    } catch (e) {
      flash((e as Error).message);
    }
  }
  async function deleteSelected(): Promise<void> {
    const svc = selectedService();
    if (!svc) return;
    if (!await askConfirm({
      title: $t.deleteServiceConfirmTitle,
      message: $t.deleteServiceConfirmMsg.replace('{name}', svc.name),
      confirmLabel: $t.deleteServiceBtn,
      cancelLabel: $t.cancelBtn,
      danger: true,
    })) return;
    try {
      await api.deleteService(svc.id);
      selectedId = null;
    } catch (e) {
      flash((e as Error).message);
    }
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $dialogs.settings}
  <div class="overlay" on:click={(event) => { if (event.target === event.currentTarget) close(); }} role="presentation">
    <div class="dialog wide" role="dialog" aria-label={$t.settingsHeader}>
      <h2>{$t.settingsHeader}</h2>
      <div class="tabs" role="tablist">
        <button class:active={tab === 'general'} on:click={() => (tab = 'general')}>{$t.tabGeneral}</button>
        <button class:active={tab === 'downloads'} on:click={() => (tab = 'downloads')}>{$t.tabDownloads}</button>
        <button class:active={tab === 'services'} on:click={() => (tab = 'services')}>{$t.tabServices}</button>
        <button class:active={tab === 'about'} on:click={() => (tab = 'about')}>{$t.tabAbout}</button>
      </div>

      {#if tab === 'general'}
        <label class="switch-row">{$t.minimizeToTray}<input type="checkbox" class="toggle" role="switch" bind:checked={form.minimize_to_tray} /></label>
        <label class="switch-row">{$t.startMinimized}<input type="checkbox" class="toggle" role="switch" bind:checked={form.start_minimized} /></label>
        <label class="switch-row">{$t.globalDnd}<input type="checkbox" class="toggle" role="switch" bind:checked={form.global_dnd} /></label>
        <div class="field">{$t.appearanceLabel}</div>
        <select bind:value={form.theme_mode}>
          <option value="system">{$t.themeSystem}</option>
          <option value="light">{$t.themeLight}</option>
          <option value="dark">{$t.themeDark}</option>
        </select>
        <label class="switch-row">{$t.showNavBar}<input type="checkbox" class="toggle" role="switch" bind:checked={form.show_navigation_bar} /></label>
        <label class="switch-row">{$t.autoHibernate}<input type="checkbox" class="toggle" role="switch" bind:checked={form.auto_hibernate} /></label>
        {#if form.auto_hibernate}
          <label class="switch-row">{$t.hibernateAfterLabel}
            <span><input type="number" min="1" max="1440" bind:value={form.hibernate_minutes} /> {$t.hibernateMinutesUnit}</span>
          </label>
        {/if}
        <label class="switch-row">{$t.languageLabel}
          <select bind:value={form.language}>
            {#each LOCALES as locale}<option value={locale.code}>{locale.label}</option>{/each}
          </select>
        </label>
      {:else if tab === 'downloads'}
        <div class="field">{$t.downloadLocationLabel}</div>
        <div class="pathrow">
          <input value={form.download_dir || defaultDir()} readonly />
          <button on:click={browse}>{$t.browseBtn}</button>
          <button on:click={resetDir} title={$t.resetFolderTitle}>{$t.resetBtn}</button>
        </div>
        <label class="switch-row">{$t.alwaysAskDownload}<input type="checkbox" class="toggle" role="switch" bind:checked={form.always_ask_download} /></label>
        <label class="switch-row">{$t.notifyDownloadComplete}<input type="checkbox" class="toggle" role="switch" bind:checked={form.notify_download_complete} /></label>
      {:else if tab === 'services'}
        <div class="field">{$t.configuredServicesLabel}</div>
        <div class="svclist">
          {#each serviceList as svc (svc.id)}
            <div class="svcrow {selectedId === svc.id ? 'sel' : ''}" on:click={() => (selectedId = svc.id)} role="option" aria-selected={selectedId === svc.id} tabindex="0" on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedId = svc.id; } }}>{svc.name} ({svc.url})</div>
          {/each}
          {#if !serviceList.length}<div class="empty">{$t.noServicesConfigured}</div>{/if}
        </div>
        <div class="actions left">
          <button on:click={clearCache}>{$t.clearSessionBtn}</button>
          <button class="danger" on:click={deleteSelected}>{$t.deleteServiceBtn}</button>
        </div>
      {:else}
        <div class="abouttitle">Artyplexer v0.1.0</div>
        <p class="about">{$t.aboutSubtitle}</p>
        <ul class="about"><li>{$t.aboutBullet1}</li><li>{$t.aboutBullet2}</li><li>{$t.aboutBullet3}</li></ul>
      {/if}

      <div class="actions">
        <button on:click={close}>{$t.cancelBtn}</button>
        <button class="save" on:click={save}>{$t.saveSettingsBtn}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  input[type="number"] { width: 5em; }
  .dialog.wide { min-width: 520px; max-width: 600px; }
  .dialog .save {
    background-color: #2563eb;
    border: none;
    color: #ffffff;
    font-weight: bold;
    padding: 8px 18px;
  }
  .dialog .save:hover { background-color: #1d4ed8; }
  .tabs { display: flex; gap: 2px; margin-bottom: 14px; }
  .tabs button {
    background: var(--gx-surface);
    color: var(--gx-muted);
    border: none;
    border-radius: 6px 6px 0 0;
    padding: 10px 18px;
    font-weight: 500;
  }
  .tabs button.active {
    background: var(--gx-window);
    color: var(--gx-accent);
    font-weight: bold;
  }
  .field { margin: 10px 0 6px; }
  .pathrow { display: flex; gap: 8px; }
  .pathrow input { flex: 1; }
  .svclist {
    background: var(--gx-surface);
    border: 1px solid var(--gx-border);
    border-radius: 6px;
    padding: 4px;
    max-height: 200px;
    overflow: auto;
  }
  .svcrow { padding: 8px; border-bottom: 1px solid var(--gx-separator); cursor: pointer; }
  .svcrow:last-child { border-bottom: none; }
  .svcrow.sel { background: var(--gx-selection); color: var(--gx-selection_text); }
  .actions.left { justify-content: flex-start; }
  .danger { color: #ef4444; border-color: #ef4444; }
  .abouttitle { font-size: 16px; font-weight: bold; color: var(--gx-accent); }
  .about { color: var(--gx-muted); font-size: 13px; line-height: 1.5; }
</style>
