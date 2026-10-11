// Type-to-edit with an IME: 「张」 not 「z张」, and no keystroke lost while the editor loads.
import test from "node:test";
import assert from "node:assert/strict";
import { gridKeyAction } from "../src/grid-edit-core.ts";
import { isComposingEvent as isImeKey } from "../src/ime.ts";
import { captureEdit, editorReady } from "../src/grid-capture-core.ts";

test("IME keys never start type-to-edit (the first pinyin letter does not leak into the cell)", () => {
  assert.equal(gridKeyAction({ key: "z", keyCode: 229 }), null, "Safari / Chrome: first pinyin key reads z with keyCode 229");
  assert.equal(gridKeyAction({ key: "Process" }), null);
  assert.equal(gridKeyAction({ key: "z", isComposing: true }), null);
  assert.equal(gridKeyAction({ key: "z", keyCode: 90 }), "type", "plain typing still edits");
  assert.equal(gridKeyAction({ key: "Enter", keyCode: 13 }), "edit");
  assert.equal(isImeKey({ key: "a" }), false);
});

test("composition opens the editor with the composed text only", () => {
  let edit = captureEdit(null, { type: "compositionstart", rowId: "r1", field: "name" });
  assert.deepEqual(edit, { rowId: "r1", field: "name", startText: "", composing: true });
  assert.equal(editorReady(edit), false, "the editor waits: mounting it would end the composition");
  edit = captureEdit(edit, { type: "input", text: "zh", composing: true });
  assert.equal(edit?.startText, "", "the IME preview is not text");
  edit = captureEdit(edit, { type: "compositionend", text: "张" });
  assert.deepEqual(edit, { rowId: "r1", field: "name", startText: "张", composing: false });
  assert.equal(editorReady(edit), true);
  // Esc in the IME: nothing composed, the edit it started is cancelled.
  const cancelled = captureEdit(captureEdit(null, { type: "compositionstart", rowId: "r1", field: "name" }), { type: "compositionend", text: "" });
  assert.equal(cancelled, null);
});

test("keys typed before the lazy editor mounts are buffered, not lost", () => {
  // 「a」 started the edit (keydown), 「bc」 landed in the capture while the editor chunk was loading.
  let edit = captureEdit({ rowId: "r1", field: "name", startText: "a" }, { type: "input", text: "b" });
  edit = captureEdit(edit, { type: "input", text: "c" });
  assert.equal(edit?.startText, "abc");
  // Typing then composing: both kept.
  edit = captureEdit(edit, { type: "compositionstart", rowId: "r1", field: "name" });
  edit = captureEdit(edit, { type: "compositionend", text: "张" });
  assert.equal(edit?.startText, "abc张");
  assert.equal(captureEdit(null, { type: "input", text: "x" }), null, "no edit, no buffering");
});
