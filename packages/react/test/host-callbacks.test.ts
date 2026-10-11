// Host functions / objects handed to SDK hooks must not be effect dependencies: an inline loader or an inline
// `source={{ … }}` is new on every render, so an effect keyed on it refetches (or resets) → sets state →
// re-renders → refetches, forever. These are the two hooks the data fixes did not cover (2026-10-11 audit).
import assert from "node:assert/strict";
import test from "node:test";
import { installHookRuntime, renderHook } from "./hook-runtime.ts";
import type { DashboardWidget } from "../src/dashboard-builder-core.ts";
import type { DashboardFilterValue } from "../src/dashboard-filters-core.ts";
import type { OrgDataSource } from "../src/org-picker/org-picker-core.ts";

installHookRuntime();
const { useWidgetData } = await import("../src/dashboard-widget-data.ts");
const { useOrgTree } = await import("../src/org-picker/use-org-data.ts");

const widget: DashboardWidget = { id: "w1", kind: "kpi", title: "营收", layout: { x: 0, y: 0, w: 3, h: 2 } };
const context: DashboardFilterValue = { time: "today", compare: "mom", dims: {} };

test("useWidgetData: an inline loader loads once, not in a loop; a retry and a changed filter still reload", async () => {
  let calls = 0;
  const view = renderHook(
    (ctx: DashboardFilterValue) =>
      useWidgetData(widget, ctx, async () => {
        calls++;
        return { kind: "kpi", value: 1 } as never;
      }),
    context,
  );
  await view.settle();
  assert.equal(calls, 1, `loader called ${calls} times`);
  assert.equal(view.result.state.status, "ready");
  view.rerender({ ...context });
  await view.settle();
  assert.equal(calls, 1, "an equal context with a new inline loader does not reload");
  view.result.reload();
  await view.settle();
  assert.equal(calls, 2, "retry reloads");
  view.rerender({ ...context, time: "week" });
  await view.settle();
  assert.equal(calls, 3, "a changed filter reloads");
  view.unmount();
});

test("useOrgTree: an inline source object loads the roots once and does not reset in a loop", async () => {
  let roots = 0;
  const source = (): OrgDataSource => ({
    roots: async () => {
      roots++;
      return [{ id: "g", name: "集团", kind: "group" } as never];
    },
    loadChildren: async () => [],
    loadMembers: async () => ({ items: [], nextCursor: null }) as never,
    search: async () => [],
    resolve: async () => [],
  });
  const view = renderHook(() => useOrgTree(source(), true), undefined);
  await view.settle();
  assert.equal(roots, 1, `roots() called ${roots} times`);
  assert.equal(view.result.roots?.length, 1);
  view.unmount();
});

test("useWidgetData: a card that remounts (wide grid ↔ phone list) shows the data it had at once, then refreshes quietly", async () => {
  let calls = 0;
  const load = async () => {
    calls++;
    return { kind: "kpi", value: calls } as never;
  };
  const first = renderHook((ctx: DashboardFilterValue) => useWidgetData(widget, ctx, load), context);
  await first.settle();
  assert.equal(first.result.state.status, "ready");
  first.unmount();
  // Remount with the same loader and key: no skeleton frame (8.9.1 flashed every card for ~0.5 s here).
  const again = renderHook((ctx: DashboardFilterValue) => useWidgetData(widget, ctx, load), context);
  assert.equal(again.result.state.status, "ready", "first render after remount is the cached data, not loading");
  await again.settle();
  assert.equal(calls, 2, "still refreshed in the background");
  assert.equal(again.result.state.status, "ready");
  again.unmount();
});
