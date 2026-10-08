// Checks the static build: every route has its HTML file, asset links fit the target and exist, no file is too big
// for simple static hosts, no internal / company references leaked into what visitors see, and — in a real browser —
// the home page stays inside its first-load budget and works (live CRM, Ctrl / ⌘ K search, anchors, links, docs, 404).
//   node scripts/check-build.mjs              web build (build/: absolute paths from /, hashed assets, 404.html)
//   node scripts/check-build.mjs --sandbox    sandbox build (build-sandbox/: relative paths, classic bundles)
//   --no-browser                              skip the browser part (budget included)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { browseSite } from "./check-build-browser.mjs";

const sandbox = process.argv.includes("--sandbox");
const root = resolve(import.meta.dirname, sandbox ? "../build-sandbox" : "../build");
if (!existsSync(root)) {
  console.error(`没有 ${relative(resolve(import.meta.dirname, ".."), root)}/，先 npm run ${sandbox ? "build:sandbox" : "build"}`);
  process.exit(2);
}
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(root);

const problems = [];
// 1. Route files: llms.txt lists every page; each must exist. The web build also ships the host's 404 page.
const llms = readFileSync(join(root, "llms.txt"), "utf8");
const pages = [...llms.matchAll(/\]\(([a-z0-9-]+\.html)\)/g)].map((m) => m[1]);
if (pages.length < 20) problems.push(`llms.txt 只列了 ${pages.length} 页`);
for (const page of [...pages, "index.html", "preview.html", ...(sandbox ? [] : ["404.html"])]) if (!existsSync(join(root, page))) problems.push(`缺页面文件 ${page}`);
if (existsSync(join(root, "docs.html"))) problems.push("docs.html 只是模板，不该留在产物里");
if (!sandbox) {
  const notFound = existsSync(join(root, "404.html")) ? readFileSync(join(root, "404.html"), "utf8") : "";
  if (!notFound.includes("没有这个页面") || !notFound.includes('href="/"')) problems.push("404.html 应该说明「没有这个页面」并链回首页（/）");
  if (/<script[^>]+src=/.test(notFound)) problems.push("404.html 不该加载应用脚本");
}

// 2. Asset links: web = absolute from / (pages are served at any depth, e.g. the 404 page); sandbox = relative (works
//    in any sub-directory and in srcdoc frames). Either way they must resolve to a file in the build.
for (const f of files.filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    const url = m[1];
    if (/^(https?:)?\/\//.test(url) || url.startsWith("data:")) continue;
    const isPage = /^[a-z0-9-]+\.html$/.test(url);
    if (sandbox && url.startsWith("/")) problems.push(`${relative(root, f)} 用了绝对路径 ${url}（沙箱版要相对路径）`);
    else if (!sandbox && !url.startsWith("/") && !isPage) problems.push(`${relative(root, f)} 的资源用了相对路径 ${url}（正式版从 / 开始）`);
    const target = url.startsWith("/") ? join(root, url === "/" ? "index.html" : url) : resolve(f, "..", url);
    if (!existsSync(target)) problems.push(`${relative(root, f)} 引用的 ${url} 不存在`);
  }
}

// 3. Size: some static hosts / review tools cap single files at 5 MB. Web build: everything under assets/ carries an
//    8-character content hash (the host caches those for a year).
for (const f of files) if (statSync(f).size > 5 * 1024 * 1024) problems.push(`${relative(root, f)} 超过 5 MB`);
if (!sandbox) {
  const unhashed = readdirSync(join(root, "assets")).filter((f) => !/-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/.test(f));
  if (unhashed.length) problems.push(`assets/ 里有不带内容哈希的文件：${unhashed.slice(0, 10).join(", ")}`);
}

// 4. Leaks: the repo's leak guard over what visitors get. Internal repo: tools/admin-ui-oss/check-internal.mjs (plaintext
//    term list); exported public repo: scripts/check-internal.mjs (hashed list). The build is mirrored to
//    <tmp>/tree/sites/docs/out so the guard sees the public path it allows the docs host under; in the internal repo the
//    mirror gets the export's text rewrites (package name …), so it is scanned exactly as it would ship.
const repoRoot = resolve(import.meta.dirname, "../../..");
const guard = [join(repoRoot, "tools/admin-ui-oss/check-internal.mjs"), join(repoRoot, "scripts/check-internal.mjs")].find((f) => existsSync(f));
if (!guard) problems.push("找不到泄漏守卫（tools/admin-ui-oss/check-internal.mjs 或 scripts/check-internal.mjs）");
else {
  const mappingFile = join(repoRoot, "tools/admin-ui-oss/mapping.mjs");
  const mapping = existsSync(mappingFile) ? await import(pathToFileURL(mappingFile).href) : null;
  const tmp = mkdtempSync(join(tmpdir(), "site-guard-"));
  try {
    const mirror = join(tmp, "tree/sites/docs/out");
    for (const f of files) {
      const rel = relative(root, f).replaceAll("\\", "/");
      const to = join(mirror, rel);
      mkdirSync(dirname(to), { recursive: true });
      if (mapping?.isTextFile(rel)) writeFileSync(to, mapping.rewriteText(`sites/docs/out/${rel}`, readFileSync(f, "utf8")));
      else copyFileSync(f, to);
    }
    const report = join(tmp, "report");
    const run = spawnSync(process.execPath, [guard, join(tmp, "tree"), "--quiet", "--report", report], { encoding: "utf8" });
    if (run.status !== 0) {
      problems.push(`泄漏守卫没通过（退出码 ${run.status ?? run.signal}）：${(run.stderr || run.stdout).trim()}`);
      if (existsSync(`${report}.json`)) {
        const { hits } = JSON.parse(readFileSync(`${report}.json`, "utf8"));
        for (const h of hits.slice(0, 30)) {
          // Minified bundles are one long line: show the text around the hit, not the start of the line.
          const line = readFileSync(join(tmp, "tree", h.file), "utf8").split(/\r?\n/)[h.line - 1] ?? "";
          const around = line.slice(Math.max(0, h.col - 41), h.col + 40).replace(/\s+/g, " ");
          problems.push(`${h.file.replace(/^sites\/docs\/out\//, "")}:${h.line}:${h.col} [${h.category}] ${h.match}：…${around}…`);
        }
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// 5. Browser: first-load budget of the home page (what it really requests before any scrolling, pointing or idle time,
//    gzip -9 of the files; the hero CRM and other idle-time loads come after first paint and are reported) and the
//    pages working — see check-build-browser.mjs.
const HOME_BUDGET_KB = 250;
let summary = "（跳过浏览器检查）";
if (!problems.length && !process.argv.includes("--no-browser")) {
  const result = await browseSite({ root, sandbox });
  problems.push(...result.problems);
  const { js, css } = result.firstLoad;
  const total = (js + css) / 1024;
  const idleKb = (result.afterIdle.js + result.afterIdle.css) / 1024;
  summary = `首页首屏 JS ${(js / 1024).toFixed(1)} KB + CSS ${(css / 1024).toFixed(1)} KB = ${total.toFixed(1)} KB gzip（预算 ${HOME_BUDGET_KB}，${result.firstLoad.files} 个文件）；空闲后连同首屏 CRM 共 ${idleKb.toFixed(1)} KB`;
  // The budget is for the web build visitors get; the sandbox build (one classic bundle per island) is only reported.
  if (!sandbox && total > HOME_BUDGET_KB) problems.push(`首页首屏 ${total.toFixed(1)} KB gzip，超过 ${HOME_BUDGET_KB} KB：${result.firstLoad.biggest}`);
}

if (problems.length) {
  console.error(`构建检查（${sandbox ? "沙箱版" : "正式版"}）：${problems.length} 个问题`);
  for (const p of problems.slice(0, 50)) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`构建检查通过（${sandbox ? "沙箱版 build-sandbox/" : "正式版 build/"}）：${files.length} 个文件，${pages.length} 个页面；${summary}`);
