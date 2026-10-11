// Grid search: one commit 300 ms after typing stops, none while an IME composes.
import test from "node:test";
import assert from "node:assert/strict";
import { createSearchDebouncer, GRID_SEARCH_DELAY } from "../src/grid-search.ts";

function fakeTimers() {
  let now = 0;
  const pending = new Map<number, { at: number; run: () => void }>();
  let next = 1;
  return {
    schedule: (run: () => void, ms: number) => { const id = next++; pending.set(id, { at: now + ms, run }); return id; },
    clear: (handle: unknown) => { pending.delete(handle as number); },
    advance(ms: number) {
      now += ms;
      for (const [id, job] of [...pending]) if (job.at <= now) { pending.delete(id); job.run(); }
    },
  };
}

test("typing commits once, 300 ms after the last keystroke", () => {
  const timers = fakeTimers();
  const commits: string[] = [];
  const search = createSearchDebouncer((text) => commits.push(text), timers);
  for (const text of ["客", "客户", "客户A"]) {
    search.input(text);
    timers.advance(100);
  }
  assert.deepEqual(commits, [], "nothing per keystroke");
  timers.advance(GRID_SEARCH_DELAY);
  assert.deepEqual(commits, ["客户A"]);
  search.input("");
  assert.deepEqual(commits, ["客户A", ""], "clearing applies at once");
});

test("no search while an IME composes; the composed text is searched once composition ends", () => {
  const timers = fakeTimers();
  const commits: string[] = [];
  const search = createSearchDebouncer((text) => commits.push(text), timers);
  search.compositionStart();
  for (const text of ["z", "zh", "zhang"]) {
    search.input(text);
    timers.advance(400);
  }
  assert.deepEqual(commits, [], "pinyin is never searched");
  search.compositionEnd("张");
  timers.advance(GRID_SEARCH_DELAY);
  assert.deepEqual(commits, ["张"]);
  search.input("张三", true);
  timers.advance(GRID_SEARCH_DELAY);
  assert.deepEqual(commits, ["张"], "an input flagged isComposing is not committed");
});
