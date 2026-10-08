// Load every demo (or those of the given slugs / groups) in preview.html at 1440 and 390 wide; report runtime
// errors, error panels and horizontal overflow at 390. Needs the dev server (npm run dev) or a built preview.
// Usage: node scripts/check-demos.mjs [baseUrl] [slug-or-group …]
import { chromium } from "playwright";

const [base = "http://127.0.0.1:5410/", ...filters] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const probe = await ctx.newPage();
await probe.goto(new URL("preview.html", base).href);
const demos = await probe.evaluate(async () => {
  const src = document.querySelector('script[type="module"][src*="preview-main"]') ? "/src/content/index.ts" : null;
  if (!src) return null;
  const mod = await import(/* @vite-ignore */ src);
  return mod.COMPONENT_DOCS.flatMap((d) =>
    d.demos.map((x) => ({ slug: d.slug, group: d.group, id: x.id, bleed: Boolean(x.bleed), props: Object.fromEntries((x.controls ?? []).map((c) => [c.name, c.default])) })),
  );
});
await probe.close();
if (!demos) {
  console.error("这个脚本要在开发服务器上跑（npm run dev），构建产物里没有源码模块。");
  process.exit(2);
}
const chosen = filters.length ? demos.filter((d) => filters.includes(d.slug) || filters.includes(d.group)) : demos;
let bad = 0;
for (const width of [1440, 390]) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height: 900 });
  for (const d of chosen) {
    const errors = [];
    const onError = (e) => errors.push(e.message);
    const onConsole = (m) => m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text()) && errors.push(m.text());
    page.on("pageerror", onError);
    page.on("console", onConsole);
    const state = { demo: d.id, mode: "light", palette: "forest", props: d.props, bleed: d.bleed };
    await page.goto(`${new URL("preview.html", base).href}#${encodeURIComponent(JSON.stringify(state))}`);
    await page.waitForTimeout(900);
    const panel = await page.evaluate(() => {
      const el = document.querySelector(".aui-state");
      return el && /演示出错了|没有这个演示/.test(el.textContent ?? "") ? el.textContent : "";
    });
    if (panel) errors.push(panel);
    const overflow = width === 390 ? await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) : 0;
    page.off("pageerror", onError);
    page.off("console", onConsole);
    if (errors.length || overflow > 1) {
      bad++;
      console.log(`✗ ${width} ${d.slug} ${d.id}: ${errors.slice(0, 3).join(" | ")}${overflow > 1 ? ` 横向溢出 ${overflow}px` : ""}`);
    }
  }
  await page.close();
}
console.log(`检查了 ${chosen.length} 个演示 × 2 种宽度，问题 ${bad} 个`);
await browser.close();
process.exitCode = bad ? 1 : 0;
