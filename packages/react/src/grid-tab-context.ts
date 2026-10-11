/**
 * One tab stop per grid: links, chips and buttons rendered inside BitableGrid cells take `tabIndex={-1}` at render
 * time (the grid provides -1 here; outside a grid the context is undefined and controls stay in the tab order).
 * Enter on a cell moves into its controls (the grid sets their tabIndex to 0 while inside).
 */
import { createContext, useContext } from "react";

export const GridInnerTabIndex = /* @__PURE__ */ createContext<number | undefined>(undefined);
/** tabIndex for a control inside a cell: -1 inside a grid, undefined elsewhere. */
export const useInnerTabIndex = () => useContext(GridInnerTabIndex);
