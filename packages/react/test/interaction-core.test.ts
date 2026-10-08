import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_LIST_STATE, isSilentRun, listLoadReducer, mergeReloadMode, type ListLoadState } from "../src/data-core.ts";
import { nextMenuIndex } from "../src/menu-core.ts";
import { changedFields } from "../src/confirm-core.ts";
import { pageSizeOptions } from "../src/contracts.ts";

type D = { rows: string[] };
const loaded: ListLoadState<D> = { data: { rows: ["a"] }, loading: false, refreshing: false };

test("静默刷新保留当前行，失败变成 staleError 而不是整表报错", () => {
  const refreshing = listLoadReducer(loaded, { type: "start", silent: true });
  assert.deepEqual(refreshing, { ...loaded, refreshing: true });
  assert.equal(refreshing.loading, false, "不进入 loading，表格不闪");
  const failed = listLoadReducer(refreshing, { type: "failure", message: "网络错误", silent: true });
  assert.deepEqual(failed.data, loaded.data);
  assert.equal(failed.error, undefined);
  assert.equal(failed.staleError, "网络错误");
  const ok = listLoadReducer({ ...failed, refreshing: true }, { type: "success", data: { rows: ["b"] } });
  assert.deepEqual(ok, { data: { rows: ["b"] }, loading: false, refreshing: false });
});

test("普通 reload 行为不变：清空旧行进入 loading，失败显示 error", () => {
  const start = listLoadReducer(loaded, { type: "start", silent: false });
  assert.deepEqual(start, { loading: true, refreshing: false });
  const failed = listLoadReducer(start, { type: "failure", message: "加载失败", silent: false });
  assert.deepEqual(failed, { loading: false, refreshing: false, error: "加载失败" });
});

test("还没有数据时的静默刷新等同普通加载，失败照常显示 error", () => {
  assert.equal(listLoadReducer(INITIAL_LIST_STATE as ListLoadState<D>, { type: "start", silent: true }), INITIAL_LIST_STATE);
  const errored: ListLoadState<D> = { loading: false, refreshing: false, error: "x" };
  assert.deepEqual(listLoadReducer(errored, { type: "start", silent: true }), { loading: true, refreshing: false });
  assert.deepEqual(listLoadReducer({ loading: true, refreshing: false }, { type: "failure", message: "y", silent: true }), {
    loading: false,
    refreshing: false,
    error: "y",
  });
});

test("待执行的刷新合并：普通优先；换了查询一律普通加载", () => {
  assert.equal(mergeReloadMode(null, "silent"), "silent");
  assert.equal(mergeReloadMode("silent", "normal"), "normal");
  assert.equal(mergeReloadMode("normal", "silent"), "normal");
  assert.equal(isSilentRun("silent", "k", "k"), true);
  assert.equal(isSilentRun("silent", "k", "k2"), false);
  assert.equal(isSilentRun("silent", null, "k"), false);
  assert.equal(isSilentRun(null, "k", "k"), false);
});

test("菜单方向键跳过禁用项并循环", () => {
  const disabled = [false, true, false, false];
  assert.equal(nextMenuIndex(disabled, 0, 1), 2);
  assert.equal(nextMenuIndex(disabled, 3, 1), 0);
  assert.equal(nextMenuIndex(disabled, 0, -1), 3);
  assert.equal(nextMenuIndex(disabled, 2, -1), 0);
  assert.equal(nextMenuIndex(disabled, -1, 1), 0);
  assert.equal(nextMenuIndex(disabled, -1, -1), 3);
  assert.equal(nextMenuIndex([true, false, true], 0, "first"), 1);
  assert.equal(nextMenuIndex([false, false, true], 0, "last"), 1);
  assert.equal(nextMenuIndex([true, true], 0, 1), -1);
  assert.equal(nextMenuIndex([], 0, "first"), -1);
});

test("改动清单只列真的变了的字段，按字段顺序，空值显示 —", () => {
  const before = { rate: 28, cap: 10000, open: true, rooms: [1, 2], note: null as string | null };
  const after = { rate: 30, cap: 10000, open: false, rooms: [1, 2], note: "x" };
  const items = changedFields(before, after, [
    { key: "rate", label: "汇率", unit: "币/弹药", effect: "立即" },
    { key: "cap", label: "每日上限" },
    { key: "open", label: "开关", format: (v) => (v ? "开" : "关"), effect: "重启后" },
    { key: "rooms", label: "地图" },
    { key: "note", label: "备注" },
  ]);
  assert.deepEqual(items, [
    { label: "汇率", from: "28", to: "30", unit: "币/弹药", effect: "立即" },
    { label: "开关", from: "开", to: "关", effect: "重启后" },
    { label: "备注", from: "—", to: "x" },
  ]);
  assert.deepEqual(changedFields(before, { ...before, rooms: [1, 2] }, [{ key: "rooms", label: "地图" }]), []);
});

test("每页条数选项总包含当前值，升序去重", () => {
  assert.deepEqual(pageSizeOptions([10, 20, 50], 20), [10, 20, 50]);
  assert.deepEqual(pageSizeOptions([10, 20, 50], 30), [10, 20, 30, 50]);
  assert.deepEqual(pageSizeOptions([50, 10, 10], 100), [10, 50, 100]);
  assert.deepEqual(pageSizeOptions([], 15), [15]);
  assert.deepEqual(pageSizeOptions([0, -1, 2.5, 20], 20), [20]);
});
