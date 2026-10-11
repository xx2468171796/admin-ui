// Server blocks: answers are validated, and a record that shifted between two blocks never shows twice.
import test from "node:test";
import assert from "node:assert/strict";
import { emptyBlockState, markLoading, receiveBlock, type GridBlockState } from "../src/grid-data-core.ts";
import { gridLoadProblem, shownRowAt, shownRows, visibleRowOffsets } from "../src/grid-data-view.ts";

type Row = { id: string };
const rowId = (row: Row) => row.id;
const rows = (...ids: string[]) => ids.map((id) => ({ id }));
const answer = (state: GridBlockState<Row>, block: number, list: Row[], total: number) =>
  receiveBlock(markLoading(state, [block]), { key: state.key, generation: state.generation, block, result: { rows: list, total }, rowId }, 30, 3);

test("a record in two blocks (rows shifted on the server between requests): the newer block wins, the older one is stale", () => {
  let state = emptyBlockState<Row>("q");
  state = answer(state, 0, rows("a", "b", "c"), 6);
  // A record was inserted before "c" on the server: block 1 now starts with "c".
  state = answer(state, 1, rows("c", "d", "e"), 7);
  assert.ok(state.outdated?.has(0), "the older block is refetched");
  const offsets = visibleRowOffsets(state, rowId, 3);
  assert.equal(offsets.get("c"), 3, "the newest copy of c is the one shown");
  assert.equal(shownRowAt(state, offsets, rowId, 2, 3), undefined, "the old copy shows as a placeholder");
  assert.equal(shownRowAt(state, offsets, rowId, 3, 3)?.id, "c");
  assert.deepEqual(shownRows(state, offsets, rowId, 3).map(rowId), ["a", "b", "c", "d", "e"], "every record once");
  // The stale block comes back: now it holds the newest copy.
  state = answer(state, 0, rows("a", "b", "x"), 7);
  const after = visibleRowOffsets(state, rowId, 3);
  assert.deepEqual(shownRows(state, after, rowId, 3).map(rowId), ["a", "b", "x", "c", "d", "e"]);
  assert.ok(!state.outdated?.has(0));
});

test("malformed data source answers are rejected (rows array, integer total ≥ 0)", () => {
  assert.equal(gridLoadProblem({ rows: [], total: 0 }), null);
  assert.match(gridLoadProblem({ rows: null, total: 3 }) ?? "", /rows/);
  assert.match(gridLoadProblem({ rows: [], total: 2.5 }) ?? "", /total/);
  assert.match(gridLoadProblem({ rows: [], total: -1 }) ?? "", /total/);
  assert.match(gridLoadProblem({ rows: [], total: "3" }) ?? "", /total/);
  assert.match(gridLoadProblem(undefined) ?? "", /对象/);
});
