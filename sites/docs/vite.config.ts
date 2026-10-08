import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { CAPABILITIES } from "@adminui/react/catalog";
import { COMPONENT_DOCS, GUIDES, ROUTES } from "./src/content/index";
import { GROUPS } from "./src/content/types";
import { searchIndexAsset, writeSitePages } from "./site-pages";

/**
 * Static site: every route is its own flat HTML file (`button.html`, `why.html` …); the files are copies of docs.html
 * with the title / description filled in and the app reads the route from the file name. index.html is the homepage
 * (src/home, its own small bundle; the live demos are islands, src/home/islands.ts). Two targets
 * (SITE_TARGET, scripts/build.mjs):
 *
 * - `web` (default, build/): for a normal static host at the site root (https://adminui.zygskins.cn/). One Vite
 *   build with ES modules, absolute asset paths from `/`, content-hashed chunks shared between pages, islands and
 *   demos as lazy chunks, the demo frame as a same-origin `preview.html#state`, plus 404.html.
 * - `sandbox` (build-sandbox/): for review tools and doc hosts that put the page in a sandbox (opaque origin, no
 *   storage, `frame-ancestors 'self'`). Classic (IIFE) bundles built one after the other (SITE_STEP): `index` (the
 *   homepage shell), `docs` (every other page), `preview` (the demo frame, loaded through `srcdoc`) and the homepage
 *   islands (`home-<name>.js`). Classic scripts without `crossorigin` and relative URLs load there; module scripts
 *   and dynamic imports would need CORS headers.
 */
const sandbox = process.env.SITE_TARGET === "sandbox";
const OUT = sandbox ? "build-sandbox" : "build";
const BASE = sandbox ? "./" : "/";
const step = sandbox ? process.env.SITE_STEP : undefined;
const SEARCH_INDEX = searchIndexAsset();

/** Module script / crossorigin → classic deferred script, so no CORS is needed anywhere (sandbox target). */
const classic = (html: string) =>
  html
    .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
    .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=');

/** Navigation without the doc content (titles, groups, counts) for the layout: `virtual:site-nav`. */
function siteNav(): Plugin {
  const id = "\0virtual:site-nav";
  const nav = {
    guides: GUIDES.map((g) => ({ slug: g.slug, title: g.title })),
    groups: GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      docs: COMPONENT_DOCS.filter((d) => d.group === group.id).map((d) => ({ slug: d.slug, title: d.title, ...(d.status ? { status: d.status } : {}) })),
    })),
    routes: ROUTES.map((r) => ({ slug: r.slug, title: r.title, summary: r.summary, groupTitle: r.groupTitle, keywords: r.keywords })),
    componentSlugs: COMPONENT_DOCS.map((d) => d.slug),
    exportsCount: new Set(CAPABILITIES.flatMap((c) => c.exports)).size,
  };
  return {
    name: "site-nav",
    resolveId: (source) => (source === "virtual:site-nav" ? id : null),
    load: (source) => (source === id ? `export default ${JSON.stringify(nav)};` : null),
  };
}

/**
 * Sandbox islands: admin-ui's AdminProvider imports the core stylesheet, which the homepage shell already has. Loading
 * it again after home.css would re-declare the base rules later in the cascade and undo the page's own styling.
 */
function islandCoreCss(): Plugin {
  const empty = resolve(__dirname, "src/home/islands/empty.css");
  return {
    name: "site-island-core-css",
    enforce: "pre",
    resolveId(source) {
      return source === "#aui-css/core.css" || source === "@adminui/react/styles.css" ? empty : null;
    },
  };
}

function routePages(): Plugin {
  return {
    name: "site-route-pages",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        // The home page's search index is written by the build; dev serves it from memory.
        if (url.split("?")[0] === `/${SEARCH_INDEX.file}`) {
          res.setHeader("content-type", "text/javascript");
          res.end(SEARCH_INDEX.code);
          return;
        }
        // `/button.html` → docs.html (index.html is the homepage, preview.html the demo frame).
        const m = /^\/([a-z0-9-]+)\.html(\?.*)?$/.exec(url);
        if (m && m[1] !== "preview" && m[1] !== "index" && m[1] !== "docs") req.url = `/docs.html${m[2] ?? ""}`;
        next();
      });
    },
    closeBundle() {
      const dir = resolve(__dirname, OUT);
      if (!sandbox) {
        writeSitePages(dir, { transform: (html) => html, notFound: true });
        return;
      }
      if (step !== "preview") return; // runs once, after the index / docs / preview bundles exist
      writeSitePages(dir, { transform: classic, notFound: false });
      const leftovers = readdirSync(resolve(dir, "assets")).filter((f) => f.endsWith(".js") && !/^(index-|docs-|search-index-|preview\.js$)/.test(f));
      if (leftovers.length) throw new Error(`构建出了额外的 JS 块（应该只有 index / docs / preview 和 search-index）：${leftovers.join(", ")}`);
    },
  };
}

const entry = step === "index" || step === "docs" || step === "preview" ? step : null;
const island = step?.startsWith("island:") ? step.slice("island:".length) : null;
// Sandbox: the docs bundle loads the demo bundle by a fixed name (+ build id against stale caches); see src/shell/preview-frame.ts.
const buildId = process.env.SITE_BUILD_ID ?? "dev";
// Sandbox: homepage islands share the shell's React through these globals (src/home/main.tsx sets them).
const SHARED_GLOBALS: Record<string, string> = {
  react: "__auiReact",
  "react-dom": "__auiReactDOM",
  "react-dom/client": "__auiReactDOMClient",
  "react/jsx-runtime": "__auiJSX",
};
const AUI_VERSION = (JSON.parse(readFileSync(resolve(__dirname, "../../packages/react/package.json"), "utf8")) as { version: string }).version;
const PAGES = { index: resolve(__dirname, "index.html"), docs: resolve(__dirname, "docs.html"), preview: resolve(__dirname, "preview.html") };

/** Sandbox: one classic bundle per step. */
function sandboxBuild() {
  if (island)
    return {
      outDir: `${OUT}/assets`,
      emptyOutDir: false,
      sourcemap: false,
      minify: true,
      target: "es2022",
      chunkSizeWarningLimit: 4000,
      lib: {
        entry: resolve(__dirname, `src/home/islands/${island}.tsx`),
        formats: ["iife" as const],
        name: `auiHome_${island}`,
        fileName: () => `home-${island}.js`,
        cssFileName: `home-${island}`,
      },
      rollupOptions: { external: Object.keys(SHARED_GLOBALS), output: { globals: SHARED_GLOBALS, inlineDynamicImports: true } },
    };
  return {
    outDir: OUT,
    emptyOutDir: entry === "index",
    sourcemap: false,
    modulePreload: false as const,
    // The homepage shell ships its CSS as a file (in parallel, not inside the JS); the other bundles inject theirs.
    cssCodeSplit: entry !== "index",
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: entry ? { [entry]: PAGES[entry] } : PAGES,
      output: { format: "iife" as const, inlineDynamicImports: true, ...(entry === "preview" ? { entryFileNames: "assets/preview.js" } : {}) },
    },
  };
}

export default defineConfig({
  base: BASE,
  // Island bundles are written into assets/: public/ is copied once, by the page build.
  ...(island ? { publicDir: false as const } : {}),
  plugins: [react(), siteNav(), routePages(), ...(island ? [islandCoreCss()] : [])],
  define: {
    __SITE_ESM__: JSON.stringify(!sandbox),
    __PREVIEW_SCRIPT__: JSON.stringify(`assets/preview.js?v=${buildId}`),
    __HOME_BUILD__: JSON.stringify(buildId),
    __SEARCH_INDEX_SCRIPT__: JSON.stringify(`${BASE === "/" ? "/" : ""}${SEARCH_INDEX.file}`),
    __AUI_VERSION__: JSON.stringify(AUI_VERSION),
    __AUI_EXPORTS__: JSON.stringify(new Set(CAPABILITIES.flatMap((c) => c.exports)).size),
    // Library mode keeps process.env for consumers; islands run straight in the browser.
    ...(island ? { "process.env.NODE_ENV": JSON.stringify("production") } : {}),
  },
  // Demos track the library source in this repo (packages/react/src via the workspace link), not a published build.
  resolve: { conditions: ["source", "module", "browser", "development|production"] },
  build: sandbox
    ? sandboxBuild()
    : { outDir: OUT, emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 4000, rollupOptions: { input: PAGES } },
  server: { host: "127.0.0.1" },
});
