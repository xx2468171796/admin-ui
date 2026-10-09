import assert from "node:assert/strict";
import { test } from "node:test";
import { firstInlineEditColumn } from "../src/grid-add-row.ts";
import type { GridFieldType } from "../src/grid-core.ts";

type Cell = { editable: boolean; type: GridFieldType | undefined; hostEditor: boolean };
const cells = (list: Cell[]) => (col: number) => list[col]!;

test("新增记录打开第一个能直接在格子里改的列", () => {
  const info = cells([
    { editable: false, type: "text", hostEditor: false },
    { editable: true, type: "checkbox", hostEditor: false },
    { editable: true, type: "link", hostEditor: true },
    { editable: true, type: "attachment", hostEditor: false },
    { editable: true, type: "user", hostEditor: true },
    { editable: true, type: "phone", hostEditor: false },
  ]);
  assert.equal(firstInlineEditColumn([0, 1, 2, 3, 4, 5], info), 5);
  assert.equal(firstInlineEditColumn([5, 0], info), 5, "按显示顺序");
  assert.equal(firstInlineEditColumn([0, 1, 2], info), null, "没有能直接改的列 = 只选中第一格");
});
