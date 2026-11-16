#!/usr/bin/env node
/**
 * crestylon-word 內容編譯器（零依賴）
 * content/pages 下的 .md  →  dist 下的 .html
 * 用法：node scripts/build.mjs [--watch]
 *
 * Markdown 支援：標題、段落、粗體、斜體、連結、圖片、清單、
 * 有序清單、引用、程式碼區塊、行內碼、表格、分隔線、自訂區塊。
 * 自訂區塊語法：
 *   ::: hero           → 首屏大標區（內放 # 標題與引言）
 *   ::: cards          → 卡片網格（內用 #### 卡片標題 + 段落）
 *   ::: timeline       → 時間線（內用 #### 年份 + 段落）
 *   ::: oath           → 誓言／引文大字區
 *   ::: cta            → 行動呼籲（內放連結）
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'content', 'pages');
const DIST = join(ROOT, 'dist');
const TPL = readFileSync(join(ROOT, 'templates', 'base.html'), 'utf8');
const HOME_TPL = readFileSync(join(ROOT, 'templates', 'home.html'), 'utf8');
const JOIN_FORM = readFileSync(join(ROOT, 'templates', 'join-form.html'), 'utf8');
const SITE = JSON.parse(readFileSync(join(ROOT, 'site.json'), 'utf8'));

/* ---------- frontmatter ---------- */
function parseFile(src) {
  const raw = readFileSync(src, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

/* ---------- inline ---------- */
function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/* ---------- block parser ---------- */
function mdToHtml(body) {
  const lines = body.split('\n');
  const out = [];
  let i = 0, inCode = false, codeBuf = [], listStack = [];

  const closeLists = () => { while (listStack.length) out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>'); };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; codeBuf = []; }
      else { inCode = false; out.push('<pre><code>' + codeBuf.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</code></pre>'); }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    // 自訂區塊 ::: name ... :::
    const bm = line.match(/^:::\s*(\w+)/);
    if (bm) {
      closeLists();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(':::')) { buf.push(lines[i]); i++; }
      i++; // 跳過結尾 :::
      out.push(renderBlock(bm[1], buf.join('\n')));
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      closeLists();
      const lv = line.match(/^(#{1,6})/)[1].length;
      const text = line.replace(/^#{1,6}\s*/, '');
      const id = 's' + text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '-').slice(0, 24);
      out.push(`<h${lv} id="${id}">${inline(text)}</h${lv}>`);
      i++; continue;
    }
    if (/^---+$/.test(line.trim())) { closeLists(); out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      closeLists();
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
      continue;
    }
    const lm = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
    if (lm) {
      const tag = /^\d/.test(lm[2]) ? 'ol' : 'ul';
      const depth = Math.floor(lm[1].length / 2);
      while (listStack.length > depth + 1) out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>');
      if (listStack.length < depth + 1) { out.push(`<${tag}>`); listStack.push(tag); }
      out.push('<li>' + inline(lm[3]) + '</li>');
      i++; continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      closeLists();
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(lines[i].trim()); i++; }
      const cells = r => r.slice(1, -1).split('|').map(c => inline(c.trim()));
      let html = '<div class="table-wrap"><table><thead><tr>' + cells(rows[0]).map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows.slice(2)) html += '<tr>' + cells(r).map(c => `<td>${c}</td>`).join('') + '</tr>';
      out.push(html + '</tbody></table></div>');
      continue;
    }
    if (!line.trim()) { closeLists(); i++; continue; }
    closeLists();
    // 連續非空行合併為一段
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|:::\s*|```|\s*>|(\s*)([-*]|\d+\.)\s|---+$|\|.*\|$)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push('<p>' + inline(buf.join(' ')) + '</p>');
  }
  closeLists();
  return out.join('\n');
}

const BRIDGE_SVG = `<svg class="bridge-svg" viewBox="0 0 560 90" aria-hidden="true"><defs><linearGradient id="bridgeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#06B6D4"/><stop offset="100%" stop-color="#F97316"/></linearGradient></defs><path d="M20 70 Q 140 10 280 40 T 540 20"/></svg><div class="scroll-cue">往下走，過橋<span></span></div>`;
const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FORUM_HTML = `<div class="forum" id="forumSec">
  <div class="forum-stats">
    <div class="fstat"><b id="statPosts">–</b><span>制度提案</span></div>
    <div class="fstat"><b id="statJoins">–</b><span>加入人次</span></div>
    <div class="fstat"><b id="statReplies">–</b><span>回覆</span></div>
  </div>
  <form id="forumForm" class="forum-form composer">
    <button type="button" class="composer-teaser" id="composerTeaser" aria-label="發起提案">
      <span class="fp-ava" id="teaserAva">？</span>
      <span class="teaser-text">提出你想改革的制度問題，寫下你的方案…</span>
      <span class="teaser-cta">發起提案</span>
    </button>
    <div class="ff-fields">
      <div class="ff-row">
        <input id="fAuthor" type="text" maxlength="30" autocomplete="off" placeholder="你的暱稱" aria-label="你的暱稱">
        <input id="fTitle" type="text" maxlength="60" autocomplete="off" placeholder="新制度的名稱" aria-label="新制度的名稱">
      </div>
      <textarea id="fProblem" maxlength="500" rows="3" placeholder="你不喜歡、想改革的制度問題" aria-label="想改革的制度問題"></textarea>
      <textarea id="fBody" maxlength="2000" rows="4" placeholder="你的改革方案" aria-label="改革方案"></textarea>
      <p class="fork-note" id="forkNote" hidden>分支自「<b id="forkTitle"></b>」——寫下你的版本。<button type="button" id="forkCancel">取消分支</button></p>
      <div class="ff-actions">
        <button type="submit" id="fSubmit">宣告</button>
        <p class="form-err" id="formErr" role="alert"></p>
      </div>
    </div>
  </form>
  <p class="done-msg" id="doneMsg">「<b id="doneName"></b>」——宣告，就存在。</p>
  <div class="forum-toolbar">
    <div class="forum-tabs" role="tablist" aria-label="排序">
      <button type="button" class="ftab on" data-sort="new">最新</button>
      <button type="button" class="ftab" data-sort="hot">最多加入</button>
    </div>
  </div>
  <div class="forum-list" id="forumList"><p class="forum-loading">正在載入眾織廣場…</p></div>
  <div class="forum-detail" id="forumDetail" hidden></div>
</div>`;

function renderBlock(kind, inner) {
  // joinform：原樣輸出加入我們表單（舊站 Custom Embed 移植），不經 markdown 轉義
  if (kind === 'joinform') return JOIN_FORM;
  // forum：眾織廣場（社群討論串，互動由 site.js 論壇引擎驅動）
  if (kind === 'forum') return FORUM_HTML;
  const html = mdToHtml(inner);
  // freedoms：七自由互動選擇器（標題＋一句話取自 markdown，不編新文案）
  if (kind === 'freedoms') {
    const items = html.split(/<h4[^>]*>/).slice(1).map(p => {
      const m = p.match(/^(.*?)<\/h4>([\s\S]*)$/);
      return { title: m[1], body: m[2].trim() };
    });
    if (!items.length) return `<div class="freedoms">${html}</div>`;
    const tabs = items.map((it, i) => `<button type="button" data-f="${i}" data-title="${escAttr(it.title)}" data-body="${escAttr(it.body)}" aria-selected="${i === 0 ? 'true' : 'false'}">${it.title}</button>`).join('');
    const dots = items.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('');
    return `<div class="freedoms" id="freedoms"><div class="tabs" role="tablist">${tabs}</div><div class="panel" aria-live="polite"><div class="fade"><h3>${items[0].title}</h3>${items[0].body}</div><div class="navrow"><button type="button" class="freedom-prev">← 上一個</button><button type="button" class="freedom-next">下一個 →</button><span class="dots" aria-hidden="true">${dots}</span></div></div></div>`;
  }
  if (kind === 'hero') return `<div class="hero-block">${html}${BRIDGE_SVG}</div>`;
  // cycle：橫向階段帶（編號＋標題＋說明，格間箭頭）；標題無編號時自動補序號
  if (kind === 'cycle') {
    const parts = html.split(/<h4[^>]*>/).slice(1).map(p => {
      const m = p.match(/^(.*?)<\/h4>([\s\S]*)$/);
      return { title: m[1], body: m[2] };
    });
    const steps = parts.map((it, i) => {
      const mm = it.title.match(/^(.+?)\s*·\s*(.+)$/);
      const num = mm ? mm[1] : String(i + 1).padStart(2, '0');
      const name = mm ? mm[2] : it.title;
      const arrow = i < parts.length - 1 ? '<span class="arrow" aria-hidden="true">→</span>' : '';
      return `<div class="step"><span class="num">${num}</span><h4>${name}</h4>${it.body}${arrow}</div>`;
    });
    return `<div class="cycle">` + steps.join('') + '</div>';
  }
  // cards：把連續的 h4+段落 轉成卡片
  if (kind === 'cards' || kind === 'timeline') {
    const parts = html.split(/<h4[^>]*>/).slice(1).map(p => {
      const m = p.match(/^(.*?)<\/h4>([\s\S]*)$/);
      return `<div class="${kind === 'cards' ? 'card' : 'tl-item'}"><h3>${m[1]}</h3>${m[2]}</div>`;
    });
    return `<div class="${kind === 'cards' ? 'cards' : 'timeline'}">` + parts.join('') + '</div>';
  }
  // pin：全幅定格幕（圖釘住，宣言句在上面經過）；第一段圖、其後段落為字幕行
  if (kind === 'pin') {
    const imgM = html.match(/<img[^>]*>/);
    const img = imgM ? imgM[0] : '';
    const rest = html.replace(/<p>\s*<img[^>]*>\s*<\/p>|<img[^>]*>/, '');
    const lines = rest.split(/<\/p>/).map(s => s.replace(/<p[^>]*>/, '').trim()).filter(Boolean);
    const lineHtml = lines.map((t, i) => `<p class="${i < 2 ? 'big' : 'small'}">${t}</p>`).join('');
    return `<section class="pin"><div class="stage">${img}<div class="shade"></div><div class="lines">${lineHtml}</div></div></section>`;
  }
  // rows：編號列（標題可帶「01 / 04 · 」前綴，自動拆成編號＋標題）
  if (kind === 'rows') {
    const parts = html.split(/<h4[^>]*>/).slice(1).map((p, i) => {
      const m = p.match(/^(.*?)<\/h4>([\s\S]*)$/);
      const tm = m[1].match(/^(\d+)\s*\/\s*\d+\s*·\s*(.+)$/);
      const num = tm ? tm[1] : String(i + 1).padStart(2, '0');
      const title = tm ? tm[2] : m[1];
      return `<div class="row"><span class="n">${num}</span><div><h3>${title}</h3>${m[2]}</div></div>`;
    });
    return `<div class="rows">` + parts.join('') + '</div>';
  }
  // silence：全黑靜默幕，只有一句話
  if (kind === 'silence') return `<section class="silence">${html}</section>`;
  // finale：終幕（背景圖壓暗＋宣言＋按鈕＋片尾小字）
  if (kind === 'finale') {
    const imgM = html.match(/<img[^>]*>/);
    const img = imgM ? imgM[0].replace('<img', '<img class="bgimg" aria-hidden="true"') : '';
    let rest = html.replace(/<p>\s*<img[^>]*>\s*<\/p>|<img[^>]*>/, '');
    let n = 0;
    rest = rest.replace(/<a /g, () => `<a class="btn ${++n === 1 ? 'primary' : 'ghost'}" `);
    return `<section class="finale">${img}<div class="shade"></div><div class="fin-in">${rest}</div><div class="colophon">CRESTYLON · A WORLD THAT CONTAINS WORLDS · SINCE 2024</div></section>`;
  }
  const cls = { hero: 'hero-block', oath: 'oath-block', cta: 'cta-block' }[kind] || 'custom-block';
  if (kind === 'cta') {
    // CTA 內的連結就是按鈕：第一顆主色、其餘幽靈色，整顆含 padding 都可點
    let n = 0;
    const btnHtml = html.replace(/<a /g, () => `<a class="btn ${++n === 1 ? 'primary' : 'ghost'}" `);
    return `<div class="${cls}">${btnHtml}</div>`;
  }
  return `<div class="${cls}">${html}</div>`;
}

/* ---------- nav ---------- */
function buildNav(activeSection) {
  return SITE.nav.map(n => {
    const cls = n.key === activeSection ? ' class="active"' : '';
    return `<a href="${n.path}"${cls}>${n.label}</a>`;
  }).join('');
}

/* ---------- main ---------- */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.md')) out.push(p);
  }
  return out;
}

function build() {
  mkdirSync(DIST, { recursive: true });
  const pages = walk(CONTENT).map(src => {
    const rel = relative(CONTENT, src).replace(/\\/g, '/');
    const { meta, body } = parseFile(src);
    const slug = rel.replace(/\.md$/, '');
    const url = slug === 'index' ? '/' : '/' + slug + '/';
    return { src, slug, url, meta, body };
  });

  // 目錄頁：為每個 section 產生索引
  const bySection = {};
  for (const p of pages) {
    const sec = p.meta.section || 'page';
    (bySection[sec] ||= []).push(p);
  }
  for (const sec of Object.keys(bySection)) bySection[sec].sort((a, b) => (+(a.meta.order || 99)) - (+(b.meta.order || 99)));

  const written = new Set();
  const render = (p) => {
    const sec = p.meta.section || '';
    // 首頁走專屬模板（templates/home.html，R7 版面正本）；index.md 只提供 frontmatter
    if (p.slug === 'index') {
      return HOME_TPL
        .replaceAll('{{title}}', p.meta.title || SITE.name)
        .replaceAll('{{description}}', p.meta.description || SITE.description)
        .replaceAll('{{siteName}}', SITE.name)
        .replaceAll('{{enName}}', SITE.enName)
        .replaceAll('{{nav}}', buildNav(sec))
        .replaceAll('{{emails}}', SITE.contact.email.map(e => `<a href="mailto:${e}">${e}</a>`).join(' ・ '))
        .replaceAll('{{instagram}}', SITE.contact.instagram)
        .replaceAll('{{footerNote}}', SITE.footerNote)
        .replaceAll('{{section}}', sec);
    }
    // 先注入內容，再替換佔位符（內容裡也可用 {{emails}} 等）
    let html = TPL.replaceAll('{{content}}', mdToHtml(p.body));
    // 內頁 hero 眉題（比照首頁章節眉題：Cormorant 英文＋中文分區名）
    const EB = { concept: 'CONCEPT · 形象理念', product: 'PRODUCT · 核心產品', plan: 'PLAN · 團隊計畫', team: 'TEAM · 團隊憲章', faq: 'FAQ · 常見問題', join: 'JOIN · 加入我們', community: 'COMMUNITY · 眾織廣場' };
    const eb = EB[p.slug] || EB[p.slug.split('/')[0]];
    if (eb) html = html.replace('<div class="hero-block">', `<div class="hero-block"><p class="page-eyebrow">${eb}</p>`);
    // 憲章頁：自動產生篇目（TOC），插在第一個內文 h2 之前（第一個 h2 是 hero 副標，跳過）
    if (p.slug === 'team/charter') {
      const heads = [...html.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)];
      if (heads.length > 2) {
        const items = heads.slice(1).map(m => `<li><a href="#${m[1]}">${m[2]}</a></li>`).join('');
        const toc = `<nav class="doc-toc"><p class="toc-eyebrow">INDEX · 篇目</p><ol>${items}</ol></nav>`;
        const at = heads[1].index;
        html = html.slice(0, at) + toc + html.slice(at);
      }
    }
    html = html
      .replaceAll('{{title}}', p.meta.title || SITE.name)
      .replaceAll('{{description}}', p.meta.description || SITE.description)
      .replaceAll('{{siteName}}', SITE.name)
      .replaceAll('{{enName}}', SITE.enName)
      .replaceAll('{{nav}}', buildNav(sec))
      .replaceAll('{{emails}}', SITE.contact.email.map(e => `<a href="mailto:${e}">${e}</a>`).join(' ・ '))
      .replaceAll('{{instagram}}', SITE.contact.instagram)
      .replaceAll('{{footerNote}}', SITE.footerNote)
      .replaceAll('{{section}}', sec);
    return html;
  };

  for (const p of pages) {
    const outDir = p.slug === 'index' ? DIST : join(DIST, p.slug);
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'index.html');
    writeFileSync(outFile, render(p));
    written.add(outFile);
    console.log('  ✓', p.url, '←', relative(ROOT, p.src));
  }

  // section 索引頁（已有內容頁佔用該路徑時跳過，避免覆蓋）
  for (const n of SITE.nav) {
    const selfSlug = n.path.replace(/^\//, '').replace(/\/$/, '');
    const list = (bySection[n.key] || []).filter(p => p.slug !== 'index' && p.slug !== selfSlug);
    if (!list.length) continue;
    const items = list.map(p => `<a class="panel" href="${p.url}"><h3>${p.meta.title || ''}</h3><p>${p.meta.description || ''}</p><span class="go">進入 →</span></a>`).join('');
    const EB2 = { concept: 'CONCEPT', product: 'PRODUCT', plan: 'PLAN' };
    let html = TPL.replaceAll('{{content}}', `<div class="hero-block index-hero"><div class="wrap"><p class="page-eyebrow">${EB2[n.key] || ''} · ${n.label}</p><h1>${n.label}</h1></div></div><div class="wrap prose"><div class="panels">${items}</div></div>`);
    html = html
      .replaceAll('{{title}}', n.label + '｜' + SITE.name)
      .replaceAll('{{description}}', n.label)
      .replaceAll('{{siteName}}', SITE.name)
      .replaceAll('{{enName}}', SITE.enName)
      .replaceAll('{{nav}}', buildNav(n.key))
      .replaceAll('{{emails}}', SITE.contact.email.map(e => `<a href="mailto:${e}">${e}</a>`).join(' ・ '))
      .replaceAll('{{instagram}}', SITE.contact.instagram)
      .replaceAll('{{footerNote}}', SITE.footerNote)
      .replaceAll('{{section}}', n.key);
    const outDir = join(DIST, n.path);
    const outFile = join(outDir, 'index.html');
    if (written.has(outFile)) { console.log('  ○', n.path, '(已有內容頁，跳過索引)'); continue; }
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, html);
    written.add(outFile);
    console.log('  ✓', n.path, '(索引)');
  }

  // 靜態資源
  const copyDir = (s, d) => {
    mkdirSync(d, { recursive: true });
    for (const f of readdirSync(s, { withFileTypes: true })) {
      const sp = join(s, f.name), dp = join(d, f.name);
      if (f.isDirectory()) copyDir(sp, dp);
      else copyFileSync(sp, dp);
    }
  };
  copyDir(join(ROOT, 'assets'), join(DIST, 'assets'));
  // sw.js 必須在根目錄才能取得全站 scope；從 assets 搬到 dist 根
  copyFileSync(join(ROOT, 'assets', 'sw.js'), join(DIST, 'sw.js'));
  try { unlinkSync(join(DIST, 'assets', 'sw.js')); } catch (e) {}
  // 404
  const nf = TPL
    .replaceAll('{{title}}', '找不到頁面｜' + SITE.name)
    .replaceAll('{{description}}', '404')
    .replaceAll('{{siteName}}', SITE.name).replaceAll('{{enName}}', SITE.enName)
    .replaceAll('{{nav}}', buildNav(''))
    .replaceAll('{{content}}', '<div class="hero-block"><h1>這座橋還沒延伸到這裡</h1><p>你要找的頁面不存在。<a href="/">回首頁</a></p></div>')
    .replaceAll('{{emails}}', SITE.contact.email.map(e => `<a href="mailto:${e}">${e}</a>`).join(' ・ '))
    .replaceAll('{{instagram}}', SITE.contact.instagram)
    .replaceAll('{{footerNote}}', SITE.footerNote)
    .replaceAll('{{section}}', '');
  writeFileSync(join(DIST, '404.html'), nf);
  console.log('\n建置完成 → dist/（共', pages.length, '個內容頁）');
}

build();

if (process.argv.includes('--watch')) {
  const { watch } = await import('node:fs');
  console.log('監看 content/、templates/、assets/、site.json …');
  for (const d of [CONTENT, join(ROOT, 'templates'), join(ROOT, 'assets')]) {
    watch(d, { recursive: true }, () => { try { build(); } catch (e) { console.error(e.message); } });
  }
  watch(join(ROOT, 'site.json'), () => { try { build(); } catch (e) { console.error(e.message); } });
  process.stdin.resume();
}
