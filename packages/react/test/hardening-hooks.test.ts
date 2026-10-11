import assert from "node:assert/strict";
import test from "node:test";
import { installHookRuntime, renderHook } from "./hook-runtime.ts";

installHookRuntime();
const { useChangeTracker } = await import("../src/change-tracker.ts");
const { useBulkActionRunner } = await import("../src/bulk-action-runner.ts");
const { useAbortOwner } = await import("../src/abort-owner.ts");

type Form = { name: string; city: string };

test("useChangeTracker: commit(snapshot) keeps edits made while the save was in flight dirty", async () => {
  const initial: Form = { name: "甲", city: "北京" };
  const view = renderHook(() => useChangeTracker(initial), null);
  view.result.set("name", "乙");
  await view.settle();
  const snapshot = view.result.values; // the save starts with this draft
  view.result.set("city", "上海"); // typed while the request runs
  await view.settle();
  view.result.commit(snapshot);
  await view.settle();
  assert.deepEqual(view.result.keys, ["city"], "the late edit is still unsaved");
  assert.equal(view.result.values.city, "上海");
  // commit(serverValues) with no snapshot keeps the old meaning: the server values become the draft.
  view.result.commit({ name: "乙", city: "上海市" });
  await view.settle();
  assert.deepEqual(view.result.keys, []);
  assert.equal(view.result.values.city, "上海市");
  view.unmount();
});

test("useChangeTracker: a reload (version change) never throws a dirty draft away", async () => {
  let initial: Form = { name: "甲", city: "北京" };
  let version = 1;
  const view = renderHook(() => useChangeTracker(initial, version), null);
  view.result.set("name", "乙");
  await view.settle();
  initial = { name: "丙", city: "广州" };
  version = 2;
  view.rerender(null);
  await view.settle();
  assert.deepEqual(view.result.values, { name: "乙", city: "广州" });
  assert.deepEqual(view.result.conflicts, ["name"]);
  view.result.reset();
  await view.settle();
  assert.deepEqual(view.result.values, { name: "丙", city: "广州" });
  assert.deepEqual(view.result.conflicts, []);
  view.unmount();
});

test("useBulkActionRunner: focus returns when the bar disappears; a pending action blocks double clicks", async () => {
  const focused: string[] = [];
  const el = (name: string) => ({ name, isConnected: true, focus: () => focused.push(name) });
  const checkbox = el("checkbox");
  const clearButton = el("clear");
  const doc = { activeElement: checkbox as unknown };
  Object.assign(globalThis, { document: doc });
  try {
    const view = renderHook((count: number) => useBulkActionRunner(count), 0 as number);
    view.rerender(2); // bar appears; the row checkbox had the focus
    view.result.dock.current = { contains: (n: unknown) => n === clearButton } as unknown as HTMLDivElement;
    doc.activeElement = clearButton; // user tabs to ✕ and presses it
    let cleared = 0;
    view.result.clear(() => cleared++);
    view.rerender(0); // selection empty → bar gone
    assert.equal(cleared, 1);
    assert.deepEqual(focused, ["checkbox"], "focus went back to the checkbox, not <body>");

    view.rerender(2);
    let release = () => {};
    let calls = 0;
    const slow = () => {
      calls++;
      return new Promise<void>((r) => (release = r));
    };
    view.result.run("delete", slow);
    view.result.run("delete", slow);
    view.result.run("archive", slow);
    await view.settle();
    assert.equal(calls, 1, "double click ignored");
    assert.equal(view.result.busy, "delete");
    release();
    await view.settle();
    assert.equal(view.result.busy, null);
    view.unmount();
  } finally {
    Reflect.deleteProperty(globalThis, "document");
  }
});

test("useAbortOwner: the running operation is aborted on unmount", () => {
  const view = renderHook(() => useAbortOwner(), null);
  const signal = view.result.next();
  assert.equal(signal.aborted, false);
  view.unmount();
  assert.equal(signal.aborted, true);
});
