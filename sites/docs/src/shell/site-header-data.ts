// The site header's data, shared by the homepage (src/home) and the docs shell (src/shell/layout.tsx): one list of
// top-level destinations, so both headers always show the same items with the same targets. Pure data, no React.
import type { Lang } from "../i18n";

declare const __AUI_VERSION__: string;

export const GITHUB = "https://github.com/xx2468171796/admin-ui";
/** Version badge next to the wordmark: major.minor of the package the site documents. */
export const VERSION_BADGE = __AUI_VERSION__.split(".").slice(0, 2).join(".");
export const SEARCH_PLACEHOLDER: Record<Lang, string> = { zh: "搜索组件、文档…", en: "Search components and docs…" };

export type HeaderNavId = "guide" | "components" | "templates" | "ai" | "why" | "stacks";
/** A top-level destination; every `slug` is a real page (`<slug>.html`). */
export type HeaderNavItem = { id: HeaderNavId; slug: string; label: Record<Lang, string> };

export const HEADER_NAV: readonly HeaderNavItem[] = [
  { id: "guide", slug: "install", label: { zh: "文档", en: "Docs" } },
  { id: "components", slug: "button", label: { zh: "组件", en: "Components" } },
  { id: "templates", slug: "templates-gallery", label: { zh: "页面模板", en: "Templates" } },
  { id: "ai", slug: "ai", label: { zh: "给 AI 用", en: "For AI" } },
  { id: "why", slug: "why", label: { zh: "对比", en: "Compare" } },
  { id: "stacks", slug: "stacks", label: { zh: "技术栈", en: "Stacks" } },
];

/** Guide pages that live under 「文档」 rather than under their own header item. */
const GUIDE_SLUGS: ReadonlySet<string> = new Set(["install", "theming", "migration", "changelog"]);

/** Which header item a docs route belongs to (highlighted with aria-current); none for the homepage. */
export function headerNavFor(slug: string, componentSlugs: readonly string[]): HeaderNavId | undefined {
  if (GUIDE_SLUGS.has(slug)) return "guide";
  if (componentSlugs.includes(slug)) return "components";
  return HEADER_NAV.find((item) => item.slug === slug)?.id;
}
