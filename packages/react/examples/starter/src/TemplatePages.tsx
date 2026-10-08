// bt/templates：T15 / T16 / T17 自带外壳（图标栏外壳 / 公开页），不放进后台外壳的工作标签里，各自占一整页：
// #template=t15 · t16-form · t16-success · t16-expired · t16-visitor · t16-password · t17 · t17-frame，加 &dark 看深色。
// 菜单「页面模板」里的 T15–T17 跳到这些地址；页面左上角的 A（或浏览器后退）回到后台外壳。
import { lazy, Suspense } from "react";
import { LayoutDashboard, Link2, Table2, type LucideIcon } from "lucide-react";
import { AdminProvider, NotificationProvider, StatePanel } from "@adminui/react";
import type { PublicTemplateKind } from "./TemplatePublic";
const TemplatePublic = lazy(() => import("./TemplatePublic").then((m) => ({ default: m.TemplatePublic })));

const TemplateWorkspace = lazy(() => import("./TemplateWorkspace").then((m) => ({ default: m.TemplateWorkspace })));
const TemplateBuilder = lazy(() => import("./TemplateBuilder").then((m) => ({ default: m.TemplateBuilder })));
const TemplateBuilderFrame = lazy(() => import("./TemplateBuilderFrame").then((m) => ({ default: m.TemplateBuilderFrame })));

export type TemplatePageKind = "t15" | "t17" | "t17-frame" | `t16-${PublicTemplateKind}`;
export const TEMPLATE_HASH = /^#template=(t15|t17|t17-frame|t16-(?:form|success|expired|visitor|password))(&dark)?$/;
export const templatePage = (): { kind: TemplatePageKind; dark: boolean } | null => {
  const m = TEMPLATE_HASH.exec(window.location.hash);
  return m ? { kind: m[1] as TemplatePageKind, dark: Boolean(m[2]) } : null;
};
/** Menu entries (group 页面模板): id → the hash page it opens. */
export const TEMPLATE_LINKS: readonly { id: string; title: string; icon: LucideIcon; hash: string; keywords: string }[] = [
  { id: "tpl-t15", title: "T15 表格工作区", icon: Table2, hash: "template=t15", keywords: "模板 多维表格 工作区 图标栏 目录 视图标签 业务线 在线头像 D01" },
  { id: "tpl-t16", title: "T16 公开页", icon: Link2, hash: "template=t16-form", keywords: "模板 公开 表单 填表 提交成功 访客 分享 密码门 D18 D21" },
  { id: "tpl-t17", title: "T17 看板搭建器", icon: LayoutDashboard, hash: "template=t17", keywords: "模板 看板 搭建 组件库 画布 组件设置 撤销 D32" },
];

export function TemplateStandalone({ kind, dark }: { kind: TemplatePageKind; dark: boolean }) {
  const body =
    kind === "t15" ? <TemplateWorkspace /> : kind === "t17" ? <TemplateBuilder /> : kind === "t17-frame" ? <TemplateBuilderFrame /> : <TemplatePublic kind={kind.slice(4) as PublicTemplateKind} />;
  return (
    // 和后台外壳同一套项目默认值（SDK 默认中性：时区跟浏览器、不带币种、电话区号按浏览器语言地区）
    <AdminProvider storageKey="adminui-starter-precision-theme" mode={dark ? "dark" : "light"} defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}>
      <NotificationProvider>
        <Suspense fallback={<StatePanel kind="loading" />}>{body}</Suspense>
      </NotificationProvider>
    </AdminProvider>
  );
}
