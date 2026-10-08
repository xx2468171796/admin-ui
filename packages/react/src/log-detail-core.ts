/**
 * Readable audit / log details (审阅 05: the expanded audit row showed raw keys like `lineId`, `ids` and JSON
 * to end users). Pure: the host gives labels for the keys people should read (and may format values,
 * e.g. resolve ids to names); everything without a label goes to a folded 「技术细节」 group.
 */

export type LogDetailEntry = { key: string; label: string; value: string };
export type ReadableDetailOptions = {
  /** key → label people read (「业务线」); keys without one are technical. */
  labels?: Readonly<Record<string, string>>;
  /** Host formatting for a labelled key (resolve an id to a name, a code to its label); undefined = default. */
  format?: (key: string, value: unknown) => string | undefined;
  /** Arrays longer than this read 「N 项」 (default 5); the full list stays in the technical group. */
  maxList?: number;
};

const isPrimitive = (value: unknown): value is string | number | boolean => ["string", "number", "boolean"].includes(typeof value);

/** One value as text: 是 / 否, thousands separators, short lists joined by 「、」, 「—」 for empty. */
export function detailValueText(value: unknown, maxList = 5): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return value.toLocaleString("zh-CN");
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    if (value.length > maxList || !value.every(isPrimitive)) return `${value.length} 项`;
    return value.map((item) => detailValueText(item, maxList)).join("、");
  }
  return JSON.stringify(value);
}

/** Split a detail object into what people read (labelled, in label order) and the technical rest (raw). */
export function readableDetail(detail: Readonly<Record<string, unknown>>, options: ReadableDetailOptions = {}): { shown: LogDetailEntry[]; technical: LogDetailEntry[] } {
  const labels = options.labels ?? {};
  const maxList = options.maxList ?? 5;
  const shown: LogDetailEntry[] = [];
  const technical: LogDetailEntry[] = [];
  const order = Object.keys(labels);
  const keys = Object.keys(detail).sort((a, b) => (order.includes(a) ? order.indexOf(a) : order.length) - (order.includes(b) ? order.indexOf(b) : order.length));
  for (const key of keys) {
    const value = detail[key];
    const label = labels[key];
    if (label) {
      shown.push({ key, label, value: options.format?.(key, value) ?? detailValueText(value, maxList) });
      if (Array.isArray(value) && value.length > maxList) technical.push({ key, label: key, value: JSON.stringify(value) });
    } else {
      technical.push({ key, label: key, value: typeof value === "string" ? value : JSON.stringify(value) ?? "—" });
    }
  }
  return { shown, technical };
}
