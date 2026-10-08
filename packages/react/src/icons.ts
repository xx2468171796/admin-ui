/**
 * Icons: Lucide only, five sizes, stroke width by size, and ONE icon per meaning.
 * Use `ACTION_ICONS.edit` (not Pencil / PenLine / SquarePen picked by hand) so 「编辑」 looks the same
 * everywhere; test/icons.test.ts keeps the SDK on this set.
 */
import {
  ArrowUpDown,
  Bell,
  CircleHelp,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  History,
  Layers,
  Link,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Shield,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

/** 12 tags / external ↗ / before a note · 14 small buttons, chips, field-type icons · 16 default · 20 phone tab bar, icon blocks · 24 empty states, big icon blocks. */
export type IconSize = 12 | 14 | 16 | 20 | 24;
export const ICON_SIZES: readonly IconSize[] = [12, 14, 16, 20, 24];

/** Stroke width by size: 12–14 → 2 (thin ones blur), 16–20 → 1.75, 24 → 1.5 (close to Feishu / Linear). */
export function iconStroke(size: number): number {
  if (size <= 14) return 2;
  if (size >= 24) return 1.5;
  return 1.75;
}

/** The fixed set of 24 action icons and what each one means. */
export const ACTION_ICONS = {
  create: Plus,
  edit: Pencil,
  delete: Trash2,
  copy: Copy,
  search: Search,
  filter: Filter,
  group: Layers,
  sort: ArrowUpDown,
  refresh: RefreshCw,
  history: History,
  settings: Settings2,
  more: Ellipsis,
  download: Download,
  upload: Upload,
  share: Share2,
  link: Link,
  openNew: ExternalLink,
  close: X,
  help: CircleHelp,
  notify: Bell,
  access: Shield,
  lock: Lock,
  show: Eye,
  hide: EyeOff,
} as const satisfies Record<string, LucideIcon>;
export type ActionIconName = keyof typeof ACTION_ICONS;

/** Chinese meaning of each action icon (docs, the starter gallery). */
export const ACTION_ICON_LABELS: Readonly<Record<ActionIconName, string>> = {
  create: "新建",
  edit: "编辑",
  delete: "删除",
  copy: "复制",
  search: "搜索",
  filter: "筛选",
  group: "分组",
  sort: "排序",
  refresh: "刷新",
  history: "历史 / 操作记录",
  settings: "设置",
  more: "更多",
  download: "导出 / 下载",
  upload: "导入 / 上传",
  share: "分享",
  link: "链接",
  openNew: "新窗口打开",
  close: "关闭",
  help: "说明",
  notify: "通知 / 关注",
  access: "权限",
  lock: "锁定 / 只读",
  show: "显示",
  hide: "隐藏",
};

/** Lucide names that duplicate a meaning above; the SDK doesn't use them for that meaning. */
export const REPLACED_ICONS: Readonly<Record<string, ActionIconName>> = {
  Settings: "settings",
  SlidersHorizontal: "settings",
  PenLine: "edit",
  SquarePen: "edit",
  RotateCw: "refresh",
  MoreHorizontal: "more",
  ListFilter: "filter",
  Share: "share",
  HelpCircle: "help",
};
