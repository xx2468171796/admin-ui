import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createPalette, contrast, PALETTES } from "../src/palette.ts";
import {
  groupNavigation,
  pageWindow,
  validateFile,
} from "../src/contracts.ts";
import { buildCsv, validateReportRange } from "../src/reports-core.ts";
import { CAPABILITIES, PAGE_TEMPLATES } from "../src/catalog.ts";

/** package.json exports 的值 → 源码文件路径。2026-10 起 TS 入口是 { types, source, default }（编译产物见 scripts/build-dist.mjs），CSS 等入口是字符串或 { types, default } */
function entryFile(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const entry = value as { source?: unknown; default?: unknown };
    if (typeof entry.source === "string") return entry.source;
    if (typeof entry.default === "string") return entry.default;
  }
  return undefined;
}
test("every palette and bright custom colours keep readable text in light and dark mode", () => {
  for (const seed of [...PALETTES, "#ffffff", "#ffff00", "#00ff00", "#000000"]) {
    for (const mode of ["light", "dark"] as const) {
      const palette = createPalette(seed, mode);
      const v = palette.vars;
      const name = `${typeof seed === "string" ? seed : seed.id} ${mode}`;
      if (mode === "light") assert.ok(contrast(v.primary!, "#ffffff") >= 4.8, `${name}: 主色在白底`);
      assert.ok(contrast(v["primary-fill"]!, "#ffffff") >= 4.5, `${name}: 主按钮白字`);
      assert.ok(contrast(v.primary!, v.surface!) >= 4.5, `${name}: 主色文字`);
      assert.ok(contrast(v.note!, v.surface!) >= 4.5, `${name}: 说明文字`);
      assert.ok(contrast(v.text!, v.surface!) >= 7, `${name}: 正文`);
      for (const accent of ["warning", "danger", "info"]) assert.ok(contrast(v[accent]!, v[`${accent}-soft`]!) >= 4.5, `${name}: ${accent} 在浅底上`);
      for (const color of Object.values(v)) assert.match(color, /^#[\da-f]{6}$/i);
    }
  }
  assert.throws(() => createPalette("#fff"));
  assert.throws(() => createPalette("red"));
});
test("dark primary button: white text ≥ 4.5 : 1 on the fill in all 6 palettes, forest = the approved sample, and links never repaint a Button rendered as <a> (8.0.2)", () => {
  const core = readFileSync(new URL("../src/styles/core.css", import.meta.url), "utf8");
  assert.match(core, /\.adminui \.aui-button-primary \{[^}]*color: var\(--aui-on-primary\)/, "主按钮字用 on-primary");
  for (const p of PALETTES) {
    const v = createPalette(p, "dark").vars;
    assert.ok(contrast(v["primary-fill"]!, v["on-primary"] ?? "#ffffff") >= 4.5, `${p.id} dark: 主按钮白字 ${contrast(v["primary-fill"]!, "#ffffff").toFixed(2)}`);
  }
  assert.equal(createPalette(PALETTES[0], "dark").vars["primary-fill"], "#306848", "森林绿深色主按钮 = 审阅 01 通过的样稿值");
  // The dark-mode link colour must stay below a Button's own colour rule (.adminui .aui-button-* = 0,2,0):
  // `.adminui[data-aui-mode=dark] a` was 0,2,1 and painted <Button asChild><a> text primary-green on the green fill.
  const tokens = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  assert.doesNotMatch(tokens, /\[data-aui-mode=dark\] a\s*\{/, "深色链接规则不能用 (0,2,1) 的 `a`");
  assert.match(tokens, /\.adminui\[data-aui-mode=dark\] :where\(a\) \{ color:var\(--aui-dark-accent\); \}/);
});

test("neutral text ramp: Feishu greys in light, readable dark equivalents, untinted, existing text tokens unchanged", () => {
  const isGrey = (hex: string) => { const [r, g, b] = hex.slice(1).match(/../g)!.map((n) => parseInt(n, 16)); return Math.max(r!, g!, b!) - Math.min(r!, g!, b!) <= 16; };
  for (const seed of [...PALETTES, "#ffff00", "#000000"]) {
    for (const mode of ["light", "dark"] as const) {
      const v = createPalette(seed, mode).vars;
      const name = `${typeof seed === "string" ? seed : seed.id} ${mode}`;
      const ramp = [v["neutral-1"]!, v["neutral-2"]!, v["neutral-3"]!, v["neutral-4"]!];
      if (mode === "light") assert.deepEqual(ramp, ["#1f2329", "#646a73", "#8f959e", "#bbbfc4"], `${name}: 浅色 = 飞书灰阶`);
      for (const c of ramp) assert.ok(isGrey(c), `${name}: ${c} 是纯中性灰`);
      assert.ok(contrast(ramp[0]!, v.surface!) >= 7, `${name}: 中性 1 正文 ≥ 7`);
      assert.ok(contrast(ramp[1]!, v.surface!) >= 4.5, `${name}: 中性 2 ≥ 4.5`);
      assert.ok(contrast(ramp[1]!, v["surface-subtle"]!) >= 4.5, `${name}: 中性 2 在次级面上 ≥ 4.5`);
      assert.ok(contrast(ramp[2]!, v.surface!) >= 3, `${name}: 中性 3 ≥ 3`);
      // 一级比一级浅（浅色）/ 暗（深色）：对面板的对比度递减
      for (let i = 1; i < 4; i++) assert.ok(contrast(ramp[i]!, v.surface!) < contrast(ramp[i - 1]!, v.surface!), `${name}: 中性 ${i + 1} 比 ${i} 弱`);
    }
  }
  // 全站不变色：森林绿浅色的正文 / 次要 / 备注还是原来的值（tokens.css 兜底值同步）
  const forest = createPalette(PALETTES[0], "light").vars;
  const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  for (const key of ["text", "secondary", "note", "neutral-1", "neutral-2", "neutral-3", "neutral-4"]) assert.match(css, new RegExp(`--aui-${key}: ${forest[key]};`), `tokens.css 兜底 --aui-${key}`);
  // 文档区开关：子树里只换正文 / 次要 / 备注三个变量（备注用 2 级，小字仍 ≥ 4.5:1）
  const rule = css.match(/\.adminui \.aui-neutral-text \{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /--aui-text: var\(--aui-neutral-1\);/);
  assert.match(rule, /--aui-secondary: var\(--aui-neutral-2\);/);
  assert.match(rule, /--aui-note: var\(--aui-neutral-2\);/);
  assert.match(rule, /color: var\(--aui-text\);/);
});
test("page controls stay bounded for million-row services", () => {
  assert.deepEqual(pageWindow(1, 100000), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    pageWindow(100000, 100000),
    [99996, 99997, 99998, 99999, 100000],
  );
  assert.deepEqual(pageWindow(1, 1), [1]);
});

test("upload rejects mismatched MIME and oversized files", () => {
  assert.equal(
    validateFile(
      { name: "a.png", type: "image/png", size: 20 },
      ["image/png"],
      100,
    ),
    null,
  );
  assert.ok(
    validateFile(
      { name: "a.png", type: "text/html", size: 20 },
      ["image/png"],
      100,
    ),
  );
  assert.ok(
    validateFile(
      { name: "a.png", type: "image/png", size: 101 },
      ["image/png"],
      100,
    ),
  );
  assert.equal(
    validateFile({ name: "A.MD", type: "", size: 20 }, [".md"], 100),
    null,
  );
});
test("navigation groups by first appearance and keeps flat menus untouched", () => {
  assert.deepEqual(
    groupNavigation<{ id: string; group?: string }>([{ id: "a" }, { id: "b" }]),
    [{ items: [{ id: "a" }, { id: "b" }] }],
  );
  assert.deepEqual(
    groupNavigation([
      { id: "home" },
      { id: "users", group: "用户" },
      { id: "recharge", group: "商业" },
      { id: "wallet", group: "用户" },
      { id: "logs" },
    ]),
    [
      { items: [{ id: "home" }] },
      {
        group: "用户",
        items: [
          { id: "users", group: "用户" },
          { id: "wallet", group: "用户" },
        ],
      },
      { group: "商业", items: [{ id: "recharge", group: "商业" }] },
      { items: [{ id: "logs" }] },
    ],
  );
  assert.deepEqual(groupNavigation([]), []);
});
test("report ranges validate real inclusive calendar dates and max length", () => {
  assert.equal(
    validateReportRange({ start: "2026-09-16", end: "2026-09-16" }),
    null,
  );
  assert.equal(
    validateReportRange({ start: "2024-02-29", end: "2024-03-01" }),
    null,
  );
  assert.match(
    validateReportRange({ start: "2026-02-29", end: "2026-03-01" })!,
    /有效/,
  );
  assert.match(
    validateReportRange({ start: "2026-09-17", end: "2026-09-16" })!,
    /不能晚于/,
  );
  assert.match(
    validateReportRange({ start: "2026-09-10", end: "2026-09-16" }, 6)!,
    /最多 6 天/,
  );
});
test("CSV escapes quotes, commas and formula cells without damaging numeric negatives", () => {
  const csv = buildCsv(
    [
      { name: "=SUM(1,2)", amount: -123.45, note: 'a,"b"' },
      { name: " @cmd", amount: 0, note: null },
    ],
    [
      { title: "名称", value: (r) => r.name },
      { title: "金额", value: (r) => r.amount, type: "number" },
      { title: "备注", value: (r) => r.note },
    ],
  );
  assert.ok(csv.startsWith('\ufeff"名称","金额","备注"\r\n'));
  assert.ok(csv.includes('"\'=SUM(1,2)","-123.45","a,""b"""'));
  assert.ok(csv.includes('"\' @cmd","0",""'));
  assert.throws(
    () =>
      buildCsv([{}], [{ title: "金额", value: () => "=1+2", type: "number" }]),
    /无效数值/,
  );
});
test("package compiles under the strict flags consumers use, so shipped source cannot regress", () => {
  // Source-distributed package: a consumer with strict + noUncheckedIndexedAccess
  // typechecks these files too, so the flags must stay on here.
  for (const file of ["../tsconfig.json", "../examples/starter/tsconfig.json"]) {
    const config = JSON.parse(
      readFileSync(new URL(file, import.meta.url), "utf8"),
    );
    assert.equal(config.compilerOptions.strict, true, file);
    assert.equal(config.compilerOptions.noUncheckedIndexedAccess, true, file);
  }
  const own = JSON.parse(
    readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8"),
  );
  for (const entry of ["src", "test/*.ts", "test/*.tsx", "examples/starter/src"])
    assert.ok(own.include.includes(entry), entry);
});
test("capability imports resolve to shipped entrypoints; heavy modules absent from root", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  for (const cap of CAPABILITIES) {
    const sub = cap.entry.replace("@adminui/react", ".") as string;
    assert.ok(entryFile(pkg.exports[sub]), cap.entry);
    assert.ok(existsSync(new URL("../" + entryFile(pkg.exports[sub]), import.meta.url)));
  }
  const root = readFileSync(
    new URL("../src/index.ts", import.meta.url),
    "utf8",
  );
  assert.ok(!root.includes("charts.tsx") && !root.includes("markdown.tsx") && !/from "\.\/grid/.test(root) && !root.includes("access/") && !root.includes("peizhi/"));
  // Optional heavy deps stay optional peers, so apps that never import the subpath don't install them.
  for (const dep of ["echarts", "@tanstack/react-table", "@tanstack/react-virtual"]) assert.equal(pkg.peerDependenciesMeta[dep]?.optional, true, dep);
  assert.deepEqual(pkg.sideEffects, ["**/*.css"]);
});
/** Value names an entry really exports: follows `export *` and explicit lists, skips `export type`. */
function publicValues(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file)) return names;
  seen.add(file);
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
  const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
  const resolve = (spec: string) => {
    const parts = (dir + spec.replace(/^\.\//, "")).split("/");
    const out: string[] = [];
    for (const part of parts) if (part === "..") out.pop(); else if (part !== ".") out.push(part);
    return out.join("/");
  };
  for (const m of source.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]!);
  for (const m of source.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm)) {
    if (m[1]) continue;
    for (const part of m[2]!.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (part.startsWith("type ")) continue;
      names.add(part.split(/\s+as\s+/).pop()!);
    }
  }
  for (const m of source.matchAll(/^export\s+\*\s+from\s+"([^"]+)"/gm)) for (const name of publicValues(resolve(m[1]!), seen)) names.add(name);
  return names;
}
const ENTRY_FILES: Record<string, string> = {
  "@adminui/react": "index.ts",
  "@adminui/react/charts": "charts.tsx",
  "@adminui/react/markdown": "markdown.tsx",
  "@adminui/react/excel": "excel.ts",
  "@adminui/react/grid": "grid.tsx",
  "@adminui/react/grid-query": "grid-query.ts",
  "@adminui/react/record-detail-spec": "record-detail-spec.ts",
  "@adminui/react/access": "access/index.ts",
  "@adminui/react/peizhi": "peizhi/index.ts",
  "@adminui/react/settings": "peizhi/index.ts",
  "@adminui/react/views": "views/index.ts", // bt/views
  "@adminui/react/form-builder": "form-builder/index.ts", // bt/builders-a
  "@adminui/react/forms-public": "form-builder/public.ts", // bt/builders-a
  "@adminui/react/dashboard-builder": "dashboard-builder.tsx", // bt/builders-b
  "@adminui/react/org-picker": "org-picker/index.ts",
  "@adminui/react/vite": "vite.ts",
};
test("every catalog export is really exported from its entry", () => {
  for (const cap of CAPABILITIES) {
    const file = ENTRY_FILES[cap.entry];
    assert.ok(file, cap.entry);
    const names = publicValues(file);
    for (const name of cap.exports) assert.ok(names.has(name), `${cap.id}: ${name} is not exported from ${cap.entry}`);
  }
});
test("5.0 removals stay removed (no drawer, no legacy pagination, one date / money formatter)", () => {
  const root = publicValues("index.ts");
  const removed = [
    "LegacyPageFooter", "useRecordDrawer", "buttonVariants", "CHECK_STATUS_ORDER", "CHECK_STATUS_LABELS", "Z95", "Z998",
    "useTaskCenter", "PEEK_FIELD_LIMIT", "RECORD_DETAIL_LEVELS", "RECORD_LEVEL_LABELS", "RECORD_PARAM",
    "RECORD_PRIMARY_ACTIONS", "RECORD_VIEW_PARAM", "recordFieldCount", "recordFieldText", "sectionFields", "CELL_LINE_HEIGHT",
    "ROW_HEIGHT_LABELS", "TWO_LINE_MIN_HEIGHT", "ROW_SIZE_HEIGHTS", "VIZ_DIVERGING", "useCellBudget", "RefreshToolbar",
    "useAutoRefresh", "AuditExplorer", "SplitView", "EmbeddedPage", "useEmbeddedPage", "PermissionGate", "formatMinor",
    "formatCellDate", "absoluteTime", "THEME_PRESETS", "groupNavigation", "pageWindow", "pageSizeOptions", "validateFile",
  ];
  // DeltaBadge came back on purpose (bt/dashboards): table cells and metric strips need the chip outside KpiCard.
  for (const name of removed) assert.ok(!root.has(name), `${name} must not be exported from @adminui/react`);
  // The grid-query cores (parsing, in-memory query, SQL) are the backend entry only.
  const grid = publicValues("grid.tsx");
  for (const name of ["parseGridQuery", "applyGridQuery", "buildGridSql", "validateFieldInput"]) assert.ok(!grid.has(name), `${name} belongs to ./grid-query`);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  for (const sub of ["./theme", "./contracts"]) assert.equal(entryFile(pkg.exports[sub]), undefined, `${sub} subpath was removed in 5.0`);
  const dialogs = readFileSync(new URL("../src/forms.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dialogs, /DialogSize = [^;]*"drawer"/, "records open as centered dialogs; there is no drawer size");
});

test("page templates T01–T17 only name catalog components and point at real demos and starter pages", () => {
  assert.deepEqual(PAGE_TEMPLATES.map((t) => t.id), Array.from({ length: 17 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`));
  const known = new Set<string>(CAPABILITIES.flatMap((cap) => [...cap.exports]));
  // T15–T17 (bt/templates) bring their own shell: their starter pages are listed in TemplatePages.tsx.
  const starter = ["PageTemplates.tsx", "TemplatePages.tsx"].map((f) => readFileSync(new URL(`../examples/starter/src/${f}`, import.meta.url), "utf8")).join(String.fromCharCode(10));
  for (const t of PAGE_TEMPLATES) {
    for (const name of t.components) assert.ok(known.has(name), `${t.id}: ${name} is not in the catalog`);
    assert.ok(existsSync(new URL(`../${t.demo}`, import.meta.url)), `${t.id}: ${t.demo}`);
    if (t.starter !== "kit") assert.ok(starter.includes(`id: "${t.starter}"`), `${t.id}: starter page ${t.starter}`);
  }
});

test("8.0 removals stay removed (the MIGRATION_8 table of the audit tool)", async () => {
  const { MIGRATION_8 } = await import("../scripts/ui-audit.mjs");
  for (const [entry, file] of Object.entries(ENTRY_FILES)) {
    const names = publicValues(file);
    for (const name of Object.keys(MIGRATION_8.exports)) assert.ok(!names.has(name), `${name} must not be exported from ${entry}`);
  }
  const primitives = readFileSync(new URL("../src/primitives.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(primitives, /icon: "aui-button-icon"|link: "aui-button-link"/, "Button has no size=icon / variant=link");
});
