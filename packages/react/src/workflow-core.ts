/** Framework-independent contracts. All authorization and durable writes belong to the host. */
import { isTableRowHeight, type TableRowHeight } from "./table-rows.ts";
export type SortRule = { key: string; direction: "asc" | "desc" };
export type Selection =
  | { mode: "ids"; ids: readonly string[] }
  | { mode: "query"; token: string; count: number };
export function selectionCount(value: Selection) {
  if (
    value.mode === "query" &&
    (!value.token || !Number.isSafeInteger(value.count) || value.count < 0)
  )
    throw Error("筛选快照或数量无效");
  return value.mode === "ids" ? new Set(value.ids).size : value.count;
}
export type BatchResult = {
  succeeded: number;
  failures: readonly { id: string; message: string }[];
};
export type TablePreferences = {
  density: "comfortable" | "compact";
  columns: string[];
  hidden: string[];
  pinned?: string;
  pageSize: number;
  /** Row height the user picked in TablePreferencesMenu (rowHeightControl); overrides DataTable rowHeight. */
  rowHeight?: TableRowHeight;
};
export function normalizePreferences(
  value: TablePreferences,
  keys: readonly string[],
): TablePreferences {
  const columns = [
    ...new Set([...value.columns.filter((k) => keys.includes(k)), ...keys]),
  ];
  const hidden = [...new Set(value.hidden.filter((k) => columns.includes(k)))];
  return {
    density: value.density === "compact" ? "compact" : "comfortable",
    columns,
    hidden: hidden.length === columns.length ? hidden.slice(1) : hidden,
    pinned: keys.includes(value.pinned ?? "") ? value.pinned : undefined,
    pageSize: [10, 20, 25, 50, 100].includes(value.pageSize)
      ? value.pageSize
      : 20,
    ...(isTableRowHeight(value.rowHeight) ? { rowHeight: value.rowHeight } : {}),
  };
}
export type SavedView<T> = {
  id: string;
  name: string;
  value: T;
  shared?: boolean;
  isDefault?: boolean;
  editable?: boolean;
};
export type StoreAdapter<T> = {
  load: (key: string, signal: AbortSignal) => Promise<T | null>;
  save: (key: string, value: T, signal: AbortSignal) => Promise<void>;
  remove: (key: string, signal: AbortSignal) => Promise<void>;
};
/** Preferences only. The caller must explicitly validate and exclude sensitive query fields. */
export function browserPreferenceStore<T>(
  validate: (input: unknown) => input is T,
): StoreAdapter<T> {
  return {
    async load(key) {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (!validate(data)) throw Error("偏好格式已变更，请恢复默认");
      return data;
    },
    async save(key, value) {
      if (!validate(value)) throw Error("偏好格式不正确");
      localStorage.setItem(key, JSON.stringify(value));
    },
    async remove(key) {
      localStorage.removeItem(key);
    },
  };
}
export function viewUrl(base: string, value: unknown) {
  const url = new URL(base);
  url.searchParams.set("view", JSON.stringify(value));
  return url.toString();
}
export function readViewUrl<T>(
  url: string,
  validate: (value: unknown) => value is T,
): T | null {
  try {
    const raw = new URL(url).searchParams.get("view");
    if (!raw || raw.length > 16000) return null;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : null;
  } catch {
    return null;
  }
}
export type AdminTask = {
  id: string;
  title: string;
  status: "queued" | "running" | "success" | "failed" | "cancelled";
  progress?: number;
  error?: string;
  resultUrl?: string;
  cancellable?: boolean;
  retryable?: boolean;
  updatedAt?: string;
};
export type TaskAdapter = {
  list: (signal: AbortSignal) => Promise<AdminTask[]>;
  cancel?: (id: string, signal: AbortSignal) => Promise<void>;
  retry?: (id: string, signal: AbortSignal) => Promise<void>;
};
export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target?: string;
  at: string;
  detail?: string;
  changes?: readonly { field: string; before: string; after: string }[];
};
export function safeDownloadUrl(value: string): string | undefined {
  try {
    const url = new URL(value, "https://admin.invalid");
    return ["https:", "http:"].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}
export type ImportRow = Record<string, string>;
export type ImportIssue = { row: number; field: string; message: string };
/** RFC4180-style quoted CSV, including CRLF and embedded newlines; bounded client preview. */
export function parseCsv(
  text: string,
  maxRows = 1000,
): { headers: string[]; rows: ImportRow[] } {
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const pushField = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  const pushRow = () => {
    pushField();
    records.push(row);
    row = [];
    if (records.length > maxRows + 1)
      throw Error(`最多预览 ${maxRows} 行，大文件请走服务端导入任务`);
  };
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
      continue;
    }
    if (char === ",") pushField();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      pushRow();
    } else if (char === '"' && field === "" && !closed) quoted = true;
    else {
      if (closed || char === '"') throw Error("CSV 引号格式不正确");
      field += char;
    }
  }
  if (quoted) throw Error("CSV 引号未闭合");
  if (field || row.length || closed) pushRow();
  const headers = records.shift()?.map((x) => x.trim()) ?? [];
  if (
    !headers.length ||
    headers.some((x) => !x) ||
    new Set(headers).size !== headers.length
  )
    throw Error("表头不能为空或重复");
  const rows = records
    .filter((r) => !(r.length === 1 && r[0] === ""))
    .map((r, i) => {
      if (r.length !== headers.length)
        throw Error(`第 ${i + 2} 行列数与表头不一致`);
      return Object.fromEntries(headers.map((h, n) => [h, r[n]!]));
    });
  return { headers, rows };
}
