#!/usr/bin/env node
// Size budget gate for @adminui/react.
//   node scripts/size-budget.mjs            → measure, compare with BUDGETS, exit 1 when one is over
//   node scripts/size-budget.mjs --report   → print the numbers only (never fails)
//   node scripts/size-budget.mjs --json     → numbers as JSON (for MIGRATION-8 / CI dashboards)
//   node scripts/size-budget.mjs --only core,grid
//
// What it measures (all minified + gzip -9, the way a Vite consumer ships them):
// - "probe" consumers built from a virtual entry against the published entry points (dist, default conditions):
//   core = AdminProvider + Button + Input + Dialog + styles.css (the smallest real page); root = every root export;
//   one probe per subpath (every export of it). react / react-dom are external (the app pays for them anyway);
//   heavy peers (echarts, @tanstack/*, react-markdown, remark-gfm, read-excel-file) are external too and the
//   probe fails when a heavy peer is imported by a probe that must not have it (core / root).
// - first-paint probes ("grid:read-only"): a consumer that renders one component; only the entry chunk and its static
//   imports count (the parts the component loads lazily — panels, editors, dialogs — are listed, never budgeted), and
//   the heavy peers it needs are bundled in (that is what the page really downloads; the note says which).
// - tier starters (examples/small, examples/starter, examples/large): the FIRST SCREEN only = the entry chunk and
//   its static imports + the CSS they pull in. Lazy chunks are listed but never budgeted — importing any subpath
//   is allowed in every tier; it just has to be lazy when it is heavy.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const reportOnly = args.includes("--report") || args.includes("--json");
const asJson = args.includes("--json");
const onlyArg = args.find((a) => a.startsWith("--only"));
const only = onlyArg ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1] ?? "").split(",").filter(Boolean) : null;

const KB = 1024;
/** Budgets in KB gzip (8.0.0 measured + ~10 % headroom). Probe JS excludes react / react-dom and the heavy peers; probe CSS = styles.css + the chunks the entry pulls in. */
export const BUDGETS = {
  core: { js: 28, css: 26 }, // 8.6: page-flush rules for every page live in core (+0.6 KB gzip; 25.0 → 26 keeps the headroom)
  root: { js: 330, css: 100 },
  charts: { js: 22, css: 31 },
  markdown: { js: 11, css: 26 },
  catalog: { js: 75, css: 26 },
  excel: { js: 2, css: 26 },
  grid: { js: 165, css: 54 },
  access: { js: 240, css: 64 },
  peizhi: { js: 96, css: 45 },
  // 8.2: neutral alias of /peizhi (same module, same size).
  settings: { js: 96, css: 45 },
  "record-detail-spec": { js: 4, css: 26 },
  "grid-query": { js: 27, css: 26 },
  views: { js: 130, css: 53 },
  "form-builder": { js: 106, css: 52 },
  "forms-public": { js: 61, css: 38 },
  "dashboard-builder": { js: 139, css: 62 },
  // 8.1: own subpath + CSS chunk; GrantList / ShareDialog import it lazily (the root probe inlines lazy chunks, so root counts it too).
  "org-picker": { js: 50, css: 30 },
  // 8.3: first paint of a read-only BitableGrid (with @tanstack table / virtual; panels, editors, lightbox lazy).
  "grid:read-only": { js: 120, css: 41 },
  // Tiers: first screen only. js = without react / react-dom; jsTotal = with them (large hosts verify: ≤ 300 KB JS, ≤ 40 KB CSS).
  "tier:small": { js: 72, css: 32 },
  "tier:medium": { js: 130, jsTotal: 300, css: 40 },
  "tier:large": { js: 80, jsTotal: 300, css: 40 },
};

const HEAVY_PEERS = ["echarts", "zrender", "@tanstack/react-table", "@tanstack/table-core", "@tanstack/react-virtual", "@tanstack/virtual-core", "react-markdown", "remark-gfm", "read-excel-file"];
const REACT = ["react", "react-dom", "react/jsx-runtime", "react-dom/client", "scheduler"];
const isUnder = (id, names) => names.some((n) => id === n || id.startsWith(`${n}/`));

const gz = (text) => gzipSync(text, { level: 9 }).length;

/** Every export name of an entry point (from its compiled .d.ts-free JS via a dynamic import is impossible: CSS). Read the probe list from the module graph instead. */
function probeSource(spec) {
  if (spec.source) return spec.source;
  if (spec.names) {
    return `import { ${spec.names.join(", ")} } from "${spec.from}";\n${spec.css ? `import "${spec.css}";\n` : ""}console.log(${spec.names.join(", ")});\n`;
  }
  return `import * as all from "${spec.from}";\n${spec.css ? `import "${spec.css}";\n` : ""}console.log(all);\n`;
}

/** First paint of a probe that renders something: entry chunk + its static imports (lazy chunks listed, not counted). */
function firstPaintOf(outputs) {
  const byName = new Map(outputs.map((o) => [o.fileName, o]));
  const entry = outputs.find((o) => o.type === "chunk" && o.isEntry);
  const seen = new Set();
  const cssFiles = new Set();
  const walk = (file) => {
    const chunk = byName.get(file);
    if (!chunk || seen.has(file)) return;
    seen.add(file);
    for (const c of chunk.viteMetadata?.importedCss ?? []) cssFiles.add(c);
    for (const dep of chunk.imports) walk(dep);
  };
  walk(entry.fileName);
  let js = 0;
  let lazy = 0;
  for (const o of outputs) if (o.type === "chunk") (seen.has(o.fileName) ? (js += gz(o.code)) : (lazy += gz(o.code)));
  let css = 0;
  for (const c of cssFiles) {
    const o = byName.get(c);
    if (o) css += gz(typeof o.source === "string" ? o.source : Buffer.from(o.source));
  }
  return { js, css, lazy };
}

async function measureProbe(name, spec) {
  const id = "\0aui-size-probe";
  const seenHeavy = new Set();
  const result = await build({
    root: pkgRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "aui-size-probe",
        resolveId(source) {
          if (source === "aui-size-probe") return id;
          return null;
        },
        load(source) {
          return source === id ? probeSource(spec) : null;
        },
      },
    ],
    build: {
      write: false,
      minify: "esbuild",
      cssCodeSplit: Boolean(spec.firstPaint),
      modulePreload: false,
      reportCompressedSize: false,
      rollupOptions: {
        input: "aui-size-probe",
        external: (source) => {
          if (isUnder(source, REACT)) return true;
          if (isUnder(source, HEAVY_PEERS)) {
            seenHeavy.add(source);
            return !spec.firstPaint;
          }
          return false;
        },
        output: { inlineDynamicImports: !spec.firstPaint },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  if (spec.firstPaint) return { name, ...firstPaintOf(outputs), heavy: [...seenHeavy].sort(), bundledHeavy: true };
  let js = 0;
  let css = 0;
  for (const file of outputs) {
    if (file.type === "chunk") js += gz(file.code);
    else if (file.fileName.endsWith(".css")) css += gz(typeof file.source === "string" ? file.source : Buffer.from(file.source));
  }
  return { name, js, css, heavy: [...seenHeavy].sort() };
}

/** Build a tier starter and sum the first screen (entry + static imports) from the Vite manifest. */
async function firstScreen(root, external) {
  const result = await build({
    root,
    configFile: false,
    logLevel: "silent",
    base: "./",
    plugins: [react()],
    build: { write: false, manifest: true, minify: "esbuild", reportCompressedSize: false, modulePreload: { polyfill: false }, rollupOptions: external ? { external: (id) => isUnder(id, REACT) } : {} },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const byName = new Map(outputs.map((o) => [o.fileName, o]));
  const manifest = JSON.parse(String(outputs.find((o) => o.fileName.endsWith("manifest.json")).source));
  const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
  const seen = new Set();
  const cssFiles = new Set();
  const walk = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const c of manifest[key].css ?? []) cssFiles.add(c);
    for (const dep of manifest[key].imports ?? []) walk(dep);
  };
  walk(entryKey);
  const files = new Set([...seen].map((k) => manifest[k].file));
  let js = 0;
  for (const f of files) { const o = byName.get(f); if (o?.type === "chunk") js += gz(o.code); }
  let css = 0;
  for (const c of cssFiles) { const o = byName.get(c); if (o) css += gz(typeof o.source === "string" ? o.source : Buffer.from(o.source)); }
  let lazy = 0;
  for (const o of outputs) if (o.type === "chunk" && !files.has(o.fileName)) lazy += gz(o.code);
  return { js, css, lazy };
}

/** Build a tier starter and sum the first screen (entry + static imports + their CSS). JS is budgeted without react / react-dom (every React app pays those ~58 KB); the total is reported. */
async function measureTier(name, dir) {
  const root = join(pkgRoot, dir);
  if (!existsSync(join(root, "index.html"))) return { name, missing: true };
  const all = await firstScreen(root, false);
  const own = await firstScreen(root, true);
  return { name, js: own.js, css: all.css, lazy: all.lazy, jsWithReact: all.js };
}

const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
const self = pkg.name;
/** Node-only subpaths (build tooling, never imported by the app) have no browser bundle to measure. */
const NODE_ONLY = new Set(["vite"]);
const subpaths = Object.keys(pkg.exports).filter((k) => k !== "." && !k.endsWith(".css")).map((k) => k.slice(2)).filter((k) => !NODE_ONLY.has(k));

const probes = [
  ["core", { from: self, names: ["AdminProvider", "Button", "Input", "Dialog"], css: `${self}/styles.css` }],
  ["root", { from: self, css: `${self}/styles.css` }],
  ...subpaths.map((sub) => [sub, { from: `${self}/${sub}`, css: `${self}/styles.css` }]),
  [
    "grid:read-only",
    {
      firstPaint: true,
      source: `import "${self}/styles.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { BitableGrid } from "${self}/grid";
const fields = [{ key: "name", title: "名称", type: "text" }, { key: "stage", title: "阶段", type: "singleSelect", options: [{ value: "a", label: "A" }] }];
createRoot(document.getElementById("root")).render(createElement(BitableGrid, { fields, rows: [{ id: "1", name: "x", stage: "a" }], getRowId: (r) => r.id }));
`,
    },
  ],
];
const tiers = [
  ["tier:small", "examples/small"],
  ["tier:medium", "examples/starter"],
  ["tier:large", "examples/large"],
];

const rows = [];
for (const [name, spec] of probes) if (!only || only.includes(name)) rows.push(await measureProbe(name, spec));
for (const [name, dir] of tiers) if (!only || only.includes(name)) rows.push(await measureTier(name, dir));

const fmt = (n) => (n / KB).toFixed(1).padStart(7);
const failures = [];
if (asJson) {
  console.log(JSON.stringify(rows.map((r) => ({ ...r, jsKB: +(r.js / KB).toFixed(1), cssKB: +(r.css / KB).toFixed(1) })), null, 2));
} else {
  console.log("entry                  JS KB  budget   CSS KB  budget  notes");
}
for (const row of rows) {
  const budget = BUDGETS[row.name];
  const notes = [];
  if (row.missing) notes.push("missing");
  if (row.heavy?.length) notes.push(`${row.bundledHeavy ? "bundled heavy peers" : "heavy peers"}: ${row.heavy.join(" ")}`);
  if (row.jsWithReact) notes.push(`with react ${(row.jsWithReact / KB).toFixed(1)} KB`);
  if (row.lazy) notes.push(`lazy ${(row.lazy / KB).toFixed(1)} KB (not budgeted)`);
  if (budget && !row.missing) {
    if (row.js > budget.js * KB) failures.push(`${row.name} JS ${(row.js / KB).toFixed(1)} KB > ${budget.js} KB`);
    if (row.css > budget.css * KB) failures.push(`${row.name} CSS ${(row.css / KB).toFixed(1)} KB > ${budget.css} KB`);
    if (budget.jsTotal && row.jsWithReact > budget.jsTotal * KB) failures.push(`${row.name} JS with react ${(row.jsWithReact / KB).toFixed(1)} KB > ${budget.jsTotal} KB`);
  } else if (!budget) notes.push("no budget");
  if ((row.name === "core" || row.name === "root" || row.name === "tier:small") && row.heavy?.length) {
    failures.push(`${row.name} imports heavy peers (${row.heavy.join(", ")}) — heavy deps belong to their subpaths only`);
  }
  if (!asJson) {
    console.log(`${row.name.padEnd(20)} ${row.missing ? "      -" : fmt(row.js)} ${String(budget?.js ?? "-").padStart(7)}  ${row.missing ? "      -" : fmt(row.css)} ${String(budget?.css ?? "-").padStart(7)}  ${notes.join("; ")}`);
  }
}
if (failures.length && !reportOnly) {
  console.error(`\nsize budget exceeded:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
if (!asJson) console.log(failures.length ? `\n${failures.length} over budget (report only)` : "\nsize budget ok");
