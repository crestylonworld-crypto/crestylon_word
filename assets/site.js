// 凌極世界官網 — 前端互動（零依賴）
// 1) 行動版選單 2) 捲動揭示 3) PWA Service Worker 註冊
(function () {
  'use strict';

  // 卡片整張可點：點卡片任何位置都走標題連結（已是連結本身時不重複觸發）
  document.querySelectorAll('.card').forEach(function (card) {
    var link = card.querySelector('h3 a');
    if (!link) return;
    card.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      window.location.href = link.href;
    });
  });

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

// 首頁 R7 引擎（2026-11-16 整合）：只在首頁（有 #gl）時啟動。橋線脊椎＋WebGL 星雲＋定格宣言＋fork/dissolve scrub，共用單一時鐘。
(function () {
  'use strict';
  if (!document.getElementById('gl')) return;
  // ---------- 揭示 ----------
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.rv').forEach(el => io.observe(el));
  const tio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('on', e.isIntersecting)), { rootMargin: '-38% 0px -38% 0px' });
  document.querySelectorAll('.takeover').forEach(el => tio.observe(el));
  // ---------- 創世儀式（純前端、不送出） ----------
  const nameForm = document.getElementById('nameForm');
  if (nameForm) nameForm.addEventListener('submit', e => {
    e.preventDefault();
    const v = document.getElementById('nameInput').value.trim();
    if (!v) return;
    document.getElementById('doneName').textContent = v;
    document.getElementById('doneMsg').style.display = 'block';
  });
  // ---------- WebGL 星雲＋曙光 ----------
  let dawnTarget = .3, dawnCur = .3;
  (function () {
    const cv = document.getElementById('gl');
    const gl = cv.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) { cv.style.background = 'radial-gradient(900px 600px at 50% 110%, #3A2415, #0A1120 70%)'; return; }
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = [
      'precision highp float;',
      'uniform vec2 R;uniform float T;uniform vec2 M;uniform float D;',
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
      ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.0+vec2(17.3,9.1);a*=.5;}return v;}',
      'float stars(vec2 uv,float scale,float th){',
      ' vec2 g=uv*scale;vec2 id=floor(g);vec2 f=fract(g)-.5;',
      ' float h=hash(id);vec2 off=vec2(hash(id+7.),hash(id+13.))-.5;',
      ' float d=length(f-off*.7);',
      ' float tw=.55+.45*sin(T*(1.5+h*2.5)+h*40.);',
      ' return smoothstep(th,.0,d)*step(.82,h)*tw;}',
      'void main(){',
      ' vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);',
      ' vec2 muv=uv+M*.06;',
      ' float t=T*.03;',
      ' vec2 w=vec2(fbm(muv*1.6+vec2(t,-t*.6)),fbm(muv*1.6+vec2(5.2,1.3)-t*.5));',
      ' float n=fbm(muv*1.9+w*2.6+vec2(t*.7,-t*.4));',
      ' float n2=fbm(muv*3.6-vec2(t*.6,t*.3)+n);',
      ' vec3 col=mix(vec3(.027,.051,.102),vec3(.086,.157,.247),smoothstep(.3,.85,n));',
      ' col=mix(col,vec3(.13,.45,.62),smoothstep(.5,.92,n2)*.32);',
      ' col=mix(col,vec3(.35,.75,.95),smoothstep(.8,1.,n*n2)*.2);',
      ' float dawn=pow(max(0.,1.-length((uv-vec2(0.,-1.05))*vec2(1.,1.35))),3.2);',
      ' col+=vec3(.98,.45,.15)*dawn*.55*D;',
      ' col+=vec3(1.,.72,.42)*pow(dawn,3.)*.4*D;',
      ' col+=vec3(1.)*stars(uv,42.,.09)*.8;',
      ' col+=vec3(.85,.93,1.)*stars(uv+31.,90.,.06)*.55;',
      ' float vig=smoothstep(1.65,.45,length(uv*vec2(1.,1.12)));',
      ' col*=mix(.72,1.,vig);',
      ' col+=(hash(gl_FragCoord.xy+ fract(T))-.5)*.045;',
      ' gl_FragColor=vec4(col,1.);}'
    ].join('\n');
    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'),
          uM = gl.getUniformLocation(pr, 'M'), uD = gl.getUniformLocation(pr, 'D');
    let mx = 0, my = 0, tx = 0, ty = 0;
    addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function resize() {
      const s = .75, dpr = Math.min(devicePixelRatio || 1, 1.5);
      cv.width = cv.clientWidth * dpr * s; cv.height = cv.clientHeight * dpr * s;
      gl.viewport(0, 0, cv.width, cv.height);
    }
    addEventListener('resize', resize); resize();
    let visible = true;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(cv);
    const t0 = performance.now();
    (function loop() {
      if (visible) {
        mx += (tx - mx) * .03; my += (ty - my) * .03;
        dawnCur += (dawnTarget - dawnCur) * .04;
        gl.uniform2f(uR, cv.width, cv.height);
        gl.uniform1f(uT, reduced ? 8 : (performance.now() - t0) / 1000);
        gl.uniform2f(uM, mx, -my);
        gl.uniform1f(uD, dawnCur);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if (!reduced) requestAnimationFrame(loop);
    })();
    setTimeout(() => document.body.classList.add('ready'), 120);
  })();
  // ---------- 橋線脊椎＋單一時鐘捲動編排 ----------
  (function () {
    const svg = document.getElementById('spine');
    const main = document.getElementById('spineMain');
    const penTip = document.getElementById('penTip');
    const fade = document.getElementById('spineFade');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mainLen = 0, built = false;
    const nodeEls = [];
    function spineX() { return innerWidth <= 900 ? 20 : 84; }
    function build() {
      const H = document.documentElement.scrollHeight;
      const W = innerWidth;
      const x = spineX();
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.style.height = H + 'px';
      const heroH = document.getElementById('m0').offsetHeight;
      const fin = document.getElementById('finaleSec');
      const finTop = fin.offsetTop;
      const spineStart = heroH - 24;
      main.setAttribute('d', 'M ' + x + ' ' + spineStart + ' L ' + x + ' ' + (finTop - 60));
      fade.setAttribute('d', 'M ' + x + ' ' + (finTop - 60) + ' L ' + x + ' ' + (finTop + fin.offsetHeight * .45));
      [main, fade].forEach(p => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = (p === fade) ? ('1 16') : String(L);
        if (p === main) mainLen = L;
        if (p !== fade) p.style.strokeDashoffset = String(L);
      });
      nodeEls.forEach(n => n.el.remove()); nodeEls.length = 0;
      document.querySelectorAll('[data-node]').forEach((sec, i) => {
        const d = document.createElement('div');
        d.className = 'node' + (i >= 5 ? ' ember' : '');
        d.style.top = (sec.offsetTop + 90) + 'px';
        document.body.appendChild(d);
        nodeEls.push({ el: d, y: sec.offsetTop + 90 });
      });
      document.querySelectorAll('.soil-dot').forEach(n => n.remove());
      for (let i = 0; i < 14; i++) {
        const d = document.createElement('div');
        d.className = 'soil-dot';
        const s = 5 + (i % 4) * 2;
        d.style.width = s + 'px'; d.style.height = s + 'px';
        d.style.left = (8 + ((i * 61) % 84)) + '%';
        d.style.top = (finTop + 120 + (i * 97) % Math.max(200, fin.offsetHeight - 260)) + 'px';
        document.body.appendChild(d);
        nodeEls.push({ el: d, y: parseFloat(d.style.top), soil: true });
      }
      built = true;
    }
    build();
    addEventListener('resize', () => { built = false; build(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { build(); });
    const pin = document.getElementById('m1');
    const lines = pin.querySelectorAll('[data-line]');
    const dots = pin.querySelectorAll('[data-dot]');
    const pinImg = document.getElementById('pinImg');
    const finImg = document.getElementById('finImg');
    let smooth = scrollY, pinCur = 0;
    const forkPaths = Array.from(document.querySelectorAll('#forkSvg path')).map(pp => {
      const isMerge = pp.id === 'forkMerge';
      const len = pp.getTotalLength();
      if (!isMerge) { pp.style.strokeDasharray = String(len); pp.style.strokeDashoffset = String(len); }
      else { pp.style.opacity = '0'; }
      return { el: pp, len, merge: isMerge };
    });
    const forkCircles = Array.from(document.querySelectorAll('#forkSvg circle'));
    forkCircles.forEach(c => { c.style.opacity = '0'; });
    function prog(el, sy) {
      const top = el.offsetTop;
      return Math.min(1, Math.max(0, (sy - top) / Math.max(1, el.offsetHeight - innerHeight)));
    }
    function loop() {
      smooth += (scrollY - smooth) * (reduced ? 1 : .085);
      const H = document.documentElement.scrollHeight - innerHeight;
      const p = H > 0 ? smooth / H : 0;
      dawnTarget = .3 + .7 * Math.min(1, smooth / (innerHeight * 1.6));
      if (built) {
        const centerDoc = smooth + innerHeight * .55;
        const frac = Math.min(1, Math.max(0, centerDoc / (document.documentElement.scrollHeight)));
        const drawFrac = Math.min(1, frac * 1.06);
        main.style.strokeDashoffset = String(mainLen * (1 - drawFrac));
        try { const pt = main.getPointAtLength(mainLen * drawFrac); penTip.style.left = pt.x + 'px'; penTip.style.top = pt.y + 'px'; penTip.style.opacity = drawFrac >= 0.995 ? '0' : '1'; } catch (e) {}
        const fs2 = document.getElementById('forkSec');
        if (fs2 && forkPaths) { const fr2 = fs2.getBoundingClientRect();
          const fp = Math.min(1, Math.max(0, (innerHeight * .88 - fr2.top) / (innerHeight * .75)));
          forkPaths.forEach((fpItem, i) => { const draw = Math.min(1, Math.max(0, fp * 1.6 - i * 0.14));
            if (fpItem.merge) { fpItem.el.style.opacity = String(Math.min(1, Math.max(0, (fp - .55) * 2.4))); }
            else { fpItem.el.style.strokeDashoffset = String(fpItem.len * (1 - draw)); } });
          forkCircles.forEach((c, i) => { c.style.opacity = String(Math.min(1, Math.max(0, fp * 1.6 - i * 0.5))); }); }
        const ds = document.getElementById('dissolveSec');
        if (ds) { const dp = Math.min(1, Math.max(0, (centerDoc - ds.offsetTop + innerHeight * 0.2) / Math.max(1, ds.offsetHeight)));
          document.querySelectorAll('#dLayers .d-layer').forEach((row, i) => { const local = Math.min(1, Math.max(0, dp * 6 - i)); const line = row.querySelector('.d-line'); const st = row.querySelector('.d-state');
            line.style.opacity = String(1 - local * 0.92); line.style.background = local > 0.5 ? 'rgba(124,141,166,.6)' : 'var(--cyan)'; line.style.height = (3 - local * 1.6) + 'px'; st.textContent = local >= 1 ? '已退場' : local > 0 ? '退場中' : '在場'; st.style.color = local >= 1 ? 'var(--ember)' : ''; row.querySelector('.d-name').style.opacity = String(1 - local * 0.45); }); }
        fade.style.opacity = String(Math.max(0, 1 - Math.max(0, p - .9) * 6));
        nodeEls.forEach(n => n.el.classList.toggle('lit', centerDoc > n.y));
      }
      pinCur += (prog(pin, smooth) - pinCur) * .1;
      const lit = pinCur < .16 ? 0 : pinCur < .48 ? 1 : pinCur < .78 ? 2 : 3;
      lines.forEach((el, i) => el.classList.toggle('on', i < lit));
      dots.forEach((el, i) => el.classList.toggle('on', i < lit));
      pinImg.style.transform = 'translateY(' + ((pinCur - .5) * -6) + '%)';
      const fr = finImg.parentElement.getBoundingClientRect();
      if (fr.top < innerHeight && fr.bottom > 0) {
        const fp2 = Math.min(1, Math.max(0, (innerHeight - fr.top) / (innerHeight + fr.height)));
        finImg.style.transform = 'translateY(' + ((fp2 - .5) * -9) + '%)';
      }
      requestAnimationFrame(loop);
    }
    loop();
  })();
})();

// ---------- 眾織廣場（獨立頁論壇引擎，Supabase 儲存） ----------
  // ---------- 眾織廣場（創世討論串，Supabase 儲存） ----------
  (function forum() {
    const listEl = document.getElementById('forumList');
    if (!listEl) return;
    const SB = 'https://bcdanvmuffxgtezopyib.supabase.co';
    const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZGFudm11ZmZ4Z3Rlem9weWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3OTEzNTMsImV4cCI6MjEwNzM2NzM1M30.EZtkULSRB_qwVyDl86MOhGf_ihKAAMy7q3fwuKYX0JI';
    const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
    const $ = id => document.getElementById(id);
    const store = {
      get name() { try { return localStorage.getItem('wf_name') || '' } catch (e) { return '' } },
      set name(v) { try { localStorage.setItem('wf_name', v) } catch (e) {} },
      joined() { try { return JSON.parse(localStorage.getItem('wf_joined') || '[]') } catch (e) { return [] } },
      addJoined(id) { try { const a = store.joined(); a.push(id); localStorage.setItem('wf_joined', JSON.stringify(a)) } catch (e) {} },
      mine() { try { return JSON.parse(localStorage.getItem('wf_mine') || '[]') } catch (e) { return [] } },
      addMine(id) { try { const a = store.mine(); if (!a.includes(id)) { a.push(id); localStorage.setItem('wf_mine', JSON.stringify(a)); } } catch (e) {} },
      last() { try { return +localStorage.getItem('wf_last') || 0 } catch (e) { return 0 } },
      stamp() { try { localStorage.setItem('wf_last', Date.now()) } catch (e) {} }
    };
    let forkOf = null, byId = {};
    const fmtTime = ts => {
      const d = new Date(ts), p = n => String(n).padStart(2, '0');
      return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    };
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    async function api(path, opts) {
      const r = await fetch(SB + path, Object.assign({ headers: H }, opts || {}));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.status === 204 ? null : r.json().catch(() => null);
    }
    const isMine = row => store.mine().includes(row.id) || (!!store.name && row.author === store.name);
    async function delRow(id) { await api('/rest/v1/world_forum_posts?id=eq.' + id, { method: 'DELETE' }); }
    async function deletePost(p) {
      if (!confirm('確定要刪除「' + p.title + '」嗎？底下的回覆也會一起刪除，無法復原。')) return;
      try {
        const reps = state.replies.filter(r => r.parent_id === p.id);
        for (const r of reps) await delRow(r.id);
        await delRow(p.id);
        if (state.detail === p.id) closeDetail();
        await load();
      } catch (e) { $('formErr').textContent = '刪除失敗，稍後再試。'; }
    }
    function replyItem(rp) {
      const box = el('div', 'fp-reply');
      const head = el('p', 'fp-reply-meta');
      head.appendChild(el('b', null, rp.author));
      head.appendChild(el('span', null, ' · ' + fmtTime(rp.created_at)));
      if (isMine(rp)) {
        const db = el('button', 'fp-del-reply', '刪除'); db.type = 'button';
        db.addEventListener('click', async () => {
          if (!confirm('確定要刪除這則回覆嗎？')) return;
          try { await delRow(rp.id); await load(); if (state.detail) openDetail(state.detail); } catch (e) {}
        });
        head.appendChild(db);
      }
      box.appendChild(head);
      box.appendChild(el('p', 'fp-reply-body', rp.body));
      return box;
    }
    function postCard(p, replies, opts) {
      opts = opts || {};
      const card = el('article', 'fpost');
      const main = el('div', 'fp-main');
      const head = el('div', 'fp-head');
      const titleEl = el('h4', 'fp-title', p.title);
      if (!opts.detail) { titleEl.classList.add('fp-title-link'); titleEl.addEventListener('click', () => openDetail(p.id)); }
      head.appendChild(titleEl);
      const byline = el('div', 'fp-byline');
      const ava = el('span', 'fp-ava', (p.author || '？').trim().slice(0, 1) || '？');
      let hue = 0; for (const ch of (p.author || '')) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
      ava.style.background = 'hsl(' + hue + ' 45% 30%)';
      byline.appendChild(ava);
      const meta = el('p', 'fp-meta');
      let mt = p.author + ' · ' + fmtTime(p.created_at);
      if (p.fork_of && byId[p.fork_of]) mt += ' · 分支自「' + byId[p.fork_of].title + '」';
      meta.textContent = mt;
      byline.appendChild(meta);
      head.appendChild(byline);
      main.appendChild(head);
      main.appendChild(el('p', 'fp-label', '想改革的問題'));
      main.appendChild(el('p', 'fp-text', p.problem));
      main.appendChild(el('p', 'fp-label', '改革方案'));
      main.appendChild(el('p', 'fp-text', p.body));
      const acts = el('div', 'fp-actions');
      const joined = store.joined().includes(p.id);
      const jcount = el('b', 'fp-jcount', p.joins);
      const jb = el('button', 'fp-btn fp-join' + (joined ? ' on' : ''), joined ? '已加入' : '加入');
      jb.type = 'button';
      if (joined) jb.disabled = true;
      jb.addEventListener('click', async () => {
        jb.disabled = true;
        try {
          const v = await api('/rest/v1/rpc/world_forum_join', { method: 'POST', body: JSON.stringify({ p_id: p.id }) });
          p.joins = typeof v === 'number' ? v : p.joins + 1;
          store.addJoined(p.id);
          jcount.textContent = p.joins;
          jb.textContent = '已加入';
          jb.classList.add('on');
        } catch (e) { jb.disabled = false; }
      });
      const fb = el('button', 'fp-btn', '分支'); fb.type = 'button';
      fb.addEventListener('click', () => {
        $('forumForm').classList.remove('collapsed');
        forkOf = p.id;
        $('forkTitle').textContent = p.title;
        $('forkNote').hidden = false;
        $('fTitle').value = '';
        $('forumForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('fTitle').focus();
      });
      const rb = el('button', 'fp-btn', '回覆 · ' + replies.length); rb.type = 'button';
      const rail = el('div', 'fp-rail');
      rail.append(jcount, jb);
      acts.append(fb, rb);
      if (!opts.detail) {
        const db2 = el('button', 'fp-btn', '詳情'); db2.type = 'button';
        db2.addEventListener('click', () => openDetail(p.id));
        acts.appendChild(db2);
      }
      if (isMine(p)) {
        const del = el('button', 'fp-btn fp-del', '刪除'); del.type = 'button';
        del.addEventListener('click', () => deletePost(p));
        acts.appendChild(del);
      }
      main.appendChild(acts);
      const rbox = el('div', 'fp-replies'); rbox.hidden = !opts.detail;
      const rlist = el('div', 'fp-reply-list');
      replies.forEach(rp => rlist.appendChild(replyItem(rp)));
      rbox.appendChild(rlist);
      const rform = el('form', 'fp-reply-form');
      const rinput = el('textarea'); rinput.maxLength = 1000; rinput.rows = 2; rinput.placeholder = '寫下你的回覆'; rinput.setAttribute('aria-label', '回覆內容');
      const rbtn = el('button', 'fp-btn fp-send', '送出回覆'); rbtn.type = 'submit';
      rform.append(rinput, rbtn);
      rform.addEventListener('submit', async e => {
        e.preventDefault();
        const author = ($('fAuthor').value || '').trim() || store.name;
        const body = rinput.value.trim();
        if (!author) { $('fAuthor').focus(); $('formErr').textContent = '先在上方填你的暱稱，再回覆。'; return; }
        if (!body) return;
        if (Date.now() - store.last() < 15000) { $('formErr').textContent = '先等一下，15 秒後再送出。'; return; }
        rbtn.disabled = true;
        try {
          const rows = await api('/rest/v1/world_forum_posts?select=*', { method: 'POST', headers: Object.assign({}, H, { Prefer: 'return=representation' }), body: JSON.stringify({ kind: 'reply', parent_id: p.id, author, body }) });
          store.name = author; store.stamp();
          const rp = rows && rows[0];
          if (rp) { store.addMine(rp.id); rlist.appendChild(replyItem(rp)); rb.textContent = '回覆 · ' + rlist.children.length; }
          rinput.value = '';
        } catch (err) { $('formErr').textContent = '回覆送不出去，稍後再試。'; }
        rbtn.disabled = false;
      });
      rbox.appendChild(rform);
      rb.addEventListener('click', () => { rbox.hidden = !rbox.hidden; if (!rbox.hidden) rinput.focus(); });
      main.appendChild(rbox);
      card.append(rail, main);
      return card;
    }
    const state = { sort: 'new', posts: [], replies: [], detail: null };
    function openDetail(id) {
      const p = byId[id];
      if (!p || p.kind !== 'post') return;
      state.detail = id;
      try { history.replaceState(null, '', '#post-' + id); } catch (e) {}
      const dEl = $('forumDetail'); if (!dEl) return;
      $('forumForm').hidden = true;
      const tb = document.querySelector('.forum-toolbar'); if (tb) tb.hidden = true;
      listEl.hidden = true;
      $('doneMsg').style.display = 'none';
      dEl.hidden = false;
      dEl.textContent = '';
      const back = el('button', 'fp-btn fp-back', '← 回到廣場'); back.type = 'button';
      back.addEventListener('click', closeDetail);
      dEl.appendChild(back);
      if (p.fork_of && byId[p.fork_of]) {
        const pl = el('button', 'fp-btn fp-back', '分支自「' + byId[p.fork_of].title + '」→'); pl.type = 'button';
        pl.addEventListener('click', () => openDetail(p.fork_of));
        dEl.appendChild(pl);
      }
      const reps = state.replies.filter(r => r.parent_id === p.id);
      dEl.appendChild(postCard(p, reps, { detail: true }));
      const forks = state.posts.filter(x => x.fork_of === p.id);
      if (forks.length) {
        dEl.appendChild(el('h3', 'fd-sec', '從這套制度分支出去的版本'));
        forks.forEach(f => {
          const item = el('button', 'fd-fork'); item.type = 'button';
          item.appendChild(el('b', null, f.title));
          item.appendChild(el('span', null, f.author + ' · 加入 ' + f.joins));
          item.addEventListener('click', () => openDetail(f.id));
          dEl.appendChild(item);
        });
      }
      dEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function closeDetail() {
      state.detail = null;
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      const dEl = $('forumDetail'); if (dEl) { dEl.hidden = true; dEl.textContent = ''; }
      $('forumForm').hidden = false;
      const tb = document.querySelector('.forum-toolbar'); if (tb) tb.hidden = false;
      listEl.hidden = false;
    }
    function paint() {
      const posts = state.posts.slice();
      if (state.sort === 'hot') posts.sort((a, b) => (b.joins - a.joins) || (a.created_at < b.created_at ? 1 : -1));
      listEl.textContent = '';
      const sp = $('statPosts'), sj = $('statJoins'), sr = $('statReplies');
      if (sp) sp.textContent = state.posts.length;
      if (sj) sj.textContent = state.posts.reduce((n, p) => n + (p.joins || 0), 0);
      if (sr) sr.textContent = state.replies.length;
      if (!posts.length) { listEl.appendChild(el('p', 'forum-empty', '廣場還很安靜——第一個制度，由你宣告。')); return; }
      posts.forEach(p => listEl.appendChild(postCard(p, state.replies.filter(r => r.parent_id === p.id))));
    }
    async function load() {
      try {
        const rows = await api('/rest/v1/world_forum_posts?select=*&order=created_at.desc&limit=300');
        byId = {}; rows.forEach(r => byId[r.id] = r);
        state.posts = rows.filter(r => r.kind === 'post');
        state.replies = rows.filter(r => r.kind === 'reply').reverse();
        paint();
        if (state.detail && byId[state.detail]) openDetail(state.detail);
        else if (!state.detail && location.hash.indexOf('#post-') === 0) { const hid = location.hash.slice(6); if (byId[hid]) openDetail(hid); }
      } catch (e) {
        listEl.textContent = '';
        listEl.appendChild(el('p', 'forum-empty', '廣場暫時連不上，稍後再試。'));
      }
    }
    document.querySelectorAll('.ftab').forEach(t => t.addEventListener('click', () => {
      state.sort = t.getAttribute('data-sort');
      document.querySelectorAll('.ftab').forEach(x => x.classList.toggle('on', x === t));
      paint();
    }));
    const form = $('forumForm');
    if (store.name) $('fAuthor').value = store.name;
    const teaser = $('composerTeaser');
    if (teaser) {
      $('forumForm').classList.add('collapsed');
      const ta = $('teaserAva');
      if (ta && store.name) {
        ta.textContent = store.name.trim().slice(0, 1) || '？';
        let hue = 0; for (const ch of store.name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
        ta.style.background = 'hsl(' + hue + ' 45% 30%)';
      }
      teaser.addEventListener('click', () => {
        $('forumForm').classList.remove('collapsed');
        ($('fAuthor').value ? $('fTitle') : $('fAuthor')).focus();
      });
    }
    $('forkCancel').addEventListener('click', () => { forkOf = null; $('forkNote').hidden = true; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('formErr'); err.textContent = '';
      const author = $('fAuthor').value.trim(), title = $('fTitle').value.trim(),
        problem = $('fProblem').value.trim(), body = $('fBody').value.trim();
      if (!author || !title || !problem || !body) { err.textContent = '暱稱、制度名稱、想改革的問題、改革方案，四個都要填。'; return; }
      if (Date.now() - store.last() < 20000) { err.textContent = '先等一下，20 秒後再宣告下一個。'; return; }
      const btn = $('fSubmit'); btn.disabled = true; btn.textContent = '宣告中…';
      try {
        const payload = { kind: 'post', author, title, problem, body };
        if (forkOf) payload.fork_of = forkOf;
        const created = await api('/rest/v1/world_forum_posts?select=*', { method: 'POST', headers: Object.assign({}, H, { Prefer: 'return=representation' }), body: JSON.stringify(payload) });
        if (created && created[0]) store.addMine(created[0].id);
        store.name = author; store.stamp();
        $('doneName').textContent = title;
        $('doneMsg').style.display = 'block';
        $('fTitle').value = ''; $('fProblem').value = ''; $('fBody').value = '';
        forkOf = null; $('forkNote').hidden = true;
        await load();
        $('doneMsg').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err2) { err.textContent = '宣告失敗，稍後再試。'; }
      btn.disabled = false; btn.textContent = '宣告';
    });
    load();
  })();

// ---------- a015 內頁 hero 星雲引擎＋視差＋揭示 ----------
(function () {
  const cv = document.querySelector('canvas.hero-gl');
  const hero = document.querySelector('.hero-block');
  if (!cv || !hero) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 視差
  const ghost = hero.querySelector('.hero-ghost');
  const h1 = hero.querySelector('h1');
  let ticking = false;
  function parallax() {
    ticking = false;
    const y = scrollY;
    if (y > innerHeight * 1.2) return;
    if (ghost) ghost.style.transform = `translate(-50%, ${y * .16}px)`;
    if (h1) h1.style.transform = `translateY(${y * .05}px)`;
  }
  if (!reduced) addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
  // 揭示
  document.body.classList.add('rv-on');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll('.prose > h2, .prose .card, .panels a.panel, .tl-item, .prose > blockquote').forEach(el => io.observe(el));
  // WebGL（與首頁同一 shader 語言）
  const gl = cv.getContext('webgl', { antialias: false, alpha: true });
  if (!gl) return;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = [
    'precision highp float;',
    'uniform vec2 R;uniform float T;uniform vec2 M;uniform float D;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.0+vec2(17.3,9.1);a*=.5;}return v;}',
    'float stars(vec2 uv,float scale,float th){',
    ' vec2 g=uv*scale;vec2 id=floor(g);vec2 f=fract(g)-.5;',
    ' float h=hash(id);vec2 off=vec2(hash(id+7.),hash(id+13.))-.5;',
    ' float d=length(f-off*.7);',
    ' float tw=.55+.45*sin(T*(1.5+h*2.5)+h*40.);',
    ' return smoothstep(th,.0,d)*step(.82,h)*tw;}',
    'void main(){',
    ' vec2 uv=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);',
    ' vec2 muv=uv+M*.06;',
    ' float t=T*.03;',
    ' vec2 w=vec2(fbm(muv*1.6+vec2(t,-t*.6)),fbm(muv*1.6+vec2(5.2,1.3)-t*.5));',
    ' float n=fbm(muv*1.9+w*2.6+vec2(t*.7,-t*.4));',
    ' float n2=fbm(muv*3.6-vec2(t*.6,t*.3)+n);',
    ' vec3 col=mix(vec3(.027,.051,.102),vec3(.086,.157,.247),smoothstep(.3,.85,n));',
    ' col=mix(col,vec3(.13,.45,.62),smoothstep(.5,.92,n2)*.32);',
    ' col=mix(col,vec3(.35,.75,.95),smoothstep(.8,1.,n*n2)*.2);',
    ' float dawn=pow(max(0.,1.-length((uv-vec2(0.,-1.05))*vec2(1.,1.35))),3.2);',
    ' col+=vec3(.98,.45,.15)*dawn*.55*D;',
    ' col+=vec3(1.,.72,.42)*pow(dawn,3.)*.4*D;',
    ' col+=vec3(1.)*stars(uv,42.,.09)*.8;',
    ' col+=vec3(.85,.93,1.)*stars(uv+31.,90.,.06)*.55;',
    ' float vig=smoothstep(1.65,.45,length(uv*vec2(1.,1.12)));',
    ' col*=mix(.72,1.,vig);',
    ' col+=(hash(gl_FragCoord.xy+ fract(T))-.5)*.045;',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(pr, 'R'), uT = gl.getUniformLocation(pr, 'T'),
        uM = gl.getUniformLocation(pr, 'M'), uD = gl.getUniformLocation(pr, 'D');
  let mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * .6;
    cv.width = Math.max(2, hero.clientWidth * dpr); cv.height = Math.max(2, hero.clientHeight * dpr);
    gl.viewport(0, 0, cv.width, cv.height);
  }
  size(); addEventListener('resize', size);
  let visible = true, raf = 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  const t0 = performance.now();
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    mx += (tx - mx) * .04; my += (ty - my) * .04;
    gl.uniform2f(uR, cv.width, cv.height);
    gl.uniform1f(uT, (performance.now() - t0) / 1000);
    gl.uniform2f(uM, mx, -my);
    gl.uniform1f(uD, .9);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  if (reduced) { gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, 12); gl.uniform2f(uM, 0, 0); gl.uniform1f(uD, .9); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  else frame();
})();

/* a020 深淺模式切換 */
(() => {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.classList.add('theming');
    setTimeout(() => document.documentElement.classList.remove('theming'), 650);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cw-theme', next); } catch (e) {}
  });
})();
