// An open editor follows its record (not a row index) and keeps its draft while the record is away.
import test from "node:test";
import assert from "node:assert/strict";
import { editorStartText, locateEdit } from "../src/grid-capture-core.ts";

const finder = (order: string[], cols: string[]) => ({ rowIndex: (id: string) => order.indexOf(id), colIndex: (key: string) => cols.indexOf(key) });

test("rows re-sorted / refreshed while editing: the editor stays on the same record", () => {
  const edit = { rowId: "r2", field: "name" };
  assert.deepEqual(locateEdit(edit, finder(["r1", "r2", "r3"], ["__row", "name"]), true), { kind: "here", row: 1, col: 1 });
  // r0 inserted on top, r2 moved down one row: still r2.
  assert.deepEqual(locateEdit(edit, finder(["r0", "r1", "r3", "r2"], ["__row", "name"]), true), { kind: "here", row: 3, col: 1 });
  // Columns reordered: follows the field.
  assert.deepEqual(locateEdit(edit, finder(["r2"], ["__row", "amount", "name"]), true), { kind: "here", row: 0, col: 2 });
});

test("a record missing while data loads is waited for; gone only once loading settled", () => {
  const edit = { rowId: "r2", field: "name" };
  assert.deepEqual(locateEdit(edit, finder(["r1"], ["name"]), false), { kind: "wait" }, "body reloading: keep the edit and its draft");
  assert.deepEqual(locateEdit(edit, finder(["r1"], ["name"]), true), { kind: "gone" });
});

test("an editor that remounts (its row came back) reopens with the typed draft", () => {
  const edit = { rowId: "r2", field: "name", startText: "a" };
  assert.equal(editorStartText(edit, { rowId: "r2", field: "name", text: "abc 张" }), "abc 张");
  assert.equal(editorStartText(edit, { rowId: "r9", field: "name", text: "other" }), "a", "a draft of another cell is not used");
  assert.equal(editorStartText({ rowId: "r2", field: "name" }, null), undefined);
});
