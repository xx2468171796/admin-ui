/**
 * Data port of the dictionary / parameter pages: one method per peizhi/fastify route, plus
 * `createPeizhiApi` (fetch). Errors are AccessApiError-compatible (`{ status, code, message, field? }`).
 * `history` is optional: peizhi hands change events to the host (`onChange`), so only a host that
 * stores them can serve「改动记录」.
 */
import { AccessApiError, readAccessError } from "../access/console-api.ts";
import type { ConfigChangeEvent, CustomParamInput, DictItemDto, DictItemInput, DictItemPatch, DictTypeDto, DictTypeInput, DictTypePatch, ParamDto } from "./contracts.ts";

type Signal = AbortSignal | undefined;

export type PeizhiApi = {
  listDictTypes(signal?: Signal): Promise<DictTypeDto[]>;
  createDictType(input: DictTypeInput, signal?: Signal): Promise<DictTypeDto>;
  updateDictType(code: string, patch: DictTypePatch, signal?: Signal): Promise<DictTypeDto>;
  deleteDictType(code: string, signal?: Signal): Promise<void>;
  restoreDictType(code: string, signal?: Signal): Promise<unknown>;
  listDictItems(type: string, signal?: Signal): Promise<DictItemDto[]>;
  createDictItem(type: string, input: DictItemInput, signal?: Signal): Promise<DictItemDto>;
  updateDictItem(type: string, value: string, patch: DictItemPatch, signal?: Signal): Promise<DictItemDto>;
  deleteDictItem(type: string, value: string, signal?: Signal): Promise<void>;
  restoreDictItem(type: string, value: string, signal?: Signal): Promise<unknown>;
  listParams(signal?: Signal): Promise<ParamDto[]>;
  createParam(input: CustomParamInput, signal?: Signal): Promise<ParamDto>;
  setParam(key: string, value: unknown, signal?: Signal): Promise<ParamDto>;
  resetParam(key: string, signal?: Signal): Promise<ParamDto>;
  deleteParam(key: string, signal?: Signal): Promise<void>;
  /** Change history of one target (dict type code, `type/value`, or param key) — host-provided. */
  history?(target: { kind: ConfigChangeEvent["kind"]; target: string }, signal?: Signal): Promise<ConfigChangeEvent[]>;
};

export type CreatePeizhiApiOptions = {
  /** Where peizhiFastify is registered, e.g. "/api/peizhi". */
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: () => Record<string, string> | undefined;
  credentials?: RequestCredentials;
  /** Optional history endpoint of the host: GET `${historyUrl}?kind=&target=` → ConfigChangeEvent[]. */
  historyUrl?: string;
};

const enc = encodeURIComponent;

export function createPeizhiApi(options: CreatePeizhiApiOptions): PeizhiApi {
  const base = options.baseUrl.replace(/\/$/, "");
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  async function call<T>(method: string, url: string, body?: unknown, signal?: Signal): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        credentials: options.credentials ?? "same-origin",
        headers: { accept: "application/json", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(options.headers?.() ?? {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") throw e;
      throw new AccessApiError(0, { code: "NETWORK", message: "连不上服务器，请检查网络后重试" });
    }
    if (!res.ok) throw await readAccessError(res);
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const none = async (p: Promise<unknown>) => {
    await p;
  };
  const d = (type: string) => `${base}/dicts/${enc(type)}`;
  return {
    listDictTypes: (s) => call("GET", `${base}/dicts`, undefined, s),
    createDictType: (input, s) => call("POST", `${base}/dicts`, input, s),
    updateDictType: (code, patch, s) => call("PATCH", d(code), patch, s),
    deleteDictType: (code, s) => none(call("DELETE", d(code), undefined, s)),
    restoreDictType: (code, s) => call("POST", `${d(code)}/restore`, {}, s),
    listDictItems: (type, s) => call("GET", `${d(type)}/items`, undefined, s),
    createDictItem: (type, input, s) => call("POST", `${d(type)}/items`, input, s),
    updateDictItem: (type, value, patch, s) => call("PATCH", `${d(type)}/items/${enc(value)}`, patch, s),
    deleteDictItem: (type, value, s) => none(call("DELETE", `${d(type)}/items/${enc(value)}`, undefined, s)),
    restoreDictItem: (type, value, s) => call("POST", `${d(type)}/items/${enc(value)}/restore`, {}, s),
    listParams: (s) => call("GET", `${base}/params`, undefined, s),
    createParam: (input, s) => call("POST", `${base}/params`, input, s),
    setParam: (key, value, s) => call("PUT", `${base}/params/${enc(key)}`, { value }, s),
    resetParam: (key, s) => call("POST", `${base}/params/${enc(key)}/reset`, {}, s),
    deleteParam: (key, s) => none(call("DELETE", `${base}/params/${enc(key)}`, undefined, s)),
    ...(options.historyUrl
      ? { history: (t: { kind: ConfigChangeEvent["kind"]; target: string }, s?: Signal) => call<ConfigChangeEvent[]>("GET", `${options.historyUrl}?kind=${enc(t.kind)}&target=${enc(t.target)}`, undefined, s) }
      : {}),
  };
}
