import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrast, createPalette, FONT_SIZE_PRESETS, PALETTES } from "../src/palette.ts";
import { MOBILE_QUERY } from "../src/media-query.ts";
import { topLevel } from "../scripts/css-layered.mjs";

/**
 * Accessibility gates for the theme (8.10):
 * - non-text contrast (WCAG 1.4.11): focus indicator, control / input borders, switch tracks and thumb ≥ 3 : 1;
 * - text contrast: note / secondary / primary (links) ≥ 4.5 : 1 on the panel, the page canvas AND the subtle band;
 * - the CSS really uses those tokens (a contrast-safe token nobody reads is worth nothing);
 * - forced colours / prefers-contrast, reduced-motion busy indicators, z-index scale, the one mobile breakpoint.
 */
const dir = fileURLToPath(new URL("../src/styles/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".css"));
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (f: string) => strip(readFileSync(dir + f, "utf8"));
type Rule = { file: string; media: string; selector: string; body: string };
function rulesOf(file: string, css: string, media = ""): Rule[] {
  return topLevel(css).flatMap((statement) => {
    const open = statement.indexOf("{");
    if (open < 0) return [];
    const prelude = statement.slice(0, open).trim();
    const body = statement.slice(open + 1, statement.lastIndexOf("}"));
    if (prelude.startsWith("@media") || prelude.startsWith("@supports")) return rulesOf(file, body, `${media} ${prelude}`.trim());
    if (prelude.startsWith("@")) return [];
    return [{ file, media, selector: prelude, body }];
  });
}
const all = files.flatMap((f) => rulesOf(f, read(f)));
const tokens = read("tokens.css");
const tokenValue = (name: string) => tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

const MODES = ["light", "dark"] as const;
const fmt = (n: number) => n.toFixed(2);

test("non-text contrast ≥ 3 : 1 for every preset palette in light and dark (focus, borders, switch)", () => {
  const fails: string[] = [];
  for (const p of PALETTES) for (const mode of MODES) {
    const v = createPalette(p, mode).vars;
    const at = (name: string, fg: string | undefined, bg: string | undefined, min: number) => {
      assert.ok(fg && bg, `${p.id} ${mode}: ${name} missing`);
      const r = contrast(fg, bg);
      if (r < min) fails.push(`${p.id} ${mode} ${name}: ${fmt(r)} < ${min}`);
    };
    for (const ground of ["surface", "canvas", "surface-subtle"]) at(`focus vs ${ground}`, v.focus, v[ground], 3);
    for (const ground of ["surface", "surface-subtle"]) {
      at(`control-border (checkbox / radio) vs ${ground}`, v["control-border"], v[ground], 3);
      at(`field-border (inputs) vs ${ground}`, v["field-border"], v[ground], 3);
    }
    at("switch off-track vs surface", v["switch-off"], v.surface, 3);
    at("switch on-track vs surface", v["switch-on"], v.surface, 3);
    at("switch thumb vs off-track", v["switch-thumb"], v["switch-off"], 3);
    at("switch thumb vs on-track", v["switch-thumb"], v["switch-on"], 3);
  }
  assert.deepEqual(fails, []);
});

test("text tokens ≥ 4.5 : 1 on surface, canvas and surface-subtle (note, secondary, primary link)", () => {
  const fails: string[] = [];
  for (const p of PALETTES) for (const mode of MODES) {
    const v = createPalette(p, mode).vars;
    for (const name of ["note", "secondary", "primary"]) for (const ground of ["surface", "canvas", "surface-subtle"]) {
      const r = contrast(v[name]!, v[ground]!);
      if (r < 4.5) fails.push(`${p.id} ${mode} ${name} on ${ground}: ${fmt(r)}`);
    }
  }
  assert.deepEqual(fails, []);
});

test("the brand fill does not move: primary-fill / palette.primary keep the 8.9 values, only text-primary may deepen", () => {
  const forest = createPalette(PALETTES[0], "light");
  assert.equal(forest.vars["primary-fill"], "#357450");
  assert.equal(forest.primary, "#357450", "charts / swatches keep the brand colour");
  assert.equal(tokenValue("--aui-primary"), forest.vars.primary, "tokens.css fallback = forest light");
  for (const key of ["control-border", "field-border", "focus", "note"])
    assert.equal(tokenValue(`--aui-${key}`), forest.vars[key], `tokens.css fallback --aui-${key}`);
});

test("focus indicator: a solid double ring in --aui-focus; focus rules keep a transparent outline for forced colours", () => {
  assert.equal(tokenValue("--aui-focus-ring"), "0 0 0 2px var(--aui-surface), 0 0 0 4px var(--aui-focus)");
  assert.equal(tokenValue("--aui-focus-ring-danger"), "0 0 0 2px var(--aui-surface), 0 0 0 4px var(--aui-danger)");
  const focusRules = all.filter((r) => /:focus(-visible|-within)?\b/.test(r.selector) && !/forced-colors/.test(r.media));
  const offenders: string[] = [];
  for (const r of focusRules) {
    if (r.file === "grid.css") continue; // owned by the grid work; forced colours still get the global Highlight outline
    const ring = /box-shadow\s*:/.test(r.body) && !/box-shadow\s*:\s*none/.test(r.body);
    if (ring && /outline\s*:\s*(none|0)\s*(;|$)/.test(r.body)) offenders.push(`${r.file}: ${r.selector} → outline none + box-shadow ring`);
    if (/color-mix\(in srgb,\s*var\(--aui-(primary|danger)\)\s*\d+%,\s*transparent\)/.test(r.body) && ring) offenders.push(`${r.file}: ${r.selector} → translucent halo as focus`);
    if (/outline\s*:\s*2px solid var\(--aui-primary\)/.test(r.body)) offenders.push(`${r.file}: ${r.selector} → outline in --aui-primary (use --aui-focus)`);
  }
  // --aui-focus-ring is a shadow list, never a colour
  for (const r of all) if (/(\dpx|inset)\s+var\(--aui-focus-ring/.test(r.body)) offenders.push(`${r.file}: ${r.selector} → var(--aui-focus-ring) used as a colour`);
  assert.deepEqual(offenders, []);
});

test("controls read the contrast-safe tokens (checkbox / radio border, inputs, switch)", () => {
  const find = (file: string, selector: string) => all.find((r) => r.file === file && r.selector === selector && !r.media);
  const box = find("core.css", ".adminui :is(.aui-checkbox, .aui-grid-check, .aui-pform-tick > i, .aui-opt-box)");
  assert.match(box?.body ?? "", /border:\s*1\.5px solid var\(--aui-control-border\)/);
  assert.match(all.find((r) => r.file === "core.css" && r.selector.startsWith(".adminui :is(.aui-radio, .aui-access-radio") && !r.media)?.body ?? "", /border:\s*1\.5px solid var\(--aui-control-border\)/);
  const input = all.find((r) => r.file === "core.css" && /^\.adminui \.aui-input$/.test(r.selector.trim()) && /border:/.test(r.body));
  assert.match(input?.body ?? "", /border:\s*1px solid var\(--aui-field-border\)/);
  assert.match(find("core.css", ".adminui .aui-switch")?.body ?? "", /background:\s*var\(--aui-switch-off\)/);
  assert.match(find("core.css", '.adminui .aui-switch[data-state="checked"]')?.body ?? "", /background:\s*var\(--aui-switch-on\)/);
  assert.match(find("core.css", ".adminui .aui-switch-thumb")?.body ?? "", /background:\s*var\(--aui-switch-thumb\)/);
});

test("forced colours and prefers-contrast: states that live in backgrounds / shadows get system colours", () => {
  const forced = all.filter((r) => /forced-colors:\s*active/.test(r.media));
  const body = (selector: RegExp) => forced.filter((r) => selector.test(r.selector)).map((r) => r.body).join(";");
  assert.match(body(/:focus-visible/), /outline:\s*2px solid Highlight/);
  assert.match(body(/^\.adminui \.aui-switch$/), /border:\s*1px solid/);
  assert.match(body(/\.aui-switch\[data-state=checked\]/), /forced-color-adjust:\s*none;[^}]*background:\s*Highlight/);
  assert.match(body(/aui-switch-thumb/), /forced-color-adjust:\s*none/);
  assert.match(body(/aui-checkbox\[data-state=checked\]/), /background:\s*Highlight/);
  for (const row of ["tr", ".aui-table-card", ".aui-rcard"]) assert.match(forced.find((r) => r.selector.includes(row) && r.selector.includes("[data-selected]"))?.body ?? "", /outline:\s*2px solid Highlight/, row);
  const more = all.filter((r) => /prefers-contrast:\s*more/.test(r.media)).map((r) => r.body).join(";");
  assert.match(more, /--aui-field-border:\s*var\(--aui-control-border\)\s*!important/);
  assert.match(more, /--aui-note:\s*var\(--aui-secondary\)\s*!important/);
});

test("reduced motion: busy indicators pulse instead of freezing; the pulse only fades", () => {
  assert.match(tokens, /@keyframes aui-busy-pulse \{ 0%, 100% \{ opacity: 1; \} 50% \{ opacity: \.4; \} \}/);
  const reduced = all.filter((r) => /prefers-reduced-motion:\s*reduce/.test(r.media) && /var\(--aui-busy-reduced\)\s*!important/.test(r.body));
  const covered = reduced.map((r) => r.selector).join(" ");
  for (const cls of [".aui-spinner", ".aui-top-progress > i", ".aui-progress[data-indeterminate] > i", ".aui-loading-dots-shapes > span", ".aui-grant-saving > svg", "[data-kind=saving] > svg"])
    assert.ok(covered.includes(cls), `${cls} keeps a busy pulse under reduced motion`);
  for (const r of reduced) assert.match(r.selector, /:not\(\[data-aui-motion=none\]\)/, "motion=none still stops everything");
});

test("z-index: overlays use the --aui-z-* scale; popovers sit above dialogs", () => {
  const order = ["sticky", "rail", "dialog", "sheet", "popover", "toast", "tip", "drag"].map((n) => Number(tokenValue(`--aui-z-${n}`)));
  for (let i = 1; i < order.length; i++) assert.ok(order[i]! > order[i - 1]!, `z scale ascending: ${order.join(" < ")}`);
  const literal = all.filter((r) => r.file !== "grid.css" && /z-index\s*:\s*(\d{2,})/.test(r.body)).map((r) => `${r.file}: ${r.selector}`);
  assert.deepEqual(literal, [], "overlay layers come from the scale, not a literal");
  const z = (selector: string) => all.find((r) => r.selector === selector && /z-index/.test(r.body))?.body.match(/z-index\s*:\s*([^;]+)/)?.[1]?.trim();
  assert.equal(z(".adminui .aui-popover"), "var(--aui-z-popover)");
  assert.equal(z(".adminui .aui-dialog-overlay"), "var(--aui-z-dialog)");
});

test("one mobile breakpoint: 760 everywhere (CSS and useIsMobile)", () => {
  assert.equal(MOBILE_QUERY, "(max-width: 760px)");
  const off = all.filter((r) => /max-width:\s*(759|761)(\.\d+)?px/.test(r.media)).map((r) => `${r.file}: ${r.media}`);
  assert.deepEqual([...new Set(off)], []);
});

test("font scale: controls grow only above 1.1 (default 中大 1.075 keeps 36px)", () => {
  assert.equal(tokenValue("--aui-size-scale"), "max(1, calc(var(--aui-font-scale) - 0.1))");
  assert.equal(tokenValue("--aui-control-height"), "calc(36px * var(--aui-size-scale))");
  assert.equal(tokenValue("--aui-control-height-sm"), "calc(28px * var(--aui-size-scale))");
  const size = (scale: number) => Math.max(1, scale - 0.1);
  for (const preset of FONT_SIZE_PRESETS) {
    if (preset.scale <= 1.1) assert.equal(size(preset.scale), 1, `${preset.id}: unchanged`);
    else assert.ok(36 * size(preset.scale) >= 14 * preset.scale * 2.2, `${preset.id}: ${(36 * size(preset.scale)).toFixed(1)}px control for ${(14 * preset.scale).toFixed(1)}px text`);
  }
});

test("dead / missing tokens: every var(--aui-*) a stylesheet reads without a fallback is defined somewhere", () => {
  const defined = new Set<string>(Object.keys(createPalette().vars).map((k) => `--aui-${k}`));
  for (const f of files) for (const m of read(f).matchAll(/(--aui-[\w-]+)\s*:/g)) defined.add(m[1]!);
  const srcDir = fileURLToPath(new URL("../src/", import.meta.url));
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}${e.name}/`) : /\.tsx?$/.test(e.name) ? [`${d}${e.name}`] : []));
  for (const path of walk(srcDir)) for (const m of readFileSync(path, "utf8").matchAll(/["'`](--aui-[\w-]+)/g)) defined.add(m[1]!);
  const missing = new Set<string>();
  for (const f of files) for (const m of read(f).matchAll(/var\((--aui-[\w-]+)\s*\)/g)) if (!defined.has(m[1]!)) missing.add(`${f}: ${m[1]}`);
  assert.deepEqual([...missing], []);
  assert.ok(defined.has("--aui-font-sans") && defined.has("--aui-sidebar-deep"));
  assert.doesNotMatch(tokens, /@keyframes aui-live-pulse/, "unused keyframes with a hard-coded green are gone");
});
