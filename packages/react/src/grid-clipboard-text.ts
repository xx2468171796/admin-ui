/**
 * Formula-injection guard of copied grid cells. Internal (not re-exported by ./grid-query): grid-edit-core.ts is
 * re-exported there with `export *`, so helpers live here instead.
 */
const FORMULA_START = /^[\s\u0000-\u001f]*[=+\-@\t\r\n]/;
/**
 * Formula-injection guard of copied cells (the same rule as the CSV export, reports-core buildCsv): text that a
 * spreadsheet would run as a formula (`=` `+` `-` `@` first) gets a leading `'`, which Excel / WPS show as text.
 */
export const escapeFormula = (cell: string) => (FORMULA_START.test(cell) ? `'${cell}` : cell);
/** Undo escapeFormula when pasting back into the grid (a copied `'=SUM(…)` comes back as `=SUM(…)`). */
export const unescapeFormula = (cell: string) => (cell.startsWith("'") && FORMULA_START.test(cell.slice(1)) ? cell.slice(1) : cell);
