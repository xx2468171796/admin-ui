/**
 * Parts of BitableGrid that are not on the first paint: the cell editors (text / select / date picker / rating …)
 * load once the grid can edit (on idle after mount, or on the first edit), the conflict notice when a save conflicts.
 */
import type { ReactNode } from "react";
import { lazyPart } from "./lazy-part.ts";
import type { GridEditorProps } from "./grid-editors.tsx";
import type { EditConflictNoticeProps } from "./edit-conflict.tsx";

export const cellEditor = /* @__PURE__ */ lazyPart(() => import("./grid-editors.tsx").then((m) => m.GridCellEditor));
export const GridCellEditor = cellEditor.Part as <T>(props: GridEditorProps<T>) => ReactNode;
const conflictNotice = /* @__PURE__ */ lazyPart(() => import("./edit-conflict.tsx").then((m) => m.EditConflictNotice));
export const EditConflictNotice = conflictNotice.Part as (props: EditConflictNoticeProps) => ReactNode;
