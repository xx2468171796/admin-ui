// bt/templates：T15 / T17 共用的平台图标栏（样稿 D01 / D32 左边 56px 那一列）。模块、通知数、账号菜单都是演示数据。
import { Bell, BookOpen, FileText, Folder, Home, ListTodo, MessageSquareText, Settings, Table2, Users } from "lucide-react";
import type { MenuSection, RailAccount, RailModule } from "@adminui/react";

export const RAIL_MODULES: readonly RailModule[] = [
  { id: "home", title: "工作台", icon: Home },
  { id: "table", title: "表格", icon: Table2 },
  { id: "crm", title: "客户", icon: Users },
  { id: "files", title: "文件", icon: Folder },
  { id: "scripts", title: "话术", icon: MessageSquareText },
  { id: "todo", title: "待办", icon: ListTodo, badge: 3 },
  { id: "wiki", title: "知识库", icon: BookOpen },
];
export const RAIL_FOOTER: readonly RailModule[] = [
  { id: "notice", title: "通知", icon: Bell, badge: 12 },
  { id: "settings", title: "设置", icon: Settings },
];
export const accountOf = (name: string, hint: string, onPick: (what: string) => void): RailAccount => ({
  name,
  hint,
  menu: [
    { items: [{ key: "me", label: "个人设置", icon: <FileText aria-hidden="true" />, onSelect: () => onPick("个人设置") }] },
    { items: [{ key: "out", label: "退出登录", onSelect: () => onPick("退出登录") }] },
  ] satisfies MenuSection[],
});
/** 演示里点模块不真的跳页：回到后台外壳的「页面模板」。 */
export const backToStarter = () => {
  window.location.hash = "";
};
