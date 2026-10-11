import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRemoteSearch, type RemoteSearchState } from "../src/choice-core.ts";

type Item = { value: string; label: string };
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** A loader that records calls and resolves / rejects by hand. */
function fakeLoader() {
  const calls: { q: string; signal: AbortSignal; resolve: (items: Item[]) => void; reject: (e: unknown) => void }[] = [];
  const load = (q: string, ctx: { signal: AbortSignal }) =>
    new Promise<readonly Item[]>((resolve, reject) => {
      calls.push({ q, signal: ctx.signal, resolve, reject });
    });
  return { calls, load };
}

test("remote search: opens at once, then searches 250 ms after the last keystroke (debounce)", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, load } = fakeLoader();
  const states: RemoteSearchState<Item>[] = [];
  const search = createRemoteSearch<Item>({ load, onChange: (s) => states.push(s) });
  search.open();
  await flush();
  assert.deepEqual(calls.map((c) => c.q), [""], "open = immediate suggestions request");
  calls[0]?.resolve([{ value: "1", label: "张三" }]);
  await flush();
  assert.equal(states.at(-1)?.status, "ready");
  search.setQuery("z");
  search.setQuery("zh");
  t.mock.timers.tick(249);
  await flush();
  assert.equal(calls.length, 1, "still waiting");
  search.setQuery("zha ");
  t.mock.timers.tick(249);
  await flush();
  assert.equal(calls.length, 1, "each keystroke restarts the wait");
  assert.equal(states.at(-1)?.status, "loading");
  assert.equal(states.at(-1)?.items.length, 1, "old results stay on screen while loading");
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(calls.map((c) => c.q), ["", "zha"], "one request, trimmed");
  search.dispose();
});

test("remote search: a new query aborts the running request; its late answer never overwrites the newer one", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, load } = fakeLoader();
  let state: RemoteSearchState<Item> | null = null;
  const search = createRemoteSearch<Item>({ load, onChange: (s) => (state = s), debounceMs: 100 });
  search.setQuery("a");
  t.mock.timers.tick(100);
  await flush();
  search.setQuery("ab");
  assert.equal(calls[0]?.signal.aborted, true, "typing again aborts the request for 「a」");
  t.mock.timers.tick(100);
  await flush();
  calls[1]?.resolve([{ value: "2", label: "ab 结果" }]);
  await flush();
  calls[0]?.resolve([{ value: "1", label: "a 结果（迟到）" }]); // a loader that ignores the signal
  await flush();
  assert.deepEqual((state as RemoteSearchState<Item> | null)?.items.map((i) => i.label), ["ab 结果"]);
  search.setQuery("abc");
  t.mock.timers.tick(100);
  await flush();
  assert.equal(calls.length, 3);
  search.dispose();
  assert.equal(calls[2]?.signal.aborted, true, "closing the popover aborts the running request");
});

test("remote search: nothing is requested while an IME composes; the committed text is searched", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, load } = fakeLoader();
  const search = createRemoteSearch<Item>({ load, onChange: () => undefined });
  search.compositionStart();
  search.setQuery("zh");
  search.setQuery("zhang");
  t.mock.timers.tick(1000);
  await flush();
  assert.equal(calls.length, 0, "no request for half-typed pinyin");
  search.compositionEnd("张");
  t.mock.timers.tick(250);
  await flush();
  assert.deepEqual(calls.map((c) => c.q), ["张"]);
  // A timer started before composing is cancelled by compositionstart.
  search.setQuery("张s");
  search.compositionStart();
  t.mock.timers.tick(1000);
  await flush();
  assert.equal(calls.length, 1);
  search.dispose();
});

test("remote search: failure → error + retry; below minLength → idle without a request; throwing loaders count as failures", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { calls, load } = fakeLoader();
  let state: RemoteSearchState<Item> | null = null;
  const search = createRemoteSearch<Item>({ load, onChange: (s) => (state = s), minLength: 2 });
  search.open();
  await flush();
  assert.equal(calls.length, 0);
  assert.equal((state as RemoteSearchState<Item> | null)?.status, "idle");
  search.setQuery("ab");
  t.mock.timers.tick(250);
  await flush();
  calls[0]?.reject(new Error("网络不通"));
  await flush();
  assert.deepEqual({ status: (state as RemoteSearchState<Item> | null)?.status, error: (state as RemoteSearchState<Item> | null)?.error }, { status: "error", error: "网络不通" });
  search.retry();
  await flush();
  assert.equal(calls.length, 2, "retry searches at once");
  const throwing = createRemoteSearch<Item>({ load: () => { throw new Error("坏了"); }, onChange: (s) => (state = s) });
  throwing.open();
  await flush();
  assert.equal((state as RemoteSearchState<Item> | null)?.error, "坏了");
  search.dispose();
});

test("AsyncChoice: Choice's keyboard, IME guard in the keys, remote states, root export", () => {
  const source = readFileSync(new URL("../src/async-choice.tsx", import.meta.url), "utf8");
  assert.match(source, /onCompositionStart=\{search\.compositionStart\}/);
  assert.match(source, /onCompositionEnd=/);
  assert.match(source, /if \(event\.nativeEvent\.isComposing\) return;/, "arrow / Enter keys ignored while composing");
  assert.match(source, /moveActive\(shown, active, event\.key, false\)/, "same arrow / Home / End rules as Choice");
  assert.match(source, /\["ArrowDown", "ArrowUp", "Enter", " "\]\.includes\(event\.key\)/, "trigger keys like Choice");
  for (const text of ["正在搜索…", "没有匹配「", "没加载出来", "重试", "再输入"]) assert.ok(source.includes(text), text);
  const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  assert.match(index, /export \{ AsyncChoice, type AsyncChoiceProps \} from "\.\/async-choice\.tsx";/);
});
