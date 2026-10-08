// 反馈与弹层的纯规则——弹框滚动分隔线、提示条停留时长、撤销倒计时（可暂停）、提示条堆叠、先问还是先做再撤销、编辑冲突、提示按键写法。
import test from "node:test";
import assert from "node:assert/strict";
import { confirmOrUndo, createCountdown, scrollEdges, secondsLeft, stackToasts, toastDuration, TOAST_MS } from "../src/overlay-core.ts";
import { conflictCounts, conflictHeadline, overriddenKeys, pickOf, resolveConflicts } from "../src/edit-conflict-core.ts";
import { formatShortcut } from "../src/tooltip-core.ts";

test("弹框：正文滚动起来才出头部分隔线，下面还有内容才出底栏分隔线", () => {
  assert.deepEqual(scrollEdges({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 }), { scrolled: false, more: false }, "短弹框没有线");
  assert.deepEqual(scrollEdges({ scrollTop: 0, scrollHeight: 900, clientHeight: 400 }), { scrolled: false, more: true });
  assert.deepEqual(scrollEdges({ scrollTop: 120, scrollHeight: 900, clientHeight: 400 }), { scrolled: true, more: true });
  assert.deepEqual(scrollEdges({ scrollTop: 500, scrollHeight: 900, clientHeight: 400 }), { scrolled: true, more: false }, "滚到底");
  assert.deepEqual(scrollEdges({ scrollTop: 499.5, scrollHeight: 900, clientHeight: 400 }), { scrolled: true, more: false }, "小数像素不算还有");
});

test("提示条：成功 4 秒、带操作 8 秒、失败和进行中不自动消失、宿主可指定", () => {
  assert.equal(toastDuration({ tone: "success" }), TOAST_MS.plain);
  assert.equal(toastDuration({ tone: "info" }), 4000);
  assert.equal(toastDuration({ tone: "success", action: true }), 8000);
  assert.equal(toastDuration({ tone: "error" }), null, "失败要用户点 ×");
  assert.equal(toastDuration({ tone: "error", action: true }), null);
  assert.equal(toastDuration({ tone: "loading" }), null);
  assert.equal(toastDuration({ tone: "success", duration: null }), null);
  assert.equal(toastDuration({ tone: "error", duration: 3000 }), 3000);
});

test("撤销倒计时：按真实时间走，鼠标放上去暂停，移开接着走，不会小于 0", () => {
  const clock = createCountdown(8000, 1000);
  assert.equal(clock.remaining(1000), 8000);
  assert.equal(clock.remaining(500), 8000, "时钟比开始还早（渲染时的旧时间）不加时间");
  assert.equal(clock.remaining(4000), 5000);
  assert.equal(secondsLeft(clock.remaining(4000)), 5);
  assert.equal(secondsLeft(clock.remaining(4100)), 5, "4.9 秒显示 5");
  clock.pause(4000);
  assert.equal(clock.paused, true);
  assert.equal(clock.remaining(60000), 5000, "暂停时不走");
  clock.pause(70000);
  assert.equal(clock.remaining(70000), 5000, "重复暂停不扣时间");
  clock.resume(70000);
  assert.equal(clock.remaining(72000), 3000);
  clock.resume(72000);
  assert.equal(clock.remaining(72000), 3000, "重复继续不重置");
  assert.equal(clock.remaining(99999), 0);
  assert.equal(secondsLeft(0), 0);
  assert.equal(secondsLeft(1), 1);
});

test("提示条堆叠：最多 3 条，同一条再来只留新的，先挤掉成功的、留住失败 / 进行中的", () => {
  type T = { id: number; title: string; tone: "success" | "error" | "loading" | "info"; key?: string };
  const t = (id: number, title: string, tone: T["tone"] = "success", key?: string): T => ({ id, title, tone, key });
  let list: T[] = [];
  list = stackToasts(list, t(1, "已保存"));
  list = stackToasts(list, t(2, "已保存"));
  assert.deepEqual(list.map((x) => x.id), [2], "同文字同口气只留一条");
  list = stackToasts(list, t(3, "复制失败", "error"));
  list = stackToasts(list, t(4, "正在导出…", "loading"));
  list = stackToasts(list, t(5, "已删除"));
  assert.deepEqual(list.map((x) => x.id), [3, 4, 5], "超过 3 条挤掉最早的成功");
  list = stackToasts(list, t(6, "已移动"));
  assert.deepEqual(list.map((x) => x.id), [3, 4, 6], "失败和进行中留着");
  const keyed = stackToasts([t(7, "已删除", "success", "undo:7")], t(8, "已删除", "success", "undo:8"));
  assert.equal(keyed.length, 2, "两次撤销各是各的");
});

test("先问还是先做再撤销：能撤回的单条直接做；撤不回、影响别人、批量 ≥ 20 才问", () => {
  assert.equal(confirmOrUndo({ reversible: true }), "undo", "删一条");
  assert.equal(confirmOrUndo({ reversible: true, count: 19 }), "undo");
  assert.equal(confirmOrUndo({ reversible: true, count: 20 }), "confirm", "批量删 20 条");
  assert.equal(confirmOrUndo({ reversible: false }), "confirm", "删表 / 停用账号");
  assert.equal(confirmOrUndo({ reversible: true, affectsOthers: true }), "confirm");
  assert.equal(confirmOrUndo({ reversible: true, count: 6, bulkThreshold: 5 }), "confirm");
});

test("编辑冲突：默认保留别人较新的，点了「用我的」才覆盖", () => {
  const rows = [
    { key: "name", theirs: "赵静怡", mine: "赵静宜" },
    { key: "stage", theirs: "谈判", mine: "报价" },
    { key: "owner", theirs: "小王", mine: "小陈" },
  ];
  assert.equal(pickOf("name", {}), "theirs");
  assert.deepEqual(resolveConflicts(rows, {}), { name: "赵静怡", stage: "谈判", owner: "小王" });
  assert.deepEqual(resolveConflicts(rows, { stage: "mine" }), { name: "赵静怡", stage: "报价", owner: "小王" });
  assert.deepEqual(overriddenKeys(rows, { stage: "mine", owner: "theirs" }), ["stage"]);
  assert.deepEqual(conflictCounts(rows, { stage: "mine" }), { theirs: 2, mine: 1 });
  assert.equal(conflictHeadline("王小明", "14:31"), "王小明 刚改过这一格 · 14:31");
  assert.equal(conflictHeadline("王小明", undefined, "这条记录"), "王小明 刚改过这条记录");
});

test("菜单里的快捷键写短：⇧ ↵ ⌫ 用符号，Ctrl 照写", () => {
  assert.deepEqual(formatShortcut("Ctrl+Shift+Enter", "other", true), ["Ctrl", "⇧", "↵"]);
  assert.deepEqual(formatShortcut("Ctrl+Shift+Enter", "other"), ["Ctrl", "Shift", "Enter"], "不压缩时照旧");
  assert.deepEqual(formatShortcut("Mod+Backspace", "mac", true), ["⌘", "⌫"]);
  assert.deepEqual(formatShortcut("Alt+K", "other", true), ["Alt", "K"]);
});
