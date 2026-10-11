/**
 * Keyboard of BitableGrid in navigation mode (an open editor handles its own keys). `gridKeyCommand` is the pure
 * dispatcher: a key on a cell + what that cell is → one command (unit-tested in test/grid-keyboard.test.ts);
 * the grid runs the command. IME keys are no command (the composition opens the editor, grid-capture-core.ts).
 */
import { moveGridCell } from "./grid-core.ts";
import { gridKeyAction, type GridCellRef } from "./grid-edit-core.ts";
import { isComposingEvent } from "./ime.ts";

/** What the focused cell is (the grid fills this in from its model). */
export type GridKeyFacts = {
  here: GridCellRef;
  /** Item rows (group / add / record / loading), then the summary row when there is one. */
  count: number;
  rowCount: number;
  colCount: number;
  /** Rows per Page Up / Down. */
  page: number;
  column: "field" | "row" | "actions" | "add" | "other";
  item: "row" | "group" | "add" | "loading" | null;
  itemError?: boolean;
  /** Editing is on (onCellsChange) / this cell can be edited / its field is a checkbox. */
  editingEnabled: boolean;
  editable: boolean;
  checkbox: boolean;
  selectable: boolean;
  canSelectRow: boolean;
  canExpand: boolean;
  canInsertRows: boolean;
  hasAnchor: boolean;
  footerAdd: boolean;
  summary: boolean;
};

export type GridKeyCommand =
  | { kind: "resizeColumn"; delta: number }
  | { kind: "contextMenu" }
  | { kind: "moveRow"; delta: -1 | 1 }
  | { kind: "move"; to: GridCellRef; extend: boolean }
  | { kind: "insertRow"; position: "above" | "below" }
  | { kind: "openRecord" }
  | { kind: "fillDown" }
  | { kind: "addField" }
  | { kind: "addRow" }
  | { kind: "footerAdd" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "selectAll" }
  | { kind: "clearAnchor" }
  | { kind: "clear" }
  | { kind: "type"; text: string }
  | { kind: "toggleRow"; shift: boolean }
  | { kind: "headerMenu" }
  | { kind: "toggleAll" }
  | { kind: "summaryPicker" }
  | { kind: "toggleGroup" }
  | { kind: "retry" }
  | { kind: "clickAction" }
  | { kind: "toggleCheckbox" }
  | { kind: "edit" }
  /** Enter on a cell that cannot be edited: into its links / buttons, else open the record. */
  | { kind: "enterCell" }
  /** Nothing happens (the key's default is still prevented). */
  | { kind: "noop" };

type KeyInput = { key: string; shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; keyCode?: number; isComposing?: boolean };

/** Column resize, menus, record moves and cursor moves (the keys that work on every cell). */
function navigationCommand(event: KeyInput, f: GridKeyFacts): GridKeyCommand | null {
  const { here } = f;
  if (event.altKey && here.row === -1 && f.column === "field" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return { kind: "resizeColumn", delta: event.key === "ArrowLeft" ? -16 : 16 };
  // bt/grid-b: Shift + F10 / menu key → header or cell menu; Alt + Shift + ↑ / ↓ moves the record.
  if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") return { kind: "contextMenu" };
  if (event.altKey && event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) return { kind: "moveRow", delta: event.key === "ArrowUp" ? -1 : 1 };
  const next = moveGridCell(here, event.key, { rows: f.rowCount, cols: f.colCount, page: f.page }, { ctrl: Boolean(event.ctrlKey || event.metaKey) });
  if (!next) return null;
  const extend = Boolean(event.shiftKey) && here.row >= 0 && here.row < f.count && next.row >= 0 && next.row < f.count;
  return { kind: "move", to: next, extend };
}

/** Enter / F2 / Space on the header, summary row, group rows and the special columns, then on records. */
function activateCommand(action: "edit" | "expand", f: GridKeyFacts, shift: boolean): GridKeyCommand | null {
  const { here } = f;
  if (here.row === -1 && f.column === "field") return action === "edit" ? { kind: "headerMenu" } : { kind: "noop" };
  if (here.row === -1 && f.column === "row" && f.selectable && action === "expand") return { kind: "toggleAll" };
  if (here.row === f.count && f.footerAdd && f.column === "row") return { kind: "footerAdd" };
  if (here.row === f.count && f.summary && f.column === "field") return { kind: "summaryPicker" };
  if (!f.item) return null;
  if (f.item === "group") return { kind: "toggleGroup" };
  if (f.item === "loading") return f.itemError ? { kind: "retry" } : { kind: "noop" };
  if (f.item === "add") return { kind: "noop" };
  if (f.column === "row") return action === "expand" && f.selectable && f.canSelectRow ? { kind: "toggleRow", shift } : { kind: "openRecord" };
  if (f.column === "actions") return { kind: "clickAction" };
  if (action === "expand") return { kind: "openRecord" };
  // Enter / F2: edit → toggle checkbox → go into the cell's links / chips → open the record.
  if (f.editable) return f.checkbox ? { kind: "toggleCheckbox" } : { kind: "edit" };
  return { kind: "enterCell" };
}

/** The command for a key on a cell, or null (not a grid key: the browser's default). */
export function gridKeyCommand(event: KeyInput, f: GridKeyFacts): GridKeyCommand | null {
  // IME composition in the input capture: arrows / Enter / Esc belong to the candidate list.
  if (isComposingEvent(event)) return null;
  const nav = navigationCommand(event, f);
  if (nav) return nav;
  let action = gridKeyAction(event);
  if (!action) return null;
  // bt/grid-b: insert / open / fill-down shortcuts; Shift + Enter stays 「edit」 when rows cannot be inserted.
  if (action === "insertBelow" || action === "insertAbove") {
    if (f.canInsertRows && f.item === "row") return { kind: "insertRow", position: action === "insertAbove" ? "above" : "below" };
    if (action === "insertAbove") return null;
    action = "edit";
  }
  if (action === "openRecord") return f.item === "row" && f.canExpand ? { kind: "openRecord" } : null;
  if (action === "fillDown") return { kind: "fillDown" };
  if (f.column === "add" && f.here.row === -1 && (action === "edit" || action === "expand")) return { kind: "addField" };
  if (f.item === "add" && (action === "edit" || action === "expand")) return { kind: "addRow" };
  switch (action) {
    case "undo":
    case "redo":
      return f.editingEnabled ? { kind: action } : null;
    case "selectAll":
      return f.count ? { kind: "selectAll" } : null;
    case "escape":
      return f.hasAnchor ? { kind: "clearAnchor" } : null;
    case "clear":
      return f.item && f.editingEnabled ? { kind: "clear" } : null;
    case "type":
      return f.column === "field" && f.item === "row" && f.editable && !f.checkbox ? { kind: "type", text: event.key } : null;
    case "toggleRow":
      return f.item === "row" && f.selectable && f.canSelectRow ? { kind: "toggleRow", shift: false } : null;
    default:
      return activateCommand(action, f, Boolean(event.shiftKey));
  }
}
