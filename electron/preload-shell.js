'use strict';
/* Preload for the Svelte control shell: minimal IPC bridge. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  addService: (s) => ipcRenderer.invoke('services:add', s),
  updateService: (s) => ipcRenderer.invoke('services:update', s),
  deleteService: (id) => ipcRenderer.invoke('services:delete', id),
  reorderServices: (ids) => ipcRenderer.invoke('services:reorder', ids),
  attachWebview: (id) => ipcRenderer.invoke('webview:attach', id),
  detachWebview: (id) => ipcRenderer.invoke('webview:detach', id),
  getOverlaySrc: () => ipcRenderer.invoke('service:overlay-src'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  openMedia: (dir) => ipcRenderer.invoke('media:open', dir),
  saveMedia: (dir) => ipcRenderer.invoke('media:save', dir),
  fetchIcon: (url) => ipcRenderer.invoke('service:fetch-icon', url),
  clearServiceData: (id) => ipcRenderer.invoke('service:clear-data', id),
  openDirDialog: (current) => ipcRenderer.invoke('dialog:open-dir', current),
  setTitle: (title) => ipcRenderer.invoke('shell:set-title', title),
  setActive: (id) => ipcRenderer.invoke('service:set-active', id),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  onEvent: (cb) => {
    const fn = (_e, msg) => cb(msg);
    ipcRenderer.on('artyplexer:event', fn);
    return () => ipcRenderer.removeListener('artyplexer:event', fn);
  },
});
