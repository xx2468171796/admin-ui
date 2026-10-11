import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const src = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("LazyAdminChart: root export, loads ./charts only through import(), chart-high loading skeleton while it loads", () => {
  const lazy = src("lazy-admin-chart.ts");
  // The only runtime reference to the charts module is the dynamic import (types are erased).
  const runtime = lazy.split("\n").filter((line) => /charts\.tsx/.test(line) && !/^\s*\/\//.test(line));
  assert.deepEqual(runtime.map((l) => l.trim()), ['import("./charts.tsx").then((m) => m.AdminChart as unknown as ComponentType<LazyAdminChartProps>),']);
  assert.doesNotMatch(lazy, /^import type [^\n]*charts\.tsx/m, "not even a type import of ./charts (it names ECharts types)");
  assert.doesNotMatch(lazy, /from "echarts/, "no echarts import in the root module");
  assert.match(lazy, /createElement\(ChartState, \{ kind: "loading", height: props\.height \?\? 300, label: props\.label \}\)/, "same skeleton and default height as AdminChart's loading state");
  assert.match(lazy, /export type LazyAdminChartProps = AdminChartPropsOf<object, unknown>;/, "same props as AdminChart (ref, onEvents, onPointClick), loose option / instance types");
  const index = src("index.ts");
  assert.match(index, /export \{ LazyAdminChart, preloadAdminChart, type LazyAdminChartProps \} from "\.\/lazy-admin-chart\.ts";/);
  assert.ok(!index.includes("charts.tsx"), "index.ts never names charts.tsx");
});

test("size gate: a lazy import() of a public subpath is that subpath's cost (root / core keep it external); static imports still count", () => {
  const gate = readFileSync(new URL("../scripts/size-budget.mjs", import.meta.url), "utf8");
  assert.match(gate, /async resolveDynamicImport\(specifier, importer\)/);
  assert.match(gate, /\["root", \{ from: self, css: `\$\{self\}\/styles\.css`, lazySubpathsElsewhere: true \}\]/);
  assert.match(gate, /\["core", \{[^\n]*lazySubpathsElsewhere: true \}\]/);
  // Only exact subpath entry files qualify; the heavy-peer check of the static graph is untouched.
  assert.match(gate, /if \(!file \|\| !entryFiles\.has\(file\)\) return null;/);
  assert.match(gate, /failures\.push\(`\$\{row\.name\} imports heavy peers/);
});
