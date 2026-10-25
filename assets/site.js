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

  // 閱讀進度條（頂部青→橙漸變，尊重 reduced-motion）
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    var bar = document.createElement('div');
    bar.id = 'read-progress';
    document.body.appendChild(bar);
    var onScroll = function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  // 捲動揭示：為主要區塊加上 .reveal
  var targets = document.querySelectorAll('main h2, main .card, main .tl-item, main .oath-block, main .cta-block, main blockquote, main .table-wrap, main .hero-figure');
  if (!reduce && 'IntersectionObserver' in window) {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  // 七自由互動選擇器：文案來自 markdown 產生的 data-title / data-text，不在 JS 裡寫死
  var freedomRoot = document.querySelector('.freedoms');
  if (freedomRoot) {
    var tabs = freedomRoot.querySelectorAll('.tabs button');
    var panel = freedomRoot.querySelector('.panel');
    var fade = panel ? panel.querySelector('.fade') : null;
    var dots = freedomRoot.querySelector('.dots');
    var current = 0;
    var renderFreedom = function (i) {
      current = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === current ? 'true' : 'false'); });
      var t = tabs[current];
      if (fade) {
        fade.innerHTML = '<h3>' + t.getAttribute('data-title') + '</h3>' + t.getAttribute('data-body');
        fade.style.animation = 'none'; void fade.offsetWidth; fade.style.animation = '';
      }
      if (dots) dots.innerHTML = Array.prototype.map.call(tabs, function (_, j) { return '<i class="' + (j === current ? 'on' : '') + '"></i>'; }).join('');
    };
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { renderFreedom(i); }); });
    var prevBtn = freedomRoot.querySelector('.freedom-prev');
    var nextBtn = freedomRoot.querySelector('.freedom-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { renderFreedom(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { renderFreedom(current + 1); });
    renderFreedom(0);
  }

  // PWA：只註冊同源 sw.js；註冊失敗靜默忽略
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
