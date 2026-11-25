'use strict';
/**
 * Artyplexer main process: Electron shell + Rust media backend.
 *
 * - One BrowserWindow per service with isolated session partition
 *   (persist:<id>).
 * - Downloads intercepted via will-download into the Rust temp store
 *   (7-day retention), with auto-preview for overlay-initiated fetches.
 * - Native tray, notifications, dialogs, single instance.
 * - Svelte control UI talks to main over context-bridged IPC.
 */
const { app, BrowserWindow, Tray, Menu, session, Notification, dialog, shell, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { migrateUserData } = require('./migrate-user-data');

const APP_NAME = 'Artyplexer';
app.setName(APP_NAME);
const configHome = app.getPath('appData');
const dataHome = process.platform === 'linux'
  ? process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share')
  : configHome;
const dataOverride = process.env.ARTYPLEXER_DATA_DIR;
const DATA_DIR = dataOverride || path.join(dataHome, 'artyplexer', 'data');
const profileDir = dataOverride
  ? path.join(DATA_DIR, 'electron-profile')
  : path.join(configHome, 'artyplexer', 'electron');
fs.mkdirSync(profileDir, { recursive: true });
app.setPath('userData', profileDir);
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function defaultServices() {
  const mk = (id, name, url, icon_type, custom_color) => ({
    id, name, url, icon_type, custom_color,
    custom_icon_path: '', enabled: true,
    notifications_enabled: true, muted: false, user_agent: DEFAULT_UA,
  });
  return [
    mk('wa_personal', 'WhatsApp (Personal)', 'https://web.whatsapp.com', 'whatsapp', '#25D366'),
    mk('wa_work', 'WhatsApp (Work)', 'https://web.whatsapp.com', 'whatsapp', '#3b82f6'),
    mk('telegram', 'Telegram', 'https://web.telegram.org/a/', 'telegram', '#229ED9'),
  ];
}

function defaultSettings() {
  return {
    minimize_to_tray: true, start_minimized: false, global_dnd: false,
    is_maximized: false, last_active_service_id: '', window_width: 1200,
    window_height: 800, theme_mode: 'system', download_dir: '',
    always_ask_download: false, notify_download_complete: true,
    language: 'en-US', show_navigation_bar: false,
    auto_hibernate: false, hibernate_minutes: 15,
  };
}

const MAIN_I18N = {
  'en-US': {
    unreadTray: (n) => `Artyplexer (${n} unread)`,
    unreadBody: (n, diff) => `${n} unread messages (${diff} new)`,
    saveFileTitle: 'Save file as...',
    dlCompleteTitle: 'Download complete',
    dlSavedIn: (f, dir) => `${f} saved in ${dir}.`,
    dlTempBody: (f) => `${f} available for 7 days.`,
    dlFailedTitle: 'Download failed',
    replaceTitle: 'Replace file',
    replaceDetail: 'A file with this name already exists at the destination. Replace it?',
    replaceBtn: 'Replace',
    cancelBtn: 'Cancel',
    selectDlDir: 'Select Download Directory',
    invalidUrl: 'Please enter a valid URL first.',
    invalidDomain: 'Could not determine the domain from URL.',
    iconFetchFailed: 'Could not fetch an icon from this site. Choose a built-in icon below.',
    trayShowHide: 'Show / Hide Window',
    trayDisableDnd: 'Disable Do Not Disturb',
    trayEnableDnd: 'Enable Do Not Disturb',
    traySettings: 'Settings...',
    trayQuit: 'Quit Artyplexer',
  },
  'pt-BR': {
    unreadTray: (n) => `Artyplexer (${n} não lidas)`,
    unreadBody: (n, diff) => `${n} mensagens não lidas (${diff} novas)`,
    saveFileTitle: 'Salvar arquivo como...',
    dlCompleteTitle: 'Download concluído',
    dlSavedIn: (f, dir) => `${f} foi salvo em ${dir}.`,
    dlTempBody: (f) => `${f} disponível por 7 dias.`,
    dlFailedTitle: 'Falha no download',
    replaceTitle: 'Substituir arquivo',
    replaceDetail: 'Já existe um arquivo com esse nome no destino. Quer substituí-lo?',
    replaceBtn: 'Substituir',
    cancelBtn: 'Cancelar',
    selectDlDir: 'Selecionar pasta de downloads',
    invalidUrl: 'Informe uma URL válida primeiro.',
    invalidDomain: 'Não foi possível identificar o domínio da URL.',
    iconFetchFailed: 'Não foi possível baixar o ícone deste site. Escolha um ícone padrão abaixo.',
    trayShowHide: 'Mostrar / Ocultar janela',
    trayDisableDnd: 'Desativar Não Perturbe',
    trayEnableDnd: 'Ativar Não Perturbe',
    traySettings: 'Configurações...',
    trayQuit: 'Sair do Artyplexer',
  },
};
function tr() {
  const lang = store?.settings?.language;
  return MAIN_I18N[lang] || MAIN_I18N['en-US'];
}

/* ---------------- config ---------------- */
let store = { services: defaultServices(), settings: defaultSettings() };
function loadConfig() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.services)) store.services = data.services;
    store.settings = { ...defaultSettings(), ...(data.settings || {}) };
  } catch {
    saveConfig();
  }
}
function saveConfig() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(store, null, 2));
  } catch (e) { console.error('save config:', e.message); }
}

/* ---------------- Rust media backend (stdio JSON) ---------------- */
class MediaBackend {
  constructor() {
    this.proc = null;
    this.seq = 0;
    this.pending = new Map();
    this.buf = '';
  }
  sidecarPath() {
    const executable = process.platform === 'win32' ? 'artyplexer-media.exe' : 'artyplexer-media';
    const dev = path.join(__dirname, '..', 'rust-helper', 'target', 'release', executable);
    if (fs.existsSync(dev)) return dev;
    // electron-builder extraResources layout
    return path.join(process.resourcesPath, executable);
  }
  start() {
    const bin = this.sidecarPath();
    console.log('[artyplexer-media] spawning', bin);
    this.proc = spawn(bin, [], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, ARTYPLEXER_DATA_DIR: DATA_DIR } });
    this.proc.on('error', (err) => console.error('[artyplexer-media] spawn error:', err.message));
    this.proc.on('exit', (code) => console.error('[artyplexer-media] exited with code', code));
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => this.onData(chunk));
    this.proc.on('exit', (code) => {
      for (const [, p] of this.pending) p.reject(new Error('media backend exited'));
      this.pending.clear();
      this.proc = null;
    });
  }
  onData(chunk) {
    this.buf += chunk;
    let idx;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim();
      this.buf = this.buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg);
      else p.reject(new Error(msg.error || 'backend error'));
    }
  }
  request(op, params = {}) {
    if (!this.proc) return Promise.reject(new Error('media backend not running'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ id, op, ...params }) + '\n');
    });
  }
  stage(f) { return this.request('stage', f); }
  complete(f) { return this.request('complete', f); }
  list() { return this.request('list'); }
  open(dir) { return this.request('open', { dir }); }
  save(dir, target, overwrite = false) { return this.request('save', { dir, target: target || '', overwrite: !!overwrite }); }
  stop() {
    if (!this.proc) return;
    try { this.proc.stdin.write(JSON.stringify({ id: ++this.seq, op: 'shutdown' }) + '\n'); } catch {}
  }
}
const media = new MediaBackend();

/* ---------------- state ---------------- */
const serviceWins = new Map(); // id -> true (attached guests)
const serviceState = new Map(); // id -> {online, unread}
const guestService = new Map(); // guest webContents.id -> service id
const servicePartitions = new WeakMap(); // Session -> service id
const hookedSessions = new Set(); // partitions with will-download hooked
let shellWin = null;
let trayObj = null;
let quitting = false;
let activeServiceId = '';
let OVERLAY_SRC = '';
try {
  OVERLAY_SRC = fs.readFileSync(path.join(__dirname, 'overlay.js'), 'utf8');
} catch (e) { console.error('overlay.js missing:', e.message); }

function emitAll(type, payload) {
  const msg = { type, payload };
  if (shellWin && !shellWin.isDestroyed()) shellWin.webContents.send('artyplexer:event', msg);
}
function servicesSnapshot() {
  return store.services.map((s) => ({ ...s, online: !!serviceState.get(s.id)?.online, unread: serviceState.get(s.id)?.unread || 0 }));
}
async function mediaSnapshot() {
  try {
    const r = await media.list();
    return r.entries || [];
  } catch { return []; }
}
function totalUnread() {
  let n = 0;
  for (const [, st] of serviceState) n += st.unread || 0;
  return n;
}
function refreshTray() {
  if (!trayObj) return;
  const n = totalUnread();
  trayObj.setToolTip(n > 0 ? `Artyplexer (${n} unread)` : 'Artyplexer');
  try {
    const img = drawTrayIcon(n);
    if (!img.isEmpty()) trayObj.setImage(img);
  } catch {}
  rebuildTrayMenu();
}

/* ---------------- windows ---------------- */
function shellPath() {
  return path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
}
function saveWindowState() {
  if (!shellWin || shellWin.isDestroyed()) return;
  try {
    store.settings.is_maximized = shellWin.isMaximized();
    if (!shellWin.isMaximized()) {
      const [w, h] = shellWin.getSize();
      store.settings.window_width = w;
      store.settings.window_height = h;
    }
    saveConfig();
  } catch {}
}

function createShell() {
  const showNow = !store.settings.start_minimized;
  shellWin = new BrowserWindow({
    width: store.settings.window_width || 1200,
    height: store.settings.window_height || 800,
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: showNow,
    webPreferences: {
      preload: path.join(__dirname, 'preload-shell.js'),
      contextIsolation: true,
      sandbox: false,
      webviewTag: true, // service guests embedded in the shell (single window)
    },
  });
  if (store.settings.is_maximized) shellWin.maximize();
  let saveTimer = null;
  const queueSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveWindowState, 800);
  };
  shellWin.on('resize', queueSave);
  shellWin.on('move', queueSave);
  shellWin.on('maximize', () => { store.settings.is_maximized = true; saveConfig(); });
  shellWin.on('unmaximize', () => { store.settings.is_maximized = false; saveConfig(); });
  shellWin.loadFile(shellPath());
  // Map guest webContents -> service for IPC arriving from <webview> guests.
  shellWin.webContents.on('did-attach-webview', (_e, wc) => {
    const sid = servicePartitions.get(wc.session);
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const key = input.key.toLowerCase();
      const modifier = input.control || input.meta;
      const shortcut = input.key === 'F11' || (modifier && !input.alt &&
        (input.shift ? key === 'b' : /^[1-9kjnr,]$/.test(key)));
      if (!shortcut) return;
      event.preventDefault();
      if (!input.isAutoRepeat) {
        emitAll('shell-shortcut', { key: input.key, ctrlKey: input.control, metaKey: input.meta, shiftKey: input.shift });
      }
    });
    if (sid) {
      guestService.set(wc.id, sid);
      hookSession(sid);
      wc.on('page-title-updated', (_event, title) => {
        const count = title.match(/\((\d+)\+?\)/);
        setUnread(sid, count ? Number(count[1]) : 0);
      });
      wc.on('destroyed', () => guestService.delete(wc.id));
    }
  });
  shellWin.on('close', (e) => {
    saveWindowState();
    if (store.settings.minimize_to_tray && !quitting) {
      e.preventDefault();
      shellWin.hide();
    }
  });
  shellWin.on('closed', () => { shellWin = null; });
}

/* ---------------- service guests (<webview> in shell) ---------------- */
// Guests are renderer-owned <webview> tags with isolated partitions
// (persist:artyplexer-<id>) — the Electron equivalent of QWebEngineProfile.
// Main resolves the service from the guest session and hooks downloads per partition.
function serviceSession(id) {
  const partition = session.fromPartition('persist:artyplexer-' + id, { cache: true });
  servicePartitions.set(partition, id);
  return partition;
}

const ALLOWED_PERMISSIONS = new Set([
  'notifications', 'mediaKeySystem', 'fullscreen',
  'clipboard-sanitized-write', 'clipboard-read',
]);

function canUseMedia(id, wc, requestingUrl) {
  const service = store.services.find((entry) => entry.id === id);
  if (!service || service.enabled === false || !wc || wc.isDestroyed()) return false;
  try {
    const configured = new URL(service.url);
    return configured.protocol === 'https:' &&
      new URL(wc.getURL()).origin === configured.origin &&
      new URL(requestingUrl).origin === configured.origin;
  } catch {
    return false;
  }
}

function hookSession(id) {
  const ses = serviceSession(id);
  if (!hookedSessions.has(id)) {
    hookedSessions.add(id);
    ses.setPermissionCheckHandler((wc, permission, origin) =>
      permission === 'media' ? canUseMedia(id, wc, origin) : ALLOWED_PERMISSIONS.has(permission));
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      callback(permission === 'media'
        ? canUseMedia(id, wc, details.requestingUrl)
        : ALLOWED_PERMISSIONS.has(permission));
    });
    attachDownloader(ses, id);
  }
  serviceWins.set(id, true);
  serviceState.set(id, { online: true, unread: serviceState.get(id)?.unread || 0 });
  emitAll('service-status', servicesSnapshot());
}

function guestServiceId(sender) {
  return (sender && guestService.get(sender.id)) || '';
}

function setUnread(id, n) {
  const cur = serviceState.get(id) || { online: true, unread: 0 };
  const prev = cur.unread || 0;
  if (n === prev) return;
  serviceState.set(id, { ...cur, unread: n });
  emitAll('service-status', servicesSnapshot());
  refreshTray();
  // Update notifications: notify on increase (muted/disabled/DND aware).
  const svc = store.services.find((s) => s.id === id);
  if (n > prev && svc && svc.enabled && svc.notifications_enabled && !svc.muted && !store.settings.global_dnd) {
    const diff = n - prev;
    new Notification({ title: svc.name, body: tr().unreadBody(n, diff) }).show();
  }
}

/* ---------------- downloads ---------------- */
// Correlates the next will-download with its trigger (overlay sets the flag).
let nextDownloadMeta = null;

function guessMime(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const map = {
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', webm: 'video/webm',
    ogv: 'video/ogg', ogg: 'video/ogg', mkv: 'video/x-matroska',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function uniqueTarget(target) {
  if (!fs.existsSync(target)) return target;
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const stem = path.basename(target, ext);
  for (let i = 1; ; i++) {
    const cand = path.join(dir, `${stem} (${i})${ext}`);
    if (!fs.existsSync(cand)) return cand;
  }
}

function downloadDir() {
  return process.env.ARTYPLEXER_DOWNLOAD_DIR || store.settings.download_dir || app.getPath('downloads');
}

// Non-media files (documents, chat exports): save straight to the download
// folder (no temp store, no 7-day expiry).
function saveDirect(item, suggested) {
  const pick = async () => {
    if (store.settings.always_ask_download && shellWin) {
      const r = await dialog.showSaveDialog(shellWin, {
        title: tr().saveFileTitle,
        defaultPath: path.join(downloadDir(), suggested),
      });
      if (r.canceled || !r.filePath) { item.cancel(); return; }
      item.setSavePath(r.filePath);
    } else {
      try {
        fs.mkdirSync(downloadDir(), { recursive: true });
      } catch { item.cancel(); return; }
      item.setSavePath(uniqueTarget(path.join(downloadDir(), suggested)));
    }
  };
  pick().then(() => {
    item.once('done', (_e, state) => {
      if (state === 'completed' && store.settings.notify_download_complete && !store.settings.global_dnd) {
        new Notification({ title: tr().dlCompleteTitle, body: tr().dlSavedIn(item.getFilename(), path.dirname(item.getSavePath())) }).show();
      } else if (state !== 'completed' && !store.settings.global_dnd) {
        new Notification({ title: tr().dlFailedTitle, body: `${suggested}: ${item.getInterruptReason?.() || state}` }).show();
      }
    });
  });
}

function attachDownloader(ses, partitionId) {
  ses.on('will-download', (event, item) => {
    const meta = nextDownloadMeta;
    nextDownloadMeta = null;
    const svcId = meta?.serviceId || partitionId || '';
    const svc = store.services.find((s) => s.id === svcId);
    const serviceName = svc ? svc.name : '';
    const suggested = item.getFilename() || 'download';
    let mime = item.getMimeType() || '';
    if (!mime || mime === 'application/octet-stream') {
      mime = guessMime(suggested);
    }
    // Non-media files (documents, chat exports) save directly to the
    // download folder instead of the temporary media store.
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      saveDirect(item, suggested);
      return;
    }
    media.stage({ filename: suggested, service: serviceName, mime }).then((st) => {
      item.setSavePath(st.path);
      item.on('updated', () => {});
      item.once('done', async (_e, state) => {
        if (state !== 'completed') {
          console.error('[artyplexer-media] download not completed:', suggested, state);
          emitAll('media-error', { file: suggested, reason: state });
          if (!store.settings.global_dnd) {
            new Notification({ title: tr().dlFailedTitle, body: `${suggested}: ${state}` }).show();
          }
          return;
        }
        try {
          const done = await media.complete({ dir: st.dir, filename: suggested, service: serviceName, mime });
          const entries = await mediaSnapshot();
          emitAll('media-added', entries);
          if (store.settings.notify_download_complete && !store.settings.global_dnd) {
            new Notification({ title: tr().dlCompleteTitle, body: tr().dlTempBody(done.entry.filename) }).show();
          }
          if (meta?.autoPreview && done.entry.is_video) {
            emitAll('open-preview', { directory: done.entry.directory });
          }
        } catch (err) {
          emitAll('media-error', { file: suggested, reason: String(err.message || err) });
        }
      });
    }).catch((err) => {
      console.error('[artyplexer-media] stage failed:', err && err.message);
      item.cancel();
      emitAll('media-error', { file: suggested, reason: String(err.message || err) });
    });
  });
}

/* ---------------- tray ---------------- */
const { drawTrayIcon } = require('./tray-icon');

function setupTray() {
  trayObj = new Tray(drawTrayIcon(totalUnread()));
  rebuildTrayMenu();
  trayObj.setToolTip('Artyplexer');
  trayObj.on('click', () => toggleShell());
  refreshTray();
}
function rebuildTrayMenu() {
  if (!trayObj) return;
  const total = totalUnread();
  const header = total > 0 ? tr().unreadTray(total) : 'Artyplexer';
  const items = [{ label: header, enabled: false }, { type: 'separator' }];
  for (const svc of store.services) {
    if (svc.enabled === false) continue;
    const st = serviceState.get(svc.id) || {};
    const mark = svc.id === activeServiceId ? '● ' : '';
    const unread = st.unread ? ` (${st.unread})` : '';
    items.push({
      label: `${mark}${svc.name}${unread}`,
      click: () => {
        if (shellWin) { shellWin.show(); shellWin.focus(); }
        emitAll('activate-service', { id: svc.id });
      },
    });
  }
  if (store.services.length) items.push({ type: 'separator' });
  items.push({ label: tr().trayShowHide, click: () => toggleShell() });
  items.push({
    label: store.settings.global_dnd ? tr().trayDisableDnd : tr().trayEnableDnd,
    click: () => {
      store.settings.global_dnd = !store.settings.global_dnd;
      saveConfig();
      rebuildTrayMenu();
      emitAll('settings-changed', store.settings);
    },
  });
  items.push({
    label: tr().traySettings, click: () => {
      if (shellWin) { shellWin.show(); shellWin.focus(); }
      emitAll('open-settings', {});
    },
  });
  items.push({ type: 'separator' });
  items.push({ label: tr().trayQuit, click: () => { quitting = true; app.quit(); } });
  trayObj.setContextMenu(Menu.buildFromTemplate(items));
}
function toggleShell() {
  if (!shellWin || shellWin.isDestroyed()) return;
  if (shellWin.isVisible() && !shellWin.isMinimized() && shellWin.isFocused()) shellWin.hide();
  else {
    shellWin.show();
    shellWin.focus();
  }
}

/* ---------------- IPC (Svelte shell) ---------------- */
function setupIPC() {
  ipcMain.handle('state:get', async () => ({
    services: servicesSnapshot(), settings: store.settings, media: await mediaSnapshot(),
  }));
  ipcMain.handle('settings:save', async (_e, s) => {
    store.settings = {
      ...defaultSettings(),
      ...s,
      last_active_service_id: store.settings.last_active_service_id,
    };
    const minutes = Number(store.settings.hibernate_minutes);
    store.settings.hibernate_minutes = Number.isFinite(minutes) && minutes >= 1
      ? Math.min(1440, Math.floor(minutes))
      : defaultSettings().hibernate_minutes;
    saveWindowState();
    rebuildTrayMenu();
    emitAll('settings-changed', store.settings);
    return store.settings;
  });
  ipcMain.handle('services:add', async (_e, s) => {
    if (!s.id) s.id = 'svc_' + Date.now().toString(36);
    store.services.push({ enabled: true, notifications_enabled: true, muted: false, user_agent: DEFAULT_UA, icon_type: 'generic', custom_color: '#3b82f6', ...s });
    saveConfig();
    rebuildTrayMenu();
    emitAll('services-changed', servicesSnapshot());
    return s;
  });
  ipcMain.handle('services:update', async (_e, s) => {
    const i = store.services.findIndex((x) => x.id === s.id);
    if (i >= 0) { store.services[i] = { ...store.services[i], ...s, id: store.services[i].id }; }
    saveConfig();
    rebuildTrayMenu();
    emitAll('services-changed', servicesSnapshot());
    return s;
  });
  ipcMain.handle('services:delete', async (_e, id) => {
    store.services = store.services.filter((x) => x.id !== id);
    saveConfig();
    try {
      await serviceSession(id).clearStorageData();
    } catch {}
    serviceState.delete(id);
    serviceWins.delete(id);
    rebuildTrayMenu();
    emitAll('services-changed', servicesSnapshot());
    return true;
  });
  ipcMain.handle('services:reorder', async (_e, ids) => {
    if (Array.isArray(ids)) {
      const byId = new Map(store.services.map((s) => [s.id, s]));
      const next = [];
      for (const id of ids) {
        if (byId.has(id)) {
          next.push(byId.get(id));
          byId.delete(id);
        }
      }
      for (const rest of byId.values()) next.push(rest);
      store.services = next;
      saveConfig();
      rebuildTrayMenu();
      emitAll('services-changed', servicesSnapshot());
    }
    return servicesSnapshot();
  });
  ipcMain.handle('webview:attach', async (_e, id) => {
    const ses = serviceSession(id);
    const service = store.services.find((entry) => entry.id === id);
    if (service && URL.canParse(service.url) && new URL(service.url).origin === 'https://web.whatsapp.com') {
      // Match Chrome's reduced UA while keeping the actual Chromium major.
      const ua = app.userAgentFallback
        .replace(/ (?:Artyplexer|Electron)\/\S+/gi, '')
        .replace(/ Chrome\/(\d+)\.\S+/, ' Chrome/$1.0.0.0');
      ses.setUserAgent(ua);
    }
    return { partition: 'persist:artyplexer-' + id, preload: path.join(__dirname, 'preload-service.js') };
  });
  ipcMain.handle('webview:detach', async (_e, id) => {
    serviceState.set(id, { online: false, unread: 0 });
    emitAll('service-status', servicesSnapshot());
    return true;
  });
  ipcMain.handle('service:overlay-src', async () => OVERLAY_SRC);
  ipcMain.handle('shell:open-external', async (_e, url) => {
    await shell.openExternal(url);
    return true;
  });
  ipcMain.on('service:title', (e, { unread }) => setUnread(guestServiceId(e.sender), unread || 0));
  ipcMain.handle('media:open', async (_e, dir) => media.open(dir));
  ipcMain.handle('media:save', async (_e, dir) => {
    const entries = await mediaSnapshot();
    const m = entries.find((x) => x.directory === dir);
    let target = '';
    let overwrite = false;
    if (store.settings.always_ask_download && shellWin) {
      const base = store.settings.download_dir || app.getPath('downloads');
      const r = await dialog.showSaveDialog(shellWin, {
        title: tr().saveFileTitle,
        defaultPath: path.join(base, m ? m.filename : 'download'),
      });
      if (r.canceled || !r.filePath) return null;
      target = r.filePath;
      if (fs.existsSync(target)) {
        const q = await dialog.showMessageBox(shellWin, {
          type: 'question',
          message: tr().replaceTitle,
          detail: tr().replaceDetail,
          buttons: [tr().replaceBtn, tr().cancelBtn],
          defaultId: 1,
          cancelId: 1,
        });
        if (q.response !== 0) return null;
        overwrite = true;
      }
    }
    const r = await media.save(dir, target, overwrite);
    emitAll('media-saved', { path: r.path });
    return r;
  });
  ipcMain.handle('dialog:open-dir', async (_e, current) => {
    if (!shellWin) return null;
    const r = await dialog.showOpenDialog(shellWin, {
      title: tr().selectDlDir,
      defaultPath: current || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory'],
    });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('service:fetch-icon', async (_e, rawUrl) => {
    // Try Google s2 favicons, then /favicon.ico.
    let url = (rawUrl || '').trim();
    if (!url || url === 'https://') throw new Error(tr().invalidUrl);
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let domain = '';
    try { domain = new URL(url).hostname; } catch { throw new Error(tr().invalidDomain); }
    if (!domain) throw new Error(tr().invalidDomain);
    const iconsDir = path.join(DATA_DIR, 'icons');
    fs.mkdirSync(iconsDir, { recursive: true });
    const dest = path.join(iconsDir, `${domain.replace(/:/g, '_')}_${Date.now().toString(36)}.png`);
    const candidates = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      new URL('/favicon.ico', url).toString(),
    ];
    for (const fav of candidates) {
      try {
        const res = await net.fetch(fav, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 100) continue;
        const isPng = buf[0] === 0x89 && buf[1] === 0x50;
        const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
        const isIco = buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01;
        if (!isPng && !isJpeg && !isIco) continue;
        fs.writeFileSync(dest, buf);
        return dest;
      } catch { /* try next */ }
    }
    throw new Error(tr().iconFetchFailed);
  });
  ipcMain.handle('service:clear-data', async (_e, id) => {
    try {
      await serviceSession(id).clearStorageData();
    } catch (err) {
      throw new Error(String((err && err.message) || err));
    }
    return true;
  });
  ipcMain.handle('shell:set-title', async (_e, title) => {
    if (shellWin && !shellWin.isDestroyed()) shellWin.setTitle(title);
    return true;
  });
  ipcMain.handle('service:set-active', async (_e, id) => {
    activeServiceId = id || '';
    if (store.settings.last_active_service_id !== activeServiceId) {
      store.settings.last_active_service_id = activeServiceId;
      saveConfig();
    }
    rebuildTrayMenu();
    return true;
  });
  ipcMain.handle('app:quit', async () => { quitting = true; app.quit(); });
  // Guest <webview> -> main (via preload-service). The sender IS the guest
  // contents, so the service is resolved through the attach map.
  ipcMain.on('service:notify', (e, { title, body }) => {
    const serviceId = guestServiceId(e.sender);
    const svc = store.services.find((s) => s.id === serviceId);
    if (!svc || store.settings.global_dnd || !svc.notifications_enabled || svc.muted) return;
    new Notification({ title: title || svc.name, body: body || '' }).show();
  });
  ipcMain.on('service:download-video', (e, { url }) => {
    const serviceId = guestServiceId(e.sender);
    if (!serviceId) return;
    nextDownloadMeta = { serviceId, autoPreview: true };
    e.sender.downloadURL(url);
  });
  ipcMain.on('service:upload-video', async (e, { filename, mime, dataB64 }) => {
    // Overlay recovered the bytes from the page cache: stage, write, complete.
    const serviceId = guestServiceId(e.sender);
    const svc = store.services.find((s) => s.id === serviceId);
    const serviceName = svc ? svc.name : '';
    try {
      const st = await media.stage({ filename, service: serviceName, mime });
      await fs.promises.writeFile(st.path, Buffer.from(dataB64, 'base64'));
      const done = await media.complete({ dir: st.dir, filename, service: serviceName, mime });
      const entries = await mediaSnapshot();
      emitAll('media-added', entries);
      if (store.settings.notify_download_complete && !store.settings.global_dnd) {
        new Notification({ title: tr().dlCompleteTitle, body: tr().dlTempBody(done.entry.filename) }).show();
      }
      if (done.entry.is_video) emitAll('open-preview', { directory: done.entry.directory });
    } catch (err) {
      emitAll('media-error', { file: filename, reason: String((err && err.message) || err) });
    }
  });
  ipcMain.on('service:notice', (_e, { text }) => {
    if (shellWin && !shellWin.isDestroyed()) shellWin.webContents.send('artyplexer:event', { type: 'media-notice', payload: { text } });
    // Also surface as tray tooltip flash? Keep to shell feedback.
  });
}

/* ---------------- media:// protocol (preview <video>/<img>) ---------------- */
function setupMediaProtocol() {
  protocol.handle('media', async (req) => {
    try {
      const u = new URL(req.url);
      const uuid = u.hostname;
      const file = decodeURIComponent(u.pathname.replace(/^\//, ''));
      const p = path.join(DATA_DIR, 'media-downloads', uuid, 'file', path.basename(file));
      const st = fs.statSync(p);
      if (!st.isFile()) return new Response('expired', { status: 410 });
      return net.fetch('file://' + p);
    } catch {
      return new Response('expired', { status: 410 });
    }
  });
}

/* ---------------- smoke test (CI/dev): --smoke ----------------
 * Exercises the single-window model: attach a <webview> guest in the
 * shell, inject the overlay, run a download through the guest session
 * (will-download -> Rust store), then write smoke.json to the isolated data directory.
 */
async function runSmokeTest() {
  const { webContents } = require('electron');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const result = { ok: false, steps: [] };
  const done = (code) => {
    try { fs.writeFileSync(path.join(DATA_DIR, 'smoke.json'), JSON.stringify(result, null, 2)); } catch {}
    quitting = true;
    process.exitCode = code;
    app.quit();
  };
  const step = (name, ok, extra = {}) => result.steps.push({ name, ok, ...extra });
  try {
    if (!store.services.find((s) => s.id === 'smoke')) {
      store.services.push({
        id: 'smoke', name: 'Smoke', url: 'about:blank', icon_type: 'generic',
        custom_color: '#888888', enabled: true, notifications_enabled: false,
        muted: true, user_agent: DEFAULT_UA,
      });
    }
    serviceSession('smoke');
    await shellWin.webContents.executeJavaScript(`(() => {
      const wv = document.createElement('webview');
      wv.setAttribute('partition', 'persist:artyplexer-smoke');
      wv.setAttribute('src', 'data:text/html,<html><body><h1>smoke</h1></body></html>');
      wv.style.cssText = 'width:10px;height:10px;position:fixed;left:-100px;top:-100px;';
      document.body.appendChild(wv);
      return 'attached';
    })()`);
    let guestId = null;
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      const hit = [...guestService.entries()].find(([, v]) => v === 'smoke');
      if (hit) { guestId = hit[0]; break; }
    }
    step('webview-attach', !!guestId);
    if (!guestId) return done(1);
    const wc = webContents.fromId(guestId);
    await wc.executeJavaScript(OVERLAY_SRC);
    const hasOverlay = await wc.executeJavaScript('window.__artyplexerOverlay ? "yes" : "no"');
    step('overlay-inject', hasOverlay === 'yes', { hasOverlay });
    nextDownloadMeta = { serviceId: 'smoke', autoPreview: true };
    wc.downloadURL('data:video/mp4;base64,QUJDRA==');
    await sleep(4000);
    const entries = await mediaSnapshot();
    step('guest-download', entries.some((e) => e.service_name === 'Smoke'), { entries: entries.length });
    // Non-media downloads go straight to the download folder (no temp store).
    nextDownloadMeta = null;
    wc.downloadURL('data:text/plain;base64,aGVsbG8=');
    await sleep(4000);
    let directHit = false;
    try {
      const dlDir = process.env.ARTYPLEXER_DOWNLOAD_DIR || '';
      const files = fs.readdirSync(dlDir);
      directHit = files.some((f) => f.startsWith('download'));
    } catch {}
    step('direct-download', directHit, {});
    step('shell-alive', !!(shellWin && !shellWin.isDestroyed()));
    result.ok = result.steps.every((s) => s.ok);
  } catch (err) {
    step('exception', false, { error: String((err && err.message) || err) });
  }
  done(result.ok ? 0 : 1);
}
protocol.registerSchemesAsPrivileged([{
  scheme: 'media',
  privileges: { standard: true, secure: true, supportFetchStreams: true, corsEnabled: true },
}]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  if (!dataOverride) {
    try {
      migrateUserData({
        dataDir: DATA_DIR,
        profileDir,
        oldDataDir: path.join(dataHome, 'ironplexer'),
        oldProfileDir: path.join(configHome, 'ironplexer'),
      });
    } catch (error) {
      console.error('Could not migrate Artyplexer user data:', error.message);
      app.exit(1);
    }
  }
  app.on('second-instance', () => {
    if (shellWin) { shellWin.isVisible() ? shellWin.focus() : shellWin.show(); }
  });
  app.whenReady().then(async () => {
    loadConfig();
    media.start();
    setupIPC();
    setupTray();
    setupMediaProtocol();
    createShell();
    if (process.argv.includes('--smoke')) runSmokeTest();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createShell();
      else if (shellWin) shellWin.show();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Keep running in tray like the Qt app (minimize_to_tray semantics).
      if (!store.settings.minimize_to_tray) app.quit();
    }
  });
  app.on('before-quit', () => {
    quitting = true;
    try { media.stop(); } catch {}
  });
}
