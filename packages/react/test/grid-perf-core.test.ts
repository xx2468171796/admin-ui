// Grid performance fixes: one shared ResizeObserver for chip cells, document pointer listeners only while dragging.
import test from "node:test";
import assert from "node:assert/strict";
import { createSharedResizeObserver } from "../src/grid-shared-resize.ts";
import { createPointerDrag } from "../src/grid-controls-core.ts";

test("chip cells share one ResizeObserver; each element gets its own callback", () => {
  const instances: FakeObserver[] = [];
  class FakeObserver {
    watched = new Set<Element>();
    callback: (entries: readonly { target: Element }[]) => void;
    constructor(callback: (entries: readonly { target: Element }[]) => void) {
      this.callback = callback;
      instances.push(this);
    }
    observe(target: Element) { this.watched.add(target); }
    unobserve(target: Element) { this.watched.delete(target); }
  }
  const observeSize = createSharedResizeObserver(FakeObserver);
  const nodes = [{}, {}, {}] as Element[];
  const hits: number[] = [];
  const stops = nodes.map((node, i) => observeSize(node, () => hits.push(i)));
  assert.equal(instances.length, 1, "one observer for any number of cells");
  instances[0]?.callback([{ target: nodes[2]! }, { target: nodes[0]! }]);
  assert.deepEqual(hits, [2, 0]);
  stops[1]?.();
  assert.equal(instances[0]?.watched.size, 2);
  assert.equal(createSharedResizeObserver(undefined)(nodes[0]!, () => undefined)(), undefined, "no ResizeObserver (SSR): no-op");
});

test("range-drag pointer listeners are attached on pointerdown and removed on pointerup only", () => {
  const listeners = new Map<string, number>();
  let added = 0;
  const target = {
    addEventListener: (type: string) => { added++; listeners.set(type, (listeners.get(type) ?? 0) + 1); },
    removeEventListener: (type: string) => { listeners.set(type, (listeners.get(type) ?? 0) - 1); },
  };
  const moves: number[] = [];
  let ups = 0;
  const drag = createPointerDrag<number>(target, { move: (x) => moves.push(x), up: () => { ups++; } });
  assert.equal(added, 0, "nothing attached until a drag starts (renders never touch document listeners)");
  drag.start();
  drag.start();
  assert.equal(listeners.get("pointermove"), 1);
  assert.equal(drag.active, true);
  drag.stop();
  assert.equal(listeners.get("pointermove"), 0);
  assert.equal(listeners.get("pointerup"), 0);
  assert.equal(ups, 0);
  assert.equal(added, 2);
});
