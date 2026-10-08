// Build-time pages written next to the bundles (vite.config.ts `routePages`): one HTML file per route, llms.txt, the
// docs search index for the home page, and the 404 page (web build). Pure string work over the built templates.
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPONENT_DOCS, ROUTES } from "./src/content/index";
import { buildSearchBlocks } from "./src/shell/search-blocks";

export const SITE_NAME = "admin-ui";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The docs search index the home page loads on its first query: a classic script, named by its content hash. */
export function searchIndexAsset(): { file: string; code: string } {
  const code = `window.__AUI_SEARCH__=${JSON.stringify(buildSearchBlocks(COMPONENT_DOCS)).replace(/</g, "\\u003c")};\n`;
  const hash = createHash("sha256").update(code).digest("base64url").slice(0, 8);
  return { file: `assets/search-index-${hash}.js`, code };
}

function routeHtml(template: string, title: string, summary: string, heading: string): string {
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(summary)}"`)
    .replace("<!--route-noscript-->", `<noscript><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(summary)}</p></noscript>`);
}

function llmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    "",
    "> 为数据密集型管理后台而生的 React 19 组件库。",
    "",
    "## 指南",
    ...ROUTES.filter((r) => r.kind === "guide").map((r) => `- [${r.title}](${r.slug}.html): ${r.summary}`),
    "",
    "## 组件",
    ...COMPONENT_DOCS.map((d) => `- [${d.title}（${d.subtitle}）](${d.slug}.html): ${d.summary} 导入：\`${d.importFrom}\``),
    "",
  ].join("\n");
}

/**
 * 404 page for static hosts (`error_page 404 /404.html`): served at any depth, so links are absolute. No app bundle —
 * inline styles in the default palette (forest), dark mode from the system or the visitor's saved site preference.
 */
function notFoundHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>没有这个页面 · ${SITE_NAME}</title>
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script>try{var m=JSON.parse(localStorage.getItem("aui-site:prefs")||"null");if(m&&m.mode)document.documentElement.dataset.mode=m.mode}catch(e){}</script>
    <style>
      :root{--bg:#fff;--tile:#f5f6f7;--text:#1f2329;--sub:#646a73;--line:#e5e6eb;--primary:#357450;--on:#fff;color-scheme:light}
      @media (prefers-color-scheme:dark){:root:not([data-mode=light]){--bg:#16181b;--tile:#1f2226;--text:#e8eaed;--sub:#a3a8b0;--line:#2e3238;--primary:#5fae82;--on:#0d1a12;color-scheme:dark}}
      :root[data-mode=dark]{--bg:#16181b;--tile:#1f2226;--text:#e8eaed;--sub:#a3a8b0;--line:#2e3238;--primary:#5fae82;--on:#0d1a12;color-scheme:dark}
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font-family:"PingFang SC","Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
      header{height:64px;display:flex;align-items:center;padding:0 32px;border-bottom:1px solid var(--line)}
      .logo{display:inline-flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-.02em}
      main{flex:1;display:flex;align-items:center;justify-content:center;padding:48px 24px}
      .card{max-width:520px;text-align:center}
      .code{font:700 72px/1 "Cascadia Code","JetBrains Mono",Consolas,ui-monospace,monospace;color:var(--primary);letter-spacing:-.04em}
      h1{margin:16px 0 8px;font-size:24px}
      p{margin:0;color:var(--sub);line-height:1.7}
      .actions{margin-top:28px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
      .actions a{display:inline-flex;align-items:center;height:40px;padding:0 18px;border-radius:8px;font-size:15px;text-decoration:none;border:1px solid var(--line);color:var(--text);background:var(--bg)}
      .actions a.primary{background:var(--primary);border-color:var(--primary);color:var(--on)}
      .actions a:hover{background:var(--tile)}
      .actions a.primary:hover{filter:brightness(1.08);background:var(--primary)}
      .actions a:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
      footer{padding:24px 32px;color:var(--sub);font-size:13px;border-top:1px solid var(--line);text-align:center}
    </style>
  </head>
  <body>
    <header>
      <a class="logo" href="/" aria-label="${SITE_NAME} 首页">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="var(--primary)"/><rect x="7" y="8" width="18" height="3.2" rx="1.6" fill="var(--on)"/><rect x="7" y="14.4" width="11" height="3.2" rx="1.6" fill="var(--on)" opacity=".85"/><rect x="7" y="20.8" width="15" height="3.2" rx="1.6" fill="var(--on)" opacity=".7"/><rect x="20" y="14.4" width="5" height="9.6" rx="1.6" fill="var(--on)" opacity=".55"/></svg>
        ${SITE_NAME}
      </a>
    </header>
    <main>
      <div class="card">
        <div class="code" aria-hidden="true">404</div>
        <h1>没有这个页面</h1>
        <p>可能是链接写错了，或者页面改了名字。<br />回首页看看，或者直接去文档里找。</p>
        <div class="actions">
          <a class="primary" href="/">回到首页</a>
          <a href="/install.html">安装与起步</a>
          <a href="/button.html">浏览组件</a>
        </div>
      </div>
    </main>
    <footer>为数据密集型管理后台而生的 React 组件库</footer>
  </body>
</html>
`;
}

/**
 * Writes the route files from the built templates: index.html is the home page (its own bundle, kept as built), every other route is a copy of docs.html (removed afterwards; it was only the template).
 * `transform` adapts a built HTML file to the target (the sandbox build rewrites module scripts to classic ones).
 */
export function writeSitePages(dir: string, { transform, notFound }: { transform: (html: string) => string; notFound: boolean }) {
  const read = (name: string) => transform(readFileSync(resolve(dir, name), "utf8"));
  writeFileSync(resolve(dir, "preview.html"), read("preview.html"));
  writeFileSync(resolve(dir, "index.html"), read("index.html"));
  const template = read("docs.html");
  rmSync(resolve(dir, "docs.html"));
  for (const route of ROUTES.filter((r) => r.slug !== "index")) {
    writeFileSync(resolve(dir, `${route.slug}.html`), routeHtml(template, `${route.title} · ${SITE_NAME}`, route.summary, route.title));
  }
  const search = searchIndexAsset();
  writeFileSync(resolve(dir, search.file), search.code);
  writeFileSync(resolve(dir, "llms.txt"), llmsTxt());
  if (notFound) writeFileSync(resolve(dir, "404.html"), notFoundHtml());
}
