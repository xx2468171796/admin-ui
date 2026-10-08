// Homepage copy. Facts only from the package and the docs pages (why.md, stacks.md, install.md). Links are relative
// (`install.html`) so the page works on the real host, locally and inside sandboxed review frames.
declare const __AUI_VERSION__: string;
declare const __AUI_EXPORTS__: number;

export const PKG = "@adminui/react";
export const VERSION = __AUI_VERSION__;
export const EXPORTS_COUNT = __AUI_EXPORTS__;
export const GITHUB = "https://github.com/xx2468171796/admin-ui";
export const RELEASES = `${GITHUB}/releases`;
export const doc = (slug: string) => `${slug}.html`;

export const INSTALL = {
  npm: `npm i ${PKG}`,
  pnpm: `pnpm add ${PKG}`,
  yarn: `yarn add ${PKG}`,
} as const;
export type PackageManager = keyof typeof INSTALL;

export const USAGE = `import "${PKG}/styles.css";
import { AdminProvider } from "${PKG}";
import { BitableGrid } from "${PKG}/grid";

<AdminProvider palette="forest">
  <BitableGrid rows={rows} fields={fields} />
</AdminProvider>`;

export type Starter = { size: "S" | "M" | "L"; name: string; dir: string; who: string; budget: string; css: string };
export const STARTERS: readonly Starter[] = [
  { size: "S", name: "小工具", dir: "small", who: "内部小工具、Go / Rust 单二进制", budget: "≤ 72 KB JS", css: "≤ 32 KB CSS" },
  { size: "M", name: "中型系统", dir: "starter", who: "CRM、工单、运营后台，按页面加子路径", budget: "≤ 300 KB JS（含 React）", css: "≤ 40 KB CSS" },
  { size: "L", name: "大型平台", dir: "large", who: "多模块 SaaS，表格 / 视图 / 搭建器全部懒加载", budget: "≤ 300 KB JS（含 React）", css: "≤ 40 KB CSS" },
];
export const starterCmd = (dir: string) => `npx degit xx2468171796/admin-ui/examples/${dir} my-admin`;

export type Rival = { name: string; them: string; us: string };
export const RIVALS: readonly Rival[] = [
  { name: "shadcn/ui", them: "复制源码进项目，自己拼；没有多维表格、看板、权限界面", us: "一个包、一套定死的规范，随版本升级" },
  { name: "Ant Design + Pro", them: "通用企业级，50+ 语言，生态很大", us: "多维表格级表格、视图和看板搭建器是现成的" },
  { name: "MUI X", them: "Data Grid 很强，分组、聚合在付费档", us: "表格的分组、填充柄、服务端分组都是 MIT" },
  { name: "Refine", them: "管路由和 CRUD 数据流，UI 交给别家", us: "管每一块长什么样、怎么交互，数据流交给你的 adapter" },
];
export const WEAK_SPOTS: readonly string[] = ["很新：1.0 到 8.0 只用了三周", "只支持 React 19", "国际化进行中，目前界面文字是中文", "社区还很小"];

export type Stack = { name: string; note: string; status: "已验证" | "文档支持" | "原理可行" };
export const STACKS: readonly Stack[] = [
  { name: "React 19 + Vite", note: "首选，三档样板都是 Vite", status: "已验证" },
  { name: "Next.js", note: "客户端组件里用", status: "文档支持" },
  { name: "Tauri / Electron", note: "相对路径静态构建", status: "原理可行" },
  { name: "Node · Fastify / Hono", note: "grid-query 服务端分组", status: "已验证" },
  { name: "Go 单二进制", note: "go:embed + SQLite", status: "已验证" },
  { name: "Rust 单二进制", note: "include_dir + rusqlite", status: "已验证" },
];

export const NAV_LINKS: readonly [string, string][] = [
  ["文档", "install"],
  ["组件", "button"],
  ["页面模板", "templates-gallery"],
  ["给 AI 用", "ai"],
  ["对比", "why"],
];

/** Docs pages offered in the top-bar command palette (Ctrl K). */
export const PALETTE_PAGES: readonly [string, string, string][] = [
  ["install", "安装与起步", "开始"],
  ["theming", "主题与色卡", "开始"],
  ["stacks", "适配的技术栈", "开始"],
  ["grid", "多维表格 BitableGrid", "组件"],
  ["kanban", "看板 · 视图", "组件"],
  ["dashboard-builder", "看板搭建器", "组件"],
  ["record-detail", "记录详情", "组件"],
  ["org-picker", "组织树选人", "组件"],
  ["access", "权限与治理", "组件"],
  ["ai", "给 AI 用", "资源"],
  ["why", "和其他组件库对比", "资源"],
  ["changelog", "更新日志", "资源"],
];

export const FOOTER: readonly { title: string; links: readonly [string, string][] }[] = [
  { title: "开始", links: [["安装与起步", doc("install")], ["主题与色卡", doc("theming")], ["适配的技术栈", doc("stacks")], ["迁移到 8.0", doc("migration")]] },
  { title: "组件", links: [["多维表格", doc("grid")], ["看板 · 视图", doc("kanban")], ["看板搭建器", doc("dashboard-builder")], ["记录详情", doc("record-detail")]] },
  { title: "资源", links: [["给 AI 用", doc("ai")], ["和其他库对比", doc("why")], ["页面模板", doc("templates-gallery")], ["更新日志", doc("changelog")]] },
  { title: "社区", links: [["GitHub", GITHUB], ["提问题", `${GITHUB}/issues`], ["讨论区", `${GITHUB}/discussions`], ["MIT 许可", `${GITHUB}/blob/main/LICENSE`]] },
];

/** The CRM pages of the live hero; the top-bar command palette opens them too. */
export const CRM_PAGES = [
  { id: "grid", title: "客户表", hint: "双击格子改值 · 拖右下角填充柄 · 勾选几行看底部浮条" },
  { id: "kanban", title: "商机看板", hint: "拖卡片换阶段（赢单锁住了）· 失败会自动放回原处" },
  { id: "calendar", title: "跟进日历", hint: "把事件拖到另一天 · 从「无日期」抽屉拖进来" },
  { id: "detail", title: "商机详情", hint: "点阶段条直接改 · 点「需求说明」就地编辑 · 写一条评论" },
] as const;
export type CrmPage = (typeof CRM_PAGES)[number]["id"];
export const isCrmPage = (v: unknown): v is CrmPage => CRM_PAGES.some((p) => p.id === v);

export const AUDIT_BAD = `$ npx ${PKG} audit src
src/pages/customers.tsx:4  错误 [hard-colour] 不写死颜色：用色卡变量 var(--aui-…)
    <div style={{ color: "#1677ff" }}>
src/pages/customers.tsx:5  错误 [raw-control] 不手写原生控件：用 SDK 的 Button / DataTable / Choice / Input …
    <select><option>全部</option></select>
src/pages/customers.tsx:6  错误 [raw-control] 不手写原生控件：用 SDK 的 Button / DataTable / Choice / Input …
    <input type="date" />

admin-ui-audit：3 个错误，0 个提醒`;
export const AUDIT_OK = `$ npx ${PKG} audit src

admin-ui-audit：0 个错误，0 个提醒
✓ 可以提交`;

export const RULES = `# AI-RULES.md（节选）
- 可用符号以 ${PKG}/catalog 为准，不按记忆猜 import。
- 每个后台页面先说清用 T01–T17 哪个模板：布局定死，只换内容。
- 只用套件组件和当前色卡的颜色；不手写按钮、表格、弹框。
- 界面会被自动检查：原生控件、写死颜色、装饰色条、
  改组件内部样式、操作列超过 3 个……`;
