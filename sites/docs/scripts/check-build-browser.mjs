// Browser half of check-build.mjs: serves the build like its host and drives it in Chromium.
//   web     → like the production static host: `try_files $uri $uri.html`, unknown paths get 404.html with status 404
//   sandbox → like sandboxed review tools: every response carries `Content-Security-Policy: sandbox …` (opaque origin)
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".json": "application/json" };

/** A static server for `root` in the given mode; resolves to its base URL. */
export function serveBuild(dir, { sandbox, port = 0 }) {
  const root = resolve(dir);
  const isFile = (f) => f.startsWith(root) && existsSync(f) && statSync(f).isFile();
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const candidates = path.endsWith("/") ? [join(root, path, "index.html")] : sandbox ? [join(root, path)] : [join(root, path), join(root, `${path}.html`)];
    const file = candidates.find(isFile);
    const headers = sandbox ? { "content-security-policy": "sandbox allow-scripts allow-forms; form-action 'none'; frame-ancestors 'self'" } : {};
    if (!file) {
      const notFound = join(root, "404.html");
      if (!sandbox && existsSync(notFound)) return res.writeHead(404, { ...headers, "content-type": TYPES[".html"] }).end(readFileSync(notFound));
      return res.writeHead(404, { ...headers, "content-type": "text/plain; charset=utf-8" }).end("没有这个文件");
    }
    res.writeHead(200, { ...headers, "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

/**
 * What the home page requests until the network is quiet, without scrolling or pointing at anything: gzip bytes of JS
 * and CSS. `idle: false` = the browser never reports idle time, so idle-time loads (the hero CRM, the grid's panel
 * prefetch) stay out — that is the first-load critical path the budget is about; `idle: true` = everything that
 * arrives on its own after first paint (reported).
 */
async function measureLoad(browser, url, root, { idle }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (!idle) await page.addInitScript(() => Object.assign(window, { requestIdleCallback: () => 0, cancelIdleCallback: () => undefined }));
  const seen = new Set();
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.origin === new URL(url).origin && /\.(js|css)$/.test(u.pathname)) seen.add(decodeURIComponent(u.pathname));
  });
  await page.goto(url, { waitUntil: "networkidle" });
  if (idle) await page.locator(".h-crm-slot .aui-shell").waitFor({ timeout: 15000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle");
  await page.close();
  let js = 0;
  let css = 0;
  const sizes = [];
  for (const p of seen) {
    const file = join(root, p);
    if (!existsSync(file)) continue;
    const n = gz(file);
    if (p.endsWith(".css")) css += n;
    else js += n;
    sizes.push([p, n]);
  }
  sizes.sort((a, b) => b[1] - a[1]);
  const biggest = sizes.slice(0, 5).map(([p, n]) => `${p.replace(/^\/assets\//, "")} ${(n / 1024).toFixed(1)} KB`).join("，");
  return { js, css, files: seen.size, biggest };
}

async function checkHome(browser, url, found) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  const crm = page.locator(".h-crm-slot .aui-shell");
  await crm.waitFor({ timeout: 15000 }).catch(() => found.push("首页的 CRM 演示没有渲染出来"));
  await crm.getByRole("grid", { name: "客户" }).first().waitFor({ timeout: 8000 }).catch(() => found.push("首页 CRM 里没有客户表格"));
  // Freshly opened page, nothing focused: CommandPalette `globalShortcut` must catch Ctrl / ⌘ K.
  await page.keyboard.press("Control+k");
  const palette = page.locator(".aui-cmdk");
  await palette.waitFor({ timeout: 5000 }).catch(() => found.push("刚打开的首页按 Ctrl+K 没有打开搜索"));
  await page.keyboard.type("分页");
  await palette.getByRole("group", { name: "文档内容" }).waitFor({ timeout: 8000 }).catch(() => found.push("首页搜索没有搜到文档内容（search-index）"));
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "开始使用" }).first().click();
  await page.waitForURL(/install(\.html)?$/, { timeout: 8000 }).catch(() => found.push("首页的「开始使用」没有打开 install.html"));
  await page.locator(".site-main h1").first().waitFor({ timeout: 8000 }).catch(() => found.push("从首页点进去的文档页没渲染出来"));
  for (const e of errors) found.push(`首页脚本报错：${e}`);
  await page.close();
}

async function checkAnchors(browser, url, found) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const id of ["ai", "east", "start"]) {
    await page.goto(`${url}index.html#${id}`);
    await page.waitForTimeout(1200);
    const top = await page.evaluate((x) => document.getElementById(x)?.getBoundingClientRect().top ?? null, id);
    if (top === null || top < -8 || top > 120) found.push(`index.html#${id} 没有滚到对应章节（离顶 ${top}）`);
  }
  await page.close();
}

async function checkDocs(browser, url, sandbox, found) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const deep = sandbox ? ["grid.html"] : ["grid.html", "grid"];
  for (const path of deep) {
    await page.goto(`${url}${path}`);
    const h1 = page.locator(".site-main h1").first();
    await h1.waitFor({ timeout: 10000 }).catch(() => found.push(`文档深链 /${path} 没渲染出来`));
    if (!/BitableGrid|多维表格/.test((await h1.textContent().catch(() => "")) ?? "")) found.push(`文档深链 /${path} 打开的不是多维表格页`);
    const frame = page.frameLocator("iframe").first();
    await frame.locator(".adminui, .aui-shell, table").first().waitFor({ timeout: 15000 }).catch(() => found.push(`/${path} 的演示框没渲染出来`));
  }
  if (!sandbox) {
    const res = await page.goto(`${url}no-such-page-xyz`);
    if (res?.status() !== 404) found.push(`不存在的地址返回 ${res?.status()}，应为 404`);
    if (!(await page.getByText("没有这个页面").first().isVisible().catch(() => false))) found.push("不存在的地址没有显示 404 页");
  }
  for (const e of errors) found.push(`文档页脚本报错：${e}`);
  await page.close();
}

export async function browseSite({ root, sandbox }) {
  const problems = [];
  const { chromium } = await import("playwright");
  const server = await serveBuild(root, { sandbox });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const firstLoad = await measureLoad(browser, server.url, root, { idle: false });
    const afterIdle = await measureLoad(browser, server.url, root, { idle: true });
    await checkHome(browser, server.url, problems);
    await checkAnchors(browser, server.url, problems);
    await checkDocs(browser, server.url, sandbox, problems);
    return { problems, firstLoad, afterIdle };
  } finally {
    await browser.close();
    server.close();
  }
}
