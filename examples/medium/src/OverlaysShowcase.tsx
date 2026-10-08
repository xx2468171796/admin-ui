// 组件库审阅第 3 批「反馈与弹层」样板页（系统 → 反馈与弹层）。十项各一块：弹框、确认、侧边 / 底部弹层、菜单、弹出面板、
// 提示条与行内提示、空 / 错状态、通知中心、命令面板、编辑冲突。页面不写一行控件样式。
import { CommandPaletteShowcase } from "./CommandPaletteShowcase";
import { NotificationCenterShowcase } from "./NotificationCenterShowcase";
import { ConfirmDemo, DialogsDemo, SheetsDemo } from "./overlays-demo-dialogs";
import { MenusDemo, PopoverDemo, ToastsDemo } from "./overlays-demo-feedback";
import { ConflictDemo, StatesDemo } from "./overlays-demo-states";

/** `active`: this page is showing, so its command palette demo owns Ctrl / ⌘ K. */
export function OverlaysShowcase({ active = true }: { active?: boolean }) {
  return (
    <div className="aui-stack">
      <DialogsDemo />
      <ConfirmDemo />
      <SheetsDemo />
      <MenusDemo />
      <PopoverDemo />
      <ToastsDemo />
      <StatesDemo />
      <NotificationCenterShowcase />
      <CommandPaletteShowcase enabled={active} />
      <ConflictDemo />
    </div>
  );
}
