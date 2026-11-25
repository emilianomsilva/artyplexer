<script lang="ts">
  import { dialogs, flash, askConfirm } from '../lib/store';
  import type { ServiceConfig } from '../lib/electron';
  import { t } from '../lib/i18n';
  import { api } from '../lib/api';
  import { brandIcon } from '../lib/icons';

  interface Preset { name: string; url: string; icon_type: string; color: string }
  const PRESETS: Preset[] = [
    { name: 'WhatsApp', url: 'https://web.whatsapp.com', icon_type: 'whatsapp', color: '#25D366' },
    { name: 'Telegram', url: 'https://web.telegram.org/a/', icon_type: 'telegram', color: '#229ED9' },
    { name: 'Discord', url: 'https://discord.com/app', icon_type: 'discord', color: '#5865F2' },
    { name: 'Slack', url: 'https://app.slack.com/client/', icon_type: 'slack', color: '#4A154B' },
    { name: 'YouTube', url: 'https://www.youtube.com', icon_type: 'youtube', color: '#FF0033' },
    { name: 'YouTube Music', url: 'https://music.youtube.com', icon_type: 'youtube', color: '#FF0033' },
    { name: 'AppFlowy', url: 'https://appflowy.com', icon_type: 'appflowy', color: '#8B5CF6' },
    { name: 'Custom', url: 'https://', icon_type: 'generic', color: '#3b82f6' },
  ];
  const ICON_TYPES: Array<[string, string]> = [
    ['WhatsApp', 'whatsapp'], ['Telegram', 'telegram'], ['Discord', 'discord'],
    ['Slack', 'slack'], ['YouTube', 'youtube'], ['Spotify', 'spotify'], ['AppFlowy', 'appflowy'],
    ['Generic / Browser', 'generic'],
  ];
  const SWATCHES: Array<[string, string]> = [
    ['#25D366', 'WhatsApp Green'], ['#1DB954', 'Spotify Green'], ['#229ED9', 'Telegram Blue'],
    ['#5865F2', 'Discord Blurple'], ['#f97316', 'Orange'], ['#8b5cf6', 'Purple'],
    ['#06b6d4', 'Teal'], ['#eab308', 'Yellow'], ['#64748b', 'Slate'],
  ];
  const UNSUPPORTED = ['spotify.com', 'netflix.com', 'twitch.tv', 'primevideo.com', 'disneyplus.com', 'hbomax.com', 'max.com'];

  type DialogState = { mode: 'add' } | { mode: 'edit'; service: ServiceConfig };

  $: d = $dialogs.service as DialogState | null;
  let name = '';
  let url = 'https://';
  let icon_type = 'generic';
  let color = '#25D366';
  let notif = true;
  let presetIdx = 0;
  let customIcon: string | null = null;
  let fetching = false;
  let openedKey: string | null = null;

  // Snapshot dialog inputs once per open (add or edit:<id>) so reactive
  // updates never clobber user edits (text inputs, color, or checkboxes).
  $: {
    const nextKey = d ? (d.mode === 'edit' ? `edit:${d.service.id}` : 'add') : null;
    if (nextKey !== openedKey) {
      openedKey = nextKey;
      if (d?.mode === 'edit') {
        name = d.service.name;
        url = d.service.url;
        icon_type = d.service.icon_type || 'generic';
        color = d.service.custom_color || '#25D366';
        notif = d.service.notifications_enabled !== false;
        customIcon = d.service.custom_icon_path || null;
      } else if (d?.mode === 'add') {
        notif = true;
        applyPreset(0);
      }
    }
  }

  function applyPreset(i: number): void {
    presetIdx = i;
    const p = PRESETS[i];
    if (!p) return;
    name = p.name;
    url = p.url;
    icon_type = p.icon_type;
    color = p.color;
    customIcon = null;
  }

  async function fetchIcon(): Promise<void> {
    if (!url.trim() || url.trim() === 'https://') {
      flash($t.enterValidUrlMsg);
      return;
    }
    fetching = true;
    try {
      customIcon = await api.fetchIcon(url.trim());
      flash($t.iconCopiedMsg);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      fetching = false;
    }
  }

  function pickCustom(e: Event): void {
    const t = e.target;
    if (t instanceof HTMLInputElement) color = t.value;
  }

  async function save(): Promise<void> {
    const n = name.trim();
    const u = url.trim();
    if (!n || !u) {
      flash($t.nameAndUrlRequiredMsg);
      return;
    }
    let host: string;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error();
      host = parsed.hostname;
    } catch {
      flash($t.enterValidUrlMsg);
      return;
    }
    if (UNSUPPORTED.some((dom) => host === dom || host.endsWith(`.${dom}`))) {
      if (!await askConfirm({
        title: $t.drmWarningTitle,
        message: $t.drmWarningMsg,
        confirmLabel: $t.addAnywayBtn,
        cancelLabel: $t.cancelBtn,
      })) return;
    }
    try {
      if (d?.mode === 'edit') {
        await api.updateService({ id: d.service.id, name: n, url: u, icon_type, custom_color: color, custom_icon_path: customIcon ?? '', notifications_enabled: notif });
      } else {
        await api.addService({ id: `${icon_type}_${Date.now().toString(36)}`, name: n, url: u, icon_type, custom_color: color, custom_icon_path: customIcon ?? '', notifications_enabled: notif });
      }
      close();
    } catch (e) {
      flash((e as Error).message);
    }
  }
  function close(): void {
    customIcon = null;
    dialogs.update((x) => ({ ...x, service: null }));
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && d && !$dialogs.confirm && !e.defaultPrevented) close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if d}
  <div class="overlay" on:click={(event) => { if (event.target === event.currentTarget) close(); }} role="presentation">
    <div class="dialog" role="dialog" aria-label={d.mode === 'add' ? $t.addServiceHeader : $t.editServiceHeader}>
      <h2>{d.mode === 'add' ? $t.addServiceHeader : $t.editServiceHeader}</h2>

      {#if d.mode === 'add'}
        <div class="field">{$t.presetLabel}</div>
        <select bind:value={presetIdx} on:change={() => applyPreset(presetIdx)}>
          {#each PRESETS as p, i}<option value={i}>{p.name}</option>{/each}
        </select>
      {/if}

      <div class="field">{$t.serviceNameLabel}</div>
      <input bind:value={name} placeholder={$t.serviceNamePlaceholder} />

      <div class="field">{$t.serviceUrlLabel}</div>
      <div class="urlrow">
        <input bind:value={url} placeholder="https://…" />
        <button on:click={fetchIcon} disabled={fetching} title={$t.fetchIconTitle}>
          {fetching ? '…' : $t.fetchIconBtn}
        </button>
      </div>

      <div class="field">{$t.iconTypeAndColorLabel}</div>
      <div class="iconrow">
        <select bind:value={icon_type}>
          {#each ICON_TYPES as [label, val]}<option value={val}>{label}</option>{/each}
        </select>
        <span class="preview" title="Preview">{@html brandIcon(icon_type, color)}</span>
        {#if customIcon}<span class="fav" title={customIcon}><img src={`file://${customIcon}`} alt="" /></span>{/if}
      </div>

      <div class="field">{$t.iconColorHint}</div>
      <div class="swatches">
        {#each SWATCHES as [hex, tip]}<button class="sw {color.toLowerCase() === hex.toLowerCase() ? 'sel' : ''}" style={`background:${hex}`} title={tip} on:click={() => (color = hex)} aria-label={tip}></button>{/each}
        <label class="customcolor">{$t.customColorLabel} <input type="color" value={color} on:input={pickCustom} /></label>
      </div>

      <label class="row"><input type="checkbox" bind:checked={notif} /> {$t.enableServiceNotif}</label>

      <div class="actions">
        <span style="flex:1"></span>
        <button on:click={close}>{$t.cancelBtn}</button>
        <button class="primary" on:click={save}>{$t.saveServiceBtn}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog { min-width: 440px; max-width: 520px; }
  .field { margin: 12px 0 6px; }
  input:not([type='checkbox']):not([type='color']), select { width: 100%; }
  .urlrow { display: flex; gap: 8px; }
  .urlrow input { flex: 1; }
  .iconrow { display: flex; gap: 12px; align-items: center; }
  .iconrow select { flex: 1; }
  .preview, .fav { width: 36px; height: 36px; display: inline-flex; }
  .preview :global(svg), .fav img { width: 36px; height: 36px; }
  .swatches { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .sw { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; padding: 0; cursor: pointer; }
  .sw.sel { border-color: var(--gx-text); }
  .customcolor { display: flex; gap: 6px; align-items: center; cursor: pointer; }
</style>
