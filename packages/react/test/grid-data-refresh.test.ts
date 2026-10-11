import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyBlockState,
  missingBlocks,
  patchBlockRows,
  receiveBlock,
  refreshBlockState,
  rowAtIndex,
  failBlock,
  markLoading,
  settleBlocks,
  type GridBlockState,
} from "../src/grid-data-core.ts";
import { insertBlockRow, removeBlockRows } from "../src/grid-data-edit.ts";

type Row = { id: string };
const id = (row: Row) => row.id;
const rows = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ({ id: `r${from + i}` }));
const BS = 10;
/** A cache of `total` records with the given blocks loaded (fresh). */
function cache(total: number, blocks: number[]): GridBlockState<Row> {
  let s = emptyBlockState<Row>("q");
  for (const b of blocks) s = receiveBlock(s, { key: "q", generation: 0, block: b, result: { rows: rows(b * BS, Math.min(total, (b + 1) * BS)), total } }, 30, BS);
  return s;
}
const ids = (s: GridBlockState<Row>, from: number, to: number) => Array.from({ length: to - from }, (_, i) => rowAtIndex(s, from + i, BS)?.id ?? null);

test("refresh keeps the viewport's blocks (stale) and drops the rest; stale blocks are fetched again", () => {
  const s = cache(35, [0, 1, 2, 3]);
  const r = refreshBlockState(s, [1, 2]);
  assert.equal(r.generation, s.generation + 1);
  assert.equal(r.total, 35, "总数保留，滚动高度不跳");
  assert.deepEqual([...r.blocks.keys()].sort(), [1, 2], "只留屏幕上的块");
  assert.deepEqual([...(r.stale ?? [])].sort(), [1, 2], "留下的块标为过期");
  assert.equal(rowAtIndex(r, 15, BS)?.id, "r15", "过期块的行照常显示（不出骨架行）");
  assert.deepEqual(missingBlocks(r, 10, 29, BS), [1, 2], "过期块会重取");
  assert.deepEqual(missingBlocks(refreshBlockState(s), 0, 9, BS), [0], "不传 keep = 旧行为：全部清空");
});

test("the newer answer replaces a stale block and clears its flag; total and summaries are replaced", () => {
  const r = refreshBlockState({ ...cache(35, [0, 1]), summaries: { amount: "¥1" } }, [0, 1]);
  const next = receiveBlock(r, { key: "q", generation: r.generation, block: 0, result: { rows: [{ id: "new" }, ...rows(0, 9)], total: 36, summaries: { amount: "¥2" } } }, 30, BS);
  assert.equal(rowAtIndex(next, 0, BS)?.id, "new");
  assert.equal(next.stale?.has(0), false);
  assert.equal(next.stale?.has(1), true, "其他块还在等新回包");
  assert.equal(next.total, 36);
  assert.deepEqual(next.summaries, { amount: "¥2" });
  assert.equal(receiveBlock(r, { key: "q", generation: 0, block: 1, result: { rows: [], total: 0 } }, 30, BS), r, "刷新前那一代的回包丢弃");
  const shrunk = receiveBlock(refreshBlockState(cache(35, [0, 1, 2]), [0, 1, 2]), { key: "q", generation: 1, block: 0, result: { rows: rows(0, 10), total: 12 } }, 30, BS);
  assert.deepEqual([...shrunk.blocks.keys()].sort(), [0, 1], "总数变少：超出的过期块丢掉");
});

test("insertBlockRow: next to an anchor, rows after it shift; overflow goes to the next loaded block", () => {
  const s = cache(35, [0, 1, 2, 3]);
  const after = insertBlockRow(s, { id: "x" }, { after: "r4" }, id, BS)!;
  assert.equal(after.total, 36);
  assert.deepEqual(ids(after, 3, 7), ["r3", "r4", "x", "r5"]);
  assert.deepEqual(ids(after, 9, 12), ["r8", "r9", "r10"], "每块的行往后挪一格");
  assert.deepEqual(ids(after, 34, 36), ["r33", "r34"], "最后一块多一条");
  assert.equal(after.generation, s.generation + 1, "途中的回包作废");
  const before = insertBlockRow(s, { id: "y" }, { before: "r0" }, id, BS)!;
  assert.deepEqual(ids(before, 0, 2), ["y", "r0"]);
  assert.equal(insertBlockRow(s, { id: "z" }, { after: "missing" }, id, BS), null, "锚点没加载 = 交给刷新");
  assert.equal(insertBlockRow(emptyBlockState<Row>("q"), { id: "z" }, "end", id, BS), null, "还没有数据 = 交给刷新");
});

test("insertBlockRow: the end, a gap after the run, and a row already there", () => {
  const full = cache(30, [0, 1, 2]);
  const end = insertBlockRow(full, { id: "e" }, "end", id, BS)!;
  assert.equal(end.total, 31);
  assert.deepEqual(ids(end, 29, 31), ["r29", "e"], "最后一块满了：新开一块");
  const gap = cache(50, [0, 1, 3]);
  const g = insertBlockRow(gap, { id: "g" }, { after: "r5" }, id, BS)!;
  assert.equal(g.blocks.has(3), false, "隔开的块位置都挪了：丢掉重取");
  assert.deepEqual(ids(g, 19, 20), ["r18"], "末块挤出去的那条不留（下一块重取时会带上）");
  const far = cache(50, [0]);
  const tail = insertBlockRow(far, { id: "t" }, "end", id, BS)!;
  assert.equal(tail.total, 51);
  assert.equal(tail.blocks.size, 1, "末块没加载：只把总数加一，滚到那里再取");
  const dup = insertBlockRow(full, { id: "r3" }, "end", id, BS)!;
  assert.equal(dup.total, 30, "已经在缓存里：只替换");
});

test("removeBlockRows: later rows move up; a short block before the end is fetched again", () => {
  const s = cache(35, [0, 1, 2, 3]);
  const r = removeBlockRows(s, ["r2", "r12"], id, BS);
  assert.equal(r.total, 33);
  assert.deepEqual(ids(r, 1, 4), ["r1", "r3", "r4"]);
  assert.deepEqual(ids(r, 9, 12), ["r10", "r11", "r13"]);
  assert.deepEqual(ids(r, 31, 33), ["r33", "r34"]);
  assert.equal(r.stale?.size ?? 0, 0, "连到数据末尾：不用重取");
  const mid = removeBlockRows(cache(50, [0, 1]), ["r3"], id, BS);
  assert.equal(mid.blocks.get(1)?.length, 9);
  assert.equal(mid.stale?.has(1), true, "后面还有数据的短块：标过期，重取补齐");
  assert.deepEqual(missingBlocks(mid, 0, 19, BS), [1]);
  assert.equal(removeBlockRows(s, ["nope"], id, BS), s, "没加载的 id 忽略");
});

test("patchBlockRows still replaces in place (handle.patchRows)", () => {
  const s = cache(15, [0, 1]);
  const p = patchBlockRows(s, new Map([["r11", { id: "r11" }]]), id);
  assert.notEqual(p, s);
  assert.equal(p.blocks.get(0), s.blocks.get(0), "没改的块不换引用");
});

test("8.9.1: one refresh lands at once — answers wait for every kept block still in flight", () => {
  // A row was duplicated at 5: everything from there moves +1, so r9 goes from block 0 to block 1.
  const r = markLoading(refreshBlockState(cache(30, [0, 1, 2]), [0, 1]), [0, 1]);
  const after = [...rows(0, 6), { id: "dup" }, ...rows(6, 29)];
  const answer = (block: number) => ({ key: "q", generation: r.generation, block, result: { rows: after.slice(block * BS, (block + 1) * BS), total: 30 } });
  const one = receiveBlock(r, answer(1), 30, BS);
  assert.equal(rowAtIndex(one, 10, BS)?.id, "r10", "第 1 块先回来：先不换（不然 r9 会同时出现在两块里）");
  assert.equal(one.held?.length, 1);
  assert.equal(one.loading.has(1), false);
  const both = receiveBlock(one, answer(0), 30, BS);
  assert.deepEqual([rowAtIndex(both, 9, BS)?.id, rowAtIndex(both, 10, BS)?.id], ["r8", "r9"], "最后一块到了：一起换");
  assert.equal(both.held, undefined);
  assert.equal(both.stale?.size, 0);
  const ids = [...both.blocks.get(0)!, ...both.blocks.get(1)!].map(id);
  assert.equal(new Set(ids).size, ids.length, "同一时刻没有重复的行");
  // A kept block fails: the others land, it keeps its stale rows (no skeleton, no hang)
  const failed = failBlock(one, { key: "q", generation: r.generation, block: 0, error: "x" }, 30, BS);
  assert.equal(rowAtIndex(failed, 10, BS)?.id, "r9", "到了的那块落下");
  assert.equal(rowAtIndex(failed, 0, BS)?.id, "r0", "失败的那块留着旧行");
  assert.equal(failed.stale?.has(0), true);
  // Took too long: force lands what arrived; the late one is stored normally when it comes
  const forced = settleBlocks(one, 30, BS, true);
  assert.equal(rowAtIndex(forced, 10, BS)?.id, "r9");
  assert.equal(forced.loading.has(0), true, "还在路上的那块照常等");
  assert.equal(rowAtIndex(receiveBlock(forced, answer(0), 30, BS), 6, BS)?.id, "dup");
  // Not a refresh (nothing stale): answers land right away
  const first = receiveBlock(markLoading(emptyBlockState<Row>("q"), [0, 1]), { key: "q", generation: 0, block: 1, result: { rows: rows(10, 20), total: 30 } }, 30, BS);
  assert.equal(rowAtIndex(first, 10, BS)?.id, "r10");
});
