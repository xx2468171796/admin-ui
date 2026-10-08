/**
 * Demo data of the 「导航与布局」 family: the menu, companies and signed-in account of the fictional company 北辰云.
 * Plain data (icons are lucide components), shared by the shell / work tab / workspace demos.
 */
import {
  BarChart3,
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  Home,
  KeyRound,
  LayoutGrid,
  Megaphone,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { AccountMenuItem, CompanyOption, NavItem, ShellAccount } from "@adminui/react";
import { COMPANY } from "./demo-data";

export const BRAND = COMPANY.name;
export const LOGO = COMPANY.logo;

/** Side menu: two ungrouped rows, then groups. Counts are grey; 「待办」 is something to handle (danger). */
export const SHELL_NAV: readonly NavItem[] = [
  { id: "home", title: "工作台", icon: Home },
  { id: "todo", title: "待办", icon: CheckSquare, badge: 3, badgeTone: "danger" },
  { id: "customers", title: "客户", icon: Users, group: "业务", badge: 1284 },
  { id: "deals", title: "商机", icon: FolderKanban, group: "业务", badge: 86 },
  { id: "contracts", title: "合同", icon: FileText, group: "业务" },
  { id: "campaigns", title: "营销活动", icon: Megaphone, group: "业务", locked: "营销模块还没开通，找管理员开通" },
  { id: "reports", title: "报表", icon: BarChart3, group: "分析" },
  { id: "billing", title: "账单", icon: Wallet, group: "分析" },
  { id: "members", title: "成员与部门", icon: Building2, group: "系统" },
  { id: "roles", title: "角色与权限", icon: ShieldCheck, group: "系统" },
  { id: "settings", title: "公司设置", icon: Settings, group: "系统" },
];

export const navTitle = (id: string) => SHELL_NAV.find((n) => n.id === id)?.title ?? id;
export const navIcon = (id: string) => SHELL_NAV.find((n) => n.id === id)?.icon ?? FileText;

export const COMPANIES: readonly CompanyOption[] = [
  { id: "hq", name: "北辰云 · 总部", note: "集团" },
  { id: "east", name: "北辰云 · 华东分公司" },
  { id: "south", name: "北辰云 · 华南分公司" },
];

export const ACCOUNT: ShellAccount = { name: "林晓", detail: "lin.xiao@example.com · 总部", role: "销售总监" };

export const ACCOUNT_MENU: readonly AccountMenuItem[] = [
  { id: "profile", label: "我的资料", icon: UserRound },
  { id: "tokens", label: "API 令牌", icon: KeyRound },
  { id: "console", label: "管理后台", icon: LayoutGrid, href: "https://example.com/console", external: true },
];
