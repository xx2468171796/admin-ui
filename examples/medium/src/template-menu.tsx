// 「页面模板」菜单（T01–T13）：只有菜单数据，页面在 PageTemplates.tsx 里按需加载（starter 首屏不带它们）。
import { lazy, Suspense } from "react";
import { Clock, FileText, Inbox, JapaneseYen, LayoutGrid, Link2, Plus, Server, Settings, Shield, Upload, User, Users, type LucideIcon } from "lucide-react";
import { StatePanel, type WorkspaceItem } from "@adminui/react";

const TemplateById = lazy(() => import("./PageTemplates").then((m) => ({ default: m.TemplateById })));

export type TemplateMenuItem = { id: string; no: string; title: string; icon: LucideIcon; keywords: string };
export const TEMPLATE_PAGES: readonly TemplateMenuItem[] = [
  { id: "tpl-t01", no: "T01", title: "T01 工作台首页", icon: Inbox, keywords: "模板 首页 指标带 待办 在线 常用入口" },
  { id: "tpl-t02", no: "T02", title: "T02 资源列表页", icon: Server, keywords: "模板 列表 机器 筛选 批量 分页" },
  { id: "tpl-t03", no: "T03", title: "T03 指标 + 列表", icon: Upload, keywords: "模板 指标 列表 备份 要处理的" },
  { id: "tpl-t04", no: "T04", title: "T04 统计看板页", icon: JapaneseYen, keywords: "模板 统计 用量 图表 排行" },
  { id: "tpl-t05", no: "T05", title: "T05 分区合并页", icon: Users, keywords: "模板 分区 标签 人员 角色 邀请" },
  { id: "tpl-t06", no: "T06", title: "T06 日志 / 时间线", icon: FileText, keywords: "模板 日志 审计 时间线 改前改后" },
  { id: "tpl-t07", no: "T07", title: "T07 关系图 / 监控", icon: Link2, keywords: "模板 关系图 连接图 监控 图例" },
  { id: "tpl-t08", no: "T08", title: "T08 设置 / 表单", icon: Settings, keywords: "模板 设置 表单 分节 保存条" },
  { id: "tpl-t09", no: "T09", title: "T09 权限配置页", icon: Shield, keywords: "模板 授权 矩阵 权限 人员组" },
  { id: "tpl-t10", no: "T10", title: "T10 工具 / 工作区", icon: LayoutGrid, keywords: "模板 工作区 对话 AI 助理 终端" },
  { id: "tpl-t11", no: "T11", title: "T11 进度 / 工作项", icon: Clock, keywords: "模板 进度 目标 任务 步骤" },
  { id: "tpl-t12", no: "T12", title: "T12 向导页", icon: Plus, keywords: "模板 向导 步骤 新增机器 一键接入" },
  { id: "tpl-t13", no: "T13", title: "T13 个人页", icon: User, keywords: "模板 个人 我的 接入 公钥 密钥" },
];

/** Workspace pages for AdminShell, keyed by id. */
export function templateWorkspacePages(active: string): Record<string, WorkspaceItem> {
  return Object.fromEntries(TEMPLATE_PAGES.map((p) => [p.id, { id: p.id, title: p.title, icon: p.icon, content: <Suspense fallback={<StatePanel kind="loading" />}><TemplateById id={p.id} active={active === p.id} /></Suspense> }]));
}
