import assert from "node:assert/strict";
import test from "node:test";
import { installHookRuntime, renderHook } from "./hook-runtime.ts";
import type { ListQuery, ListResult } from "../src/contracts.ts";

installHookRuntime();
const { useDataSource, useCursorDataSource, listQueryKey, pageOverflow } = await import("../src/data-sources.ts");
const { usePersistentState, useAdminEvents } = await import("../src/workflow-hooks.ts");
const { useUtilityWidths, useOverflowing } = await import("../src/table-measure.ts");

type Row = { id: string };
type Filters = { since: Date; big: bigint };
const query = (page = 1): ListQuery<Filters> => ({ page, pageSize: 10, search: "", filters: { since: new Date(Date.UTC(2026, 0, 2)), big: 12345678901234567890n } });

test("useDataSource: an inline adapter (new function every render) loads once, not in a loop", async () => {
  let calls = 0;
  const view = renderHook(
    (q: ListQuery<Filters>) =>
      useDataSource<Row, Filters>(async () => {
        calls++;
        return { rows: [{ id: "a" }], total: 1 };
      }, q),
    query(),
  );
  await view.settle();
  assert.equal(calls, 1, `adapter called ${calls} times`);
  assert.equal(view.result.data?.total, 1);
  // A re-render with an equal (but new) query object and a new inline adapter does not refetch either.
  view.rerender(query());
  await view.settle();
  assert.equal(calls, 1);
  view.rerender(query(2));
  await view.settle();
  assert.equal(calls, 2, "a changed query still reloads");
  view.unmount();
});

test("useDataSource: the adapter gets the original query (Date stays Date, bigint does not throw)", async () => {
  const seen: ListQuery<Filters>[] = [];
  const adapter = async (q: ListQuery<Filters>): Promise<ListResult<Row>> => {
    seen.push(q);
    return { rows: [], total: 0 };
  };
  const view = renderHook((q: ListQuery<Filters>) => useDataSource<Row, Filters>(adapter, q), query());
  await view.settle();
  assert.equal(view.result.error, undefined);
  assert.ok(seen[0]?.filters.since instanceof Date, "Date reached the adapter as a Date");
  assert.equal(seen[0]?.filters.big, 12345678901234567890n);
  assert.notEqual(listQueryKey({ at: new Date(1) }), listQueryKey({ at: new Date(2) }));
  assert.equal(listQueryKey({ n: 1n }), listQueryKey({ n: 1n }));
  view.unmount();
});

test("useDataSource: a memoized adapter that changed still reloads (legacy behaviour kept)", async () => {
  let version = 1;
  const calls: number[] = [];
  const make = (v: number) => async (): Promise<ListResult<Row>> => {
    calls.push(v);
    return { rows: [], total: 0 };
  };
  let adapter = make(version);
  const q = query();
  const view = renderHook(() => useDataSource<Row, Filters>(adapter, q), null);
  await view.settle();
  adapter = make(++version);
  view.rerender(null);
  await view.settle();
  assert.deepEqual(calls, [1, 2]);
  view.unmount();
});

test("useCursorDataSource: an inline adapter loads once", async () => {
  let calls = 0;
  const view = renderHook(
    () =>
      useCursorDataSource<Row, Record<string, string>>(async () => {
        calls++;
        return { rows: [], hasMore: false };
      }, { limit: 10, search: "", filters: {} }),
    null,
  );
  await view.settle();
  assert.equal(calls, 1);
  view.unmount();
});

test("useDataSource: past the last page after deletes → onPageOverflow(last page)", async () => {
  assert.equal(pageOverflow(3, 20, 10), 2);
  assert.equal(pageOverflow(2, 20, 10), null);
  assert.equal(pageOverflow(3, 0, 10), null, "an empty list stays on its page");
  const moved: number[] = [];
  const view = renderHook(
    (q: ListQuery<Filters>) => useDataSource<Row, Filters>(async () => ({ rows: [], total: 11 }), q, { onPageOverflow: (p) => moved.push(p) }),
    query(3),
  );
  await view.settle();
  assert.deepEqual(moved, [2]);
  view.unmount();
});

test("usePersistentState: an inline adapter object loads once", async () => {
  let loads = 0;
  const view = renderHook(
    () =>
      usePersistentState("k", 0, {
        load: async () => {
          loads++;
          return 5;
        },
        save: async () => {},
        remove: async () => {},
      }),
    null,
  );
  await view.settle();
  assert.equal(loads, 1);
  assert.equal(view.result.value, 5);
  view.unmount();
});

test("usePersistentState: save gets a signal that aborts on unmount, errors read cleanly", async () => {
  let signal: AbortSignal | undefined;
  const adapter = {
    load: async () => 1,
    save: async (_k: string, _v: number, s: AbortSignal) => {
      signal = s;
      throw { code: 500 };
    },
    remove: async () => {},
  };
  const view = renderHook(() => usePersistentState("k", 0, adapter), null);
  await view.settle();
  view.result.setValue(2);
  await view.settle();
  assert.equal(view.result.error, "操作没成功，请重试", "no [object Object]");
  assert.equal(signal?.aborted, false);
  view.unmount();
  assert.equal(signal?.aborted, true);
});

test("useAdminEvents: an inline subscribe function subscribes once", async () => {
  let subscriptions = 0;
  const view = renderHook(
    () =>
      useAdminEvents(
        () => {
          subscriptions++;
        },
        () => {},
      ),
    null,
  );
  view.rerender(null);
  view.rerender(null);
  await view.settle();
  assert.equal(subscriptions, 1);
  view.unmount();
});

test("DataTable measurements re-run when the table comes back from cards (phone → desktop)", async () => {
  const listeners: string[] = [];
  Object.assign(globalThis, { window: { addEventListener: (t: string) => listeners.push(t), removeEventListener: () => {} } });
  try {
    const cell = (width: number) => ({ getBoundingClientRect: () => ({ width }) }) as unknown as HTMLElement;
    const refs = { expand: { current: null as HTMLElement | null }, select: { current: null as HTMLElement | null }, record: { current: null as HTMLElement | null } };
    const box = { current: null as HTMLElement | null };
    const view = renderHook((cards: boolean) => [useUtilityWidths(refs, !cards, "x"), useOverflowing(box, !cards)] as const, true as boolean);
    await view.settle();
    refs.select.current = cell(52);
    box.current = { scrollWidth: 900, clientWidth: 400, firstElementChild: null } as unknown as HTMLElement;
    view.rerender(false);
    await view.settle();
    assert.equal(view.result[0].select, 52, "select column width measured after cards → table");
    assert.equal(view.result[1], true, "overflow measured after cards → table");
    view.unmount();
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
