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

function renderBlock(kind, inner) {
  // joinform：原樣輸出加入我們表單（舊站 Custom Embed 移植），不經 markdown 轉義
  if (kind === 'joinform') return JOIN_FORM;
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
  // cards：把連續的 h4+段落 轉成卡片
  if (kind === 'cards' || kind === 'timeline') {
    const parts = html.split(/<h4[^>]*>/).slice(1).map(p => {
      const m = p.match(/^(.*?)<\/h4>([\s\S]*)$/);
      return `<div class="${kind === 'cards' ? 'card' : 'tl-item'}"><h3>${m[1]}</h3>${m[2]}</div>`;
    });
    return `<div class="${kind === 'cards' ? 'cards' : 'timeline'}">` + parts.join('') + '</div>';
  }
  const cls = { hero: 'hero-block', oath: 'oath-block', cta: 'cta-block' }[kind] || 'custom-block';
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
    // 先注入內容，再替換佔位符（內容裡也可用 {{emails}} 等）
    let html = TPL.replaceAll('{{content}}', mdToHtml(p.body));
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
    const items = list.map(p => `<div class="card"><h3><a href="${p.url}">${p.meta.title || ''}</a></h3><p>${p.meta.description || ''}</p></div>`).join('');
    let html = TPL.replaceAll('{{content}}', `<div class="hero-block"><div class="wrap"><h1>${n.label}</h1></div></div><div class="wrap prose"><div class="cards">${items}</div></div>`);
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
