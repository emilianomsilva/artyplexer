/* Artyplexer service overlay (runs in page main world, injected by main
 * via executeJavaScript — bypasses page CSP).
 *
 * Floating button downloads the chat video through main:
 *  - https URL  -> downloadVideo (Chromium will-download pipeline)
 *  - blob URL   -> recover the full file from the page CacheStorage first
 *                  (WhatsApp's lru-media-array-buffer-cache), uploadVideo it;
 *                  fall back to downloadVideo for plain blobs.
 */
(function () {
  if (window.__artyplexerOverlay) return;
  var pt = document.documentElement.dataset.artyplexerLocale === 'pt-BR';
  var labels = pt ? {
    searching: 'Procurando o vídeo no cache da conversa…',
    failed: 'Não foi possível baixar este vídeo. Use a seta de download do app.',
    watch: 'Assistir vídeo',
    title: 'Baixar este vídeo para assistir no Artyplexer'
  } : {
    searching: 'Looking for the video in the conversation cache…',
    failed: 'Could not download this video. Use the download button in the service.',
    watch: 'Watch video',
    title: 'Download this video to watch it in Artyplexer'
  };
  window.__artyplexerOverlay = true;

  function api() { return window.electronService || null; }

  function candidates() {
    var out = [];
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      var src = v.currentSrc || v.src || '';
      if (src && /^(https?:|blob:)/.test(src)) out.push({ el: v, src: src });
    }
    return out;
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error('timeout')); }, ms);
    })]);
  }

  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  async function recoverFromCache() {
    if (!('caches' in window)) return null;
    var keys = await withTimeout(caches.keys(), 5000);
    for (var k = 0; k < keys.length; k++) {
      var cache = await withTimeout(caches.open(keys[k]), 5000);
      var reqs = await withTimeout(cache.keys(), 8000);
      var best = null, scanned = 0;
      for (var r = 0; r < reqs.length && scanned < 400; r++) {
        var url = reqs[r].url || '';
        if (url.indexOf('media') < 0 && url.indexOf('lru') < 0) continue;
        scanned++;
        var resp = await withTimeout(cache.match(reqs[r]), 8000);
        if (!resp) continue;
        var blob = await withTimeout(resp.blob(), 15000);
        if (blob && blob.size > 100000 &&
            (blob.type.indexOf('video') === 0 || /\.mp4($|\?)/.test(url))) {
          if (!best || blob.size > best.blob.size) best = { blob: blob, url: url };
        }
      }
      if (best) return best;
    }
    return null;
  }

  function guessName(url, mime) {
    var ext = '.mp4';
    if (mime && mime.indexOf('image/') === 0) ext = '.png';
    else if (/\.webm($|\?)/.test(url)) ext = '.webm';
    return 'video' + ext;
  }

  async function onClick() {
    var vids = candidates();
    if (!vids.length) return;
    var target = vids[0];
    for (var i = 0; i < vids.length; i++) {
      if (!vids[i].el.paused) { target = vids[i]; break; }
    }
    var a = api();
    if (!a) return;
    var src = target.src;
    try {
      if (/^https?:/.test(src)) {
        a.downloadVideo(src);
        return;
      }
      a.notice(labels.searching);
      try {
        var found = await recoverFromCache();
        if (found) {
          var b64 = await blobToB64(found.blob);
          a.uploadVideo(guessName(found.url, found.blob.type), found.blob.type || 'video/mp4', b64);
          return;
        }
      } catch (e) { /* fall through to direct attempt */ }
      a.downloadVideo(src);
    } catch (e) {
      a.notice(labels.failed);
    }
  }

  var btn = document.createElement('button');
  btn.textContent = '⤓ ' + labels.watch;
  btn.setAttribute('type', 'button');
  btn.hidden = true; /* visibility via property: immune to style CSP */
  btn.style.position = 'fixed';
  btn.style.right = '18px';
  btn.style.bottom = '18px';
  btn.style.zIndex = '2147483647';
  btn.style.padding = '10px 16px';
  btn.style.borderRadius = '20px';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '14px';
  btn.style.fontWeight = 'bold';
  btn.style.color = '#ffffff';
  btn.style.backgroundColor = '#25D366';
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
  btn.title = labels.title;
  btn.addEventListener('click', function () { onClick(); });

  function refresh() {
    var show = candidates().length > 0;
    if (btn.hidden === show) btn.hidden = !show;
  }

  var lastTitle = '';
  function reportTitle() {
    if (!api()) return;
    var t = document.title || '';
    if (t === lastTitle) return;
    lastTitle = t;
    var m = t.match(/\((\d+)\+?\)/);
    api().reportTitle(t, m ? parseInt(m[1], 10) : 0);
  }

  try {
    if (typeof window.Notification !== 'undefined' && !window.__artyplexerNotifHook) {
      window.__artyplexerNotifHook = true;
      var Orig = window.Notification;
      var perm = Orig.permission;
      var Hooked = function (title, opts) {
        try { if (api()) api().notify(String(title), opts && opts.body ? String(opts.body) : ''); } catch (e) {}
        return new Orig(title, opts);
      };
      Hooked.permission = perm;
      Hooked.requestPermission = Orig.requestPermission.bind(Orig);
      window.Notification = Hooked;
    }
  } catch (e) {}

  new MutationObserver(function () { refresh(); reportTitle(); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('play', function () { refresh(); reportTitle(); }, true);

  function mount() {
    var host = document.body || document.documentElement;
    if (host && !btn.parentNode) host.appendChild(btn);
    refresh();
    reportTitle();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  refresh();
})();
