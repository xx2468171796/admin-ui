// Stale closures found while replacing the dead `eslint-disable … exhaustive-deps` comments with real
// dependency lists (2026-10-11): each test pins a value a memoized callback used to keep from an older render.
import assert from "node:assert/strict";
import test from "node:test";
import { installHookRuntime, renderHook } from "./hook-runtime.ts";
import type { OrgDataSource } from "../src/org-picker/org-picker-core.ts";

installHookRuntime();
const { useOrgTree } = await import("../src/org-picker/use-org-data.ts");

test("useOrgTree: a failure after a locale switch reports the new locale's fallback message", async () => {
  const source: OrgDataSource = {
    roots: async () => [{ id: "g", name: "集团", kind: "group" } as never],
    loadChildren: async () => {
      throw new Error("");
    },
    loadMembers: async () => ({ items: [], nextCursor: null }) as never,
    search: async () => [],
    resolve: async () => [],
  };
  const view = renderHook((fallback: string) => useOrgTree(source, true, fallback), "网络中断" as string);
  await view.settle();
  view.rerender("Network error");
  view.result.expand("g");
  await view.settle();
  assert.equal(view.result.error, "Network error");
  view.unmount();
});
