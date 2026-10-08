// Screenshots of site pages: desktop 1440, mobile 390 and dark, plus console errors.
// Usage: node scripts/shots.mjs [baseUrl] [page …]   (default http://127.0.0.1:5410/ and a few key pages)
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const [base = "http://127.0.0.1:5410/", ...pages] = process.argv.slice(2);
const list = pages.length ? pages : ["index", "why", "button", "data-table", "grid"];
const out = resolve(import.meta.dirname, "../shots");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const variants = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, dark: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, dark: false },
  { name: "dark", viewport: { width: 1440, height: 900 }, dark: true },
];
let failed = 0;
for (const v of variants) {
  const ctx = await browser.newContext({ viewport: v.viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript((dark) => {
    try {
      localStorage.setItem("aui-site:prefs", JSON.stringify({ lang: "zh", mode: dark ? "dark" : "light", palette: "forest" }));
    } catch {
      /* sandboxed: no storage */
    }
  }, v.dark);
  for (const p of list) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(new URL(`${p}.html`, base).href, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: resolve(out, `${p}-${v.name}.png`), fullPage: process.env.FULL === "1" });
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    for (const f of frames) {
      const err = await f.evaluate(() => document.querySelector(".aui-state-error, .aui-state[data-kind='error']")?.textContent ?? "").catch(() => "");
      if (err) errors.push(`iframe: ${err}`);
    }
    if (errors.length || overflow > 1) failed++;
    console.log(`${p} ${v.name}: ${errors.length ? `错误 ${errors.length}：${errors.slice(0, 3).join(" | ")}` : "无报错"}${overflow > 1 ? `，横向溢出 ${overflow}px` : ""}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
process.exitCode = failed ? 1 : 0;
