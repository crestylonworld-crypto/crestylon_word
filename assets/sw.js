/* 凌極世界 PWA Service Worker（v1）
 * 硬規則（血淚教訓）：
 * 1. 只快取「無副檔名的頁面路由」導航請求 —— /assets/*.css、*.js、圖片一律不進快取，
 *    避免 CDN 回 200+index.html 時把 HTML 當成 CSS/JS 存進去造成永久無樣式。
 * 2. 導航快取前檢查 content-type 必須含 text/html。
 * 3. 版本號變更時清掉舊快取。
 */
const CACHE = 'crestylon-word-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isPageRoute(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (p.startsWith('/assets/')) return false;
  if (p === '/sw.js') return false;
  // 有副檔名的不是頁面路由（.html 除外也不快取，交給 HTTP 快取）
  if (/\.[a-z0-9]+$/i.test(p)) return false;
  return true;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate' && isPageRoute(url)) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('text/html')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('/')))
    );
  }
});
