/** Route registry. Pure data (no React) so vite.config can emit one HTML file per route at build time. */
import { basicsDocs } from "./basics";
import { businessDocs } from "./business";
import { chartsDocs } from "./charts";
import { collabDocs } from "./collab";
import { dataDocs } from "./data";
import { feedbackDocs } from "./feedback";
import { formControlsDocs } from "./form-controls";
import { inputsDocs } from "./inputs";
import { navigationDocs } from "./navigation";
import { templatesDocs } from "./templates";
import { GROUPS, type ComponentDoc, type GuidePage } from "./types";
import { viewsDocs } from "./views";

export const COMPONENT_DOCS: readonly ComponentDoc[] = [
  ...basicsDocs,
  ...formControlsDocs,
  ...inputsDocs,
  ...feedbackDocs,
  ...navigationDocs,
  ...dataDocs,
  ...chartsDocs,
  ...collabDocs,
  ...viewsDocs,
  ...businessDocs,
  ...templatesDocs,
];

export const GUIDES: readonly GuidePage[] = [
  { slug: "index", title: "首页", summary: "为数据密集型管理后台而生的 React 组件库：多维表格、视图、看板搭建、记录详情、权限与协作，一套色卡，中文优先。" },
  { slug: "why", title: "为什么选它 · 对比", summary: "和 shadcn/ui、Ant Design、Arco、Semi、TDesign、MUI、Mantine、Refine 的老实对比：优势、区别和短板。", keywords: "comparison 对比 优势 区别" },
  { slug: "stacks", title: "适配的技术栈", summary: "React 19 + Vite、Next.js、Node / Go / Rust 后端、桌面端（Tauri / Electron），以及不适合的场景。", keywords: "next vite tauri electron go rust vue angular" },
  { slug: "install", title: "安装与起步", summary: "小 / 中 / 大三档起步样板、样式引入规则、子路径按需加载与首屏体积预算。", keywords: "install 安装 起步 starter small large 体积" },
  { slug: "theming", title: "主题与色卡", summary: "6 套色卡 + 深色模式 + 品牌色，全部由 CSS 变量驱动；颜色只来自色卡。", keywords: "theme palette dark 主题 色卡 深色 token" },
  { slug: "templates-gallery", title: "页面模板", summary: "17 个页面模板：先选模板再写页面，布局定死只换内容。", keywords: "templates 模板 布局" },
  { slug: "ai", title: "给 AI 用", summary: "AI-RULES、能力清单 catalog、admin-ui-audit 漂移检查：让 AI 写出的后台页面和人写的一样规范。", keywords: "ai llm catalog audit 提示词" },
  { slug: "migration", title: "升级到 8.0", summary: "旧 → 新对照、admin-ui-audit 自动找出要改的地方。", keywords: "migration 升级 迁移" },
  { slug: "changelog", title: "更新日志", summary: "版本记录。", keywords: "changelog 版本" },
];

export type SiteRoute = {
  slug: string;
  title: string;
  summary: string;
  kind: "guide" | "component";
  groupTitle?: string;
  keywords?: string;
};

const groupTitle = (doc: ComponentDoc) => GROUPS.find((g) => g.id === doc.group)?.title ?? "";

export const ROUTES: readonly SiteRoute[] = [
  ...GUIDES.map((g) => ({ slug: g.slug, title: g.title, summary: g.summary, kind: "guide" as const, keywords: g.keywords })),
  ...COMPONENT_DOCS.map((d) => ({
    slug: d.slug,
    title: d.title,
    summary: d.summary,
    kind: "component" as const,
    groupTitle: groupTitle(d),
    keywords: `${d.subtitle} ${d.keywords ?? ""}`,
  })),
];

export const docBySlug = (slug: string) => COMPONENT_DOCS.find((d) => d.slug === slug);
export const routeBySlug = (slug: string) => ROUTES.find((r) => r.slug === slug);
