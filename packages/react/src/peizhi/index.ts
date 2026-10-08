"use client";
/**
 * `@adminui/react/peizhi` — the 字典 / 参数 pages for the peizhi package (dictionaries + system
 * parameters). Wired through a `PeizhiApi` (`createPeizhiApi({ baseUrl: "/api/peizhi" })`); mount them as
 * pages or as AccessConsole `extraSections`. The server re-checks every change.
 * Values are listed explicitly; every type stays public through `export type *`.
 */
export type * from "./contracts.ts";
export type * from "./api.ts";
export type * from "./core.ts";
export { PEIZHI_CODES } from "./contracts.ts";
export { createPeizhiApi } from "./api.ts";
export { parseParamDraft, paramValueText, groupParams } from "./core.ts";
export { DictManager, TonePicker, ConfigHistoryDialog, type DictManagerProps } from "./dict-manager.tsx";
export { ParamManager, ParamEditor, type ParamManagerProps } from "./param-manager.tsx";
