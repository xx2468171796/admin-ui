/**
 * The name a row's select checkbox is read out with (「选择 赵静怡」 instead of 「选择 3f2a…uuid」):
 * the host's `rowLabel`, else the first data column's text (its `truncate` text, or a string / number render),
 * else the row key.
 */
type LabelColumn<T> = {
  kind?: "data" | "actions";
  render: (row: T, context: { selected: boolean }) => unknown;
  truncate?: (row: T) => string;
};

export function defaultRowLabel<T>(row: T, columns: readonly LabelColumn<T>[], rowKey: (row: T) => string): string {
  const first = columns.find((column) => column.kind !== "actions");
  const text = first ? (first.truncate ? first.truncate(row) : first.render(row, { selected: false })) : null;
  if ((typeof text === "string" && text.trim()) || typeof text === "number") return String(text).trim();
  return rowKey(row);
}
