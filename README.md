# 凌極世界 crestylonworld 官網

> 登高以望遠，立近以圖遠。

Markdown 內容驅動的靜態官網。**內容只寫 Markdown，網站自動長出來** —— 架構模仿個人網頁系統（Modular Markdown Site System）的「內容與呈現分離、push 即部署」哲學，輕量化為零依賴版本。

## 運作原理

```
site.json                  ← 網站名稱、導覽列、聯絡資訊、主題色
content/pages/**/*.md      ← 唯一內容來源（一頁一檔＋frontmatter）
templates/base.html        ← 共用版型（導覽、頁尾）
assets/*                   ← 設計系統 CSS、前端 JS、PWA Service Worker
        │  npm run build
        ▼
scripts/build.mjs          ← 零依賴編譯器：MD → dist/**/*.html
        ▼
dist/                      ← 靜態產物（Cloudflare Pages 發布目錄，不進版控）
```

## 本地開發

```bash
node scripts/build.mjs          # 編譯一次 → dist/
node scripts/build.mjs --watch  # 監看內容變更自動重編
# 用任何靜態伺服器預覽 dist/，例如：npx serve dist
```

## 新增／修改頁面

1. 在 `content/pages/` 下新增 `分類/檔名.md`（或直接改現有檔案）。
2. 檔案開頭的 frontmatter：
   ```yaml
   ---
   title: 頁面標題
   section: concept        # 對應 site.json 導覽 key（concept/product/plan/team/join）
   order: 1                # 同分類內的排序
   description: 一句話摘要（用於 SEO 與分類索引卡片）
   ---
   ```
3. 內文用 Markdown。可用自訂區塊：
   - `::: hero` —— 首屏大標區
   - `::: cards` —— 卡片網格（內用 `####` 分卡）
   - `::: timeline` —— 時間線（內用 `####` 分項）
   - `::: oath` —— 誓言／引文大字區
   - `::: cta` —— 行動呼籲（內放連結）
4. Commit＋push，Cloudflare 會自動重新 build 並部署。

換 logo：把圖檔放進 `assets/logo.png`（建議正方形 PNG）即可。

## Cloudflare Pages 部署設定

在 Cloudflare Dashboard → Pages → 連接此 GitHub 倉庫：

| 項目 | 值 |
|------|-----|
| Framework preset | None |
| Build command | `node scripts/build.mjs` |
| Build output directory | `dist` |
| Node.js 版本 | 20（環境變數 `NODE_VERSION=20`） |

零依賴，build 約 1 秒完成。另附 `wrangler.jsonc`，如需改走 Cloudflare Workers 部署可用 `npm run deploy`。

## 設計系統

- **色**：`#0F172A` 深空藍黑（底）／`#F8FAFC` 月白（字）／`#06B6D4` 青（橋・連結）／`#F97316` 橙（曙光・行動）
- **字**：Noto Serif TC 900（標題，史詩敘事感）／Noto Sans TC（內文）
- **間距**：8pt 基準；圓角 4px；深色微光陰影
- **動效**：CSS 星空、拱橋 SVG、捲動揭示；支援 `prefers-reduced-motion`
- 所有 token 集中在 `assets/style.css` 的 `:root`

## PWA

`assets/sw.js`（手寫、零依賴）在 build 時會被搬到 `dist/sw.js` 取得全站 scope。快取策略經實戰修正：**只快取無副檔名的頁面路由導航、且 content-type 必須是 text/html**，避免把 HTML 誤存成 CSS/JS 造成永久無樣式。
