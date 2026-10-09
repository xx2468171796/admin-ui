import assert from "node:assert/strict";
import test from "node:test";
import { hugNumberRows } from "../src/dashboard-view-rows.ts";
import type { DashboardWidget } from "../src/dashboard-builder-core.ts";

const w = (id: string, kind: DashboardWidget["kind"], x: number, y: number, wd: number, h: number) => ({ id, kind, title: id, layout: { x, y, w: wd, h } }) as DashboardWidget;

test("8.6 看板数字卡贴内容：同一行的数字卡折成一行 auto，下面的组件跟着上移", () => {
  const out = hugNumberRows([w("a", "kpi", 0, 0, 2, 4), w("b", "kpi", 2, 0, 2, 4), w("c", "kpi", 4, 0, 2, 3), w("chart", "bar", 0, 4, 6, 8)], "R");
  assert.equal(out.templateRows, ["auto", ...Array(8).fill("R")].join(" "));
  assert.deepEqual(out.place.get("a"), { gridColumn: "1 / span 2", gridRow: "1 / span 1" });
  assert.deepEqual(out.place.get("c"), { gridColumn: "5 / span 2", gridRow: "1 / span 1" });
  assert.deepEqual(out.place.get("chart"), { gridColumn: "1 / span 6", gridRow: "2 / span 8" });
});

test("8.6 数字卡旁边有图表占着同几行时保持原布局", () => {
  const out = hugNumberRows([w("a", "kpi", 0, 0, 2, 4), w("chart", "line", 2, 0, 4, 8), w("b", "kpi", 0, 4, 2, 4)], "R");
  assert.equal(out.templateRows, Array(8).fill("R").join(" "));
  assert.deepEqual(out.place.get("b"), { gridColumn: "1 / span 2", gridRow: "5 / span 4" });
});

test("8.6 两排数字卡各自折成一行", () => {
  const out = hugNumberRows([w("a", "kpi", 0, 0, 3, 4), w("b", "kpi", 3, 0, 3, 4), w("c", "kpi", 0, 4, 6, 4), w("t", "table", 0, 8, 6, 6)], "R");
  assert.equal(out.templateRows, ["auto", "auto", ...Array(6).fill("R")].join(" "));
  assert.deepEqual(out.place.get("c"), { gridColumn: "1 / span 6", gridRow: "2 / span 1" });
  assert.deepEqual(out.place.get("t"), { gridColumn: "1 / span 6", gridRow: "3 / span 6" });
});

test("8.6 数字组（group）也贴内容：两排数字组各自一行 auto", () => {
  const out = hugNumberRows([w("g1", "group", 0, 0, 6, 4), w("g2", "group", 0, 4, 6, 4), w("bar", "bar", 0, 8, 6, 8)], "R");
  assert.equal(out.templateRows, ["auto", "auto", ...Array(8).fill("R")].join(" "));
  assert.deepEqual(out.place.get("bar"), { gridColumn: "1 / span 6", gridRow: "3 / span 8" });
});
