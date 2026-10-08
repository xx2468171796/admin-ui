/**
 * GridQuery → SQL fragments for a backend list endpoint (`@adminui/react/grid-query`): a WHERE
 * clause with bound parameters and an ORDER BY, for PostgreSQL, MySQL and SQLite. Column expressions
 * come from the server's own mapping (trusted); every user value is a parameter. Semantics follow the
 * client-side grid (empties sort last, money filters in major units, dates by day in a time zone);
 * search matches the raw column text (give `search` to match a label instead).
 * Unit-tested in test/grid-data-core.test.ts.
 */
import { runtimeTimeZone, utcOffsetOf } from "./admin-defaults.ts";
import { gridFilterOps, majorToMinor, searchTerms, type GridFieldType, type GridFilter } from "./grid-core.ts";
import { coreType, type GridFormulaResult } from "./grid-field-types.ts"; // bt/grid-b
import { gridQueryFilter, type GridQuery } from "./grid-data-core.ts";
// bt/grid-a: nested groups → parenthesized SQL, relative dates, dynamic values (「我」), group levels
import { conditionDayRange, conditionTreeSql, isDynamicValue, resolveDynamic, type ConditionContext } from "./condition-core.ts";
import { gridConditionKind } from "./grid-view-v2.ts";

export type GridSqlDialect = "pg" | "mysql" | "sqlite";
export type GridSqlColumn = {
  /** Column expression, e.g. `a.name` / `"createdAt"` (server-written, never user input). */
  sql: string;
  /** Extra types follow their base type (rating / progress / autoNumber → number, phone / link / lookup → text, createdAt → datetime …). */
  type: GridFieldType;
  /** formula: the type of the computed value (bt/grid-b). */
  resultType?: GridFormulaResult;
  /** Searched by the toolbar search (default: text-like types). */
  searchable?: boolean;
  /** Expression used for search instead of `sql` (e.g. a joined label column). */
  search?: string;
  /** singleSelect: option values in display order (sorting follows it, like the grid). */
  options?: readonly string[];
  /** multiSelect / user on PostgreSQL: the column is a text[] (`&&` / `@>`). Otherwise give `filter`. */
  array?: boolean;
  /** Custom condition for this column; return null to use the default (dynamic values arrive resolved). */
  filter?: (filter: GridFilter, param: (value: unknown) => string) => string | null;
  sortable?: boolean;
  // bt/grid-a
  /** Group key expression (text) when grouping by this column, e.g. `array_to_string(c.owners, '、')`. */
  group?: string;
};
export type GridSqlOptions = {
  dialect: GridSqlDialect;
  /** Day boundaries of date / datetime filters: IANA zone for pg (default: the runtime's), offset for mysql / sqlite (default: `utcOffset`, else the zone's current offset). */
  timeZone?: string;
  utcOffset?: string;
  /** First placeholder number for pg ($n), when the query already has parameters. */
  firstParam?: number;
  // bt/grid-a
  /**
   * Values of dynamic tokens (「我」= the session's user, 「我的下属」 …) — resolve them from the
   * session, never from the request. Unknown tokens make their condition FALSE.
   */
  resolve?: ConditionContext["resolve"];
  /** Clock and first weekday (0 Sunday … 6 Saturday, default 1) for relative dates; today is taken in `timeZone`. */
  now?: number | Date;
  weekStart?: number;
};
export type GridSqlResult = {
  /** Conditions without the WHERE keyword; "" = no condition. */
  where: string;
  params: unknown[];
  /** ORDER BY list without the keyword; "" = no sort (append your stable key, e.g. `id`). */
  orderBy: string;
};

/** Operators that keep a row when the value list is empty (dynamic value resolved to nothing). */
const NEGATIVE_OPS = new Set<GridFilter["op"]>(["noneOf", "hasNone", "isNot"]);
const TEXT_TYPES = new Set<GridFieldType>(["text", "longText", "url", "email", "custom", "singleSelect"]);
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Build WHERE + ORDER BY for a validated query (parseGridQuery first). Unknown fields are ignored. */
export function buildGridSql(query: GridQuery, columns: Readonly<Record<string, GridSqlColumn>>, options: GridSqlOptions): GridSqlResult {
  const { dialect } = options;
  const params: unknown[] = [];
  const first = options.firstParam ?? 1;
  const param = (value: unknown) => {
    params.push(value);
    return dialect === "pg" ? `$${first + params.length - 1}` : "?";
  };
  const like = (expr: string, value: string) => (dialect === "pg" ? `${expr}::text ILIKE ${param(`%${escapeLike(value)}%`)} ESCAPE '\\'` : dialect === "mysql" ? `CAST(${expr} AS CHAR) LIKE ${param(`%${escapeLike(value)}%`)} ESCAPE '\\\\'` : `${expr} LIKE ${param(`%${escapeLike(value)}%`)} ESCAPE '\\'`);
  const lower = (expr: string) => (dialect === "pg" ? `lower(${expr}::text)` : `lower(${expr})`);
  const empty = (expr: string, type: GridFieldType) => (TEXT_TYPES.has(type) ? `(${expr} IS NULL OR ${expr} = '')` : type === "checkbox" ? `(${expr} IS NULL OR ${expr} = ${dialect === "pg" ? "false" : "0"})` : `${expr} IS NULL`);
  const day = (expr: string) => dayExpr(expr, dialect, options);

  const context: ConditionContext = { now: options.now, timeZone: options.timeZone ?? runtimeTimeZone(), weekStart: options.weekStart, resolve: options.resolve };
  const condition = (filter: GridFilter): string | null => {
    const column = columns[filter.field];
    if (!column || !gridFilterOps(column).includes(filter.op)) return null;
    const type = coreType(column); // bt/grid-b
    let value = filter.value;
    if (isDynamicValue(value)) {
      const resolved = resolveDynamic(value, context);
      if (!resolved) return "1 = 0";
      // Resolved to nothing (「我的下属」 with none): negative operators keep every row, like the grid.
      if (!resolved.length) return NEGATIVE_OPS.has(filter.op) ? "1 = 1" : "1 = 0";
      value = resolved;
    }
    const custom = column.filter?.({ ...filter, value }, param);
    if (custom) return custom;
    const c = column.sql;
    const list = Array.isArray(value) ? (value as string[]) : value === undefined || value === null ? [] : [String(value)];
    switch (filter.op) {
      case "empty":
        return column.array ? `(${c} IS NULL OR cardinality(${c}) = 0)` : empty(c, type);
      case "notEmpty":
        return column.array ? `(${c} IS NOT NULL AND cardinality(${c}) > 0)` : `NOT ${empty(c, type)}`;
      case "checked":
        return `${c} = ${dialect === "pg" ? "true" : "1"}`;
      case "unchecked":
        return empty(c, "checkbox");
    }
    switch (type === "money" ? "money" : gridConditionKind(column)) {
      case "number":
      case "rating":
      case "money": {
        const target = type === "money" ? majorToMinor(String(value)) : Number(value);
        if (target === null || (typeof target === "number" && !Number.isFinite(target))) return null;
        const p = param(typeof target === "bigint" ? (target >= BigInt(Number.MIN_SAFE_INTEGER) && target <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(target) : String(target)) : target);
        const op = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[filter.op as "eq"];
        if (!op) return null;
        return filter.op === "neq" ? `(${c} IS NULL OR ${c} <> ${p})` : `${c} ${op} ${p}`;
      }
      case "date": {
        const range = conditionDayRange(value ?? undefined, context);
        if (!range) return null;
        const d = day(c);
        const single = range.from === range.to;
        switch (filter.op) {
          case "is":
          case "inRange":
            return single ? `${d} = ${param(range.from)}` : `(${d} >= ${param(range.from)} AND ${d} <= ${param(range.to)})`;
          case "notInRange":
            return single ? `(${c} IS NULL OR ${d} <> ${param(range.from)})` : `(${c} IS NULL OR ${d} < ${param(range.from)} OR ${d} > ${param(range.to)})`;
          case "before":
            return `${d} < ${param(range.from)}`;
          case "after":
            return `${d} > ${param(range.to)}`;
          case "onOrBefore":
            return `${d} <= ${param(range.to)}`;
          case "onOrAfter":
            return `${d} >= ${param(range.from)}`;
          default:
            return null;
        }
      }
      case "select": {
        if (!list.length) return null;
        const inList = `${c} IN (${list.map((v) => param(v)).join(", ")})`;
        return filter.op === "anyOf" ? inList : filter.op === "noneOf" ? `(${c} IS NULL OR NOT ${inList})` : null;
      }
      case "multi":
      case "user": {
        if (!list.length) return null;
        if (column.array) {
          // text[] needs PostgreSQL; elsewhere give `filter`. A complete condition we cannot express is FALSE, never dropped.
          if (dialect !== "pg") return "1 = 0";
          const p = `${param(list)}::text[]`;
          return filter.op === "hasAny" ? `${c} && ${p}` : filter.op === "hasAll" ? `${c} @> ${p}` : filter.op === "hasNone" ? `NOT (coalesce(${c}, '{}') && ${p})` : "1 = 0";
        }
        // A scalar column holds one value (e.g. owner_id for 「负责人 是 我」).
        if (column.type === "multiSelect") return "1 = 0";
        const unique = [...new Set(list)];
        const inList = `${c} IN (${unique.map((v) => param(v)).join(", ")})`;
        if (filter.op === "hasAny") return inList;
        if (filter.op === "hasNone") return `(${c} IS NULL OR NOT ${inList})`;
        if (filter.op === "hasAll") return unique.length === 1 ? inList : "1 = 0";
        return "1 = 0";
      }
      default: {
        const text = String(value ?? "").trim();
        if (!text) return null;
        if (filter.op === "contains") return like(c, text);
        if (filter.op === "notContains") return `(${c} IS NULL OR NOT ${like(c, text)})`;
        if (list.length > 1 && (filter.op === "is" || filter.op === "isNot")) {
          const inList = `${lower(c)} IN (${list.map((v) => param(v.toLocaleLowerCase("zh-CN"))).join(", ")})`;
          return filter.op === "is" ? inList : `(${c} IS NULL OR NOT ${inList})`;
        }
        if (filter.op === "is") return `${lower(c)} = ${param(text.toLocaleLowerCase("zh-CN"))}`;
        if (filter.op === "isNot") return `(${c} IS NULL OR ${lower(c)} <> ${param(text.toLocaleLowerCase("zh-CN"))})`;
        return null;
      }
    }
  };

  const parts: string[] = [];
  const where = conditionTreeSql(gridQueryFilter(query), condition);
  if (where) parts.push(where);
  const searchable = Object.values(columns).filter((column) => column.searchable ?? (TEXT_TYPES.has(coreType(column)) && column.type !== "custom" && column.type !== "attachment"));
  for (const term of searchTerms(query.search)) {
    if (!searchable.length) break;
    parts.push(`(${searchable.map((column) => like(column.search ?? column.sql, term)).join(" OR ")})`);
  }

  const orderTerm = (column: GridSqlColumn, expr: string, direction: "asc" | "desc") => {
    const dir = direction === "desc" ? "DESC" : "ASC";
    // Empties last in both directions, like the grid.
    return dialect === "pg" ? [`${expr} ${dir} NULLS LAST`] : [`(${column.sql} IS NULL) ASC`, `${expr} ${dir}`];
  };
  // Group levels first: empty group last, then the group order (the same terms buildGridGroupSql uses).
  const groupOrder = (query.groups ?? []).flatMap((level) => {
    const column = columns[level.field];
    return column ? groupOrderTerms(groupColumnSql(column, dialect, options), level.order) : [];
  });
  const order = query.sort.flatMap((sort) => {
    const column = columns[sort.key];
    if (!column || column.sortable === false) return [];
    return orderTerm(column, sortExpr(column, dialect), sort.direction);
  });
  return { where: parts.join(" AND "), params, orderBy: [...groupOrder, ...order].join(", ") };
}

/**
 * SQL string literal of an option value. Options can be user-defined, so quotes are doubled and, for
 * MySQL (backslash is an escape there unless NO_BACKSLASH_ESCAPES), backslashes too.
 */
export function sqlStringLiteral(value: string, dialect: GridSqlDialect): string {
  let text = value.replace(/'/g, "''");
  if (dialect === "mysql") text = text.replace(/\\/g, "\\\\");
  return `'${text}'`;
}
/** ORDER BY expression of a column: option order for single selects, else the column. */
export function sortExpr(column: GridSqlColumn, dialect: GridSqlDialect): string {
  return column.type === "singleSelect" && column.options?.length
    ? `CASE ${column.sql} ${column.options.map((value, i) => `WHEN ${sqlStringLiteral(value, dialect)} THEN ${i}`).join(" ")} ELSE ${column.options.length} END`
    : column.sql;
}
/**
 * SQL of one group level: `group` goes into GROUP BY, `key` is the group key as text (what the grid
 * calls the group: days for dates, 'true' / 'false' for checkboxes, '' for empty), `order` sorts the
 * groups, `empty` is true for the empty group (always last). `column.group` overrides all of them.
 */
export type GridGroupColumnSql = { group: string; key: string; order: string; empty: string | null };
export function groupColumnSql(column: GridSqlColumn, dialect: GridSqlDialect, options: Pick<GridSqlOptions, "timeZone" | "utcOffset"> = {}): GridGroupColumnSql {
  const c = column.sql;
  const text = (expr: string) => (dialect === "pg" ? `${expr}::text` : dialect === "mysql" ? `CAST(${expr} AS CHAR)` : `CAST(${expr} AS TEXT)`);
  if (column.group) return { group: column.group, key: `COALESCE(${column.group}, '')`, order: column.group, empty: `(${column.group} IS NULL OR ${column.group} = '')` };
  switch (coreType(column)) {
    case "date":
    case "datetime": {
      const day = dayExpr(c, dialect, options);
      return { group: day, key: `COALESCE(${day}, '')`, order: day, empty: `${day} IS NULL` };
    }
    case "checkbox": {
      const flag = `CASE WHEN ${c} THEN 'true' ELSE 'false' END`;
      return { group: flag, key: flag, order: flag, empty: null };
    }
    case "number":
    case "money":
      return { group: c, key: `COALESCE(${text(c)}, '')`, order: c, empty: `${c} IS NULL` };
    case "singleSelect":
      return { group: c, key: `COALESCE(${text(c)}, '')`, order: sortExpr(column, dialect), empty: `(${c} IS NULL OR ${c} = '')` };
    case "multiSelect":
    case "user":
      if (column.array && dialect === "pg") {
        const joined = `COALESCE(array_to_string(${c}, chr(1)), '')`;
        return { group: joined, key: joined, order: joined, empty: `${joined} = ''` };
      }
      break;
  }
  const value = `COALESCE(${text(c)}, '')`;
  return { group: value, key: value, order: value, empty: `${value} = ''` };
}
/** ORDER BY terms of a group level: empty group last, then the order expression. */
export function groupOrderTerms(sql: GridGroupColumnSql, order: "asc" | "desc"): string[] {
  const dir = order === "desc" ? "DESC" : "ASC";
  return [...(sql.empty ? [`CASE WHEN ${sql.empty} THEN 1 ELSE 0 END ASC`] : []), `${sql.order} ${dir}`];
}
function dayExpr(expr: string, dialect: GridSqlDialect, options: Pick<GridSqlOptions, "timeZone" | "utcOffset">): string {
  return dialect === "pg"
    ? `to_char((${expr}) AT TIME ZONE '${(options.timeZone ?? runtimeTimeZone()).replace(/'/g, "")}', 'YYYY-MM-DD')`
    : dialect === "mysql"
      ? `DATE_FORMAT(CONVERT_TZ(${expr}, '+00:00', '${(options.utcOffset ?? utcOffsetOf(options.timeZone ?? runtimeTimeZone())).replace(/'/g, "")}'), '%Y-%m-%d')`
      : `strftime('%Y-%m-%d', ${expr}, '${offsetModifier(options.utcOffset ?? utcOffsetOf(options.timeZone ?? runtimeTimeZone()))}')`;
}

/** "+08:00" → "+8 hours" / "+05:30" → "+330 minutes" (SQLite date modifier). */
function offsetModifier(offset: string): string {
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match) return "+0 minutes";
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return minutes % 60 === 0 ? `${match[1]}${minutes / 60} hours` : `${match[1]}${minutes} minutes`;
}
