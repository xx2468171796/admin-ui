"use client";
import { createContext } from "react";

/**
 * Upper bound on RowActionBar's inline buttons set by a container (DataTable's phone cards = 0: every row
 * action goes into ⋯). Internal: not exported from the package.
 */
export const RowActionLimitContext = /* @__PURE__ */ createContext<number | null>(null);
