import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 8.11.1: what a downstream app's first screen pulls in (its login / shell / table tab) must not quietly grow. The
 * size gate (scripts/size-budget.mjs app:*) catches bytes; these pin the specific moves, so undoing one fails here
 * with a name instead of a number:
 * - the public GridCellEditor (record forms), the 「视图管理」 panel body (ViewManager) and the notification lists load
 *   after first paint;
 * - ViewTabsContext lives in view-tabs.tsx — a module of its own made the app bundler split the table tab into 12
 *   more chunks (+1.5 KB gzip in 8.11.0);
 * - rules only lazily loaded components render (swatches, copy fields, dividers, upload rows) are not in core.css.
 */
const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

/** Runtime (non-type) static import closure of a source module; dynamic import() does not count. */
function eagerGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    let source: string;
    try {
      source = read(file);
    } catch {
      return;
    }
    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
    for (const m of source.matchAll(/^(?:import|export)\s+(?!type\s)([^;]*?)\s*from\s+"(\.[^"]+)"/gm)) {
      // `import type { … }` / `export type { … }` vanish at build time; so does `import { type A, type B }`.
      const clause = m[1] ?? "";
      if (/^\{[^}]*\}$/.test(clause.trim()) && clause.replace(/[{}\s]/g, "").split(",").every((n) => n === "" || n.startsWith("type"))) continue;
      const parts = (dir + (m[2] ?? "").replace(/^\.\//, "")).split("/");
      const out: string[] = [];
      for (const part of parts) if (part === "..") out.pop(); else if (part !== ".") out.push(part);
      walk(out.join("/"));
    }
  };
  walk(entry);
  return seen;
}

test("the grid entry does not load the cell editors eagerly (public GridCellEditor is lazy)", () => {
  const graph = eagerGraph("grid.tsx");
  assert.ok(graph.has("grid-cell-editor.tsx"), "the public editor wrapper is exported");
  for (const file of ["grid-editors.tsx", "grid-editors-date.tsx", "grid-editors-option.tsx"]) {
    assert.ok(!graph.has(file), `${file} is reachable from grid.tsx without import()`);
  }
});

test("the views entry does not load the 「视图管理」 panel body eagerly (public ViewManager is lazy)", () => {
  const graph = eagerGraph("views/index.ts");
  assert.ok(graph.has("views/view-manager-lazy.tsx") && graph.has("views/view-lock-notice.tsx"));
  assert.ok(!graph.has("views/view-manager.tsx"), "views/view-manager.tsx is reachable without import()");
});

test("the notification center loads its lists after first paint", () => {
  const graph = eagerGraph("notification-center.tsx");
  assert.ok(!graph.has("notification-center-lists.tsx"));
});

test("ViewTabsContext stays in view-tabs.tsx (no module of its own)", () => {
  assert.match(read("views/view-tabs.tsx"), /export const ViewTabsContext = /);
  assert.ok(eagerGraph("views/dashboard-tabs.tsx").has("views/view-tabs.tsx"));
  assert.throws(() => read("views/view-tabs-context.ts"));
});

test("core.css carries no rules of the lazily loaded swatch / copy / divider / upload-queue components", () => {
  const core = read("styles/core.css").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const cls of ["aui-swatch-choice", "aui-swatch-grid", "aui-copy-field", "aui-copy-btn", "aui-divider-label", "aui-upq-x", "aui-shortcuts"]) {
    assert.doesNotMatch(core, new RegExp(`\\.${cls}(?![a-z0-9-])`), `.${cls} is back in core.css`);
  }
  for (const [chunk, cls] of [["swatch", "aui-swatch-choice"], ["copy", "aui-copy-field"], ["divider", "aui-divider-label"], ["uploads", "aui-upq-x"]] as const) {
    assert.match(read(`styles/${chunk}.css`), new RegExp(`\\.${cls}`));
  }
});
