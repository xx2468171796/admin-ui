/**
 * Pure rules of the one select / dropdown look (form-controls review family 2 + 4):
 * which options a search shows, how they group, where the keyboard goes, when the search box appears
 * and when 「＋ 新建选项」 is offered. Used by Choice / MultiChoice, the grid's option editor and the
 * filter pickers (option-list.tsx). No React.
 */

/** One choosable value. */
export type SelectOption = {
  value: string;
  label: string;
  /** Option colour: shown as a coloured tag (OptionTone, or an old tone / colour name). */
  tone?: string;
  /** Legacy colour name, used when `tone` is missing. */
  color?: string;
  /** Grey note on the right (「1 天」「销售一组」). */
  hint?: string;
  /** Group heading the option sits under (「进行中」「已结束」); groups keep the order they first appear in. */
  group?: string;
  /** Person: shown with an avatar circle (the initial, or this text). */
  avatar?: string;
  disabled?: boolean;
  /** Why it cannot be picked (「要先填丢单原因」): greyed out, the reason on the right. */
  disabledReason?: string;
  /** Extra words the search matches (pinyin, code). */
  keywords?: string;
};

/** More options than this get a search box (`searchable: "auto"`). */
export const SEARCH_THRESHOLD = 6;

const norm = (text: string) => text.trim().toLocaleLowerCase("zh-CN");

/** Options whose label / value / keywords contain the query (all when it is blank), in their order. */
export function filterOptions<O extends SelectOption>(options: readonly O[], query: string): O[] {
  const q = norm(query);
  if (!q) return [...options];
  return options.filter((o) => norm(o.label).includes(q) || norm(o.value).includes(q) || (o.keywords ? norm(o.keywords).includes(q) : false));
}

/** Whether the search box shows. */
export function showsSearch(count: number, searchable: boolean | "auto" = "auto"): boolean {
  return searchable === "auto" ? count > SEARCH_THRESHOLD : searchable;
}

export type OptionSection<O extends SelectOption> = { group: string | null; options: { option: O; index: number }[] };

/** Shown options cut into groups (first-seen order); `index` = position in the flat list (keyboard order). */
export function groupOptions<O extends SelectOption>(options: readonly O[]): OptionSection<O>[] {
  const sections: OptionSection<O>[] = [];
  const byGroup = new Map<string | null, OptionSection<O>>();
  options.forEach((option, index) => {
    const key = option.group ?? null;
    let section = byGroup.get(key);
    if (!section) {
      section = { group: key, options: [] };
      byGroup.set(key, section);
      sections.push(section);
    }
    section.options.push({ option, index });
  });
  return sections;
}

/** Flat keyboard order after grouping (groups may reorder options that were not adjacent). */
export function keyboardOrder<O extends SelectOption>(options: readonly O[]): O[] {
  return groupOptions(options).flatMap((s) => s.options.map((o) => o.option));
}

export const isPickable = (option: SelectOption | undefined) => Boolean(option && !option.disabled && !option.disabledReason);

/**
 * The next active row for a key (ArrowDown / ArrowUp / Home / End / PageDown / PageUp), skipping options
 * that cannot be picked; `count` includes a trailing 「新建」 row when offered (index = options.length).
 * Returns null for other keys.
 */
export function moveActive(options: readonly SelectOption[], active: number, key: string, createRow = false): number | null {
  const total = options.length + (createRow ? 1 : 0);
  if (!total) return null;
  const ok = (i: number) => i === options.length ? createRow : isPickable(options[i]);
  const scan = (from: number, step: 1 | -1, limit = total) => {
    for (let i = from, n = 0; n < limit; i += step, n += 1) {
      const at = ((i % total) + total) % total;
      if (ok(at)) return at;
    }
    return active;
  };
  switch (key) {
    case "ArrowDown":
      return scan(active + 1, 1);
    case "ArrowUp":
      return scan(active - 1, -1);
    case "Home":
      return scan(0, 1);
    case "End":
      return scan(total - 1, -1);
    case "PageDown": {
      const target = Math.min(total - 1, active + 8);
      return ok(target) ? target : scan(target, -1);
    }
    case "PageUp": {
      const target = Math.max(0, active - 8);
      return ok(target) ? target : scan(target, 1);
    }
    default:
      return null;
  }
}

/** Where the keyboard starts: the (first) chosen option, else the first one that can be picked. */
export function initialActive(options: readonly SelectOption[], selected: readonly string[]): number {
  const chosen = options.findIndex((o) => selected.includes(o.value) && isPickable(o));
  if (chosen >= 0) return chosen;
  const first = options.findIndex(isPickable);
  return first < 0 ? 0 : first;
}

/** The label 「＋ 新建选项」 would create, or null (blank query, or an option already has that label). */
export function createCandidate(options: readonly SelectOption[], query: string): string | null {
  const label = query.trim();
  if (!label) return null;
  return options.some((o) => norm(o.label) === norm(label)) ? null : label;
}

/** Typeahead on a closed / search-less list: the next pickable option whose label starts with `text`. */
export function typeahead(options: readonly SelectOption[], active: number, text: string): number | null {
  const q = norm(text);
  if (!q) return null;
  for (let n = 1; n <= options.length; n += 1) {
    const i = (active + n) % options.length;
    const o = options[i];
    if (o && isPickable(o) && norm(o.label).startsWith(q)) return i;
  }
  return null;
}

/** Toggle a value in a multi selection, keeping the options' order; `max` refuses more (returns null). */
export function toggleValue(selected: readonly string[], value: string, order: readonly string[], max?: number): string[] | null {
  if (selected.includes(value)) return selected.filter((v) => v !== value);
  if (max !== undefined && selected.length >= max) return null;
  const next = new Set([...selected, value]);
  const known = order.filter((v) => next.has(v));
  return [...known, ...[...next].filter((v) => !order.includes(v))];
}

/** How many chips fit: given chip widths, the room and the width of a 「+N」 chip, the count to show (≥ 1 when any). */
export function chipsThatFit(widths: readonly number[], room: number, moreWidth: number, gap = 4): number {
  let used = 0;
  for (let i = 0; i < widths.length; i += 1) {
    const w = widths[i]! + (i ? gap : 0);
    const rest = i < widths.length - 1 ? moreWidth + gap : 0;
    if (used + w + rest > room) return Math.max(1, i);
    used += w;
  }
  return widths.length;
}
