import assert from "node:assert/strict";
import test from "node:test";
import { errorText } from "../src/error-text.ts";
import { isComposingEvent } from "../src/ime.ts";
import { decodeText } from "../src/text-decode.ts";
import { parseSpreadsheet } from "../src/excel.ts";
import { createAbortOwner } from "../src/abort-owner.ts";
import { createUndoCommits, type UndoCommitReason } from "../src/undo-commits.ts";
import { createLatestSearch } from "../src/latest-search.ts";
import { randomPin } from "../src/share-core.ts";
import { defaultRowLabel } from "../src/row-label.ts";
import { commitDraft, rebaseDraft } from "../src/change-tracker.ts";

test("errorText: Error message / string as is, never [object Object]; default fallback", () => {
  assert.equal(errorText(new Error("名称重复"), "失败"), "名称重复");
  assert.equal(errorText("网络断了", "失败"), "网络断了");
  assert.equal(errorText({ code: 500 }, "失败"), "失败");
  assert.equal(errorText(undefined, "失败"), "失败");
  assert.equal(errorText(new Error(""), "失败"), "失败");
  assert.equal(errorText(null), "操作没成功，请重试");
});

test("isComposingEvent: IME composition (isComposing or keyCode 229) on React and DOM events", () => {
  assert.equal(isComposingEvent({ nativeEvent: { isComposing: true } }), true);
  assert.equal(isComposingEvent({ nativeEvent: { isComposing: false, keyCode: 229 } }), true);
  assert.equal(isComposingEvent({ isComposing: true }), true);
  assert.equal(isComposingEvent({ keyCode: 229 }), true);
  assert.equal(isComposingEvent({ nativeEvent: { isComposing: false, keyCode: 13 } }), false);
  assert.equal(isComposingEvent({ isComposing: false, keyCode: 27 }), false);
});

test("CSV import decodes GB18030 (Excel on Chinese Windows) and UTF-8 with BOM", async () => {
  // 「姓名,城市\n张三,北京」 in GBK
  const gbk = new Uint8Array([0xd0, 0xd5, 0xc3, 0xfb, 0x2c, 0xb3, 0xc7, 0xca, 0xd0, 0x0a, 0xd5, 0xc5, 0xc8, 0xfd, 0x2c, 0xb1, 0xb1, 0xbe, 0xa9]);
  assert.equal(decodeText(gbk), "姓名,城市\n张三,北京");
  const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("姓名\n李四")]);
  assert.equal(decodeText(utf8), "姓名\n李四");
  const parsed = await parseSpreadsheet(new File([gbk], "人员.csv"), new AbortController().signal);
  assert.deepEqual(parsed.headers, ["姓名", "城市"]);
  assert.deepEqual(parsed.rows, [{ 姓名: "张三", 城市: "北京" }]);
});

test("createAbortOwner: next() aborts the previous operation, abort() the running one", () => {
  const owner = createAbortOwner();
  const first = owner.next();
  const second = owner.next();
  assert.equal(first.aborted, true);
  assert.equal(second.aborted, false);
  owner.abort();
  assert.equal(second.aborted, true);
  assert.equal(owner.next().aborted, false, "usable again after abort (StrictMode remount)");
});

test("createUndoCommits: each commit runs once; pagehide / unmount flush the pending ones; undo cancels", () => {
  const ran: [number, UndoCommitReason][] = [];
  const commits = createUndoCommits();
  for (const id of [1, 2, 3]) commits.add(id, ({ reason }) => ran.push([id, reason]));
  commits.cancel(2);
  assert.equal(commits.settle(1, "timeout"), true);
  assert.equal(commits.settle(1, "close"), false, "never twice");
  assert.deepEqual(commits.flush("pagehide"), [3]);
  assert.deepEqual(commits.flush("unmount"), []);
  assert.deepEqual(ran, [[1, "timeout"], [3, "pagehide"]]);
  assert.equal(commits.size, 0);
  const errors: unknown[] = [];
  const failing = createUndoCommits((e) => errors.push(e));
  failing.add(1, () => {
    throw Error("x");
  });
  failing.add(2, ({ reason }) => ran.push([2, reason]));
  assert.deepEqual(failing.flush("unmount"), [1, 2], "one failing commit does not stop the others");
  assert.equal(errors.length, 1);
});

test("createLatestSearch: debounced, skipped results of older queries, null clears at once", async () => {
  const pending: (() => void)[] = [];
  const timers = { set: (fn: () => void) => pending.push(fn), clear: () => pending.splice(0) };
  const asked: string[] = [];
  const shown: (string | null)[] = [];
  const search = createLatestSearch((q: string) => {
    asked.push(q);
    return `结果:${q}`;
  }, (r) => shown.push(r), 150, timers);
  search.request("z");
  search.request("zh");
  search.request("zha");
  assert.equal(pending.length, 1, "only the last keystroke is waiting");
  pending.shift()?.();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(asked, ["zha"]);
  assert.deepEqual(shown, ["结果:zha"]);
  search.request(null);
  assert.deepEqual(shown, ["结果:zha", null]);
});

test("randomPin defaults to 6 characters", () => {
  assert.equal(randomPin().length, 6);
});

test("defaultRowLabel: the first data column's text, else the row key", () => {
  type R = { id: string; name: string };
  const row: R = { id: "3f2a-uuid", name: "赵静怡" };
  const key = (r: R) => r.id;
  assert.equal(defaultRowLabel(row, [{ render: (r: R) => r.name }], key), "赵静怡");
  assert.equal(defaultRowLabel(row, [{ kind: "actions", render: () => "x" }, { render: (r: R) => r.name, truncate: (r: R) => `${r.name}（销售）` }], key), "赵静怡（销售）");
  assert.equal(defaultRowLabel(row, [{ render: () => ({ type: "span" }) }], key), "3f2a-uuid");
});

test("commitDraft: fields edited while the save was in flight stay unsaved", () => {
  const snapshot = { a: "1", b: "x" };
  const values = { a: "1", b: "y" }; // b edited after the save started
  assert.deepEqual(commitDraft(values, snapshot, snapshot), { a: "1", b: "y" });
  assert.deepEqual(commitDraft(values, snapshot, { a: "1.0", b: "x" }), { a: "1.0", b: "y" }, "server-normalized values for untouched fields");
});

test("rebaseDraft: a reload keeps local edits, takes new server values elsewhere, reports clashes", () => {
  const saved = { a: "1", b: "1", c: "1" };
  const values = { a: "2", b: "2", c: "1" };
  const next = { a: "1", b: "9", c: "9" };
  assert.deepEqual(rebaseDraft(saved, values, next), { values: { a: "2", b: "2", c: "9" }, conflicts: ["b"] });
});
