// 凌極世界官網 — 前端互動（零依賴）
// 1) 行動版選單 2) 捲動揭示 3) PWA Service Worker 註冊
(function () {
  'use strict';

  // 行動版選單
  var btn = document.querySelector('.menu-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '✕' : '☰';
    });
  }

  // 捲動揭示：為主要區塊加上 .reveal
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('main h2, main .card, main .tl-item, main .oath-block, main .cta-block, main blockquote, main .table-wrap');
  if (!reduce && 'IntersectionObserver' in window) {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  // PWA：只註冊同源 sw.js；註冊失敗靜默忽略
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
