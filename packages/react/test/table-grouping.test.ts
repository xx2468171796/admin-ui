import assert from "node:assert/strict";
import { test } from "node:test";
import { compareGroupKeys, flattenGroups, groupRows, toggleGroup } from "../src/table-grouping.ts";

const rows = [
  { id: "a", room: "机房 10" },
  { id: "b", room: "机房 2" },
  { id: "c", room: "机房 10" },
  { id: "d", room: "办公室" },
  { id: "e", room: "机房 2" },
];

test("分组：组内保持传入顺序（= 列排序），没给比较函数按首次出现排组", () => {
  const groups = groupRows(rows, (r) => r.room);
  assert.deepEqual(groups.map((g) => g.key), ["机房 10", "机房 2", "办公室"]);
  assert.deepEqual(groups[0]!.rows.map((r) => r.id), ["a", "c"]);
  assert.deepEqual(groups[1]!.rows.map((r) => r.id), ["b", "e"]);
});

test("分组：组有自己的顺序，数字按大小、中文按拼音；摊平后同组相邻", () => {
  const groups = groupRows(rows, (r) => r.room, compareGroupKeys);
  assert.deepEqual(groups.map((g) => g.key), ["办公室", "机房 2", "机房 10"]);
  assert.deepEqual(flattenGroups(groups).map((r) => r.id), ["d", "b", "e", "a", "c"]);
});

test("列排序只改组内顺序，不打乱组", () => {
  const byIdDesc = [...rows].sort((x, y) => y.id.localeCompare(x.id));
  const groups = groupRows(byIdDesc, (r) => r.room, compareGroupKeys);
  assert.deepEqual(groups.map((g) => g.key), ["办公室", "机房 2", "机房 10"]);
  assert.deepEqual(groups[2]!.rows.map((r) => r.id), ["c", "a"]);
});

test("折叠：切换一个组，键不重复", () => {
  assert.deepEqual(toggleGroup([], "x"), ["x"]);
  assert.deepEqual(toggleGroup(["x", "y"], "x"), ["y"]);
  assert.deepEqual(toggleGroup(["y"], "x"), ["y", "x"]);
});
