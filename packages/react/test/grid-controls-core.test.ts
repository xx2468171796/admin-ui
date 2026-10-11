// Column resize commits once per drag; the select-all checkbox stays focusable (aria-disabled) while loading.
import test from "node:test";
import assert from "node:assert/strict";
import { createResizeSession, selectAllControl, sizingChanges } from "../src/grid-controls-core.ts";

test("column resize: pointer moves only update local widths, the view is committed once on release", () => {
  const commits: Record<string, number>[] = [];
  const session = createResizeSession((widths) => commits.push(widths));
  const isField = (key: string) => key !== "__row";
  let before: Record<string, number> = { name: 200 };
  for (let width = 201; width <= 260; width++) {
    const changed = sizingChanges(before, { name: width, __row: 48 }, isField);
    if (changed) session.update(changed);
    before = { name: width };
  }
  assert.equal(commits.length, 0, "no view commit per pointermove");
  assert.deepEqual(session.live, { name: 260 }, "the drag shows the live width");
  session.end();
  assert.deepEqual(commits, [{ name: 260 }]);
  session.end();
  assert.equal(commits.length, 1, "a second release commits nothing");
  assert.equal(sizingChanges({ name: 200 }, { name: 200 }, isField), null);
});

test("select-all while loading: inert via aria-disabled (no `disabled`), activation ignored", () => {
  const loading = selectAllControl({ interactive: false, selectable: ["a", "b"], selected: [] });
  assert.equal(loading.inert, true);
  assert.equal(loading.toggle(true), null, "a click / Space while loading changes nothing");
  assert.ok(!("disabled" in loading));
  const ready = selectAllControl({ interactive: true, selectable: ["a", "b"], selected: ["x", "a"] });
  assert.equal(ready.checked, "indeterminate");
  assert.deepEqual(ready.toggle(true), ["x", "a", "b"]);
  assert.deepEqual(ready.toggle(false), ["x"]);
  assert.equal(selectAllControl({ interactive: true, selectable: [], selected: [] }).inert, true);
});
