/**
 * Small pure rules of BitableGrid controls (unit-tested in test/grid-controls-core.test.ts):
 * - column resize: widths follow the pointer locally, the view is committed once when the drag ends;
 * - the header 「选择全部记录」 checkbox stays focusable while loading (aria-disabled, activation ignored) — a
 *   `disabled` control would drop keyboard focus to the page body.
 */

/** Widths of field columns that differ from `before` (TanStack's sizing update → view widths), or null. */
export function sizingChanges(before: Readonly<Record<string, number>>, next: Readonly<Record<string, number>>, isField: (key: string) => boolean): Record<string, number> | null {
  let out: Record<string, number> | null = null;
  for (const [key, width] of Object.entries(next)) if (isField(key) && before[key] !== width) (out ??= {})[key] = width;
  return out;
}

/** One column-resize drag: `update` on every pointer move (local only), `end` commits the widths once. */
export type ResizeSession = { update(widths: Readonly<Record<string, number>>): void; end(): void; readonly live: Readonly<Record<string, number>> | null };
export function createResizeSession(commit: (widths: Record<string, number>) => void): ResizeSession {
  let live: Record<string, number> | null = null;
  return {
    update(widths) {
      live = { ...live, ...widths };
    },
    end() {
      const widths = live;
      live = null;
      if (widths) commit(widths);
    },
    get live() {
      return live;
    },
  };
}

type DragEventType = "pointermove" | "pointerup";
type ListenerTarget<E> = { addEventListener(type: DragEventType, listener: (event: E) => void): void; removeEventListener(type: DragEventType, listener: (event: E) => void): void };
/**
 * Document pointer listeners that exist only while a drag runs (range selection): `start` on pointerdown adds
 * pointermove / pointerup, the pointerup (or `stop`) removes them — not an add / remove on every render.
 */
export function createPointerDrag<E>(target: ListenerTarget<E>, handlers: { move: (event: E) => void; up: (event: E) => void }) {
  let active = false;
  const move = (event: E) => handlers.move(event);
  const up = (event: E) => {
    stop();
    handlers.up(event);
  };
  function stop() {
    if (!active) return;
    active = false;
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
  }
  return {
    start() {
      if (active) return;
      active = true;
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
    },
    stop,
    get active() {
      return active;
    },
  };
}

/** The select-all checkbox: state, whether it is inert right now, and the selection a toggle asks for (null = ignored). */
export function selectAllControl(input: { interactive: boolean; selectable: readonly string[]; selected: readonly string[] }) {
  const { interactive, selectable, selected } = input;
  const chosen = new Set(selected);
  const checkedCount = selectable.filter((id) => chosen.has(id)).length;
  const inert = !interactive || selectable.length === 0;
  return {
    checked: checkedCount && checkedCount === selectable.length ? true : checkedCount ? ("indeterminate" as const) : false,
    /** Render as `aria-disabled` (never `disabled`): focus stays on it while the grid loads. */
    inert,
    toggle(on: boolean): string[] | null {
      if (inert) return null;
      const all = new Set(selectable);
      return on ? [...new Set([...selected, ...selectable])] : selected.filter((id) => !all.has(id));
    },
  };
}
