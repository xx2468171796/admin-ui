/**
 * Server-side grouping for BitableGrid's `loadGroups` (bt/grid-a G4) — the SQL half, next to
 * buildGridSql (`@adminui/react/grid-query`, no React). One statement per group level gives every
 * group's key, record count and summaries, ordered exactly like the rows buildGridSql pages (group
 * levels first), so the grid can put group headers between server blocks.
 *
 *   const plan = buildGridGroupSql(query, COLUMNS, { dialect: 'pg', summaries });
 *   const results = [];
 *   for (const level of plan.levels)
 *     results.push(await db.query(`SELECT ${level.select} FROM deals d WHERE ${plan.where || 'true'}
 *       GROUP BY ${level.groupBy} ORDER BY ${level.orderBy}`, plan.params));
 *   return gridGroupsFromSql(results, plan, FIELDS);          // → { groups }
 *
 * Unit-tested in test/grid-group-core.test.ts.
 */
import { formatNumber } from "./dashboard-core.ts";
import { formatDateTime, formatMinorMoney } from "./format.ts";
import { toMinor, valueText, type GridField, type GridSummaryKind } from "./grid-core.ts";
import type { GridGroupsResult, GridQuery } from "./grid-data-core.ts";
import type { GridGroupNode } from "./grid-group-core.ts";
import { coreType } from "./grid-field-types.ts";
import { buildGridSql, groupColumnSql, groupOrderTerms, type GridSqlColumn, type GridSqlOptions } from "./grid-sql.ts";

export type GridGroupSqlLevel = {
  /** Field grouped at this level (the last key of each row's path). */
  field: string;
  /** SELECT list: g0 … gN (group keys as text), n (count), s0 … (summaries). */
  select: string;
  groupBy: string;
  orderBy: string;
};
export type GridGroupSqlPlan = {
  /** Same WHERE + params as buildGridSql for this query ("" = no condition). */
  where: string;
  params: unknown[];
  levels: GridGroupSqlLevel[];
  /** Which summary each `s<i>` column holds. */
  summaries: { alias: string; field: string; kind: GridSummaryKind }[];
};

const AGGREGATES = new Set<GridSummaryKind>(["sum", "avg", "min", "max", "filled", "empty", "unique"]);

/**
 * Plan the group queries of a validated query with `groups` (parseGridQuery first). Unknown level
 * fields are skipped; `summaries` (field → kind) become aggregate columns.
 */
export function buildGridGroupSql(query: GridQuery, columns: Readonly<Record<string, GridSqlColumn>>, options: GridSqlOptions & { summaries?: Record<string, GridSummaryKind> }): GridGroupSqlPlan {
  const { where, params } = buildGridSql({ ...query, sort: [], groups: [] }, columns, options);
  const levels = (query.groups ?? []).filter((level) => columns[level.field]);
  const dialect = options.dialect;
  const summaries: GridGroupSqlPlan["summaries"] = [];
  const aggregates: string[] = [];
  for (const [field, kind] of Object.entries(options.summaries ?? {})) {
    const column = columns[field];
    if (!column || !AGGREGATES.has(kind)) continue;
    const alias = `s${summaries.length}`;
    summaries.push({ alias, field, kind });
    aggregates.push(`${aggregateSql(column, kind, dialect)} AS ${alias}`);
  }
  const sqls = levels.map((level) => ({ level, sql: groupColumnSql(columns[level.field]!, dialect, options) }));
  return {
    where,
    params,
    summaries,
    levels: sqls.map((_, depth) => {
      const upto = sqls.slice(0, depth + 1);
      return {
        field: sqls[depth]!.level.field,
        select: [...upto.map(({ sql }, i) => `${sql.key} AS g${i}`), "COUNT(*) AS n", ...aggregates].join(", "),
        groupBy: upto.map(({ sql }) => sql.group).join(", "),
        orderBy: upto.flatMap(({ sql, level }) => groupOrderTerms(sql, level.order)).join(", "),
      };
    }),
  };
}

function aggregateSql(column: GridSqlColumn, kind: GridSummaryKind, dialect: GridSqlOptions["dialect"]): string {
  const c = column.sql;
  const text = dialect === "pg" ? `${c}::text` : dialect === "mysql" ? `CAST(${c} AS CHAR)` : `CAST(${c} AS TEXT)`;
  const type = coreType(column);
  const filled = type === "checkbox" ? `SUM(CASE WHEN ${c} THEN 1 ELSE 0 END)` : type === "number" || type === "money" || type === "date" || type === "datetime" ? `COUNT(${c})` : `SUM(CASE WHEN COALESCE(${text}, '') <> '' THEN 1 ELSE 0 END)`;
  switch (kind) {
    case "sum":
      return `SUM(${c})`;
    case "avg":
      return `AVG(${c})`;
    case "min":
      return `MIN(${c})`;
    case "max":
      return `MAX(${c})`;
    case "filled":
      return filled;
    case "empty":
      return `(COUNT(*) - ${filled})`;
    default:
      return `COUNT(DISTINCT ${c})`;
  }
}

/** Display text of a raw aggregate, formatted like the grid's own summaries (money in minor units). */
export function formatGroupSummary<T>(field: GridField<T>, kind: GridSummaryKind, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return kind === "sum" || kind === "avg" || kind === "min" || kind === "max" ? "—" : "0";
  if (kind === "count" || kind === "filled" || kind === "empty" || kind === "unique") return formatNumber(Number(raw));
  const type = coreType(field);
  if (type === "money") {
    const text = typeof raw === "number" ? raw.toFixed(6) : String(raw);
    const [whole = "0", frac = ""] = text.split(".");
    let minor = toMinor(whole.replace(/^\+/, "")) ?? 0n;
    if (Number(`0.${frac || "0"}`) >= 0.5) minor += whole.startsWith("-") ? -1n : 1n; // half away from zero (avg)
    return formatMinorMoney(minor, { symbol: field.currency ?? "", digits: field.precision });
  }
  if ((type === "date" || type === "datetime") && (kind === "min" || kind === "max"))
    return formatDateTime(raw as string, { time: type === "datetime", timeZone: field.timeZone }) ?? "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return formatNumber(n, { digits: kind === "avg" ? Math.max(field.precision ?? 2, 2) : field.precision ?? 2 });
}

/**
 * Rows of the level queries (in plan.levels order) → the `loadGroups` answer. `maxGroups` caps the
 * nodes (default 2000; `truncated` tells the grid).
 */
export function gridGroupsFromSql<T>(results: readonly (readonly Record<string, unknown>[])[], plan: GridGroupSqlPlan, fields: readonly GridField<T>[], maxGroups = 2000): GridGroupsResult {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const groups: GridGroupNode[] = [];
  let truncated = false;
  results.forEach((rows, depth) => {
    for (const row of rows) {
      if (groups.length >= maxGroups) { truncated = true; return; }
      const path = Array.from({ length: depth + 1 }, (_, i) => (row[`g${i}`] === null || row[`g${i}`] === undefined ? "" : String(row[`g${i}`])));
      const summaries: Record<string, string> = {};
      for (const { alias, field, kind } of plan.summaries) {
        const def = byKey.get(field);
        if (def) summaries[field] = formatGroupSummary(def, kind, row[alias]);
      }
      // Number / money keys come back raw (money in minor units): label them like the grid shows the value.
      const level = byKey.get(plan.levels[depth]?.field ?? "");
      const key = path[depth] ?? "";
      const type = level ? coreType(level) : undefined;
      const label = level && key !== "" && (type === "number" || type === "money") ? valueText(level, key) : "";
      groups.push({ path, count: Number(row.n) || 0, ...(label ? { label } : {}), ...(plan.summaries.length ? { summaries } : {}) });
    }
  });
  return truncated ? { groups, truncated } : { groups };
}
