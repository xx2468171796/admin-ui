// The grid's keyboard dispatcher (pure): key + what the focused cell is → one command.
import test from "node:test";
import assert from "node:assert/strict";
import { gridKeyCommand, type GridKeyFacts } from "../src/grid-keyboard.ts";

const facts = (patch: Partial<GridKeyFacts> = {}): GridKeyFacts => ({
  here: { row: 2, col: 1 }, count: 10, rowCount: 11, colCount: 5, page: 5, column: "field", item: "row",
  editingEnabled: true, editable: true, checkbox: false, selectable: true, canSelectRow: true, canExpand: true,
  canInsertRows: false, hasAnchor: false, footerAdd: false, summary: true, ...patch,
});

test("navigation, type-to-edit and IME keys", () => {
  assert.deepEqual(gridKeyCommand({ key: "ArrowDown" }, facts()), { kind: "move", to: { row: 3, col: 1 }, extend: false });
  assert.deepEqual(gridKeyCommand({ key: "ArrowDown", shiftKey: true }, facts()), { kind: "move", to: { row: 3, col: 1 }, extend: true });
  assert.deepEqual(gridKeyCommand({ key: "a" }, facts()), { kind: "type", text: "a" });
  assert.equal(gridKeyCommand({ key: "a" }, facts({ editable: false })), null);
  assert.equal(gridKeyCommand({ key: "z", keyCode: 229 }, facts()), null, "IME: the capture composes");
  assert.equal(gridKeyCommand({ key: "ArrowDown", isComposing: true }, facts()), null, "arrows pick IME candidates, not cells");
});

test("Enter / Space / shortcuts by cell kind", () => {
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts()), { kind: "edit" });
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts({ checkbox: true })), { kind: "toggleCheckbox" });
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts({ editable: false })), { kind: "enterCell" });
  assert.deepEqual(gridKeyCommand({ key: " " }, facts()), { kind: "openRecord" });
  assert.deepEqual(gridKeyCommand({ key: " " }, facts({ column: "row" })), { kind: "toggleRow", shift: false });
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts({ here: { row: -1, col: 1 }, item: null })), { kind: "headerMenu" });
  assert.deepEqual(gridKeyCommand({ key: " " }, facts({ here: { row: -1, col: 0 }, item: null, column: "row" })), { kind: "toggleAll" });
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts({ here: { row: 10, col: 1 }, item: null })), { kind: "summaryPicker" });
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts({ item: "group" })), { kind: "toggleGroup" });
  assert.deepEqual(gridKeyCommand({ key: "Enter" }, facts({ item: "loading", itemError: true })), { kind: "retry" });
  assert.deepEqual(gridKeyCommand({ key: "z", ctrlKey: true }, facts()), { kind: "undo" });
  assert.equal(gridKeyCommand({ key: "z", ctrlKey: true }, facts({ editingEnabled: false })), null);
  assert.deepEqual(gridKeyCommand({ key: "Delete" }, facts()), { kind: "clear" });
  assert.deepEqual(gridKeyCommand({ key: "Enter", shiftKey: true }, facts({ canInsertRows: true })), { kind: "insertRow", position: "below" });
  assert.deepEqual(gridKeyCommand({ key: "Enter", shiftKey: true }, facts()), { kind: "edit" }, "Shift + Enter edits when rows cannot be inserted");
  assert.deepEqual(gridKeyCommand({ key: "ArrowLeft", altKey: true }, facts({ here: { row: -1, col: 1 }, item: null })), { kind: "resizeColumn", delta: -16 });
  assert.deepEqual(gridKeyCommand({ key: "F10", shiftKey: true }, facts()), { kind: "contextMenu" });
  assert.deepEqual(gridKeyCommand({ key: "Escape" }, facts({ hasAnchor: true })), { kind: "clearAnchor" });
  assert.equal(gridKeyCommand({ key: "Escape" }, facts()), null);
});
