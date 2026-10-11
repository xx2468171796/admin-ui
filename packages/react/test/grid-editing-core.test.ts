// Overlapping saves of one cell: honest status text, undo `before` = a value the server had, release per cell.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyGridHistory, pushGridHistory, undoGridHistory, type GridCellChange } from "../src/grid-edit-core.ts";
import { confirmedBefore, failureText, GRID_RELEASE_AFTER, markSaving, overlayKey, rebaseGridHistory, releaseSavedCells, settleOverlay } from "../src/grid-editing-core.ts";

type Row = { id: string; name: string };
const change = (previous: string, value: string): GridCellChange<Row> => ({ rowId: "r1", field: "name", previous, value, row: { id: "r1", name: previous }, next: { id: "r1", name: value } });
const KEY = overlayKey("r1", "name");

test("an earlier save that fails after a later one succeeded rolls nothing back and does not claim 已恢复原值", () => {
  const a = change("x", "a");
  const b = change("a", "b");
  let overlay = markSaving(markSaving(new Map(), [a]), [b]);
  // b saved first …
  overlay = settleOverlay(overlay, [b], new Set()).next;
  assert.equal(overlay.get(KEY)?.state, "saved");
  // … then a fails.
  const late = settleOverlay(overlay, [a], new Set([KEY]));
  assert.equal(late.rolledBack, 0);
  assert.equal(late.superseded, 1);
  assert.equal(late.next.get(KEY)?.value, "b", "the newer value stays");
  const text = failureText("网络错误", late.rolledBack, 1);
  assert.doesNotMatch(text, /已恢复原值/);
  // A lone failure still says so.
  const alone = settleOverlay(markSaving(new Map(), [a]), [a], new Set([KEY]));
  assert.equal(alone.rolledBack, 1);
  assert.match(failureText("网络错误", alone.rolledBack, 1), /已恢复原值/);
});

test("undo after an overlapping failure restores a value the server really had (not the optimistic one)", () => {
  const a = change("x", "a");
  const b = change("a", "b");
  // b lands on the undo stack first, a fails afterwards.
  let history = pushGridHistory(emptyGridHistory(), "修改", [{ ...b, previous: confirmedBefore(b.previous, "r1", "name", []) }]);
  history = rebaseGridHistory(history, { rowId: "r1", field: "name", value: a.value, previous: a.previous });
  assert.equal(undoGridHistory(history)?.entry.cells[0]?.before, "x");
  // a fails first, b is recorded afterwards.
  const failures = [{ rowId: "r1", field: "name", value: "a", previous: "x" }];
  assert.equal(confirmedBefore(b.previous, "r1", "name", failures), "x");
  // A chain of failures walks back to the last real value.
  assert.equal(confirmedBefore("c", "r1", "name", [...failures, { rowId: "r1", field: "name", value: "c", previous: "a" }]), "x");
  assert.equal(confirmedBefore("a", "r2", "name", failures), "a", "other cells are untouched");
});

test("saved cells leave the overlay only when the host value carries them (per cell), else after a few updates", () => {
  const b = change("x", "b");
  const c = { ...change("y", "c"), rowId: "r2" };
  let overlay = settleOverlay(markSaving(new Map(), [b, c]), [b, c], new Set()).next as ReturnType<typeof releaseSavedCells>;
  const host = new Map([["r1", "x"], ["r2", "c"]]);
  overlay = releaseSavedCells(overlay, (rowId) => ({ found: host.has(rowId), value: host.get(rowId) }));
  assert.equal(overlay.get(KEY)?.value, "b", "r1's host data does not carry b yet: no flash back");
  assert.equal(overlay.has(overlayKey("r2", "name")), false, "r2 carries c: released");
  host.set("r1", "b");
  overlay = releaseSavedCells(overlay, (rowId) => ({ found: host.has(rowId), value: host.get(rowId) }));
  assert.equal(overlay.size, 0);
  // A host that keeps another value: released after GRID_RELEASE_AFTER updates.
  let stuck = settleOverlay(markSaving(new Map(), [b]), [b], new Set()).next as ReturnType<typeof releaseSavedCells>;
  for (let i = 0; i < GRID_RELEASE_AFTER; i++) stuck = releaseSavedCells(stuck, () => ({ found: true, value: "x" }));
  assert.equal(stuck.size, 0);
});
