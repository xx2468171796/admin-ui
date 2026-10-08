import assert from "node:assert/strict";
import test from "node:test";

test("两份模块副本（开发服务器预打包入口 + 按需子路径）共用同一个 Context", async () => {
  // Two query strings = two module instances, like Vite serving the root entry pre-bundled and
  // `/charts` from source. Per-module createContext would give two contexts and AdminChart would
  // throw "must be inside AdminProvider" under a perfectly good provider.
  const url = new URL("../src/context.ts", import.meta.url).href;
  type Mod = typeof import("../src/context.ts");
  const a = (await import(`${url}?copy=a`)) as Mod;
  const b = (await import(`${url}?copy=b`)) as Mod;
  assert.notEqual(a.sharedContext, b.sharedContext, "前提：确实是两份模块实例");
  assert.equal(a.sharedContext("theme"), b.sharedContext("theme"));
  assert.notEqual(a.sharedContext("theme"), a.sharedContext("tasks"));
});
