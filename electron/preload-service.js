'use strict';
/* Thin preload for service windows: exposes the native bridge and stamps
 * the service id on <html> for the overlay injected by main.
 * (Uses only contextBridge — immune to page CSP.)
 */
const { contextBridge, ipcRenderer } = require('electron');

let serviceId = '';
try {
  for (const arg of process.argv) {
    if (arg.startsWith('--artyplexer-service=')) serviceId = arg.slice('--artyplexer-service='.length);
  }
} catch { /* ignore */ }

try {
  document.documentElement.setAttribute('data-artyplexer-service', serviceId);
} catch { /* document not ready yet; overlay reads it lazily */ }

contextBridge.exposeInMainWorld('electronService', {
  serviceId,
  downloadVideo: (url) => ipcRenderer.send('service:download-video', { serviceId, url }),
  uploadVideo: (filename, mime, dataB64) =>
    ipcRenderer.send('service:upload-video', { serviceId, filename, mime, dataB64 }),
  notice: (text) => ipcRenderer.send('service:notice', { text }),
  reportTitle: (title, unread) => ipcRenderer.send('service:title', { serviceId, title, unread }),
  notify: (title, body) => ipcRenderer.send('service:notify', { serviceId, title, body }),
});
