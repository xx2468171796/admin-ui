export type ReportFilter = { start: string; end: string; source: string };

/** Dates are calendar days, inclusive. The host chooses timezone, freshness and aggregates. */
export function validateReportRange(
  { start, end }: Pick<ReportFilter, "start" | "end">,
  maxDays = 366,
) {
  const parse = (day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const time = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === day
      ? time
      : null;
  };
  const first = parse(start),
    last = parse(end);
  if (first === null || last === null) return "请选择有效的开始日期和结束日期";
  if (first > last) return "开始日期不能晚于结束日期";
  if ((last - first) / 86400000 + 1 > maxDays)
    return `一次查询最多 ${maxDays} 天`;
  return null;
}

export type CsvColumn<T> = {
  title: string;
  value: (row: T) => string | number | bigint | null;
  type?: "text" | "number";
};
/** Export only rows the host provides; large/unbounded reports should use a server export job. */
export function buildCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
) {
  const cell = (
    value: string | number | bigint | null,
    type: "text" | "number" = "text",
  ) => {
    let text = value === null ? "" : String(value);
    if (type === "number" && text !== "" && !/^-?\d+(\.\d+)?$/.test(text))
      throw Error("CSV 数值列包含无效数值");
    if (type === "text" && /^[\s\u0000-\u001f]*[=+\-@\t\r\n]/.test(text))
      text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return (
    "\ufeff" +
    [
      columns.map((c) => cell(c.title)),
      ...rows.map((row) => columns.map((c) => cell(c.value(row), c.type))),
    ]
      .map((line) => line.join(","))
      .join("\r\n")
  );
}
export function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    (name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80) || "报表") +
    ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
