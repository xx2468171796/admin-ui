/** Pure data types for the documentation content. No React here: vite.config imports the route list at build time. */

export type GroupId =
  | "basics"
  | "inputs"
  | "feedback"
  | "navigation"
  | "data"
  | "charts"
  | "collab"
  | "views"
  | "business"
  | "templates";

export const GROUPS: readonly { id: GroupId; title: string }[] = [
  { id: "basics", title: "基础" },
  { id: "inputs", title: "输入与表单" },
  { id: "feedback", title: "反馈与弹层" },
  { id: "navigation", title: "导航与布局" },
  { id: "data", title: "数据表格" },
  { id: "charts", title: "图表与仪表盘" },
  { id: "collab", title: "协作与媒体" },
  { id: "views", title: "视图" },
  { id: "business", title: "业务组件" },
  { id: "templates", title: "页面模板" },
];

/** A playground control: the value is passed to the demo component as a prop of the same name. */
export type Control =
  | { name: string; label: string; type: "select"; options: readonly string[]; default: string }
  | { name: string; label: string; type: "boolean"; default: boolean }
  | { name: string; label: string; type: "text"; default: string }
  | { name: string; label: string; type: "number"; default: number; min?: number; max?: number; step?: number };

export type DemoSpec = {
  /** Path under src/demos without extension, e.g. "basics/button-variants". The file exports `Demo`. */
  id: string;
  title: string;
  description?: string;
  /** Minimum preview height in px (default 240). Tall widgets (grid, kanban, builder) set this. */
  height?: number;
  /** No padding around the demo: shells, grids and whole pages that draw their own edges. */
  bleed?: boolean;
  controls?: readonly Control[];
};

export type PropRow = { name: string; type: string; default?: string; description: string };

export type ComponentDoc = {
  slug: string;
  title: string;
  /** Exported names shown under the title, e.g. "Button · IconButton · ButtonGroup". */
  subtitle: string;
  group: GroupId;
  summary: string;
  importFrom: string;
  /** stable = shipped in the package; preview = design approved, component not released yet. */
  status?: "stable" | "preview";
  /** deep = hand-written props tables and extra demos. */
  depth?: "deep";
  when: readonly string[];
  whenNot?: readonly string[];
  anatomy?: readonly string[];
  states?: readonly string[];
  dos: readonly string[];
  donts: readonly string[];
  a11y: readonly string[];
  demos: readonly DemoSpec[];
  props?: readonly { component: string; rows: readonly PropRow[] }[];
  /** Extra search words (English names, synonyms). */
  keywords?: string;
};

export type GuidePage = { slug: string; title: string; summary: string; keywords?: string };
