import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Style gates (owner rules 2026-10-02, DESIGN.md):
 * 1. Colours only from the palette tokens: no hard-coded colours outside styles/tokens.css
 *    (white / black / transparent and rgba() shadows are fine).
 * 2. No decorative colour bars: no coloured left / top borders of 2px+, no ::before / ::after bars.
 * 3. Controls share one height: buttons, inputs and selects size with --aui-control-height(-sm).
 */
const dir = fileURLToPath(new URL("../src/styles/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".css"));
const read = (f: string) => readFileSync(dir + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }));

const ALLOWED_HEX = /^#(fff|ffffff|000|000000)$/i;
test("no hard-coded colours outside tokens.css", () => {
  const offenders: string[] = [];
  for (const f of files.filter((f) => f !== "tokens.css"))
    for (const { selector, body } of rules(read(f)))
      for (const m of body.matchAll(/#[0-9a-f]{3,8}\b/gi)) if (!ALLOWED_HEX.test(m[0])) offenders.push(`${f}: ${selector} → ${m[0]}`);
  assert.deepEqual(offenders, [], "用色卡变量（var(--aui-…)）代替写死的颜色");
});

test("no decorative colour bars", () => {
  const offenders: string[] = [];
  for (const f of files)
    for (const { selector, body } of rules(read(f))) {
      if (/border-(left|top)\s*:\s*([2-9]|\d{2,})px\s+solid\s+var\(--aui-(primary|warning|danger|info|success|ink)/.test(body)) offenders.push(`${f}: ${selector}`);
      if (/::?(before|after)/.test(selector) && /width\s*:\s*[2-4]px/.test(body) && /background\s*:\s*var\(--aui-(primary|warning|danger|info|success)/.test(body)) offenders.push(`${f}: ${selector}`);
      if (/box-shadow\s*:\s*inset\s+[2-9]px\s+0\s+0\s+var\(--aui-(primary|warning|danger|info)/.test(body)) offenders.push(`${f}: ${selector}`);
    }
  assert.deepEqual(offenders, [], "不加装饰色条：状态用浅色底 + 边框色 + 文字色 + 图标");
});

test("buttons, inputs and selects use the shared control height", () => {
  const offenders: string[] = [];
  const control = /^\.adminui \.aui-(button|input|select-trigger|textarea)(?![\w-])/;
  for (const f of files)
    for (const { selector, body } of rules(read(f)))
      if (selector.split(",").some((s) => control.test(s.trim())) && /(^|;|\s)(min-)?height\s*:\s*\d+px/.test(body)) offenders.push(`${f}: ${selector}`);
  assert.deepEqual(offenders, [], "控件高度用 var(--aui-control-height) / var(--aui-control-height-sm)");
});

test("bare panes inside a workspace keep the divider between columns", () => {
  // 8.3.1：`Pane bare` 放在 WorkspaceLayout 中间栏时，bare 的 border:0 盖掉了栏间分割线（两栏白底贴在一起没有线）
  const css = rules(read("templates.css"));
  const divider = css.find((r) => r.selector === ".adminui .aui-workspace > * + *");
  assert.ok(divider && /border-left\s*:\s*1px solid var\(--aui-line\)/.test(divider.body), "工作区栏间要有 1px 分割线");
  const clears = css.filter((r) => r.selector.startsWith(".adminui .aui-pane[data-bare]") && /(^|;)\s*border\s*:\s*0/.test(r.body));
  assert.ok(clears.length > 0, "bare 面板在别处仍然去掉外框");
  for (const r of clears) assert.match(r.selector, /:not\(\.aui-workspace > \*\)/, `${r.selector} 会吃掉工作区的分割线`);
});
