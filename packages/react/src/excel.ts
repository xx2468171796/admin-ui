/** Optional subpath: no spreadsheet parser enters the root bundle. Reads cached values, never evaluates formulas. */
import { readSheet } from "read-excel-file/universal";
import { parseCsv, type ImportRow } from "./workflow-core.ts";
export async function parseSpreadsheet(
  file: File,
  signal: AbortSignal,
): Promise<{ headers: string[]; rows: ImportRow[] }> {
  signal.throwIfAborted();
  if (file.size > 2 * 1024 * 1024)
    throw Error("文件超过 2 MB，请使用服务端导入任务");
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    signal.throwIfAborted();
    return parseCsv(text);
  }
  if (!/\.xlsx$/i.test(file.name)) throw Error("请选择 CSV 或 XLSX 文件");
  const values = await readSheet(await file.arrayBuffer(), 1, {
    parseNumber: (value) => value,
  });
  signal.throwIfAborted();
  if (!values.length) throw Error("工作表为空");
  if (values.length > 1001 || values.some((row) => row.length > 100))
    throw Error("最多预览 1000 行、100 列，请使用服务端导入任务");
  const width = Math.max(...values.map((row) => row.length));
  return parseCsv(
    values
      .map((row) =>
        Array.from({ length: width }, (_, index) => {
          const cell = row[index];
          const text =
            cell instanceof Date
              ? cell.toISOString()
              : cell == null
                ? ""
                : String(cell);
          return `"${text.replaceAll('"', '""')}"`;
        }).join(","),
      )
      .join("\n"),
  );
}
