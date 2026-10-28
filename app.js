/*!
 * AI Virtual Office 3D — Frontend PWA (vanilla JS + Three.js r128, MIT)
 * Berjalan di GitHub Pages (fetch → Web App GAS) maupun di dalam GAS (google.script.run).
 * Tidak ada API key di frontend: semua AI & tool dieksekusi di backend.
 */
(function () {
  'use strict';
  var VERSION = '1.1.0';
  var BUILD_DATE = '2026-10-28';
  var LEGAL_V = { terms: '2026.10', privacy: '2026.10', effective: '2026-10-28' };
  var DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbyN6Dbkg8jldepFbJ9WTZqznskpyW5-mC7CVRPDIwUJfKnfqMoH_V4bgTX7uMf5w-_X/exec'; // opsional: isi URL Web App (…/exec) saat build untuk klien
  var IS_GAS = !!(window.google && google.script && google.script.run);

  // ---------------- util ----------------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function fmtDate(iso, withTime) { if (!iso) return '—'; var d = new Date(iso); if (isNaN(d)) return esc(iso); return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + (withTime === false ? '' : ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })); }
  function ago(iso) { if (!iso) return ''; var s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' mnt lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; return Math.floor(s / 86400) + ' hari lalu'; }
  function usd(n) { n = Number(n || 0); return '$' + (n < 0.01 && n > 0 ? n.toFixed(5) : n.toFixed(n < 10 ? 4 : 2)); }
  function initials(n) { return String(n || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function can(p) { return S.me && S.me.permissions.indexOf(p) >= 0; }

  var LABEL = {
    draft: 'Draf', pending_approval: 'Menunggu persetujuan', queued: 'Antre', running: 'Berjalan', waiting_dependency: 'Menunggu dependensi', waiting_human: 'Menunggu manusia',
    retrying: 'Mencoba ulang', completed: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan', needs_clarification: 'Perlu klarifikasi', pending: 'Menunggu', approved: 'Disetujui',
    rejected: 'Ditolak', expired: 'Kedaluwarsa', working: 'Bekerja', waiting: 'Menunggu', error: 'Error', idle: 'Siaga', inactive: 'Nonaktif', active: 'Aktif', suspended: 'Ditangguhkan'
  };
  function chip(st, text) { return '<span class="chip s-' + esc(st) + '">' + esc(text || LABEL[st] || st) + '</span>'; }
  var STATE_COLOR = { working: 0x0e9f6e, queued: 0x1f5eff, waiting: 0xc27803, error: 0xd92d20, idle: 0x94a3b8, inactive: 0x475569 };

  var IC = {
    office: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/>', dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    flow: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h5a4 4 0 0 1 4 4v5M6 9v9"/>', tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>', check: '<path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>', coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M9 12h6M12 9v6"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', plus: '<path d="M12 5v14M5 12h14"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', zin: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    cube: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5"/>', dl: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    play: '<path d="M6 4l14 8-14 8z"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>', more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  function ico(n, size) { return '<svg class="ico" viewBox="0 0 24 24"' + (size ? ' style="width:' + size + 'px;height:' + size + 'px"' : '') + '>' + (IC[n] || '') + '</svg>'; }
  var DEFAULT_LOGO = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6fed"/><stop offset="1" stop-color="#0b1730"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><path d="M14 46V26l18-10 18 10v20" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><rect x="26" y="32" width="12" height="14" rx="2" fill="#7fb0ff"/><circle cx="32" cy="25" r="3" fill="#fff"/></svg>');

  // ---------------- storage ----------------
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('avo_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('avo_' + k, JSON.stringify(v)); } catch (e) { /* kuota penuh / mode privat */ } },
    del: function (k) { try { localStorage.removeItem('avo_' + k); } catch (e) { } }
  };

  // ---------------- state ----------------
  var S = { token: null, me: null, seq: 0, statuses: {}, unread: 0, pending: 0, online: navigator.onLine, events: [], cache: {}, view: '', office: null, pollTimer: null, employees: [] };

  // ---------------- transport API ----------------
  function apiUrl() { return store.get('api_url', '') || DEFAULT_API_URL; }
  function cacheKey(path, query) { return 'c:' + path + '?' + JSON.stringify(query || {}); }
  var OUTBOX_OK = ['POST /tasks', 'POST /notifications/read'];

  function userKey() { return S.me ? S.me.user.id + '@' + S.me.org.id : ''; }
  function cacheGet(path, query) { var e = store.get(cacheKey(path, query)); return e && e.t && e.u === userKey() ? e : null; }
  function cachePut(path, query, data) { var s = JSON.stringify(data); if (s.length < 400000) store.set(cacheKey(path, query), { t: Date.now(), u: userKey(), d: data }); }
  function clearDataCache() { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('avo_c:') === 0) localStorage.removeItem(k); }); } catch (e) { } }
  var inflight = {};
  /** Stale-while-revalidate: tampilkan data tersimpan seketika, segarkan di latar belakang. */
  function revalidate(req, path, opts, ent) {
    var k = cacheKey(path, opts.query); if (inflight[k]) return; inflight[k] = 1;
    var view = S.view;
    send(req).then(function (res) {
      if (!res || !res.ok) { if (res && res.error && res.error.code === 'UNAUTHENTICATED') logoutLocal(); if (res && res.error && res.error.code === 'LEGAL_REQUIRED') showLegalGate(); return; }
      cachePut(path, opts.query, res.data);
      if (JSON.stringify(res.data) !== JSON.stringify(ent.d) && view === S.view) softRefresh();
    }).catch(function () { }).then(function () { delete inflight[k]; });
  }
  function api(method, path, body, opts) {
    opts = opts || {};
    var req = { method: method, path: '/api/v1' + path, body: body || {}, query: opts.query || {}, token: S.token, idempotency_key: opts.idem || '', ua: navigator.userAgent.slice(0, 150) };
    if (method === 'GET' && !opts.noCache && S.token && (S.online || IS_GAS)) {
      var ent = cacheGet(path, opts.query);
      if (ent) { if (Date.now() - ent.t > 4000) revalidate(req, path, opts, ent); return Promise.resolve(ent.d); }
    }
    if (!S.online && !IS_GAS) {
      if (method === 'GET') {
        var c = cacheGet(path, opts.query);
        if (c) return Promise.resolve(c.d);
        return Promise.reject(Object.assign(new Error('Offline: data belum tersimpan di perangkat.'), { code: 'OFFLINE' }));
      }
      if (OUTBOX_OK.indexOf(method + ' ' + path) >= 0) {
        var ob = store.get('outbox', []); req.idempotency_key = req.idempotency_key || 'off-' + uid(); ob.push(req); store.set('outbox', ob);
        return Promise.resolve({ __queued: true });
      }
      return Promise.reject(Object.assign(new Error('Anda sedang offline. Aksi ini membutuhkan koneksi.'), { code: 'OFFLINE' }));
    }
    return send(req).then(function (res) {
      if (!res || !res.ok) {
        var err = (res && res.error) || { code: 'INTERNAL', message: 'Respons server tidak valid.' };
        if (err.code === 'UNAUTHENTICATED' && path !== '/auth/login') { logoutLocal(); }
        if (err.code === 'LEGAL_REQUIRED') showLegalGate();
        throw Object.assign(new Error(err.message), { code: err.code, details: err.details });
      }
      if (method === 'GET' && !opts.noCache && S.token) cachePut(path, opts.query, res.data);
      return res.data;
    });
  }
  function send(req) {
    if (IS_GAS) return new Promise(function (ok, ko) { google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) { ko(Object.assign(new Error(e && e.message || 'Gagal menghubungi server'), { code: 'NETWORK' })); }).apiRun(req); });
    var url = apiUrl();
    if (!url) return Promise.reject(Object.assign(new Error('URL server (Web App GAS) belum diatur.'), { code: 'NO_SERVER' }));
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow', credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .catch(function (e) { throw Object.assign(new Error('Tidak dapat menghubungi server: ' + e.message), { code: 'NETWORK' }); });
  }
  function flushOutbox() {
    var ob = store.get('outbox', []); if (!ob.length || !S.token) return;
    store.set('outbox', []);
    var n = 0;
    ob.reduce(function (p, req) { req.token = S.token; return p.then(function () { return send(req).then(function (r) { if (r && r.ok) n++; }).catch(function () { var o = store.get('outbox', []); o.push(req); store.set('outbox', o); }); }); }, Promise.resolve())
      .then(function () { if (n) toast(n + ' aksi offline berhasil dikirim.', 'ok'); });
  }
  window.addEventListener('online', function () { S.online = true; renderOfflineBar(); flushOutbox(); poll(); });
  window.addEventListener('offline', function () { S.online = false; renderOfflineBar(); });

  // ---------------- toast / modal / drawer ----------------
  function toast(msg, kind) { var el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg; $('#toasts').appendChild(el); setTimeout(function () { el.remove(); }, kind === 'err' ? 6500 : 4000); }
  function fail(e) { toast(e && e.message ? e.message : String(e), 'err'); }
  function modal(o) {
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true"><header><h2>' + esc(o.title) + '</h2><button class="iconbtn right" data-x aria-label="Tutup">' + ico('x') + '</button></header><div class="body"></div>' + (o.footer !== false ? '<footer></footer>' : '') + '</div>';
    var body = $('.body', bg); if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    var close = function () { bg.remove(); document.removeEventListener('keydown', onKey); if (o.onClose) o.onClose(); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('[data-x]', bg).onclick = close; bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    var ft = $('footer', bg);
    (o.buttons || []).forEach(function (b) {
      var btn = document.createElement('button'); btn.className = 'btn ' + (b.cls || ''); btn.textContent = b.text;
      btn.onclick = function () { if (!b.fn) return close(); var r = b.fn(bg, close); if (r && r.then) { btn.disabled = true; r.then(function (v) { if (v !== false) close(); }).catch(fail).then(function () { btn.disabled = false; }); } else if (r !== false) close(); };
      ft.appendChild(btn);
    });
    if (ft && !(o.buttons || []).length) ft.remove();
    document.body.appendChild(bg);
    var f = $('input,textarea,select', body); if (f && !o.noFocus) setTimeout(function () { f.focus(); }, 50);
    return { el: bg, close: close, body: body };
  }
  function confirmBox(title, text, okText, danger) {
    return new Promise(function (res) { modal({ title: title, body: '<p>' + esc(text) + '</p>', buttons: [{ text: 'Batal', fn: function () { res(false); } }, { text: okText || 'Ya', cls: danger ? 'primary danger' : 'primary', fn: function () { res(true); } }], onClose: function () { res(false); } }); });
  }
  function promptBox(title, label, value, opts) {
    opts = opts || {};
    return new Promise(function (res) {
      var m = modal({ title: title, body: '<label class="f">' + esc(label) + (opts.multi ? '<textarea class="i" id="pb">' + esc(value || '') + '</textarea>' : '<input class="i" id="pb" maxlength="' + (opts.max || 200) + '" value="' + esc(value || '') + '">') + '</label>', buttons: [{ text: 'Batal', fn: function () { res(null); } }, { text: 'Simpan', cls: 'primary', fn: function (bg) { res($('#pb', bg).value); } }], onClose: function () { res(null); } });
      $('#pb', m.el).addEventListener('keydown', function (e) { if (e.key === 'Enter' && !opts.multi) { res(this.value); m.close(); } });
    });
  }
  function drawer(title, html, onMount) {
    var old = $('.drawer'); if (old) old.remove();
    var d = document.createElement('aside'); d.className = 'drawer';
    d.innerHTML = '<header><h2 style="margin:0;font-size:16px">' + esc(title) + '</h2><button class="iconbtn right" data-x aria-label="Tutup">' + ico('x') + '</button></header><div class="body">' + html + '</div>';
    $('[data-x]', d).onclick = function () { d.remove(); };
    document.body.appendChild(d); if (onMount) onMount(d); return d;
  }

  // ---------------- lightbox zoom (logo & foto profil) ----------------
  function zoomImage(src, alt) {
    if (!src) return;
    var lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = '<button class="lb-close" aria-label="Tutup">✕</button><img alt="' + esc(alt || '') + '" draggable="false"><div class="lb-bar"><button data-a="out" aria-label="Perkecil">−</button><span>100%</span><button data-a="in" aria-label="Perbesar">+</button><button data-a="reset" aria-label="Reset">⟲</button></div>';
    var img = $('img', lb); img.src = src;
    var z = 1, x = 0, y = 0, pts = {}, startDist = 0, startZ = 1, last = null, lastTap = 0;
    function apply() { z = Math.max(0.5, Math.min(8, z)); img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')'; $('span', lb).textContent = Math.round(z * 100) + '%'; }
    function close() { lb.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); if (e.key === '+' || e.key === '=') { z *= 1.25; apply(); } if (e.key === '-') { z /= 1.25; apply(); } }
    document.addEventListener('keydown', key);
    $('.lb-close', lb).onclick = close;
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    $$('.lb-bar button', lb).forEach(function (b) { b.onclick = function () { var a = b.getAttribute('data-a'); if (a === 'in') z *= 1.3; else if (a === 'out') z /= 1.3; else { z = 1; x = 0; y = 0; } apply(); }; });
    lb.addEventListener('wheel', function (e) { e.preventDefault(); z *= e.deltaY < 0 ? 1.12 : 1 / 1.12; apply(); }, { passive: false });
    img.addEventListener('pointerdown', function (e) {
      img.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; startDist = Math.hypot(a.x - b.x, a.y - b.y); startZ = z; }
      last = { x: e.clientX, y: e.clientY };
      var now = Date.now(); if (now - lastTap < 300) { z = z > 1.5 ? 1 : 2.5; if (z === 1) { x = 0; y = 0; } apply(); } lastTap = now;
    });
    img.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return; pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; z = startZ * Math.hypot(a.x - b.x, a.y - b.y) / (startDist || 1); apply(); }
      else if (last) { x += e.clientX - last.x; y += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; apply(); }
    });
    var up = function (e) { delete pts[e.pointerId]; last = null; };
    img.addEventListener('pointerup', up); img.addEventListener('pointercancel', up);
    document.body.appendChild(lb); apply();
  }

  /** Kompres gambar di perangkat sebelum dikirim (hemat sel & kuota). */
  function readImage(file, maxDim, type) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return rej(new Error('Pilih file gambar PNG/JPEG/WEBP.'));
      if (file.size > 8 * 1024 * 1024) return rej(new Error('Ukuran file maksimal 8 MB.'));
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var r = Math.min(1, maxDim / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
          var cx = c.getContext('2d'); if (type === 'image/jpeg') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); }
          cx.drawImage(im, 0, 0, c.width, c.height);
          var out = c.toDataURL(type || 'image/png', 0.86);
          if (out.length > 1400000) out = c.toDataURL('image/jpeg', 0.7);
          res(out);
        };
        im.onerror = function () { rej(new Error('Gambar tidak dapat dibaca.')); };
        im.src = fr.result;
      };
      fr.onerror = function () { rej(new Error('Gagal membaca file.')); };
      fr.readAsDataURL(file);
    });
  }
  function pickFile(accept) { return new Promise(function (res) { var i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = function () { res(i.files[0]); }; i.click(); }); }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name || 'artefak.txt'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------------- markdown aman (escape dulu) ----------------
  function md(src) {
    var lines = esc(src || '').split('\n'), out = [], inList = false, inCode = false, tbl = [];
    function inline(s) { return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*]+)\*/g, '$1<i>$2</i>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'); }
    function flushTbl() {
      if (!tbl.length) return;
      var rows = tbl.filter(function (r) { return !(/^\|?[\s:|-]+\|?$/.test(r) && r.indexOf('-') >= 0); });
      out.push('<table>' + rows.map(function (r, i) { var cells = r.replace(/^\||\|$/g, '').split('|'); return '<tr>' + cells.map(function (c) { return (i ? '<td>' : '<th>') + inline(c.trim()) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</table>');
      tbl = [];
    }
    lines.forEach(function (l) {
      if (/^```/.test(l)) { if (inList) { out.push('</ul>'); inList = false; } out.push(inCode ? '</pre>' : '<pre>'); inCode = !inCode; return; }
      if (inCode) { out.push(l); return; }
      if (/^\s*\|.*\|\s*$/.test(l)) { tbl.push(l.trim()); return; } else flushTbl();
      var m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { if (inList) { out.push('</ul>'); inList = false; } out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); }
      else if ((m = /^\s*[-*]\s+(.*)$/.exec(l))) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(m[1]) + '</li>'); }
      else if ((m = /^&gt;\s?(.*)$/.exec(l))) { out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); }
      else if (!l.trim()) { if (inList) { out.push('</ul>'); inList = false; } }
      else { if (inList) { out.push('</ul>'); inList = false; } out.push('<p>' + inline(l) + '</p>'); }
    });
    flushTbl(); if (inList) out.push('</ul>'); if (inCode) out.push('</pre>');
    return '<div class="md">' + out.join('\n') + '</div>';
  }

  // ---------------- tema ----------------
  function applyTheme(t) { t = t || store.get('theme', 'auto'); if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
  function applyAccent(c) { if (c && /^#[0-9a-f]{6}$/i.test(c)) document.documentElement.style.setProperty('--primary', c); else document.documentElement.style.removeProperty('--primary'); }
  applyTheme();

  // ---------------- login & setup ----------------
  function renderLogin(health) {
    var needsServer = !IS_GAS && !apiUrl();
    var setup = health && health.needs_setup;
    $('#app').innerHTML = '<div class="login"><div class="art"><div class="row"><img class="logo" src="' + DEFAULT_LOGO + '" alt="Logo" id="lgLogo"><b style="color:#fff">AI Virtual Office 3D</b></div>' +
      '<div><h1>Kantor virtual dengan karyawan AI yang benar-benar bekerja.</h1><p>AI Manager menyusun rencana, membagi tugas ke 6 karyawan AI, menjalankan antrean, memeriksa mutu, dan menyerahkan hasil — semuanya tercatat dan dapat diaudit.</p></div>' +
      '<div class="small hide-m" style="opacity:.6">v' + VERSION + ' · Google Apps Script + Google Sheets · PWA</div></div>' +
      '<div class="form"><div class="box card"><h2 id="lgTitle">' + (setup ? 'Setup pertama' : 'Masuk') + '</h2><p class="muted small" id="lgSub">' + (setup ? 'Buat organisasi & akun pemilik (owner).' : 'Gunakan akun yang dibuat administrator.') + '</p>' +
      '<form id="lgForm" class="col" autocomplete="on">' +
      (setup ? '<label class="f">Nama organisasi<input class="i" name="org_name" required maxlength="100" placeholder="PT Contoh Sejahtera"></label><label class="f">Nama Anda<input class="i" name="name" required maxlength="80"></label>' : '') +
      '<label class="f">Email<input class="i" type="email" name="email" required autocomplete="username"></label>' +
      '<label class="f">Kata sandi<input class="i" type="password" name="password" required minlength="8" autocomplete="' + (setup ? 'new-password' : 'current-password') + '"><span>' + (setup ? 'Minimal 8 karakter, berisi huruf dan angka.' : '') + '</span></label>' +
      (setup ? '<label class="row small" style="gap:8px;align-items:flex-start"><input type="checkbox" name="accept_legal" id="lgLegal" required style="margin-top:3px"><span>Saya telah membaca dan menyetujui <a href="#" data-legal="terms">Syarat &amp; Ketentuan</a> serta <a href="#" data-legal="privacy">Pemberitahuan Privasi</a>.</span></label>' : '') +
      '<button class="btn primary" style="justify-content:center;padding:11px" id="lgBtn">' + (setup ? 'Buat & masuk' : 'Masuk') + '</button></form>' +
      '<div class="small muted" style="margin-top:14px;text-align:center"><a href="#" data-legal="terms">Syarat &amp; Ketentuan</a> · <a href="#" data-legal="privacy">Pemberitahuan Privasi</a> · v' + VERSION + '</div>' +
      (IS_GAS ? '' : '<details style="margin-top:14px" ' + (needsServer ? 'open' : '') + '><summary class="small muted" style="cursor:pointer">Pengaturan server</summary><label class="f" style="margin-top:8px">URL Web App GAS<input class="i" id="srvUrl" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(apiUrl()) + '"><span>Dari Deploy → Web app di Apps Script.</span></label><button class="btn sm" id="srvSave" style="margin-top:8px">Simpan & cek koneksi</button><div id="srvMsg" class="small" style="margin-top:6px"></div></details>') +
      '</div></div></div>';
    $('#lgLogo').onclick = function () { zoomImage(this.src, 'Logo'); };
    bindLegalLinks($('#app'));
    $('#lgForm').onsubmit = function (e) {
      e.preventDefault(); var f = new FormData(this), b = {}; f.forEach(function (v, k) { b[k] = v; });
      if (setup) { if (!$('#lgLegal').checked) return fail(new Error('Setujui Syarat & Ketentuan dan Pemberitahuan Privasi.')); b.accept_legal = true; }
      var btn = $('#lgBtn'); btn.disabled = true; btn.textContent = 'Memproses…';
      api('POST', setup ? '/auth/bootstrap' : '/auth/login', b).then(onLogin).catch(function (er) { fail(er); btn.disabled = false; btn.textContent = setup ? 'Buat & masuk' : 'Masuk'; });
    };
    var sv = $('#srvSave');
    if (sv) sv.onclick = function () {
      var u = $('#srvUrl').value.trim();
      if (u && !/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) { $('#srvMsg').textContent = 'URL harus diawali https://script.google.com/…'; return; }
      store.set('api_url', u); $('#srvMsg').textContent = 'Mengecek…';
      api('GET', '/health', {}, { noCache: true }).then(function (h) { store.set('health', h); $('#srvMsg').innerHTML = '<span style="color:var(--success)">✔ Terhubung: ' + esc(h.app) + ' v' + esc(h.version) + '</span>'; renderLogin(h); }).catch(function (er) { $('#srvMsg').innerHTML = '<span style="color:var(--danger)">' + esc(er.message) + '</span>'; });
    };
  }
  function onLogin(d) { var h = store.get('health', {}) || {}; h.needs_setup = false; store.set('health', h); S.token = d.token; store.set('session', { token: d.token, expires_at: d.expires_at }); S.me = d.me; store.set('me', d.me); bootApp(true); }
  function logoutLocal() {
    S.token = null; S.me = null; S.seq = 0; S.events = []; S.statuses = {}; S.employees = []; S.view = '';
    store.del('session'); store.del('me'); store.del('outbox'); clearDataCache(); stopPoll();
    if (S.office) { S.office.destroy(); S.office = null; } S.officeRoot = null;
    $$('.modal-bg,.drawer,.lightbox').forEach(function (x) { x.remove(); });
    renderLogin(store.get('health', { needs_setup: false }));
  }
  /** Keluar instan: UI langsung kembali ke login, pencabutan sesi dikirim di latar belakang. */
  function logout() {
    var tok = S.token; logoutLocal();
    if (tok) send({ method: 'POST', path: '/api/v1/auth/logout', body: {}, token: tok }).catch(function () { });
  }

  // ---------------- dokumen hukum ----------------
  var LEGAL_TEXT = { terms: "# Syarat & Ketentuan Penggunaan\n**Versi {TERMS_V} \u00b7 berlaku sejak {EFFECTIVE}**\n\nDengan membuat akun, masuk, atau menggunakan AI Virtual Office 3D (\"Aplikasi\") di lingkungan {ORG} (\"Organisasi\"), Anda menyetujui Syarat & Ketentuan ini. Bila tidak setuju, jangan gunakan Aplikasi.\n\n## 1. Para pihak\n- **Organisasi** adalah pemegang lisensi yang memasang Aplikasi di akun Google miliknya dan mengundang pengguna.\n- **Pengguna** adalah orang yang diberi akun oleh Organisasi (pemilik, admin, manajer, anggota, peninjau).\n- **Penyedia** adalah {PROVIDER} yang mengembangkan dan melisensikan Aplikasi.\n\n## 2. Layanan\nAplikasi menyediakan kantor virtual berisi karyawan AI yang menyusun rencana, menjalankan tugas melalui antrean, memeriksa mutu, dan menghasilkan artefak (dokumen, tabel, draf email, draf undangan rapat). Data disimpan di Google Sheets/Drive milik Organisasi. Fitur AI hanya aktif bila Organisasi mengonfigurasi penyedia AI.\n\n## 3. Akun & keamanan\n- Jaga kerahasiaan kata sandi; Anda bertanggung jawab atas aktivitas di akun Anda.\n- Segera laporkan dugaan akses tidak sah kepada administrator Organisasi.\n- Hak akses mengikuti peran yang ditetapkan Organisasi. Jangan mencoba mengakses data di luar kewenangan Anda.\n\n## 4. Penggunaan yang dapat diterima\nAnda dilarang:\n- mengunggah atau memproses konten yang melanggar hukum, hak kekayaan intelektual, atau hak privasi orang lain;\n- memasukkan data pribadi pihak lain tanpa dasar hukum yang sah, atau data pribadi spesifik (kesehatan, biometrik, keuangan pribadi, data anak) kecuali benar-benar diperlukan dan diizinkan Organisasi;\n- membobol, memindai, atau membebani sistem, termasuk mencoba memanipulasi karyawan AI (prompt injection) untuk melewati kontrol;\n- menggunakan Aplikasi untuk spam, penipuan, atau keputusan yang merugikan orang lain tanpa peninjauan manusia.\n\n## 5. Keluaran AI\n- Keluaran AI dapat tidak akurat, tidak lengkap, atau tidak sesuai konteks. **Anda wajib meninjau setiap hasil** sebelum dipakai atau dibagikan.\n- Aplikasi tidak pernah mengirim email, memublikasikan konten, atau melakukan transaksi secara otomatis. Draf email memerlukan persetujuan manusia dan tetap harus dikirim sendiri oleh pengguna.\n- Tanggung jawab atas penggunaan hasil kerja berada pada pengguna dan Organisasi.\n\n## 6. Layanan pihak ketiga\nAplikasi berjalan di atas layanan Google (Apps Script, Sheets, Drive, Docs) dan, bila diaktifkan, penyedia AI (mis. Google Gemini atau layanan kompatibel OpenAI). Ketentuan dan kebijakan privasi pihak ketiga tersebut turut berlaku. Biaya penggunaan API AI ditanggung Organisasi kecuali disepakati lain.\n\n## 7. Lisensi, paket & masa uji coba\nAplikasi dilisensikan, bukan dijual. Batas pengguna, tugas, karyawan AI, dan integrasi mengikuti paket lisensi Organisasi. Saat masa uji coba atau lisensi berakhir, Aplikasi beralih ke mode baca-saja.\n\n## 8. Kekayaan intelektual\nHak atas perangkat lunak Aplikasi tetap milik Penyedia. Konten yang Anda masukkan dan artefak yang dihasilkan untuk Organisasi menjadi milik Organisasi, sepanjang tidak melanggar hak pihak lain.\n\n## 9. Ketersediaan\nAplikasi bergantung pada kuota dan ketersediaan layanan Google serta penyedia AI. Tidak ada jaminan ketersediaan tanpa gangguan kecuali diatur dalam perjanjian layanan (SLA) tertulis.\n\n## 10. Batasan tanggung jawab\nSepanjang diizinkan hukum, Penyedia tidak bertanggung jawab atas kerugian tidak langsung, kehilangan keuntungan, atau kerugian akibat penggunaan keluaran AI tanpa peninjauan. Tanggung jawab total Penyedia dibatasi sesuai perjanjian lisensi dengan Organisasi.\n\n## 11. Penangguhan & pengakhiran\nOrganisasi dapat menangguhkan akun yang melanggar ketentuan ini. Penyedia dapat mencabut lisensi atas pelanggaran perjanjian lisensi.\n\n## 12. Perubahan ketentuan\nKetentuan dapat diperbarui. Versi baru ditandai dengan nomor versi dan Anda akan diminta menyetujuinya kembali sebelum melanjutkan.\n\n## 13. Hukum yang berlaku\nKetentuan ini tunduk pada hukum Republik Indonesia.\n\n## 14. Kontak\nPertanyaan tentang ketentuan ini: {CONTACT}.\n", privacy: "# Pemberitahuan Privasi\n**Versi {PRIV_V} \u00b7 berlaku sejak {EFFECTIVE}**\n\nPemberitahuan ini menjelaskan bagaimana data pribadi Anda diproses di AI Virtual Office 3D, sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).\n\n## 1. Pengendali & prosesor data\n- **Pengendali data pribadi:** {ORG}, yang menentukan tujuan pemrosesan dan memasang Aplikasi di akun Google miliknya.\n- **Prosesor data pribadi:** {PROVIDER} hanya bila menyediakan layanan pengelolaan/dukungan atas nama Organisasi; Google (infrastruktur) dan penyedia AI yang dipilih Organisasi memproses data sesuai ketentuan masing-masing.\n- **Kontak pelindungan data:** {CONTACT}.\n\n## 2. Data yang diproses\n| Kategori | Contoh | Sumber |\n|---|---|---|\n| Identitas akun | Nama, email, peran, status akun | Administrator / Anda |\n| Kredensial | Hash kata sandi bersalt (kata sandi asli tidak disimpan), token sesi dalam bentuk hash | Sistem |\n| Foto profil (opsional) | Gambar yang Anda unggah | Anda |\n| Konten kerja | Instruksi, dataset CSV, dokumen, artefak, draf email (termasuk alamat penerima), catatan persetujuan | Anda / tim |\n| Log & audit | Waktu login, aksi, hasil, ID perangkat lunak klien (user agent), riwayat eksekusi tugas | Sistem |\n| Penggunaan AI | Jumlah token, model, perkiraan biaya per tugas | Sistem |\n| Data di perangkat | Token sesi, cache data terakhir, antrean offline, preferensi tema | Browser Anda |\n\n## 3. Tujuan & dasar pemrosesan\n- Menyediakan layanan dan mengelola akun (pelaksanaan perjanjian kerja/layanan dengan Organisasi).\n- Keamanan, pencegahan penyalahgunaan, audit, dan pemecahan masalah (kepentingan yang sah).\n- Foto profil dan data opsional lain (persetujuan Anda; dapat dihapus kapan saja dari menu Profil).\n- Memenuhi kewajiban hukum Organisasi.\nAplikasi **tidak** digunakan untuk iklan, pemrofilan pemasaran, atau penjualan data.\n\n## 4. Pemrosesan oleh AI\nBila Organisasi mengaktifkan penyedia AI, instruksi dan potongan konten yang relevan dengan tugas dikirim ke penyedia AI tersebut untuk menghasilkan rencana, isi dokumen, atau penilaian mutu. Dalam mode berbasis aturan, tidak ada data yang dikirim ke penyedia AI. Keputusan AI tidak berlaku otomatis untuk tindakan eksternal: draf email dan hasil QA di bawah ambang memerlukan peninjauan manusia. Hindari memasukkan data pribadi yang tidak diperlukan ke dalam instruksi.\n\n## 5. Lokasi penyimpanan & transfer\nData disimpan di Google Sheets dan Google Drive milik Organisasi. Pusat data Google dan penyedia AI dapat berada di luar Indonesia; transfer lintas negara dilakukan dengan memperhatikan ketentuan transfer data pribadi dalam UU PDP. Data di perangkat Anda tersimpan di penyimpanan lokal browser dan dihapus saat Anda keluar (cache data) atau menghapus data situs.\n\n## 6. Retensi\n| Data | Masa simpan |\n|---|---|\n| Sesi login | Dihapus otomatis 30 hari setelah kedaluwarsa |\n| Event aktivitas tugas | 180 hari |\n| Audit log | Selama diperlukan Organisasi untuk akuntabilitas |\n| Akun, foto, konten kerja | Sampai dihapus/ditangguhkan oleh Organisasi atau atas permintaan yang sah |\n| Cadangan (backup) | Sesuai kebijakan backup Organisasi |\n\n## 7. Pembagian data\nData tidak dijual. Data hanya dibagikan kepada: Google sebagai penyedia infrastruktur; penyedia AI yang dikonfigurasi Organisasi; Penyedia Aplikasi untuk dukungan teknis bila diminta Organisasi; dan pihak berwenang bila diwajibkan peraturan perundang-undangan.\n\n## 8. Keamanan\nKata sandi di-hash bersalt, token sesi acak 256-bit disimpan dalam bentuk hash, kontrol akses berbasis peran, isolasi data antar-organisasi, pembatasan laju, audit log, Content Security Policy pada aplikasi web, dan koneksi terenkripsi HTTPS dari Google. Tidak ada sistem yang sepenuhnya bebas risiko; laporkan dugaan insiden ke kontak di atas.\n\n## 9. Hak Anda sebagai subjek data\nSesuai UU PDP, Anda berhak:\n- memperoleh informasi tentang pemrosesan data pribadi Anda;\n- mengakses dan memperoleh salinan data pribadi Anda;\n- memperbaiki data yang tidak akurat (nama dan foto dapat diubah langsung di menu Profil);\n- meminta penghapusan atau pemusnahan data, serta menarik persetujuan untuk data opsional;\n- mengajukan keberatan atas pengambilan keputusan yang semata-mata didasarkan pada pemrosesan otomatis;\n- meminta pembatasan atau penundaan pemrosesan sesuai ketentuan hukum.\nAjukan permintaan kepada {CONTACT}. Organisasi menanggapi dalam jangka waktu yang ditetapkan UU PDP.\n\n## 10. Kegagalan pelindungan data\nBila terjadi kegagalan pelindungan data pribadi, Organisasi selaku pengendali wajib menyampaikan pemberitahuan tertulis kepada subjek data dan lembaga paling lambat 3 \u00d7 24 jam (Pasal 46 UU PDP).\n\n## 11. Pengguna\nAplikasi ditujukan untuk pengguna dewasa dalam lingkungan kerja Organisasi.\n\n## 12. Penyimpanan lokal & cookie\nAplikasi tidak memakai cookie pelacak atau analitik pihak ketiga. Penyimpanan lokal browser dipakai untuk sesi, cache data agar aplikasi cepat dan dapat dibuka offline, antrean aksi offline, dan preferensi tampilan. Service worker menyimpan berkas aplikasi untuk mode offline.\n\n## 13. Perubahan\nPemberitahuan ini dapat diperbarui. Versi baru ditandai nomor versi dan Anda akan diminta menyetujuinya kembali.\n" };
  function legalDoc(kind) {
    var org = S.me ? S.me.org : null, li = (org && org.legal) || {};
    return LEGAL_TEXT[kind].replace(/\{ORG\}/g, org ? org.name : 'organisasi pemegang lisensi')
      .replace(/\{PROVIDER\}/g, li.provider_name || 'penyedia aplikasi')
      .replace(/\{CONTACT\}/g, li.contact_email || 'administrator organisasi Anda')
      .replace(/\{TERMS_V\}/g, LEGAL_V.terms).replace(/\{PRIV_V\}/g, LEGAL_V.privacy)
      .replace(/\{EFFECTIVE\}/g, new Date(LEGAL_V.effective).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
  }
  function showLegal(kind) {
    modal({ title: kind === 'terms' ? 'Syarat & Ketentuan' : 'Pemberitahuan Privasi', wide: true, noFocus: true, body: md(legalDoc(kind)),
      buttons: [{ text: 'Unduh', fn: function () { download((kind === 'terms' ? 'syarat-ketentuan' : 'pemberitahuan-privasi') + '-v' + LEGAL_V[kind] + '.md', legalDoc(kind), 'text/markdown'); return false; } }, { text: 'Tutup', cls: 'primary' }] });
  }
  function bindLegalLinks(root) { $$('[data-legal]', root).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); showLegal(a.getAttribute('data-legal')); }; }); }
  var legalOpen = false;
  /** Gerbang persetujuan: wajib saat akun baru atau versi dokumen berubah. */
  function showLegalGate() {
    if (legalOpen || !S.token) return; legalOpen = true;
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal wide" role="dialog" aria-modal="true"><header><h2>Persetujuan diperlukan</h2></header><div class="body"><p class="muted">Sebelum melanjutkan, baca dan setujui dokumen berikut (versi ' + LEGAL_V.terms + ').</p><div class="tabs"><button class="on" data-lt="terms">Syarat &amp; Ketentuan</button><button data-lt="privacy">Pemberitahuan Privasi</button></div><div id="lgDoc" style="max-height:48vh;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:12px 16px"></div>' +
      '<label class="row small" style="gap:8px;margin-top:12px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="lgAgree" style="margin-top:3px;flex:none"> Saya telah membaca dan menyetujui Syarat &amp; Ketentuan serta Pemberitahuan Privasi.</label></div><footer><button class="btn" id="lgOut">Keluar</button><button class="btn primary" id="lgOk" disabled>Setuju &amp; lanjutkan</button></footer></div>';
    document.body.appendChild(bg);
    var showTab = function (k) { $('#lgDoc', bg).innerHTML = md(legalDoc(k)); $('#lgDoc', bg).scrollTop = 0; $$('[data-lt]', bg).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-lt') === k); }); };
    $$('[data-lt]', bg).forEach(function (b) { b.onclick = function () { showTab(b.getAttribute('data-lt')); }; }); showTab('terms');
    $('#lgAgree', bg).onchange = function () { $('#lgOk', bg).disabled = !this.checked; };
    $('#lgOut', bg).onclick = function () { legalOpen = false; bg.remove(); logout(); };
    $('#lgOk', bg).onclick = function () {
      this.disabled = true;
      api('POST', '/auth/accept-legal', { terms_version: LEGAL_V.terms, privacy_version: LEGAL_V.privacy }).then(function (l) { S.me.legal = l; store.set('me', S.me); legalOpen = false; bg.remove(); toast('Terima kasih. Persetujuan tercatat.', 'ok'); if (!location.hash || location.hash === '#/') location.hash = '#/office'; else route(); prefetch(); })
        .catch(function (e) { fail(e); $('#lgOk', bg).disabled = false; });
    };
  }

  // ---------------- shell ----------------
  var NAV = [
    ['office', 'Kantor 3D', 'office', 'employee.read'], ['dashboard', 'Dasbor', 'dash', 'task.read'], ['workflow', 'AI Manager', 'flow', 'task.read'], ['tasks', 'Tugas', 'tasks', 'task.read'],
    ['employees', 'Karyawan AI', 'users', 'employee.read'], ['approvals', 'Persetujuan', 'check', 'task.read'], ['artifacts', 'Artefak', 'file', 'artifact.read'],
    ['costs', 'Biaya', 'coin', 'usage.read'], ['audit', 'Audit', 'shield', 'audit.read'], ['settings', 'Pengaturan', 'gear', 'org.read']
  ];
  function renderShell() {
    var b = S.me.org.branding, logo = b.logo || DEFAULT_LOGO, u = S.me.user;
    applyAccent(b.accent);
    var nav = NAV.filter(function (n) { return can(n[3]); });
    $('#app').innerHTML = '<div class="shell"><aside class="side"><div class="brand"><img class="logo" id="sLogo" src="' + esc(logo) + '" alt="Logo"><div style="min-width:0"><b id="sTitle">' + esc(b.title) + '</b><span id="sSub">' + esc(b.subtitle) + '</span></div></div><nav class="nav">' +
      nav.map(function (n, i) { return (i === 4 ? '<div class="sec">Organisasi</div>' : '') + (i === 7 ? '<div class="sec">Kontrol</div>' : '') + '<a href="#/' + n[0] + '" data-nav="' + n[0] + '">' + ico(n[2]) + '<span>' + n[1] + '</span>' + (n[0] === 'approvals' ? '<i class="badge" id="bdAppr" hidden></i>' : '') + '</a>'; }).join('') +
      '</nav><a href="#/about" style="margin-top:auto;padding:10px;font-size:11px;opacity:.6;color:inherit;text-decoration:none">v' + VERSION + (IS_GAS ? ' · GAS' : ' · PWA') + ' · Tentang</a></aside>' +
      '<div class="main"><div id="offBar"></div><header class="top"><img class="logo" id="tLogo" src="' + esc(logo) + '" alt="Logo"><div class="ttl grow"><b><span id="tTitle">' + esc(b.title) + '</span>' + (can('org.manage') ? '<button class="btn ghost sm" id="editTitle" title="Ubah judul header" aria-label="Ubah judul">' + ico('pen', 14) + '</button>' : '') + '</b><small id="tSub">' + esc(b.subtitle) + ' · ' + esc(S.me.license.label || S.me.license.plan) + '</small></div>' +
      '<span class="chip hide-m" id="liveChip">Terhubung</span><button class="iconbtn" id="btnTheme" title="Tema" aria-label="Tema">' + ico('moon') + '</button><button class="iconbtn" id="btnBell" title="Notifikasi" aria-label="Notifikasi">' + ico('bell') + '<i class="badge" id="bdBell" hidden></i></button>' +
      '<button class="iconbtn" id="btnMe" style="width:auto;padding:0 2px;border:0" aria-label="Profil">' + avatarHtml(u) + '</button></header>' +
      licenseBanner() + '<main class="view" id="view"></main></div></div>' +
      '<nav class="bnav">' + [['office', 'Kantor', 'office'], ['workflow', 'AI Manager', 'flow'], ['tasks', 'Tugas', 'tasks'], ['approvals', 'Setuju', 'check']].map(function (n) { return '<a href="#/' + n[0] + '" data-nav="' + n[0] + '">' + ico(n[2], 20) + n[1] + (n[0] === 'approvals' ? '<i class="badge" id="bdAppr2" hidden></i>' : '') + '</a>'; }).join('') + '<a href="#" id="bMore">' + ico('menu', 20) + 'Menu</a></nav>';
    $('#sLogo').onclick = $('#tLogo').onclick = function () { zoomImage(this.src, 'Logo ' + b.title); };
    var et = $('#editTitle'); if (et) et.onclick = editBranding;
    $('#btnTheme').onclick = function () { var cur = store.get('theme', 'auto'), nx = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto'; store.set('theme', nx); applyTheme(nx); toast('Tema: ' + ({ auto: 'mengikuti sistem', dark: 'gelap', light: 'terang' })[nx]); if (S.office) S.office.themeChanged(); };
    $('#btnBell').onclick = showNotifications;
    $('#btnMe').onclick = function () { location.hash = '#/profile'; };
    $('#bMore').onclick = function (ev) {
      ev.preventDefault();
      drawer('Menu', '<div class="col">' + nav.map(function (n) { return '<a class="btn" style="justify-content:flex-start" href="#/' + n[0] + '">' + ico(n[2]) + n[1] + '</a>'; }).join('') + '<a class="btn" style="justify-content:flex-start" href="#/profile">' + ico('user') + 'Profil saya</a><a class="btn" style="justify-content:flex-start" href="#/about">' + ico('shield') + 'Tentang, S&amp;K &amp; Privasi</a><button class="btn danger" id="dOut" style="justify-content:flex-start">' + ico('out') + 'Keluar</button></div>', function (d) { $$('a', d).forEach(function (a) { a.addEventListener('click', function () { d.remove(); }); }); $('#dOut', d).onclick = logout; });
    };
    renderOfflineBar();
  }
  function avatarHtml(u, lg) { return u.photo ? '<img class="avatar ' + (lg ? 'lg' : '') + '" src="' + esc(u.photo) + '" alt="Foto ' + esc(u.name) + '">' : '<span class="avatar ' + (lg ? 'lg' : '') + '">' + esc(initials(u.name)) + '</span>'; }
  function licenseBanner() {
    var l = S.me.license || {};
    if (l.status !== 'active') return '<div class="notice err" style="margin:12px 22px 0">⚠️ ' + esc(l.message || 'Lisensi tidak aktif') + ' — aplikasi dalam mode baca-saja.' + (can('license.manage') ? ' <a href="#/settings/license">Aktifkan lisensi</a>' : '') + '</div>';
    if (l.plan === 'TRIAL' && l.days_left <= 5) return '<div class="notice warn" style="margin:12px 22px 0">⏳ ' + esc(l.message) + (can('license.manage') ? ' <a href="#/settings/license">Aktifkan lisensi</a>' : '') + '</div>';
    return '';
  }
  function renderOfflineBar() { var b = $('#offBar'); if (b) b.innerHTML = S.online ? '' : '<div class="offline-bar">Mode offline — menampilkan data tersimpan. Tugas baru akan dikirim saat online.</div>'; var c = $('#liveChip'); if (c) { c.className = 'chip hide-m ' + (S.online ? 's-ok' : 's-waiting'); c.textContent = S.online ? 'Terhubung' : 'Offline'; } }
  function updateBadges() {
    var set = function (id, n) { var e = $('#' + id); if (e) { e.hidden = !n; e.textContent = n > 99 ? '99+' : n; } };
    set('bdAppr', S.pending); set('bdAppr2', S.pending); set('bdBell', S.unread);
  }
  function editBranding() {
    var b = S.me.org.branding;
    var m = modal({
      title: 'Ubah header & logo', body: '<div class="col"><div class="row"><img class="logo" id="ebLogo" style="width:72px;height:72px" src="' + esc(b.logo || DEFAULT_LOGO) + '" alt="Logo"><div class="col" style="gap:6px"><button class="btn sm" id="ebUp">Unggah logo</button><button class="btn sm ghost" id="ebRm">Pakai logo bawaan</button><span class="small muted">Klik logo untuk memperbesar (zoom).</span></div></div>' +
        '<label class="f">Judul header<input class="i" id="ebTitle" maxlength="60" value="' + esc(b.title) + '"></label><label class="f">Subjudul<input class="i" id="ebSub" maxlength="80" value="' + esc(b.subtitle) + '"></label>' +
        '<label class="f">Warna aksen<input class="i" type="color" id="ebAcc" value="' + esc(b.accent || '#1f5eff') + '" style="height:42px;padding:4px"></label></div>',
      buttons: [{ text: 'Batal' }, { text: 'Simpan', cls: 'primary', fn: function (bg) {
        return api('PUT', '/org', { title: $('#ebTitle', bg).value, subtitle: $('#ebSub', bg).value, logo: m.logo === undefined ? undefined : m.logo, accent: $('#ebAcc', bg).value }).then(function (org) { S.me.org = org; store.set('me', S.me); renderShell(); route(); toast('Header diperbarui.', 'ok'); });
      } }]
    });
    $('#ebLogo', m.el).onclick = function () { zoomImage(this.src, 'Logo'); };
    $('#ebUp', m.el).onclick = function () { pickFile('image/*').then(function (f) { return readImage(f, 512, 'image/png'); }).then(function (d) { m.logo = d; $('#ebLogo', m.el).src = d; }).catch(fail); };
    $('#ebRm', m.el).onclick = function () { m.logo = ''; $('#ebLogo', m.el).src = DEFAULT_LOGO; };
  }

  // ---------------- polling realtime ----------------
  function stopPoll() { clearTimeout(S.pollTimer); S.pollTimer = null; }
  function poll() {
    stopPoll();
    if (!S.token) return;
    if (!S.online) { S.pollTimer = setTimeout(poll, 15000); return; }
    api('GET', '/events', {}, { query: { since: S.seq }, noCache: true }).then(function (d) {
      var fresh = S.seq ? d.events : [];
      S.seq = d.seq; S.statuses = d.statuses; S.unread = d.unread; S.pending = d.pending_approvals; S.stopped = d.emergency_stop;
      S.events = (S.events.length ? fresh : d.events).slice().reverse().concat(S.events).slice(0, 60);
      updateBadges();
      if (S.office) S.office.setStatuses(S.statuses);
      renderFeed();
      fresh.forEach(function (e) { if (/workflow\.(completed|failed)|security\.|task\.failed|task\.waiting_human/.test(e.type)) toast(e.message, /failed|security/.test(e.type) ? 'err' : 'ok'); });
      if (fresh.length) refreshViewSoft();
    }).catch(function () { }).then(function () {
      var busy = Object.keys(S.statuses).some(function (k) { return S.statuses[k].state === 'working' || S.statuses[k].state === 'queued'; });
      S.pollTimer = setTimeout(poll, document.hidden ? 30000 : (busy ? 4000 : 9000));
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.token) poll(); if (S.office) S.office.setPaused(document.hidden || S.view !== 'office'); });
  /** Render ulang ringan tanpa skeleton; tidak mengganggu formulir yang sedang diisi. */
  function canSoft() { var a = document.activeElement, v = $('#view'); return S.view !== 'office' && S.view !== 'settings' && S.view !== 'profile' && !$('.modal-bg') && !$('.drawer') && !(v && a && v.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)); }
  var softRefresh = debounce(function () { if (S.token && canSoft()) route(true); }, 250);
  var refreshViewSoft = debounce(function () { if (['dashboard', 'tasks', 'approvals', 'workflow', 'employees'].indexOf(S.view) >= 0 && canSoft()) { clearViewCache(); route(true); } }, 1200);
  function clearViewCache() { try { Object.keys(localStorage).forEach(function (k) { if (/^avo_c:\/(tasks|dashboard|approvals|workflows|employees)/.test(k)) { var e = JSON.parse(localStorage.getItem(k)); if (e) { e.t = 0; localStorage.setItem(k, JSON.stringify(e)); } } }); } catch (e) { } }

  function showNotifications() {
    api('GET', '/notifications', {}, { noCache: true }).then(function (list) {
      modal({ title: 'Notifikasi', body: list.length ? '<div class="col">' + list.map(function (n) { return '<a class="card flat" style="text-decoration:none;color:inherit;' + (n.read ? 'opacity:.65' : '') + '" href="' + esc(n.link || '#/dashboard') + '"><b>' + esc(n.title) + '</b><div class="small">' + esc(n.body) + '</div><div class="small muted">' + ago(n.created_at) + '</div></a>'; }).join('') + '</div>' : '<div class="empty">Belum ada notifikasi.</div>', buttons: [{ text: 'Tandai semua dibaca', cls: 'primary', fn: function () { return api('POST', '/notifications/read', {}).then(function () { S.unread = 0; updateBadges(); }); } }] });
      $$('.modal a.card').forEach(function (a) { a.addEventListener('click', function () { var bg = $('.modal-bg'); if (bg) bg.remove(); }); });
    }).catch(fail);
  }

  // ---------------- router ----------------
  var VIEWS = {};
  function route(soft) {
    if (!S.token) return;
    var h = (location.hash || '#/office').slice(2).split('/'), name = h[0] || 'office';
    if (!VIEWS[name]) name = 'office';
    var navDef = NAV.filter(function (n) { return n[0] === name; })[0];
    if (navDef && !can(navDef[3])) name = 'profile';
    if (S.office && name !== 'office') S.office.setPaused(true); // kantor 3D dipertahankan di memori: kembali ke menu Kantor instan
    S.view = name;
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === name); });
    var v = $('#view'); if (!v) return;
    var sk = setTimeout(function () { if (!soft && v.getAttribute('data-r') === rid) v.innerHTML = '<div class="col"><div class="skel" style="width:40%"></div><div class="skel"></div><div class="skel" style="width:70%"></div></div>'; }, 120);
    var rid = String(Date.now() + Math.random()); v.setAttribute('data-r', rid);
    Promise.resolve(VIEWS[name](v, h.slice(1), soft)).then(function () { clearTimeout(sk); }, function (e) { clearTimeout(sk); throw e; }).catch(function (e) { if (e.code === 'LEGAL_REQUIRED') { v.innerHTML = ''; return; } v.innerHTML = '<div class="notice err">' + esc(e.message) + '</div>'; });
    if (!soft) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', function () { route(); });

  // =====================================================================
  // VIEW: KANTOR 3D
  // =====================================================================
  VIEWS.office = function (v) {
    if (S.office && S.officeRoot) {
      v.innerHTML = ''; v.appendChild(S.officeRoot); S.office.setPaused(document.hidden);
      S.office.setStatuses(S.statuses); renderEmpList(); renderFeed();
      return Promise.resolve();
    }
    return api('GET', '/office/layout').then(function (lay) {
      if (S.view !== 'office') return;
      S.employees = lay.employees;
      var root = document.createElement('div'); v.innerHTML = ''; v.appendChild(root); S.officeRoot = root; v = root;
      lay.employees.forEach(function (e) { if (!S.statuses[e.id]) S.statuses[e.id] = e.live; });
      var mode = store.get('office_mode', 'auto');
      v.innerHTML = '<div class="row" style="margin-bottom:12px"><div><h1 style="margin:0">Kantor Virtual</h1><div class="muted small">Status avatar mengikuti eksekusi backend secara nyata (task_runs).</div></div><div class="right row"><button class="btn sm" id="ofMode">' + ico('grid', 15) + '<span></span></button>' + (can('workflow.run') ? '<a class="btn sm primary" href="#/workflow">' + ico('plus', 15) + 'Beri instruksi</a>' : '') + '</div></div>' +
        (S.stopped ? '<div class="notice err" style="margin-bottom:12px">⛔ Emergency stop aktif — semua eksekusi AI dihentikan.</div>' : '') +
        '<div class="office-wrap"><div class="stage" id="stage"><div class="ctrl"><button class="iconbtn" data-c="in" title="Perbesar">' + ico('zin') + '</button><button class="iconbtn" data-c="out" title="Perkecil">' + ico('zout') + '</button><button class="iconbtn" data-c="reset" title="Reset kamera">' + ico('reset') + '</button></div>' +
        '<div class="legend">' + ['working', 'queued', 'waiting', 'error', 'idle'].map(function (s) { return '<span class="row" style="gap:5px"><i class="dot" style="background:#' + STATE_COLOR[s].toString(16).padStart(6, '0') + '"></i>' + LABEL[s] + '</span>'; }).join('') + '</div></div>' +
        '<div class="col"><div class="card"><h3>Karyawan AI</h3><div id="empList"></div></div><div class="card"><h3>Aktivitas</h3><div class="feed" id="feed"></div></div></div></div>';
      var use3d = mode === '2d' ? false : (mode === '3d' || webglOk());
      var setModeLabel = function () { $('#ofMode span').textContent = use3d ? 'Tampilan 2D' : 'Tampilan 3D'; };
      setModeLabel();
      $('#ofMode').onclick = function () { store.set('office_mode', use3d ? '2d' : '3d'); if (S.office) S.office.destroy(); S.office = null; S.officeRoot = null; route(); };
      S.office = use3d ? new Office3D($('#stage'), lay, openEmployee) : new Office2D($('#stage'), lay, openEmployee);
      S.office.setStatuses(S.statuses);
      $$('[data-c]').forEach(function (b) { b.onclick = function () { S.office.control(b.getAttribute('data-c')); }; });
      renderEmpList(); renderFeed();
    });
  };
  function webglOk() { try { if (!window.THREE) return false; var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; } }
  function renderEmpList() {
    var el = $('#empList'); if (!el) return;
    el.innerHTML = S.employees.map(function (e) { var st = (S.statuses[e.id] || {}).state || 'idle', t = (S.statuses[e.id] || {}).task_title; return '<div class="emp-row" data-emp="' + esc(e.id) + '"><span class="avatar" style="background:' + esc(e.avatar_color) + ';color:#fff">' + esc(initials(e.name)) + '</span><div class="grow" style="min-width:0"><b style="font-size:13px">' + esc(e.title) + '</b><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t || e.department) + '</div></div>' + chip(st) + '</div>'; }).join('');
    $$('[data-emp]', el).forEach(function (r) { r.onclick = function () { openEmployee(r.getAttribute('data-emp')); }; });
  }
  function renderFeed() {
    renderEmpList();
    var f = $('#feed'); if (!f) return;
    f.innerHTML = S.events.length ? S.events.slice(0, 40).map(function (e) { return '<div><b>' + esc(e.message) + '</b><div class="muted small">' + esc(e.type) + ' · ' + ago(e.created_at) + '</div></div>'; }).join('') : '<div class="muted small" style="border:0">Belum ada aktivitas.</div>';
  }

  /** Kantor 3D (Three.js r128) — kamera orbit buatan sendiri, render on-demand, jeda saat tab tersembunyi. */
  function Office3D(stage, lay, onPick) {
    var self = this, T = window.THREE, W = stage.clientWidth, H = stage.clientHeight;
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(W, H);
    stage.insertBefore(renderer.domElement, stage.firstChild);
    var scene = new T.Scene(), camera = new T.PerspectiveCamera(45, W / H, 0.5, 300);
    scene.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.95));
    var dl = new T.DirectionalLight(0xffffff, 0.55); dl.position.set(12, 30, 18); scene.add(dl);
    var dark = function () { return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().indexOf('#0') === 0; };
    var floorMat = new T.MeshLambertMaterial({ color: dark() ? 0x16223a : 0xe9eef6 });
    var floor = new T.Mesh(new T.PlaneGeometry(160, 120), floorMat); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    var grid = new T.GridHelper(48, 24, 0x9aa8bf, 0x9aa8bf); grid.material.opacity = 0.18; grid.material.transparent = true; scene.add(grid);
    var labels = [], avatars = {}, pickables = [];
    function hex(c) { return parseInt(String(c || '#64748b').replace('#', ''), 16); }
    lay.rooms.forEach(function (r) {
      var tile = new T.Mesh(new T.BoxGeometry(r.w, 0.06, r.d), new T.MeshLambertMaterial({ color: hex(r.color), transparent: true, opacity: 0.16 })); tile.position.set(r.x, 0.03, r.z); scene.add(tile);
      var edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(r.w, 1.1, r.d)), new T.LineBasicMaterial({ color: hex(r.color), transparent: true, opacity: 0.7 })); edges.position.set(r.x, 0.55, r.z); scene.add(edges);
      var wall = new T.MeshLambertMaterial({ color: hex(r.color), transparent: true, opacity: 0.22 });
      [[0, -r.d / 2, r.w, 0.12], [-r.w / 2, 0, 0.12, r.d], [r.w / 2, 0, 0.12, r.d]].forEach(function (w) { var m = new T.Mesh(new T.BoxGeometry(w[2], 1.1, w[3]), wall); m.position.set(r.x + w[0], 0.55, r.z + w[1]); scene.add(m); });
      var el = document.createElement('div'); el.className = 'room-lbl'; el.textContent = r.name; stage.appendChild(el);
      labels.push({ el: el, pos: new T.Vector3(r.x, 0.1, r.z + r.d / 2 - 0.7) });
    });
    var deskMat = new T.MeshLambertMaterial({ color: 0x8b6b4a }), legMat = new T.MeshLambertMaterial({ color: 0x334155 });
    lay.objects.forEach(function (o) {
      if (o.type === 'meeting_table') { var tb = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 0.12, 32), deskMat); tb.position.set(o.x, 0.78, o.z); scene.add(tb); var lg = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 0.75, 12), legMat); lg.position.set(o.x, 0.38, o.z); scene.add(lg); return; }
      var g = new T.Group(); g.position.set(o.x, 0, o.z); g.rotation.y = o.rot || 0;
      var top = new T.Mesh(new T.BoxGeometry(2.2, 0.08, 1.1), deskMat); top.position.y = 0.78; g.add(top);
      [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]].forEach(function (p) { var l = new T.Mesh(new T.BoxGeometry(0.08, 0.76, 0.08), legMat); l.position.set(p[0], 0.38, p[1]); g.add(l); });
      var scrMat = new T.MeshLambertMaterial({ color: 0x1e293b, emissive: 0x000000 });
      var scr = new T.Mesh(new T.BoxGeometry(0.9, 0.55, 0.05), scrMat); scr.position.set(0, 1.12, -0.35); g.add(scr);
      scene.add(g);
      var emp = lay.employees.filter(function (e) { return e.id === o.employee_id; })[0];
      if (!emp) return;
      var av = new T.Group(); av.position.set(o.x, 0, o.z + 1.0);
      var bodyM = new T.Mesh(new T.CylinderGeometry(0.28, 0.36, 0.95, 18), new T.MeshLambertMaterial({ color: hex(emp.avatar_color) })); bodyM.position.y = 0.48;
      var head = new T.Mesh(new T.SphereGeometry(0.24, 20, 16), new T.MeshLambertMaterial({ color: 0xf1c7a3 })); head.position.y = 1.18;
      var ringMat = new T.MeshBasicMaterial({ color: STATE_COLOR.idle, transparent: true, opacity: 1 }), ring = new T.Mesh(new T.TorusGeometry(0.55, 0.05, 8, 40), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04;
      av.add(bodyM); av.add(head); av.add(ring); scene.add(av);
      [bodyM, head].forEach(function (m) { m.userData.empId = emp.id; pickables.push(m); });
      var el2 = document.createElement('div'); el2.className = 'lbl'; stage.appendChild(el2);
      avatars[emp.id] = { group: av, ring: ringMat, screen: scrMat, head: head, el: el2, emp: emp, state: 'idle' };
      labels.push({ el: el2, pos: new T.Vector3(o.x, 1.75, o.z + 1.0), av: avatars[emp.id] });
    });
    // kamera orbit
    function fitR() { var vf = 45 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (W / Math.max(1, H))); return Math.min(105, Math.max(26, Math.max(19 / Math.tan(hf / 2), 15 / Math.tan(vf / 2)) * 1.12)); }
    var target = new T.Vector3(0, 0, -1), sph = { r: fitR(), th: 0.0, ph: 0.78 }, dirty = true, paused = false, raf = 0, last = 0;
    function placeCam() { sph.ph = Math.max(0.25, Math.min(1.45, sph.ph)); sph.r = Math.max(8, Math.min(110, sph.r)); camera.position.set(target.x + sph.r * Math.sin(sph.ph) * Math.sin(sph.th), target.y + sph.r * Math.cos(sph.ph), target.z + sph.r * Math.sin(sph.ph) * Math.cos(sph.th)); camera.lookAt(target); dirty = true; }
    placeCam();
    var el = renderer.domElement, ptrs = {}, drag = null, moved = 0, pinch = 0;
    el.addEventListener('pointerdown', function (e) { el.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; drag = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey }; moved = 0; var k = Object.keys(ptrs); if (k.length === 2) { pinch = Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y); } });
    el.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var k = Object.keys(ptrs);
      if (k.length === 2) { var d = Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y); if (pinch) sph.r *= pinch / d; pinch = d; moved += 10; placeCam(); return; }
      if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      if (drag.btn === 2 || drag.shift) { var f = sph.r / 600, s = Math.sin(sph.th), c = Math.cos(sph.th); target.x -= (dx * c + dy * s) * f; target.z -= (-dx * s + dy * c) * f; target.x = Math.max(-24, Math.min(24, target.x)); target.z = Math.max(-16, Math.min(16, target.z)); }
      else { sph.th -= dx * 0.008; sph.ph -= dy * 0.006; }
      placeCam();
    });
    var up = function (e) {
      delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = 0;
      if (drag && moved < 6) { var rect = el.getBoundingClientRect(), m = new T.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), rc = new T.Raycaster(); rc.setFromCamera(m, camera); var hit = rc.intersectObjects(pickables)[0]; if (hit) onPick(hit.object.userData.empId); }
      drag = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('wheel', function (e) { e.preventDefault(); sph.r *= e.deltaY > 0 ? 1.1 : 0.9; placeCam(); }, { passive: false });
    var ro = window.ResizeObserver ? new ResizeObserver(function () { W = stage.clientWidth; H = stage.clientHeight; if (!W || !H) return; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); dirty = true; }) : null;
    if (ro) ro.observe(stage);
    var v3 = new T.Vector3();
    function updateLabels() {
      labels.forEach(function (l) {
        v3.copy(l.pos).project(camera);
        var vis = v3.z < 1 && v3.x > -1.1 && v3.x < 1.1 && v3.y > -1.1 && v3.y < 1.1;
        l.el.style.display = vis ? '' : 'none';
        if (vis) { l.el.style.left = ((v3.x + 1) / 2 * W) + 'px'; l.el.style.top = ((1 - v3.y) / 2 * H) + 'px'; }
      });
    }
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (paused) return;
      var anim = Object.keys(avatars).some(function (k) { var a = avatars[k]; return a.state === 'working' || a.state === 'waiting' || a.state === 'queued'; });
      if (!dirty && !anim) return;
      if (anim && t - last < 33) return; // ~30 fps saat animasi
      last = t;
      Object.keys(avatars).forEach(function (k) {
        var a = avatars[k];
        if (a.state === 'working') { a.head.position.y = 1.18 + Math.sin(t / 220) * 0.04; a.screen.emissive.setHex(0x0e7a52); a.screen.emissiveIntensity = 0.6 + Math.sin(t / 300) * 0.25; }
        else { a.head.position.y = 1.18; a.screen.emissive.setHex(a.state === 'queued' ? 0x163d99 : 0x000000); }
        if (a.state === 'waiting') a.ring.opacity = 0.5 + Math.sin(t / 400) * 0.5;
      });
      renderer.render(scene, camera); updateLabels(); dirty = false;
    }
    raf = requestAnimationFrame(loop);
    this.setStatuses = function (st) {
      Object.keys(avatars).forEach(function (id) {
        var a = avatars[id], s = (st[id] || {}).state || 'idle'; a.state = s;
        a.ring.color.setHex(STATE_COLOR[s] || STATE_COLOR.idle); a.ring.opacity = 1;
        a.el.innerHTML = esc(a.emp.name) + ' · ' + esc(LABEL[s] || s) + ((st[id] || {}).task_title ? '<small>' + esc(st[id].task_title) + '</small>' : '<small>' + esc(a.emp.title) + '</small>');
      });
      dirty = true;
    };
    this.control = function (c) { if (c === 'in') sph.r *= 0.8; else if (c === 'out') sph.r *= 1.25; else { target.set(0, 0, -1); sph.r = fitR(); sph.th = 0; sph.ph = 0.78; } placeCam(); };
    this.setPaused = function (p) { paused = p; dirty = true; };
    this.themeChanged = function () { setTimeout(function () { floorMat.color.setHex(dark() ? 0x16223a : 0xe9eef6); dirty = true; }, 30); };
    this.destroy = function () {
      cancelAnimationFrame(raf); if (ro) ro.disconnect();
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
      labels.forEach(function (l) { l.el.remove(); }); el.remove();
    };
    self.placeCam = placeCam;
  }

  /** Fallback dashboard 2D (SVG) — tanpa WebGL / perangkat lemah. */
  function Office2D(stage, lay, onPick) {
    var sx = function (x) { return (x + 24) * 20; }, sz = function (z) { return (z + 16) * 20; }, z = 1;
    var svg = '<svg viewBox="0 0 960 640" style="width:100%;height:100%" id="o2d"><g id="o2g">' + lay.rooms.map(function (r) {
      return '<rect x="' + sx(r.x - r.w / 2) + '" y="' + sz(r.z - r.d / 2) + '" width="' + r.w * 20 + '" height="' + r.d * 20 + '" rx="10" fill="' + esc(r.color) + '" fill-opacity=".12" stroke="' + esc(r.color) + '" stroke-width="2"/><text x="' + sx(r.x) + '" y="' + (sz(r.z - r.d / 2) + 22) + '" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" opacity=".6">' + esc(r.name.toUpperCase()) + '</text>';
    }).join('') + lay.objects.map(function (o) {
      if (o.type === 'meeting_table') return '<circle cx="' + sx(o.x) + '" cy="' + sz(o.z) + '" r="40" fill="#8b6b4a" opacity=".5"/>';
      var e = lay.employees.filter(function (x) { return x.id === o.employee_id; })[0];
      return '<rect x="' + (sx(o.x) - 22) + '" y="' + (sz(o.z) - 11) + '" width="44" height="22" rx="4" fill="#8b6b4a" opacity=".55"/>' + (e ? '<g class="o2e" data-emp="' + esc(e.id) + '" style="cursor:pointer"><circle cx="' + sx(o.x) + '" cy="' + (sz(o.z) + 26) + '" r="15" fill="' + esc(e.avatar_color) + '"/><circle class="ring" cx="' + sx(o.x) + '" cy="' + (sz(o.z) + 26) + '" r="20" fill="none" stroke-width="4"/><text x="' + sx(o.x) + '" y="' + (sz(o.z) + 31) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">' + esc(initials(e.name)) + '</text><text class="st" x="' + sx(o.x) + '" y="' + (sz(o.z) + 60) + '" text-anchor="middle" font-size="12" fill="currentColor"></text></g>' : '');
    }).join('') + '</g></svg>';
    var wrap = document.createElement('div'); wrap.style.cssText = 'position:absolute;inset:0;color:var(--text)'; wrap.innerHTML = svg; stage.insertBefore(wrap, stage.firstChild);
    $$('.o2e', wrap).forEach(function (g) { g.addEventListener('click', function () { onPick(g.getAttribute('data-emp')); }); });
    var g = $('#o2g', wrap);
    this.setStatuses = function (st) { $$('.o2e', wrap).forEach(function (n) { var s = (st[n.getAttribute('data-emp')] || {}).state || 'idle'; $('.ring', n).setAttribute('stroke', '#' + (STATE_COLOR[s] || STATE_COLOR.idle).toString(16).padStart(6, '0')); var e = lay.employees.filter(function (x) { return x.id === n.getAttribute('data-emp'); })[0]; $('.st', n).textContent = e.name + ' · ' + (LABEL[s] || s); }); };
    this.control = function (c) { z = c === 'in' ? z * 1.2 : c === 'out' ? z / 1.2 : 1; z = Math.max(0.6, Math.min(3, z)); g.setAttribute('transform', 'translate(' + 480 * (1 - z) + ' ' + 320 * (1 - z) + ') scale(' + z + ')'); };
    this.setPaused = function () { }; this.themeChanged = function () { };
    this.destroy = function () { wrap.remove(); };
  }

  // ---------------- profil karyawan (drawer) ----------------
  function openEmployee(id) {
    api('GET', '/employees/' + id, {}, { noCache: true }).then(function (e) {
      var st = (S.statuses[e.id] || e.live || {}).state || 'idle', p = e.performance;
      var html = '<div class="row"><span class="avatar lg" style="background:' + esc(e.avatar_color) + ';color:#fff;cursor:default">' + esc(initials(e.name)) + '</span><div><h2 style="margin:0">' + esc(e.name) + '</h2><div>' + esc(e.title) + '</div><div class="muted small">' + esc(e.department) + ' · <span class="mono">' + esc(e.code) + '</span></div><div style="margin-top:6px">' + chip(st) + ' ' + chip(e.status) + '</div></div></div>' +
        ((S.statuses[e.id] || {}).task_title ? '<div class="notice" style="margin-top:12px">Sedang: <b>' + esc(S.statuses[e.id].task_title) + '</b></div>' : '') +
        '<div class="grid g3" style="margin-top:14px"><div class="card flat kpi"><div class="v">' + p.completed + '</div><div class="l">Selesai</div></div><div class="card flat kpi"><div class="v">' + p.failed + '</div><div class="l">Gagal</div></div><div class="card flat kpi"><div class="v">' + (p.avg_qa == null ? '—' : p.avg_qa) + '</div><div class="l">Rata-rata QA</div></div></div>' +
        '<h3 style="margin-top:16px">Tanggung jawab</h3><ul>' + (e.responsibilities || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
        '<h3>Tool yang diizinkan</h3><div class="row">' + e.tools.map(function (t) { return '<span class="chip plain mono">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<h3 style="margin-top:14px">Keahlian</h3><div class="row">' + e.skills.map(function (s) { return '<span class="chip plain">' + esc(s.skill) + ' · ' + s.level + '/5</span>'; }).join('') + '</div>' +
        '<h3 style="margin-top:14px">Kebijakan</h3><table class="t"><tr><td>Persetujuan</td><td class="mono">' + esc(e.approval_policy) + '</td></tr><tr><td>Batas biaya</td><td>' + usd(e.cost_limit_task_usd) + '/tugas · ' + usd(e.cost_limit_daily_usd) + '/hari</td></tr><tr><td>Timeout</td><td>' + e.timeout_sec + ' dtk</td></tr><tr><td>Model</td><td class="mono">' + esc((e.model_config || {}).model || 'default') + ' · temp ' + esc((e.model_config || {}).temperature) + '</td></tr><tr><td>Kriteria mutu</td><td>' + esc(((e.quality_criteria || {}).rules || []).join('; ')) + ' (min ' + esc((e.quality_criteria || {}).min_score) + ')</td></tr><tr><td>Izin data</td><td class="mono small">' + esc(JSON.stringify(e.data_permissions)) + '</td></tr></table>' +
        '<h3 style="margin-top:14px">Tugas terbaru</h3>' + (e.recent_tasks.length ? e.recent_tasks.map(function (t) { return '<div class="emp-row" data-task="' + esc(t.id) + '"><div class="grow"><b style="font-size:13px">' + esc(t.title) + '</b><div class="small muted">' + ago(t.updated_at) + '</div></div>' + chip(t.status) + '</div>'; }).join('') : '<div class="muted small">Belum ada.</div>') +
        '<div class="row" style="margin-top:16px">' + (can('task.create') && e.status === 'active' ? '<button class="btn primary" id="eAssign">' + ico('plus', 15) + 'Beri tugas</button>' : '') + (can('employee.manage') ? '<button class="btn" id="eEdit">' + ico('pen', 15) + 'Konfigurasi</button>' : '') + '</div>';
      var d = drawer('Profil Karyawan AI', html, function (d) {
        $$('[data-task]', d).forEach(function (r) { r.onclick = function () { openTask(r.getAttribute('data-task')); }; });
        var a = $('#eAssign', d); if (a) a.onclick = function () { newTaskModal(e); };
        var ed = $('#eEdit', d); if (ed) ed.onclick = function () { d.remove(); editEmployee(e); };
      });
      return d;
    }).catch(fail);
  }

  // =====================================================================
  // VIEW: DASBOR
  // =====================================================================
  VIEWS.dashboard = function (v) {
    return api('GET', '/dashboard').then(function (d) {
      var c = d.counts, notes = [];
      if (d.ai_provider === 'none') notes.push(['warn', 'AI provider belum dikonfigurasi. Sistem berjalan dalam mode berbasis aturan (deterministik). Isi GEMINI_API_KEY di Script Properties untuk mengaktifkan AI.']);
      if (d.worker_trigger === false) notes.push(['warn', 'Trigger worker belum terpasang — antrean hanya diproses saat tombol "Jalankan worker" ditekan.' + (can('system.manage') ? ' Pasang di Pengaturan → Sistem.' : '')]);
      if (d.emergency_stop) notes.push(['err', 'Emergency stop aktif.']);
      if (d.dead_letters) notes.push(['err', d.dead_letters + ' tugas di dead-letter queue perlu ditinjau.']);
      v.innerHTML = '<div class="row" style="margin-bottom:14px"><h1 style="margin:0">Dasbor</h1>' + (can('system.manage') ? '<button class="btn sm right" id="runW">' + ico('play', 14) + 'Jalankan worker</button>' : '') + '</div>' +
        notes.map(function (n) { return '<div class="notice ' + n[0] + '" style="margin-bottom:10px">' + esc(n[1]) + '</div>'; }).join('') +
        '<div class="grid g4">' + [['Tugas aktif', c.running + c.queued + c.retrying + c.waiting_dependency], ['Selesai 7 hari', d.completed_7d], ['Menunggu persetujuan', d.pending_approvals], ['Biaya AI bulan ini', usd(d.cost_month_usd)]].map(function (k) { return '<div class="card kpi"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>'; }).join('') + '</div>' +
        '<div class="grid g2" style="margin-top:14px"><div class="card"><h3>Status tugas</h3>' + Object.keys(c).map(function (k) { var pct = d.total ? Math.round(c[k] / d.total * 100) : 0; return '<div class="row" style="margin:6px 0"><span style="width:170px">' + chip(k) + '</span><div class="bar grow"><i style="width:' + pct + '%"></i></div><b style="width:36px;text-align:right">' + c[k] + '</b></div>'; }).join('') + '<div class="small muted" style="margin-top:8px">Tingkat keberhasilan: ' + (d.success_rate == null ? '—' : d.success_rate + '%') + ' · Artefak: ' + d.artifacts + '</div></div>' +
        '<div class="card"><h3>Workflow terbaru</h3>' + (d.recent_runs.length ? d.recent_runs.map(function (r) { return '<a class="emp-row" style="text-decoration:none;color:inherit" href="#/workflow/' + esc(r.id) + '"><div class="grow"><b style="font-size:13px">' + esc(r.title) + '</b><div class="small muted">' + fmtDate(r.created_at) + '</div></div>' + chip(r.status) + '</a>'; }).join('') : '<div class="empty">Belum ada workflow. <a href="#/workflow">Beri instruksi pertama</a>.</div>') +
        '<div class="small muted" style="margin-top:8px">Lisensi: ' + esc(d.license.label || d.license.plan) + ' · ' + esc(d.license.message || '') + '</div></div></div>';
      var rw = $('#runW'); if (rw) rw.onclick = runWorkerNow;
    });
  };
  function runWorkerNow() {
    toast('Worker berjalan…');
    return api('POST', '/system/worker/run').then(function (r) { toast(r.skipped ? 'Worker dilewati: ' + r.skipped : r.processed.length + ' tugas diproses' + (r.recovered ? ', ' + r.recovered + ' dipulihkan' : '') + '.', 'ok'); poll(); route(true); }).catch(fail);
  }

  // =====================================================================
  // VIEW: AI MANAGER / WORKFLOW
  // =====================================================================
  var TEMPLATES = [
    ['Laporan dari data', 'Analisis dataset terlampir, buat laporan ringkasan temuan utama per kategori beserta rekomendasi, dan simpan tabel datanya.'],
    ['Riset dokumen', 'Telusuri dokumen internal terkait kebijakan pengadaan, rangkum poin penting dan celah yang perlu diperbaiki dalam laporan.'],
    ['Undangan rapat', 'Siapkan ringkasan progres proyek bulan ini dan jadwalkan rapat evaluasi pada ' + new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + ' 10:00 dengan tim@perusahaan.co.id.'],
    ['Draf email', 'Buat laporan singkat status pekerjaan minggu ini dan siapkan draf email ke atasan@perusahaan.co.id.']
  ];
  VIEWS.workflow = function (v, args) {
    if (args[0]) return renderRun(v, args[0]);
    return api('GET', '/workflows/runs', {}, { query: { limit: 30 } }).then(function (runs) {
      var draft = store.get('wf_draft', { instruction: '', csv: '' });
      v.innerHTML = '<h1>AI Manager</h1><p class="muted" style="margin-top:-4px">Tulis instruksi; AI Office Manager menyusun rencana, Anda meninjau, lalu tim AI mengerjakan melalui antrean.</p>' +
        '<div class="grid g2"><div class="card col">' + (can('workflow.run') ? '<label class="f">Instruksi<textarea class="i" id="wfIns" rows="6" maxlength="20000" placeholder="Contoh: Analisis data penjualan terlampir dan buat laporan ringkas untuk direksi…">' + esc(draft.instruction) + '</textarea></label>' +
        '<div class="row">' + TEMPLATES.map(function (t, i) { return '<span class="chip plain tpl" data-t="' + i + '">' + esc(t[0]) + '</span>'; }).join('') + '</div>' +
        '<details ' + (draft.csv ? 'open' : '') + '><summary style="cursor:pointer;font-weight:600">Dataset (opsional, CSV)</summary><div class="col" style="margin-top:8px"><textarea class="i mono" id="wfCsv" rows="5" placeholder="kolom1,kolom2&#10;nilai,nilai">' + esc(draft.csv) + '</textarea><div class="row"><button class="btn sm" id="wfFile">Muat file .csv</button><span class="small muted" id="wfCsvInfo"></span></div></div></details>' +
        '<label class="row small" style="gap:6px"><input type="checkbox" id="wfRule"> Paksa perencana berbasis aturan (tanpa biaya AI)</label>' +
        '<div class="row"><button class="btn primary" id="wfPlan">' + ico('flow', 15) + 'Susun rencana</button></div>' : '<div class="notice">Peran Anda hanya dapat melihat workflow.</div>') + '</div>' +
        '<div class="card" id="wfPlanBox"><div class="empty">Rencana akan tampil di sini untuk ditinjau sebelum dijalankan.</div></div></div>' +
        '<h2 style="margin-top:22px">Riwayat workflow</h2><div class="col" id="wfRuns">' + (runs.length ? runs.map(runCard).join('') : '<div class="card empty">Belum ada workflow.</div>') + '</div>';
      if (!can('workflow.run')) return;
      var save = debounce(function () { if (!$('#wfIns') || !$('#wfCsv')) return; store.set('wf_draft', { instruction: $('#wfIns').value, csv: $('#wfCsv').value }); }, 400);
      $('#wfIns').oninput = save; $('#wfCsv').oninput = function () { save(); csvInfo(); };
      $$('.tpl').forEach(function (c) { c.onclick = function () { $('#wfIns').value = TEMPLATES[c.getAttribute('data-t')][1]; save(); }; });
      $('#wfFile').onclick = function () { pickFile('.csv,text/csv,text/plain').then(function (f) { if (!f) return; if (f.size > 2000000) return fail(new Error('File CSV maksimal 2 MB.')); var r = new FileReader(); r.onload = function () { $('#wfCsv').value = r.result; save(); csvInfo(); }; r.readAsText(f); }); };
      function csvInfo() { var t = $('#wfCsv').value.trim(); $('#wfCsvInfo').textContent = t ? (t.split('\n').length - 1) + ' baris data' : ''; }
      csvInfo();
      $('#wfPlan').onclick = function () { doPlan({}); };
    });
  };
  function doPlan(extra) {
    var ins = $('#wfIns').value.trim(), csv = $('#wfCsv').value.trim();
    if (ins.length < 3) return fail(new Error('Tulis instruksi terlebih dahulu.'));
    var body = Object.assign({ instruction: ins, planner: $('#wfRule').checked ? 'rule' : 'auto' }, extra);
    if (csv) body.dataset = { csv: csv };
    var box = $('#wfPlanBox'); box.innerHTML = '<div class="col"><b>AI Office Manager sedang menyusun rencana…</b><div class="skel"></div><div class="skel" style="width:60%"></div></div>';
    api('POST', '/workflows/plan', body).then(function (run) { renderPlan(box, run, ins); }).catch(function (e) { box.innerHTML = '<div class="notice err">' + esc(e.message) + '</div>' + (e.details && e.details.errors ? '<ul class="small">' + e.details.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''); });
  }
  function empById(id) { return S.employees.filter(function (e) { return e.id === id; })[0] || {}; }
  function ensureEmployees() { return S.employees.length ? Promise.resolve(S.employees) : api('GET', '/employees').then(function (l) { S.employees = l; return l; }); }
  function renderPlan(box, run, ins) {
    if (run.status === 'needs_clarification') {
      box.innerHTML = '<h3>' + chip('needs_clarification') + ' AI Manager butuh klarifikasi</h3><ol>' + run.clarification.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol><label class="f">Jawaban Anda<textarea class="i" id="wfAns" rows="3"></textarea></label><button class="btn primary" id="wfAnsBtn" style="margin-top:8px">Kirim jawaban & susun ulang</button>';
      $('#wfAnsBtn').onclick = function () { var a = $('#wfAns').value.trim(); if (!a) return; doPlan({ clarification_answers: a }); };
      return;
    }
    ensureEmployees().then(function () {
      var steps = run.plan.steps;
      box.innerHTML = '<div class="row"><h3 style="margin:0">' + esc(run.title) + '</h3><span class="chip plain right">' + esc(run.planner) + '</span></div>' +
        '<div class="small muted" style="margin:6px 0 10px">' + steps.length + ' langkah · perkiraan biaya AI ' + usd(run.estimated_cost_usd) + (run.requires_approval ? ' · <b style="color:var(--warning)">butuh persetujuan: ' + esc(run.approval_reasons.join('; ')) + '</b>' : '') + '</div>' +
        (run.plan.warnings || []).map(function (w) { return '<div class="notice warn small" style="margin-bottom:6px">' + esc(w) + '</div>'; }).join('') +
        '<div class="steps">' + steps.map(function (s, i) { var e = empById(s.employee_id); return '<div class="step"><div class="n">' + (i + 1) + '</div><div class="grow"><b>' + esc(s.title) + '</b><div class="small"><span class="dot" style="display:inline-block;background:' + esc(e.avatar_color || '#999') + '"></span> ' + esc(e.title || s.employee) + (s.tool ? ' · <span class="mono">' + esc(s.tool) + '</span>' : ' · analisis/QA') + (s.compose ? ' · isi disusun saat eksekusi' : '') + '</div>' + (s.depends_on.length ? '<div class="small muted">Menunggu: ' + esc(s.depends_on.join(', ')) + '</div>' : '') + '</div></div>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:12px"><button class="btn primary" id="wfGo">' + ico('play', 14) + (run.requires_approval ? 'Ajukan persetujuan' : 'Jalankan') + '</button><button class="btn" id="wfDiscard">Buang</button></div>';
      $('#wfGo').onclick = function () {
        this.disabled = true;
        api('POST', '/workflows/runs/' + run.id + '/confirm').then(function (r) { store.del('wf_draft'); toast(r.status === 'running' ? 'Workflow masuk antrean.' : 'Menunggu persetujuan.', 'ok'); location.hash = '#/workflow/' + r.id; poll(); }).catch(function (e) { fail(e); $('#wfGo').disabled = false; });
      };
      $('#wfDiscard').onclick = function () { box.innerHTML = '<div class="empty">Rencana dibuang (draf tetap tercatat di audit).</div>'; };
    });
  }
  function runCard(r) {
    return '<a class="card row" style="text-decoration:none;color:inherit" href="#/workflow/' + esc(r.id) + '"><div class="grow" style="min-width:200px"><b>' + esc(r.title) + '</b><div class="small muted">' + fmtDate(r.created_at) + ' · ' + esc(r.planner) + ' · ' + (r.tasks || []).length + ' tugas</div></div><div style="width:160px" class="hide-m"><div class="bar"><i style="width:' + (r.progress || 0) + '%"></i></div><div class="small muted">' + (r.progress || 0) + '% selesai</div></div>' + chip(r.status) + '</a>';
  }
  function renderRun(v, id) {
    return Promise.all([api('GET', '/workflows/runs/' + id, {}, { noCache: true }), ensureEmployees()]).then(function (x) {
      var r = x[0];
      v.innerHTML = '<a href="#/workflow" class="small">← Kembali</a><div class="row" style="margin:8px 0 12px"><h1 style="margin:0">' + esc(r.title) + '</h1>' + chip(r.status) + '<div class="right row">' + (['running', 'pending_approval', 'draft'].indexOf(r.status) >= 0 && can('workflow.run') ? '<button class="btn danger sm" id="rCancel">' + ico('stop', 14) + 'Batalkan</button>' : '') + '<button class="btn sm" id="rRef">' + ico('refresh', 14) + 'Muat ulang</button></div></div>' +
        '<div class="grid g4" style="margin-bottom:14px"><div class="card kpi"><div class="l">Progres</div><div class="v">' + (r.progress || 0) + '%</div></div><div class="card kpi"><div class="l">Tugas</div><div class="v">' + r.tasks.length + '</div></div><div class="card kpi"><div class="l">Perkiraan biaya</div><div class="v">' + usd(r.estimated_cost_usd) + '</div></div><div class="card kpi"><div class="l">Biaya aktual</div><div class="v">' + usd(r.actual_cost_usd) + '</div></div></div>' +
        (r.result_artifact_id ? '<div class="notice" style="margin-bottom:14px">✅ Hasil diserahkan. <a href="#" data-art="' + esc(r.result_artifact_id) + '">Buka dokumen serah terima</a></div>' : '') +
        '<div class="grid g2"><div class="card"><h3>Tugas</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Langkah</th><th>Karyawan</th><th>Status</th></tr></thead><tbody>' + r.tasks.map(function (t) { var e = empById(t.assignee_employee_id); return '<tr class="click" data-task="' + esc(t.id) + '"><td><b>' + esc(t.title) + '</b><div class="small muted mono">' + esc(t.tool_key || 'AI/QA') + (t.attempts ? ' · percobaan ' + t.attempts : '') + '</div></td><td class="small">' + esc(e.title || '') + '</td><td>' + chip(t.status) + (t.qa_score != null ? '<div class="small">QA ' + t.qa_score + '</div>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<h3 style="margin-top:14px">Instruksi</h3><div class="pre">' + esc(r.instruction) + '</div>' + (r.dataset_summary ? '<div class="small muted" style="margin-top:6px">Dataset: ' + r.dataset_summary.rows + ' baris · kolom ' + esc(r.dataset_summary.columns.join(', ')) + '</div>' : '') + '</div>' +
        '<div class="card"><h3>Artefak</h3>' + (r.artifacts.length ? r.artifacts.map(artRow).join('') : '<div class="muted small">Belum ada.</div>') + '<h3 style="margin-top:14px">Timeline</h3><div class="feed" style="max-height:420px">' + r.events.slice().reverse().map(function (e) { return '<div><b>' + esc(e.message) + '</b><div class="small muted">#' + e.seq + ' · ' + esc(e.type) + ' · ' + fmtDate(e.created_at) + '</div></div>'; }).join('') + '</div></div></div>';
      $$('[data-task]', v).forEach(function (r2) { r2.onclick = function () { openTask(r2.getAttribute('data-task')); }; });
      bindArt(v);
      var c = $('#rCancel'); if (c) c.onclick = function () { confirmBox('Batalkan workflow?', 'Semua tugas yang belum selesai akan dibatalkan.', 'Batalkan', true).then(function (y) { if (y) api('POST', '/workflows/runs/' + id + '/cancel').then(function () { toast('Dibatalkan.'); route(); }).catch(fail); }); };
      $('#rRef').onclick = function () { route(); };
    });
  }

  // =====================================================================
  // VIEW: TUGAS
  // =====================================================================
  var TASK_FILTERS = [['', 'Semua'], ['queued,running,retrying,waiting_dependency', 'Aktif'], ['waiting_human,pending_approval', 'Butuh tindakan'], ['completed', 'Selesai'], ['failed,cancelled', 'Gagal/batal'], ['draft', 'Draf']];
  VIEWS.tasks = function (v, args, soft) {
    var f = store.get('task_filter', ''), q = store.get('task_q', '');
    return Promise.all([api('GET', '/tasks', {}, { query: { status: f, q: q, limit: 300 } }), ensureEmployees()]).then(function (x) {
      var list = x[0];
      v.innerHTML = '<div class="row" style="margin-bottom:12px"><h1 style="margin:0">Tugas</h1><div class="right row">' + '<button class="btn sm" id="tExp">' + ico('dl', 14) + 'CSV</button>' + (can('task.create') ? '<button class="btn sm primary" id="tNew">' + ico('plus', 14) + 'Tugas baru</button>' : '') + '</div></div>' +
        '<div class="row" style="margin-bottom:10px">' + TASK_FILTERS.map(function (t) { return '<button class="btn sm ' + (f === t[0] ? 'primary' : '') + '" data-f="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '<input class="i right" id="tQ" placeholder="Cari judul…" style="max-width:220px" value="' + esc(q) + '"></div>' +
        '<div class="card" style="padding:0">' + (list.length ? '<div class="tbl-wrap" style="border:0"><table class="t"><thead><tr><th>Tugas</th><th class="hide-m">Karyawan</th><th>Status</th><th class="hide-m">Prioritas</th><th class="hide-m">Biaya</th><th class="hide-m">Diperbarui</th></tr></thead><tbody>' + list.map(function (t) { var e = empById(t.assignee_employee_id); return '<tr class="click" data-task="' + esc(t.id) + '"><td><b>' + esc(t.title) + '</b><div class="small muted mono">' + esc(t.tool_key || 'AI') + (t.error ? ' · <span style="color:var(--danger)">' + esc(t.error.slice(0, 80)) + '</span>' : '') + '</div></td><td class="hide-m small">' + esc(e.title || '') + '</td><td>' + chip(t.status) + '</td><td class="hide-m">P' + (t.priority || 3) + (t.deadline ? '<div class="small muted">⏰ ' + fmtDate(t.deadline, false) + '</div>' : '') + '</td><td class="hide-m small">' + usd(t.cost_usd) + '</td><td class="hide-m small muted">' + ago(t.updated_at) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">Tidak ada tugas.</div>') + '</div>';
      $$('[data-f]', v).forEach(function (b) { b.onclick = function () { store.set('task_filter', b.getAttribute('data-f')); route(); }; });
      $('#tQ').oninput = debounce(function () { store.set('task_q', this.value); route(true); }.bind($('#tQ')), 500);
      $$('[data-task]', v).forEach(function (r) { r.onclick = function () { openTask(r.getAttribute('data-task')); }; });
      var n = $('#tNew'); if (n) n.onclick = function () { newTaskModal(); };
      $('#tExp').onclick = function () { api('GET', '/tasks/export', {}, { noCache: true }).then(function (r) { download(r.filename, '﻿' + r.content, 'text/csv'); }).catch(fail); };
      if (soft && q) { var i = $('#tQ'); i.focus(); i.setSelectionRange(q.length, q.length); }
    });
  };
  var PARAM_TEMPLATES = {
    search_documents: { query: 'kata kunci', limit: 10 }, read_document: { artifact_id: '' }, create_document: { title: 'Judul dokumen', body: '# Judul\n\nIsi…' },
    create_spreadsheet: { title: 'Tabel', headers: ['Kolom A', 'Kolom B'], rows: [['1', '2']] }, analyze_dataset: { headers: ['wilayah', 'nilai'], rows: [['A', 10], ['B', 20]] },
    create_task: { title: 'Judul', assignee_code: 'researcher', priority: 3 }, create_email_draft: { to: 'nama@perusahaan.co.id', subject: 'Perihal', body: 'Isi email' }, create_calendar_draft: { title: 'Rapat', start: new Date(Date.now() + 86400000).toISOString(), attendees: [] }
  };
  function newTaskModal(emp) {
    ensureEmployees().then(function (emps) {
      var act = emps.filter(function (e) { return e.status === 'active'; });
      var m = modal({
        title: 'Tugas baru', body: '<div class="col"><label class="f">Judul<input class="i" id="ntTitle" maxlength="150"></label><label class="f">Deskripsi<textarea class="i" id="ntDesc" rows="3"></textarea></label>' +
          '<div class="grid g2"><label class="f">Karyawan AI<select class="i" id="ntEmp">' + act.map(function (e) { return '<option value="' + esc(e.id) + '"' + (emp && emp.id === e.id ? ' selected' : '') + '>' + esc(e.title) + '</option>'; }).join('') + '</select></label><label class="f">Tool<select class="i" id="ntTool"></select></label></div>' +
          '<label class="f" id="ntPWrap">Parameter tool (JSON)<textarea class="i mono" id="ntParams" rows="6"></textarea><span>Divalidasi oleh backend terhadap skema tool.</span></label><label class="row small" style="gap:6px" id="ntCompWrap"><input type="checkbox" id="ntComp"> Isi konten (body/description) disusun otomatis saat eksekusi</label>' +
          '<div class="grid g2"><label class="f">Prioritas<select class="i" id="ntPri"><option value="1">P1 — Kritis</option><option value="2">P2 — Tinggi</option><option value="3" selected>P3 — Normal</option><option value="4">P4 — Rendah</option><option value="5">P5 — Nanti</option></select></label><label class="f">Deadline<input class="i" type="datetime-local" id="ntDl"></label></div>' +
          '<label class="row small" style="gap:6px"><input type="checkbox" id="ntDraft"> Simpan sebagai draf (tidak langsung diantrekan)</label></div>',
        buttons: [{ text: 'Batal' }, { text: 'Buat tugas', cls: 'primary', fn: function (bg) {
          var tool = $('#ntTool', bg).value, params = {};
          if (tool) { try { params = JSON.parse($('#ntParams', bg).value || '{}'); } catch (e) { fail(new Error('JSON parameter tidak valid.')); return false; } }
          var body = { title: $('#ntTitle', bg).value.trim(), description: $('#ntDesc', bg).value, assignee_employee_id: $('#ntEmp', bg).value, tool_key: tool, tool_params: params, compose: $('#ntComp', bg).checked, priority: +$('#ntPri', bg).value, deadline: $('#ntDl', bg).value ? new Date($('#ntDl', bg).value).toISOString() : '', draft: $('#ntDraft', bg).checked };
          return api('POST', '/tasks', body, { idem: m.idem }).then(function (r) { toast(r.__queued ? 'Offline: tugas disimpan & dikirim saat online.' : (r.duplicate ? 'Tugas sudah ada (idempoten).' : 'Tugas dibuat.'), 'ok'); poll(); if (S.view === 'tasks') route(true); });
        } }]
      });
      m.idem = 'ui-' + uid();
      var fill = function () {
        var e = act.filter(function (x) { return x.id === $('#ntEmp', m.el).value; })[0];
        $('#ntTool', m.el).innerHTML = '<option value="">(tanpa tool — kerja AI/QA)</option>' + e.tools.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
        if (e.tools.length) $('#ntTool', m.el).value = e.tools[0];
        tpl();
      };
      var tpl = function () { var t = $('#ntTool', m.el).value; $('#ntPWrap', m.el).style.display = t ? '' : 'none'; $('#ntCompWrap', m.el).style.display = /create_document|create_email_draft|create_calendar_draft/.test(t) ? '' : 'none'; $('#ntParams', m.el).value = t ? JSON.stringify(PARAM_TEMPLATES[t] || {}, null, 2) : ''; };
      $('#ntEmp', m.el).onchange = fill; $('#ntTool', m.el).onchange = tpl; fill();
    });
  }
  function openTask(id) {
    api('GET', '/tasks/' + id, {}, { noCache: true }).then(function (t) {
      var e = empById(t.assignee_employee_id);
      var m = modal({
        title: t.title, wide: true,
        body: '<div class="row" style="margin-bottom:12px">' + chip(t.status) + '<span class="chip plain mono">' + esc(t.id) + '</span><span class="chip plain">' + esc(e.title || '') + '</span>' + (t.tool_key ? '<span class="chip plain mono">' + esc(t.tool_key) + '</span>' : '') + '<span class="chip plain">P' + t.priority + '</span>' + (t.qa_score != null ? '<span class="chip plain">QA ' + t.qa_score + '</span>' : '') + '</div>' +
          (t.error ? '<div class="notice ' + (t.status === 'failed' ? 'err' : 'warn') + '" style="margin-bottom:12px">' + esc(t.error) + '</div>' : '') +
          '<div class="tabs"><button class="on" data-tab="out">Hasil</button><button data-tab="runs">Eksekusi (' + t.runs.length + ')</button><button data-tab="ev">Event (' + t.events.length + ')</button><button data-tab="info">Detail</button></div>' +
          '<div data-pane="out">' + (t.output ? md(t.output) : '<div class="empty">Belum ada hasil.</div>') + (t.artifacts.length ? '<h3>Artefak</h3>' + t.artifacts.map(artRow).join('') : '') + '</div>' +
          '<div data-pane="runs" hidden><div class="tbl-wrap"><table class="t"><thead><tr><th>#</th><th>Execution ID</th><th>Status</th><th>Durasi</th><th>Token</th><th>Biaya</th></tr></thead><tbody>' + t.runs.map(function (r) { return '<tr><td>' + r.attempt + '</td><td class="mono small">' + esc(r.id) + '<div class="muted">' + esc(r.worker_id) + '</div></td><td>' + chip(r.status === 'succeeded' ? 'completed' : r.status === 'running' ? 'running' : r.status === 'discarded' || r.status === 'abandoned' ? 'cancelled' : 'failed', r.status) + (r.error ? '<div class="small" style="color:var(--danger)">' + esc(r.error) + '</div>' : '') + '</td><td>' + (r.duration_ms ? (r.duration_ms / 1000).toFixed(1) + ' dtk' : '—') + '</td><td class="small">' + (r.input_tokens || 0) + '/' + (r.output_tokens || 0) + '<div class="muted">' + esc(r.model || '') + '</div></td><td>' + usd(r.cost_usd) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
          '<div data-pane="ev" hidden><div class="feed" style="max-height:none">' + t.events.map(function (x) { return '<div><b>' + esc(x.message) + '</b><div class="small muted">#' + x.seq + ' · ' + esc(x.type) + ' · ' + fmtDate(x.created_at) + '</div></div>'; }).join('') + '</div></div>' +
          '<div data-pane="info" hidden><table class="t"><tr><td>Dibuat</td><td>' + fmtDate(t.created_at) + '</td></tr><tr><td>Mulai</td><td>' + fmtDate(t.started_at) + '</td></tr><tr><td>Selesai</td><td>' + fmtDate(t.completed_at) + '</td></tr><tr><td>Percobaan</td><td>' + t.attempts + ' / ' + t.max_attempts + '</td></tr><tr><td>Deadline</td><td>' + fmtDate(t.deadline) + '</td></tr><tr><td>Idempotency key</td><td class="mono small">' + esc(t.idempotency_key || '—') + '</td></tr><tr><td>Dependensi</td><td>' + (t.dependencies.map(function (d) { return esc(d.title) + ' ' + chip(d.status); }).join('<br>') || '—') + '</td></tr><tr><td>Deskripsi</td><td><div class="pre">' + esc(t.description || '') + '</div></td></tr><tr><td>Parameter</td><td><div class="pre">' + esc(JSON.stringify(t.tool_params, null, 2)) + '</div></td></tr></table></div>',
        buttons: [].concat(
          t.status === 'draft' && can('task.create') ? [{ text: 'Antrekan', cls: 'primary', fn: function () { return api('POST', '/tasks/' + id + '/queue').then(function () { toast('Diantrekan.', 'ok'); poll(); }); } }] : [],
          (t.status === 'failed' || t.status === 'waiting_human') && can('task.manage') ? [{ text: t.status === 'failed' ? 'Ulangi' : 'Lanjutkan', cls: 'primary', fn: function () { return api('POST', '/tasks/' + id + '/retry').then(function () { toast('Masuk antrean.', 'ok'); poll(); }); } }] : [],
          ['completed', 'failed', 'cancelled'].indexOf(t.status) < 0 ? [{ text: 'Batalkan tugas', cls: 'danger', fn: function () { return api('POST', '/tasks/' + id + '/cancel', { reason: 'Dibatalkan dari UI' }).then(function () { toast('Tugas dibatalkan.'); poll(); }); } }] : [],
          [{ text: 'Tutup' }])
      });
      $$('[data-tab]', m.el).forEach(function (b) { b.onclick = function () { $$('[data-tab]', m.el).forEach(function (x) { x.classList.toggle('on', x === b); }); $$('[data-pane]', m.el).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== b.getAttribute('data-tab'); }); }; });
      bindArt(m.el);
    }).catch(fail);
  }

  // =====================================================================
  // VIEW: KARYAWAN AI
  // =====================================================================
  VIEWS.employees = function (v) {
    return api('GET', '/employees').then(function (list) {
      S.employees = list;
      v.innerHTML = '<div class="row" style="margin-bottom:12px"><div><h1 style="margin:0">Karyawan AI</h1><div class="muted small">Setiap karyawan punya instruksi, tool, izin data, batas biaya & kriteria mutu yang berbeda.</div></div>' + (can('employee.manage') ? '<button class="btn sm primary right" id="eNew">' + ico('plus', 14) + 'Karyawan baru</button>' : '') + '</div>' +
        '<div class="grid g3">' + list.map(function (e) { var st = (S.statuses[e.id] || e.live).state; return '<div class="card emp-card" data-emp="' + esc(e.id) + '"><div class="row"><span class="avatar" style="width:46px;height:46px;background:' + esc(e.avatar_color) + ';color:#fff">' + esc(initials(e.name)) + '</span><div class="grow" style="min-width:0"><b>' + esc(e.title) + '</b><div class="small muted">' + esc(e.name) + ' · ' + esc(e.department) + '</div></div>' + chip(st) + '</div><div class="row" style="margin-top:10px;gap:5px">' + e.tools.map(function (t) { return '<span class="chip plain mono" style="font-size:10.5px">' + esc(t) + '</span>'; }).join('') + '</div><div class="row small muted" style="margin-top:10px"><span>✔ ' + e.performance.completed + '</span><span>✘ ' + e.performance.failed + '</span><span>QA ' + (e.performance.avg_qa == null ? '—' : e.performance.avg_qa) + '</span><span>⌀ ' + e.performance.avg_sec + ' dtk</span><span class="right">' + usd(e.performance.cost_usd) + '</span></div>' + (e.status !== 'active' ? '<div style="margin-top:6px">' + chip('inactive') + '</div>' : '') + '</div>'; }).join('') + '</div>';
      $$('[data-emp]', v).forEach(function (c) { c.onclick = function () { openEmployee(c.getAttribute('data-emp')); }; });
      var n = $('#eNew'); if (n) n.onclick = function () { editEmployee(null); };
    });
  };
  function editEmployee(e) {
    Promise.all([api('GET', '/tools'), api('GET', '/departments')]).then(function (x) {
      var tools = x[0], depts = x[1], isNew = !e; e = e || { tools: [], skills: [], model_config: { temperature: 0.3, max_output_tokens: 2048 }, quality_criteria: { min_score: 70, rules: [] }, approval_policy: 'risk_based', cost_limit_task_usd: 0.05, cost_limit_daily_usd: 1, timeout_sec: 120, responsibilities: [], avatar_color: '#475569', status: 'active', data_permissions: { read: ['artifacts'], write: [] } };
      modal({
        title: isNew ? 'Karyawan AI baru' : 'Konfigurasi ' + e.title, wide: true,
        body: '<div class="grid g2">' + (isNew ? '<label class="f">Kode unik<input class="i mono" id="ecCode" placeholder="legal_reviewer"></label>' : '') +
          '<label class="f">Nama<input class="i" id="ecName" value="' + esc(e.name || '') + '"></label><label class="f">Jabatan<input class="i" id="ecTitle" value="' + esc(e.title || '') + '"></label>' +
          '<label class="f">Departemen<select class="i" id="ecDept">' + depts.map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === e.department_id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></label>' +
          '<label class="f">Status<select class="i" id="ecStatus"><option value="active">Aktif</option><option value="inactive"' + (e.status === 'inactive' ? ' selected' : '') + '>Nonaktif</option></select></label>' +
          '<label class="f">Kebijakan persetujuan<select class="i" id="ecAppr">' + ['none', 'risk_based', 'external_requires_approval', 'always'].map(function (p) { return '<option' + (p === e.approval_policy ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></label>' +
          '<label class="f">Warna avatar<input class="i" type="color" id="ecColor" value="' + esc(e.avatar_color) + '" style="height:42px;padding:4px"></label>' +
          '<label class="f">Batas biaya/tugas (USD)<input class="i" type="number" step="0.001" min="0" id="ecCT" value="' + esc(e.cost_limit_task_usd) + '"></label><label class="f">Batas biaya/hari (USD)<input class="i" type="number" step="0.01" min="0" id="ecCD" value="' + esc(e.cost_limit_daily_usd) + '"></label>' +
          '<label class="f">Timeout (detik)<input class="i" type="number" min="10" max="300" id="ecTO" value="' + esc(e.timeout_sec) + '"></label><label class="f">Model (kosong = default)<input class="i mono" id="ecModel" value="' + esc((e.model_config || {}).model || '') + '"></label>' +
          '<label class="f">Temperature<input class="i" type="number" step="0.1" min="0" max="1.5" id="ecTemp" value="' + esc((e.model_config || {}).temperature) + '"></label><label class="f">Skor mutu minimum<input class="i" type="number" min="0" max="100" id="ecQ" value="' + esc((e.quality_criteria || {}).min_score) + '"></label></div>' +
          '<label class="f" style="margin-top:12px">System instructions<textarea class="i" id="ecSys" rows="5">' + esc(e.system_instructions || '') + '</textarea></label>' +
          '<label class="f" style="margin-top:12px">Tanggung jawab (satu per baris)<textarea class="i" id="ecResp" rows="3">' + esc((e.responsibilities || []).join('\n')) + '</textarea></label>' +
          '<label class="f" style="margin-top:12px">Aturan mutu (satu per baris)<textarea class="i" id="ecRules" rows="3">' + esc(((e.quality_criteria || {}).rules || []).join('\n')) + '</textarea></label>' +
          '<label class="f" style="margin-top:12px">Keahlian (format: nama:level, satu per baris)<textarea class="i" id="ecSkills" rows="3">' + esc((e.skills || []).map(function (s) { return s.skill + ':' + s.level; }).join('\n')) + '</textarea></label>' +
          '<div style="margin-top:12px"><b class="small">Tool yang diizinkan (least privilege)</b><div class="grid g2" style="margin-top:6px">' + tools.map(function (t) { return '<label class="row small" style="gap:6px"><input type="checkbox" class="ecTool" value="' + esc(t.key) + '"' + (e.tools.indexOf(t.key) >= 0 ? ' checked' : '') + '><span class="mono">' + esc(t.key) + '</span>' + chip(t.risk_level === 'high' ? 'failed' : t.risk_level === 'medium' ? 'waiting' : 'completed', t.risk_level) + '</label>'; }).join('') + '</div></div>',
        buttons: [{ text: 'Batal' }, { text: 'Simpan', cls: 'primary', fn: function (bg) {
          var lines = function (id) { return $(id, bg).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
          var body = { name: $('#ecName', bg).value, title: $('#ecTitle', bg).value, department_id: $('#ecDept', bg).value, status: $('#ecStatus', bg).value, approval_policy: $('#ecAppr', bg).value, avatar_color: $('#ecColor', bg).value, cost_limit_task_usd: +$('#ecCT', bg).value, cost_limit_daily_usd: +$('#ecCD', bg).value, timeout_sec: +$('#ecTO', bg).value, model_config: { model: $('#ecModel', bg).value.trim(), temperature: +$('#ecTemp', bg).value, max_output_tokens: (e.model_config || {}).max_output_tokens || 2048 }, quality_criteria: { min_score: +$('#ecQ', bg).value, rules: lines('#ecRules') }, system_instructions: $('#ecSys', bg).value, responsibilities: lines('#ecResp'), skills: lines('#ecSkills').map(function (l) { var p = l.split(':'); return { skill: p[0], level: +p[1] || 3 }; }), tools: $$('.ecTool', bg).filter(function (c) { return c.checked; }).map(function (c) { return c.value; }) };
          if (isNew) body.code = $('#ecCode', bg).value;
          return api(isNew ? 'POST' : 'PUT', isNew ? '/employees' : '/employees/' + e.id, body).then(function () { toast('Tersimpan.', 'ok'); S.employees = []; route(); });
        } }]
      });
    }).catch(fail);
  }

  // =====================================================================
  // VIEW: PERSETUJUAN
  // =====================================================================
  VIEWS.approvals = function (v) {
    var tab = store.get('appr_tab', 'pending');
    return api('GET', '/approvals', {}, { query: { status: tab === 'pending' ? 'pending' : '' } }).then(function (list) {
      v.innerHTML = '<h1>Pusat Persetujuan</h1><div class="tabs"><button data-t="pending" class="' + (tab === 'pending' ? 'on' : '') + '">Menunggu</button><button data-t="all" class="' + (tab === 'all' ? 'on' : '') + '">Semua</button></div>' +
        (list.length ? '<div class="col">' + list.map(function (a) {
          var d = a.details || {}, p = d.params;
          return '<div class="card"><div class="row"><b class="grow">' + esc(a.title) + '</b>' + chip(a.risk_level === 'high' ? 'failed' : 'waiting', 'risiko ' + ({ low: 'rendah', medium: 'sedang', high: 'tinggi' }[a.risk_level] || a.risk_level)) + chip(a.status) + '</div><div class="small muted" style="margin:4px 0 8px">' + esc(a.subject_type) + ' · diminta ' + esc(a.requested_by_name) + ' · ' + fmtDate(a.created_at) + (a.expires_at ? ' · kedaluwarsa ' + fmtDate(a.expires_at) : '') + '</div><div>' + esc(a.reason) + '</div>' +
            (p ? '<details style="margin-top:8px" open><summary class="small" style="cursor:pointer;font-weight:600">Yang akan dijalankan (' + esc(d.tool) + ')</summary>' + (p.to ? '<div class="small" style="margin-top:6px"><b>Kepada:</b> ' + esc(p.to) + '<br><b>Subjek:</b> ' + esc(p.subject) + '</div>' : '') + '<div class="pre" style="margin-top:6px">' + esc(p.body || p.description || JSON.stringify(p, null, 2)) + '</div></details>' : '') +
            (d.issues && d.issues.length ? '<ul class="small">' + d.issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '') +
            (a.status === 'pending' ? (a.can_decide ? '<div class="row" style="margin-top:10px"><input class="i grow" placeholder="Catatan (opsional)" data-note="' + esc(a.id) + '"><button class="btn primary" data-ok="' + esc(a.id) + '">Setujui</button><button class="btn danger" data-no="' + esc(a.id) + '">Tolak</button></div>' : '<div class="small muted" style="margin-top:8px">Menunggu keputusan pihak lain (pemisahan tugas).</div>') : '<div class="small muted" style="margin-top:8px">' + (a.note ? 'Catatan: ' + esc(a.note) + ' · ' : '') + fmtDate(a.decided_at) + '</div>') + '</div>';
        }).join('') + '</div>' : '<div class="card empty">Tidak ada permintaan persetujuan.</div>');
      $$('[data-t]', v).forEach(function (b) { b.onclick = function () { store.set('appr_tab', b.getAttribute('data-t')); route(); }; });
      var decide = function (id, dec) { var n = $('[data-note="' + id + '"]', v); api('POST', '/approvals/' + id + '/decide', { decision: dec, note: n ? n.value : '' }).then(function () { toast(dec === 'approve' ? 'Disetujui — tugas kembali ke antrean.' : 'Ditolak.', 'ok'); poll(); route(true); }).catch(fail); };
      $$('[data-ok]', v).forEach(function (b) { b.onclick = function () { decide(b.getAttribute('data-ok'), 'approve'); }; });
      $$('[data-no]', v).forEach(function (b) { b.onclick = function () { confirmBox('Tolak permintaan?', 'Tugas terkait akan dibatalkan.', 'Tolak', true).then(function (y) { if (y) decide(b.getAttribute('data-no'), 'reject'); }); }; });
    });
  };

  // =====================================================================
  // VIEW: ARTEFAK
  // =====================================================================
  var ART_ICON = { document: '📄', spreadsheet: '📊', email_draft: '✉️', calendar_draft: '📅', workflow_summary: '✅' };
  function artRow(a) { return '<div class="emp-row" data-art="' + esc(a.id) + '"><span style="font-size:20px">' + (ART_ICON[a.type] || '📎') + '</span><div class="grow" style="min-width:0"><b style="font-size:13px">' + esc(a.title) + '</b><div class="small muted">' + esc(a.type) + ' · ' + (a.size || 0).toLocaleString('id-ID') + ' karakter · ' + fmtDate(a.created_at) + '</div></div></div>'; }
  function bindArt(root) { $$('[data-art]', root).forEach(function (r) { r.onclick = function (e) { e.preventDefault(); openArtifact(r.getAttribute('data-art')); }; }); }
  VIEWS.artifacts = function (v) {
    var type = store.get('art_type', '');
    return api('GET', '/artifacts', {}, { query: { type: type } }).then(function (list) {
      v.innerHTML = '<h1>Artefak</h1><div class="row" style="margin-bottom:10px">' + [['', 'Semua'], ['document', 'Dokumen'], ['spreadsheet', 'Tabel'], ['email_draft', 'Draf email'], ['calendar_draft', 'Undangan'], ['workflow_summary', 'Serah terima']].map(function (t) { return '<button class="btn sm ' + (type === t[0] ? 'primary' : '') + '" data-ty="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div class="card">' + (list.length ? list.map(artRow).join('') : '<div class="empty">Belum ada artefak.</div>') + '</div>';
      $$('[data-ty]', v).forEach(function (b) { b.onclick = function () { store.set('art_type', b.getAttribute('data-ty')); route(); }; });
      bindArt(v);
    });
  };
  function openArtifact(id) {
    api('GET', '/artifacts/' + id, {}, { noCache: true }).then(function (a) {
      var view;
      if (a.mime === 'text/markdown') view = md(a.content);
      else if (a.mime === 'text/csv') { var rows = a.content.split('\n').slice(0, 200).map(function (l) { return l.split(','); }); view = '<div class="tbl-wrap"><table class="t">' + rows.map(function (r, i) { return '<tr>' + r.map(function (c) { return (i ? '<td>' : '<th>') + esc(c.replace(/^"|"$/g, '')) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('') + '</table></div>'; }
      else view = '<div class="pre">' + esc(a.content) + '</div>';
      modal({ title: a.title, wide: true, body: '<div class="row small muted" style="margin-bottom:10px"><span class="mono">' + esc(a.id) + '</span><span>' + esc(a.mime) + '</span><span>checksum ' + esc(a.checksum) + '</span>' + (a.url ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">Buka di Google</a>' : '') + '</div>' + view,
        buttons: [{ text: 'Salin', fn: function () { if (navigator.clipboard) navigator.clipboard.writeText(a.content).then(function () { toast('Disalin.'); }); return false; } }, { text: 'Unduh ' + (a.filename || ''), cls: 'primary', fn: function () { download(a.filename, a.content, a.mime); return false; } }] });
    }).catch(fail);
  }

  // =====================================================================
  // VIEW: BIAYA
  // =====================================================================
  VIEWS.costs = function (v) {
    var days = store.get('cost_days', 30);
    return api('GET', '/usage/summary', {}, { query: { days: days } }).then(function (u) {
      var dayKeys = []; for (var i = days - 1; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
      var max = Math.max.apply(null, dayKeys.map(function (k) { return u.by_day[k] || 0; }).concat([0.000001]));
      var budgetPct = u.monthly_budget_usd ? Math.min(100, Math.round(u.month_usd / u.monthly_budget_usd * 100)) : 0;
      v.innerHTML = '<div class="row" style="margin-bottom:12px"><h1 style="margin:0">Biaya & Penggunaan</h1><select class="i right" id="cDays" style="width:auto">' + [7, 30, 90].map(function (d) { return '<option value="' + d + '"' + (d === days ? ' selected' : '') + '>' + d + ' hari</option>'; }).join('') + '</select></div>' +
        (u.ai_provider === 'none' ? '<div class="notice warn" style="margin-bottom:12px">AI provider belum dikonfigurasi — biaya AI nol karena sistem berjalan berbasis aturan.</div>' : '') +
        '<div class="grid g4"><div class="card kpi"><div class="l">Bulan ini</div><div class="v">' + usd(u.month_usd) + '</div><div class="bar" style="margin-top:6px"><i style="width:' + budgetPct + '%;background:' + (budgetPct > 85 ? 'var(--danger)' : 'var(--primary)') + '"></i></div><div class="small muted">Anggaran ' + usd(u.monthly_budget_usd) + '</div></div><div class="card kpi"><div class="l">' + days + ' hari</div><div class="v">' + usd(u.total_usd) + '</div></div><div class="card kpi"><div class="l">Panggilan AI</div><div class="v">' + u.calls + '</div></div><div class="card kpi"><div class="l">Token in / out</div><div class="v" style="font-size:18px">' + u.input_tokens.toLocaleString('id-ID') + ' / ' + u.output_tokens.toLocaleString('id-ID') + '</div></div></div>' +
        '<div class="card" style="margin-top:14px"><h3>Biaya harian</h3><div class="chart-bars">' + dayKeys.map(function (k) { var val = u.by_day[k] || 0; return '<div style="height:' + Math.max(1, val / max * 100) + '%" title="' + k + ': ' + usd(val) + '"></div>'; }).join('') + '</div><div class="row small muted"><span>' + dayKeys[0] + '</span><span class="right">' + dayKeys[dayKeys.length - 1] + '</span></div></div>' +
        '<div class="grid g2" style="margin-top:14px"><div class="card"><h3>Per karyawan</h3>' + (Object.keys(u.by_employee).length ? '<table class="t">' + Object.keys(u.by_employee).sort(function (a, b) { return u.by_employee[b] - u.by_employee[a]; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td style="text-align:right">' + usd(u.by_employee[k]) + '</td></tr>'; }).join('') + '</table>' : '<div class="empty">Belum ada data.</div>') + '</div>' +
        '<div class="card"><h3>Per model</h3>' + (Object.keys(u.by_model).length ? '<table class="t"><tr><th>Model</th><th>Panggilan</th><th>Token</th><th>Biaya</th></tr>' + Object.keys(u.by_model).map(function (k) { var m = u.by_model[k]; return '<tr><td class="mono small">' + esc(k) + '</td><td>' + m.calls + '</td><td>' + m.tokens.toLocaleString('id-ID') + '</td><td>' + usd(m.cost) + '</td></tr>'; }).join('') + '</table>' : '<div class="empty">Belum ada data.</div>') + '<div class="small muted" style="margin-top:8px">Kuota lisensi: ' + u.tasks_this_month + ' / ' + u.license_limits.max_tasks_month.toLocaleString('id-ID') + ' tugas bulan ini.</div></div></div>';
      $('#cDays').onchange = function () { store.set('cost_days', +this.value); route(); };
    });
  };

  // =====================================================================
  // VIEW: AUDIT
  // =====================================================================
  VIEWS.audit = function (v) {
    var q = store.get('audit_q', '');
    return api('GET', '/audit', {}, { query: { action: q, limit: 300 } }).then(function (list) {
      v.innerHTML = '<div class="row" style="margin-bottom:12px"><h1 style="margin:0">Audit Log</h1><input class="i right" id="aQ" placeholder="Filter aksi (mis. tool, auth, approval)" style="max-width:280px" value="' + esc(q) + '"><button class="btn sm" id="aDl">' + ico('dl', 14) + 'Unduh JSON</button></div>' +
        '<div class="card" style="padding:0"><div class="tbl-wrap" style="border:0;max-height:calc(100vh - 220px)"><table class="t"><thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th class="hide-m">Target</th><th>Hasil</th><th class="hide-m">Detail</th></tr></thead><tbody>' + list.map(function (a) { return '<tr><td class="small">' + fmtDate(a.created_at) + '</td><td class="small mono">' + esc(a.actor_type) + '<div class="muted">' + esc((a.actor_id || '').slice(0, 22)) + '</div></td><td class="mono small"><b>' + esc(a.action) + '</b></td><td class="hide-m small mono">' + esc(a.target_type) + ' ' + esc((a.target_id || '').slice(0, 22)) + '</td><td>' + chip(a.result === 'ok' ? 'completed' : a.result === 'denied' ? 'denied' : 'failed', a.result) + '</td><td class="hide-m small mono" style="max-width:320px;overflow-wrap:anywhere">' + esc(JSON.stringify(a.details || {}).slice(0, 220)) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      $('#aQ').onchange = function () { store.set('audit_q', this.value.trim()); route(); };
      $('#aDl').onclick = function () { download('audit-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(list, null, 2), 'application/json'); };
    });
  };

  // =====================================================================
  // VIEW: PENGATURAN
  // =====================================================================
  VIEWS.settings = function (v, args) {
    var tab = args[0] || store.get('set_tab', 'org');
    var tabs = [['org', 'Organisasi'], ['members', 'Anggota'], ['ai', 'AI & Anggaran'], ['integrations', 'Integrasi'], ['license', 'Lisensi'], ['system', 'Sistem']];
    v.innerHTML = '<h1>Pengaturan</h1><div class="tabs">' + tabs.map(function (t) { return '<button data-st="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="setBody"></div>';
    $$('[data-st]', v).forEach(function (b) { b.onclick = function () { store.set('set_tab', b.getAttribute('data-st')); location.hash = '#/settings/' + b.getAttribute('data-st'); }; });
    var body = $('#setBody');
    return (SETTINGS[tab] || SETTINGS.org)(body);
  };
  var SETTINGS = {
    org: function (el) {
      var b = S.me.org.branding;
      el.innerHTML = '<div class="grid g2"><div class="card col"><h3>Identitas & header</h3><div class="row"><img class="logo" id="soLogo" style="width:88px;height:88px" src="' + esc(b.logo || DEFAULT_LOGO) + '" alt="Logo"><div class="small muted">Klik logo untuk zoom.<br>Logo dikompres otomatis ≤512px.</div></div>' +
        '<label class="f">Nama organisasi<input class="i" id="soName" value="' + esc(S.me.org.name) + '"' + (can('org.manage') ? '' : ' disabled') + '></label><label class="f">Judul header<input class="i" id="soTitle" maxlength="60" value="' + esc(b.title) + '"' + (can('org.manage') ? '' : ' disabled') + '></label><label class="f">Subjudul<input class="i" id="soSub" maxlength="80" value="' + esc(b.subtitle) + '"' + (can('org.manage') ? '' : ' disabled') + '></label>' +
        (can('org.manage') ? '<div class="row"><button class="btn" id="soUp">Ganti logo</button><button class="btn primary" id="soSave">Simpan</button></div>' : '') + '</div>' +
        '<div class="card"><h3>Departemen</h3><div id="soDepts" class="col"></div>' + (can('department.manage') ? '<div class="row" style="margin-top:10px"><input class="i" id="sdCode" placeholder="KODE" style="max-width:100px"><input class="i grow" id="sdName" placeholder="Nama departemen"><button class="btn" id="sdAdd">Tambah</button></div>' : '') + '</div>' +
        '<div class="card col"><h3>Dokumen hukum & pelindungan data</h3><p class="small muted">Dipakai di Syarat & Ketentuan dan Pemberitahuan Privasi (organisasi = pengendali data). Pengguna diminta menyetujui dokumen saat pertama login.</p><label class="f">Email kontak pelindungan data<input class="i" id="slMail" type="email" value="' + esc(((S.me.org.legal || {}).contact_email) || '') + '"' + (can('org.manage') ? '' : ' disabled') + '></label><label class="f">Nama penyedia aplikasi<input class="i" id="slProv" maxlength="120" value="' + esc(((S.me.org.legal || {}).provider_name) || '') + '"' + (can('org.manage') ? '' : ' disabled') + '></label><div class="row">' + (can('org.manage') ? '<button class="btn primary" id="slSave">Simpan</button>' : '') + '<button class="btn" data-legal="terms">Lihat S&amp;K</button><button class="btn" data-legal="privacy">Lihat Privasi</button></div></div></div>';
      var newLogo;
      $('#soLogo').onclick = function () { zoomImage(this.src, 'Logo'); };
      if (can('org.manage')) {
        $('#soUp').onclick = function () { pickFile('image/*').then(function (f) { return readImage(f, 512, 'image/png'); }).then(function (d) { newLogo = d; $('#soLogo').src = d; }).catch(fail); };
        $('#soSave').onclick = function () { api('PUT', '/org', { name: $('#soName').value, title: $('#soTitle').value, subtitle: $('#soSub').value, logo: newLogo }).then(function (o) { S.me.org = o; store.set('me', S.me); renderShell(); route(); toast('Tersimpan.', 'ok'); }).catch(fail); };
      }
      bindLegalLinks(el);
      var sl = $('#slSave'); if (sl) sl.onclick = function () { api('PUT', '/settings', { legal_contact_email: $('#slMail').value.trim(), legal_provider_name: $('#slProv').value.trim() }).then(function (r) { S.me.org.legal = { contact_email: r.legal_contact_email || '', provider_name: r.legal_provider_name || '' }; store.set('me', S.me); toast('Tersimpan.', 'ok'); }).catch(fail); };
      api('GET', '/departments').then(function (d) { $('#soDepts').innerHTML = d.map(function (x) { return '<div class="row"><i class="dot" style="background:' + esc(x.color) + '"></i><b>' + esc(x.name) + '</b><span class="mono small muted">' + esc(x.code) + '</span></div>'; }).join(''); });
      var add = $('#sdAdd'); if (add) add.onclick = function () { api('POST', '/departments', { code: $('#sdCode').value, name: $('#sdName').value }).then(function () { toast('Departemen ditambahkan.', 'ok'); route(); }).catch(fail); };
    },
    members: function (el) {
      return api('GET', '/org/members', {}, { noCache: true }).then(function (list) {
        el.innerHTML = '<div class="card" style="padding:0"><div class="tbl-wrap" style="border:0"><table class="t"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th class="hide-m">Login terakhir</th><th></th></tr></thead><tbody>' + list.map(function (m) { return '<tr><td><b>' + esc(m.name) + '</b></td><td class="small">' + esc(m.email) + '</td><td>' + (can('member.manage') && m.user_id !== S.me.user.id ? '<select class="i" data-role="' + esc(m.id) + '" style="width:auto;padding:4px 8px">' + ['viewer', 'member', 'manager', 'admin', 'owner'].map(function (r) { return '<option' + (r === m.role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>' : '<span class="chip plain">' + esc(m.role) + '</span>') + '</td><td>' + chip(m.status) + '</td><td class="hide-m small muted">' + fmtDate(m.last_login_at) + '</td><td>' + (can('member.manage') && m.user_id !== S.me.user.id ? '<button class="btn sm" data-sus="' + esc(m.id) + '" data-st="' + (m.status === 'active' ? 'suspended' : 'active') + '">' + (m.status === 'active' ? 'Tangguhkan' : 'Aktifkan') + '</button> <button class="btn sm" data-pw="' + esc(m.id) + '">Reset sandi</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
          (can('member.manage') ? '<div class="card" style="margin-top:14px"><h3>Tambah anggota</h3><div class="grid g4"><input class="i" id="nmName" placeholder="Nama"><input class="i" id="nmEmail" type="email" placeholder="Email"><input class="i" id="nmPw" type="text" placeholder="Sandi awal (≥8, huruf+angka)"><select class="i" id="nmRole"><option>member</option><option>viewer</option><option>manager</option><option>admin</option></select></div><button class="btn primary" id="nmAdd" style="margin-top:10px">Tambah</button></div>' : '');
        $$('[data-role]', el).forEach(function (s) { s.onchange = function () { api('PUT', '/org/members/' + s.getAttribute('data-role'), { role: s.value }).then(function () { toast('Peran diubah.', 'ok'); }).catch(function (e) { fail(e); route(); }); }; });
        $$('[data-sus]', el).forEach(function (b) { b.onclick = function () { api('PUT', '/org/members/' + b.getAttribute('data-sus'), { status: b.getAttribute('data-st') }).then(function () { route(); }).catch(fail); }; });
        $$('[data-pw]', el).forEach(function (b) { b.onclick = function () { promptBox('Reset kata sandi', 'Kata sandi baru (≥8, huruf + angka)').then(function (pw) { if (pw) api('PUT', '/org/members/' + b.getAttribute('data-pw'), { password: pw }).then(function () { toast('Kata sandi direset.', 'ok'); }).catch(fail); }); }; });
        var add = $('#nmAdd'); if (add) add.onclick = function () { api('POST', '/org/members', { name: $('#nmName').value, email: $('#nmEmail').value, password: $('#nmPw').value, role: $('#nmRole').value }).then(function () { toast('Anggota ditambahkan.', 'ok'); route(); }).catch(fail); };
      });
    },
    ai: function (el) {
      return api('GET', '/settings', {}, { noCache: true }).then(function (s) {
        var ed = can('org.manage');
        el.innerHTML = '<div class="grid g2"><div class="card col"><h3>Provider AI</h3><div>Status: ' + (s.ai_provider === 'none' ? chip('waiting', 'Belum dikonfigurasi') : chip('completed', s.ai_provider)) + '</div><p class="small muted">API key TIDAK disimpan di aplikasi/browser. Atur di Apps Script → Project Settings → Script Properties: <span class="mono">GEMINI_API_KEY</span> atau <span class="mono">OPENAI_API_KEY</span> (+ <span class="mono">OPENAI_BASE_URL</span> untuk layanan kompatibel OpenAI).</p>' +
          '<label class="f">Model default Gemini<input class="i mono" id="saG" value="' + esc(s.default_model_gemini || '') + '"' + (ed ? '' : ' disabled') + '></label><label class="f">Model default OpenAI-compatible<input class="i mono" id="saO" value="' + esc(s.default_model_openai || '') + '"' + (ed ? '' : ' disabled') + '></label></div>' +
          '<div class="card col"><h3>Anggaran & kebijakan</h3><label class="f">Anggaran AI bulanan (USD)<input class="i" type="number" step="0.5" id="saB" value="' + esc(s.monthly_budget_usd) + '"' + (ed ? '' : ' disabled') + '></label><label class="f">Ambang biaya yang butuh persetujuan (USD)<input class="i" type="number" step="0.01" id="saT" value="' + esc(s.approval_cost_threshold_usd) + '"' + (ed ? '' : ' disabled') + '></label><label class="f">Skor QA minimum default<input class="i" type="number" id="saQ" value="' + esc(s.qa_min_score) + '"' + (ed ? '' : ' disabled') + '></label>' +
          '<label class="f">Harga model (USD per 1 juta token [input, output])<textarea class="i mono" id="saP" rows="6"' + (ed ? '' : ' disabled') + '>' + esc(JSON.stringify(s.ai_prices, null, 1)) + '</textarea><span>Periksa harga terbaru di halaman resmi penyedia; nilai ini hanya untuk estimasi biaya.</span></label>' + (ed ? '<button class="btn primary" id="saSave">Simpan</button>' : '') + '</div></div>';
        var sv = $('#saSave'); if (sv) sv.onclick = function () { var prices; try { prices = JSON.parse($('#saP').value); } catch (e) { return fail(new Error('JSON harga tidak valid.')); } api('PUT', '/settings', { default_model_gemini: $('#saG').value, default_model_openai: $('#saO').value, monthly_budget_usd: +$('#saB').value, approval_cost_threshold_usd: +$('#saT').value, qa_min_score: +$('#saQ').value, ai_prices: prices }).then(function () { toast('Tersimpan.', 'ok'); }).catch(fail); };
      });
    },
    integrations: function (el) {
      return api('GET', '/integrations', {}, { noCache: true }).then(function (list) {
        el.innerHTML = '<div class="col">' + list.map(function (i) { return '<div class="card row"><div class="grow"><b>' + esc(i.name) + '</b><div class="small muted mono">' + esc(i.key) + (i.allowed_by_license ? '' : ' · butuh paket Pro') + '</div></div>' + chip(i.enabled ? 'completed' : 'idle', i.enabled ? 'Aktif' : 'Nonaktif') + (can('integration.manage') ? '<button class="btn sm" data-int="' + esc(i.key) + '" data-en="' + (i.enabled ? '0' : '1') + '"' + (!i.allowed_by_license && !i.enabled ? ' disabled' : '') + '>' + (i.enabled ? 'Matikan' : 'Aktifkan') + '</button>' : '') + '</div>'; }).join('') + '<div class="notice small">Tidak ada integrasi yang MENGIRIM email, memublikasi, atau bertransaksi. Gmail hanya menyimpan draf dan membutuhkan scope tambahan https://mail.google.com/ di appsscript.json.</div></div>';
        $$('[data-int]', el).forEach(function (b) { b.onclick = function () { api('PUT', '/integrations/' + b.getAttribute('data-int'), { enabled: b.getAttribute('data-en') === '1' }).then(function () { route(); }).catch(fail); }; });
      });
    },
    license: function (el) {
      return api('GET', '/license', {}, { noCache: true }).then(function (l) {
        el.innerHTML = '<div class="grid g2"><div class="card col"><h3>Status lisensi</h3><div class="row">' + chip(l.status === 'active' ? 'completed' : 'failed', l.status === 'active' ? 'Aktif' : 'Tidak aktif') + '<span class="chip plain">' + esc(l.label || l.plan) + '</span></div><div>' + esc(l.message) + '</div><table class="t"><tr><td>Pemegang</td><td>' + esc(l.licensee || '—') + '</td></tr><tr><td>Berlaku s.d.</td><td>' + esc(l.expires || '—') + (l.days_left != null ? ' (' + l.days_left + ' hari)' : '') + '</td></tr><tr><td>Maks pengguna</td><td>' + l.limits.max_users.toLocaleString('id-ID') + '</td></tr><tr><td>Maks tugas/bulan</td><td>' + l.limits.max_tasks_month.toLocaleString('id-ID') + '</td></tr><tr><td>Maks karyawan AI</td><td>' + l.limits.max_employees + '</td></tr><tr><td>Integrasi</td><td class="mono small">' + esc(l.limits.integrations.join(', ')) + '</td></tr></table></div>' +
          '<div class="card col"><h3>Aktivasi</h3>' + (can('license.manage') ? '<label class="f">Kunci lisensi<textarea class="i mono" id="lKey" rows="4" placeholder="AVO1.xxxxx.yyyyy"></textarea></label><button class="btn primary" id="lAct">Aktifkan</button>' : '<div class="muted">Hanya pemilik (owner) yang dapat mengaktifkan lisensi.</div>') + '<div class="small muted">Butuh lisensi? Hubungi penyedia aplikasi Anda.</div></div></div>';
        var b = $('#lAct'); if (b) b.onclick = function () { api('POST', '/license/activate', { key: $('#lKey').value.trim() }).then(function (r) { S.me.license = r; store.set('me', S.me); toast('Lisensi ' + r.label + ' aktif.', 'ok'); renderShell(); route(); }).catch(fail); };
      });
    },
    system: function (el) {
      var sm = can('system.manage');
      el.innerHTML = '<div class="grid g2">' + (sm ? '<div class="card col"><h3>Worker & antrean</h3><p class="small muted">Worker memproses antrean melalui trigger waktu GAS (lease, retry backoff, dead-letter queue). Saat antrean kosong, worker keluar tanpa membaca Sheets. Akun gmail.com: kuota runtime trigger 90 mnt/hari — pilih 5 mnt bila pemakaian tinggi.</p><div class="row"><button class="btn" id="syRun">' + ico('play', 14) + 'Jalankan sekarang</button><select class="i" id="syIv" style="width:auto" title="Interval trigger"><option value="1">tiap 1 mnt</option><option value="5">tiap 5 mnt</option><option value="10">tiap 10 mnt</option><option value="15">tiap 15 mnt</option></select><button class="btn" id="syInst">Pasang trigger</button><button class="btn" id="syDlq">Dead-letter</button></div></div>' +
        '<div class="card col"><h3>Emergency stop</h3><p class="small muted">Menghentikan seluruh eksekusi AI & tool secara instan (tugas tetap tersimpan).</p><div class="row"><button class="btn danger" id="syStop">' + ico('stop', 14) + 'Aktifkan stop</button><button class="btn" id="syGo">Lanjutkan operasi</button></div></div>' +
        '<div class="card col"><h3>Backup & pemeliharaan</h3><p class="small muted">Backup membuat salinan spreadsheet database di Google Drive. Maintenance menghapus sesi kedaluwarsa, potongan blob yatim, & event lama (retensi ' + 180 + ' hari).</p><div class="row"><button class="btn" id="syBak">' + ico('dl', 14) + 'Backup sekarang</button><button class="btn" id="syMnt">Jalankan maintenance</button><button class="btn" id="sySt">Status sistem</button></div></div>' : '') +
        '<div class="card col"><h3>Perangkat ini</h3>' + (IS_GAS ? '' : '<label class="f">URL server<input class="i mono" id="syUrl" value="' + esc(apiUrl()) + '"></label><button class="btn" id="syUrlSave">Simpan URL</button>') + '<div class="row"><button class="btn" id="syCache">Hapus cache offline</button><span class="small muted">Antrean offline: ' + store.get('outbox', []).length + '</span></div><div class="small muted">Versi aplikasi ' + VERSION + '</div></div></div>';
      var on = function (id, fn) { var b = $(id); if (b) b.onclick = fn; };
      on('#syRun', runWorkerNow);
      on('#syInst', function () { api('POST', '/system/worker/install', { interval_min: +$('#syIv').value }).then(function (r) { toast('Trigger: ' + r.triggers.join(', '), 'ok'); }).catch(fail); });
      on('#syDlq', function () { api('GET', '/dead-letters', {}, { noCache: true }).then(function (l) { modal({ title: 'Dead-letter queue', wide: true, body: l.length ? '<table class="t"><tr><th>Waktu</th><th>Tugas</th><th>Alasan</th><th>Status</th></tr>' + l.map(function (d) { return '<tr class="click" data-task="' + esc(d.task_id) + '"><td class="small">' + fmtDate(d.created_at) + '</td><td>' + esc((d.payload || {}).title || d.task_id) + '</td><td class="small">' + esc(d.reason) + '</td><td>' + chip(d.resolved ? 'completed' : 'failed', d.resolved ? 'diselesaikan' : 'terbuka') + '</td></tr>'; }).join('') + '</table>' : '<div class="empty">Kosong.</div>' }); $$('.modal [data-task]').forEach(function (r) { r.onclick = function () { openTask(r.getAttribute('data-task')); }; }); }).catch(fail); });
      on('#syStop', function () { confirmBox('Aktifkan emergency stop?', 'Semua eksekusi AI akan dihentikan sampai dinonaktifkan.', 'Hentikan', true).then(function (y) { if (y) api('POST', '/system/emergency-stop', { enabled: true }).then(function () { toast('Emergency stop aktif.', 'err'); poll(); }).catch(fail); }); });
      on('#syGo', function () { api('POST', '/system/emergency-stop', { enabled: false }).then(function () { toast('Operasi dilanjutkan.', 'ok'); poll(); }).catch(fail); });
      on('#syBak', function () { toast('Membuat backup…'); api('POST', '/system/backup').then(function (r) { modal({ title: 'Backup selesai', body: '<p>' + esc(r.name) + '</p><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Buka di Google Drive</a>' }); }).catch(fail); });
      on('#syMnt', function () { api('POST', '/system/maintenance').then(function (r) { toast('Maintenance: ' + JSON.stringify(r), 'ok'); }).catch(fail); });
      on('#sySt', function () { api('GET', '/system/status', {}, { noCache: true }).then(function (r) { modal({ title: 'Status sistem', body: '<div class="pre">' + esc(JSON.stringify(r, null, 2)) + '</div>' }); }).catch(fail); });
      on('#syUrlSave', function () { var u = $('#syUrl').value.trim(); if (u && !/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return fail(new Error('URL tidak valid.')); store.set('api_url', u); toast('URL disimpan.', 'ok'); });
      on('#syCache', function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('avo_c:') === 0) localStorage.removeItem(k); }); } catch (e) { } if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }); toast('Cache dihapus.', 'ok'); });
    }
  };

  // =====================================================================
  // VIEW: PROFIL
  // =====================================================================
  VIEWS.profile = function (v) {
    var u = S.me.user;
    v.innerHTML = '<h1>Profil saya</h1><div class="grid g2"><div class="card col"><div class="row">' + avatarHtml(u, true) + '<div class="col" style="gap:6px"><b style="font-size:16px">' + esc(u.name) + '</b><span class="muted small">' + esc(u.email) + ' · ' + esc(S.me.role) + '</span><div class="row"><button class="btn sm" id="pUp">Ganti foto</button>' + (u.photo ? '<button class="btn sm ghost" id="pRm">Hapus foto</button>' : '') + '</div><span class="small muted">Klik foto untuk zoom (pinch / scroll / ketuk dua kali).</span></div></div>' +
      '<label class="f">Nama tampilan<input class="i" id="pName" maxlength="80" value="' + esc(u.name) + '"></label><button class="btn primary" id="pSave" style="align-self:flex-start">Simpan profil</button></div>' +
      '<div class="card col"><h3>Ubah kata sandi</h3><label class="f">Kata sandi lama<input class="i" type="password" id="pOld" autocomplete="current-password"></label><label class="f">Kata sandi baru<input class="i" type="password" id="pNew" autocomplete="new-password"><span>Minimal 8 karakter, huruf + angka. Sesi lain akan dikeluarkan.</span></label><button class="btn" id="pPw" style="align-self:flex-start">Ubah kata sandi</button><hr style="border:0;border-top:1px solid var(--border);width:100%"><a class="btn" href="#/about" style="align-self:flex-start">' + ico('shield', 15) + 'Tentang aplikasi, S&amp;K &amp; Privasi</a><button class="btn danger" id="pOut" style="align-self:flex-start">' + ico('out', 15) + 'Keluar</button></div></div>';
    var av = $('.avatar.lg', v); if (av && u.photo) av.onclick = function () { zoomImage(u.photo, 'Foto profil'); };
    var saveProfile = function (patch) { return api('PUT', '/auth/profile', patch).then(function (r) { S.me.user = Object.assign(S.me.user, r); store.set('me', S.me); renderShell(); route(); toast('Profil tersimpan.', 'ok'); }).catch(fail); };
    $('#pUp').onclick = function () { pickFile('image/*').then(function (f) { return readImage(f, 480, 'image/jpeg'); }).then(function (d) { saveProfile({ photo: d }); }).catch(fail); };
    var rm = $('#pRm'); if (rm) rm.onclick = function () { saveProfile({ photo: '' }); };
    $('#pSave').onclick = function () { saveProfile({ name: $('#pName').value }); };
    $('#pPw').onclick = function () { api('POST', '/auth/change-password', { old_password: $('#pOld').value, new_password: $('#pNew').value }).then(function () { toast('Kata sandi diubah.', 'ok'); $('#pOld').value = $('#pNew').value = ''; }).catch(fail); };
    $('#pOut').onclick = logout;
  };

  // =====================================================================
  // VIEW: TENTANG (versi, S&K, privasi, atribusi)
  // =====================================================================
  VIEWS.about = function (v) {
    var a = S.me.app || {}, l = S.me.legal || {}, lic = S.me.license || {};
    var mismatch = a.version && a.version !== VERSION;
    v.innerHTML = '<h1>Tentang aplikasi</h1><div class="grid g2"><div class="card col"><div class="row"><img class="logo" style="width:56px;height:56px" src="' + esc(S.me.org.branding.logo || DEFAULT_LOGO) + '" alt="Logo" id="abLogo"><div><b style="font-size:16px">AI Virtual Office 3D</b><div class="muted small">Autonomous Digital Workforce · Edisi Google Apps Script</div></div></div>' +
      '<table class="t"><tr><td>Versi aplikasi (antarmuka)</td><td><b>' + VERSION + '</b> · build ' + BUILD_DATE + '</td></tr><tr><td>Versi server (Apps Script)</td><td><b>' + esc(a.version || '—') + '</b> · skema database v' + esc(a.schema || '—') + '</td></tr><tr><td>Mode</td><td>' + (IS_GAS ? 'Web App Google Apps Script' : 'PWA (GitHub Pages)') + (navigator.serviceWorker && navigator.serviceWorker.controller ? ' · offline aktif' : '') + '</td></tr><tr><td>Lisensi</td><td>' + esc(lic.label || lic.plan || '—') + ' · ' + esc(lic.message || '') + '</td></tr><tr><td>Organisasi</td><td>' + esc(S.me.org.name) + '</td></tr></table>' +
      (mismatch ? '<div class="notice warn">Versi antarmuka (' + VERSION + ') berbeda dengan server (' + esc(a.version) + '). Perbarui deployment Apps Script atau berkas GitHub agar sama.</div>' : '<div class="notice small">Antarmuka dan server memakai versi yang sama.</div>') +
      (IS_GAS ? '' : '<button class="btn sm" id="abUpd" style="align-self:flex-start">' + ico('refresh', 14) + 'Periksa pembaruan</button>') + '</div>' +
      '<div class="card col"><h3>Dokumen hukum</h3><div class="row"><button class="btn" data-legal="terms">' + ico('file', 15) + 'Syarat &amp; Ketentuan v' + LEGAL_V.terms + '</button><button class="btn" data-legal="privacy">' + ico('shield', 15) + 'Pemberitahuan Privasi v' + LEGAL_V.privacy + '</button></div>' +
      '<div class="small muted">' + (l.accepted ? 'Anda menyetujui versi ini pada ' + fmtDate(l.accepted_at) + '.' : 'Belum disetujui.') + ' Berlaku sejak ' + esc(LEGAL_V.effective) + '. Pengendali data: ' + esc(S.me.org.name) + '. Kontak: ' + esc((S.me.org.legal || {}).contact_email || 'administrator organisasi') + '.</div>' +
      '<h3 style="margin-top:8px">Hak subjek data (UU PDP)</h3><div class="small">Anda dapat memperbarui nama & foto di <a href="#/profile">Profil</a>, menghapus foto kapan saja, dan mengajukan akses, salinan, koreksi, atau penghapusan data kepada kontak pelindungan data organisasi.</div>' +
      '<h3 style="margin-top:8px">Komponen pihak ketiga</h3><div class="small">three.js r128 — © three.js authors — MIT License · Font Inter — SIL Open Font License 1.1 · Berjalan di Google Apps Script, Sheets & Drive (Google Terms of Service).</div></div></div>';
    bindLegalLinks(v);
    $('#abLogo').onclick = function () { zoomImage(this.src, 'Logo'); };
    var up = $('#abUpd'); if (up) up.onclick = function () { if (navigator.serviceWorker) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().then(function () { toast('Pemeriksaan selesai. Bila ada versi baru, aplikasi akan memuat ulang otomatis.', 'ok'); }); else toast('Service worker tidak aktif di mode ini.'); }); };
  };

  // ---------------- boot ----------------
  /** Prefetch data menu utama di latar belakang agar perpindahan tab instan. */
  function prefetch() {
    var jobs = [['/dashboard', {}], ['/employees', {}], ['/tasks', { status: store.get('task_filter', ''), q: store.get('task_q', ''), limit: 300 }], ['/approvals', { status: store.get('appr_tab', 'pending') === 'pending' ? 'pending' : '' }], ['/workflows/runs', { limit: 30 }], ['/artifacts', { type: store.get('art_type', '') }]];
    jobs.forEach(function (j, i) {
      setTimeout(function () {
        if (!S.token || !S.online || cacheGet(j[0], j[1])) return;
        send({ method: 'GET', path: '/api/v1' + j[0], body: {}, query: j[1], token: S.token }).then(function (r) { if (r && r.ok && S.token) cachePut(j[0], j[1], r.data); }).catch(function () { });
      }, 1500 + i * 700);
    });
  }
  function bootApp(fresh) {
    renderShell();
    if (S.me && S.me.legal && !S.me.legal.accepted) { $('#view').innerHTML = ''; setTimeout(poll, 600); showLegalGate(); return; }
    if (!location.hash || location.hash === '#/') location.hash = '#/office'; else route();
    S.seq = 0; setTimeout(poll, fresh ? 600 : 0); flushOutbox();
    if (S.me && S.me.legal && !S.me.legal.accepted) showLegalGate();
    if (!fresh) api('GET', '/auth/me', {}, { noCache: true }).then(function (me) { S.me = me; store.set('me', me); if (me.legal && !me.legal.accepted) showLegalGate(); var t = $('#tTitle'); if (t && t.textContent !== me.org.branding.title) { renderShell(); route(); } }).catch(function () { });
    prefetch();
  }
  function start() {
    var p = new URLSearchParams(location.search);
    if (p.get('api') && /^https:\/\/script\.google\.com\//.test(p.get('api'))) { store.set('api_url', p.get('api')); history.replaceState(null, '', location.pathname + location.hash); }
    var sess = store.get('session');
    if (sess && sess.token && sess.expires_at > new Date().toISOString()) {
      S.token = sess.token; S.me = store.get('me');
      if (S.me) return bootApp();
    }
    if (!IS_GAS && !apiUrl()) return renderLogin(null);
    var cachedHealth = store.get('health');
    if (cachedHealth) renderLogin(cachedHealth); // tampil seketika, cek status server di latar belakang
    api('GET', '/health', {}, { noCache: true }).then(function (h) { store.set('health', h); if (!S.token && (!cachedHealth || cachedHealth.needs_setup !== h.needs_setup)) renderLogin(h); }).catch(function (e) { if (!cachedHealth) renderLogin(null); toast(e.message, 'err'); });
  }
  // service worker (hanya di GitHub Pages / origin sendiri; tidak di iframe GAS)
  if (!IS_GAS && 'serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () { var nw = reg.installing; nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) { toast('Versi baru tersedia — memuat ulang…'); nw.postMessage('skipWaiting'); } }); });
      }).catch(function () { });
      var reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', function () { if (!reloaded) { reloaded = true; location.reload(); } });
    });
  }
  // shortcut keyboard
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey || !S.token) return;
    var map = { o: 'office', d: 'dashboard', w: 'workflow', t: 'tasks', a: 'approvals' };
    if (map[e.key]) location.hash = '#/' + map[e.key];
  });
  window.__AVO__ = { version: VERSION, state: S, md: md, esc: esc };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
