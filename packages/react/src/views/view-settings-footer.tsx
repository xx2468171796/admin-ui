"use client";
/** The footer every view settings panel shares and the change counter that feeds it. */
import { Button } from "../primitives.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

export type ViewSettingsFooterProps = {
  /** 「恢复」: the user's personal changes go away (disabled while `changes` is 0). */
  onReset?: () => void;
  /** 「另存为新视图」. */
  onSaveAsNew?: () => void;
  /** 「保存给所有人」: only for people who maintain the view — leave it out for everyone else. */
  onSaveForAll?: () => void;
  /**
   * How many settings differ from the shared view (`countSettingChanges`): > 0 shows the attention dot
   * 「已改 N 处，只对你生效」, 0 disables 「恢复」. Leave out when unknown (恢复 stays enabled).
   */
  changes?: number;
  /** Left text while nothing changed (default 「改了只对你生效」). */
  note?: string;
};
/**
 * Footer of every view settings panel (one skeleton for 卡片 / 日历 / 甘特设置): left 「改了只对你生效」
 * or ● 「已改 1 处，只对你生效」; right 恢复 · 另存为新视图 · 保存给所有人 (maintainers only). PopoverPanel `footer`.
 */
export function ViewSettingsFooter({ onReset, onSaveAsNew, onSaveForAll, changes, note = "改了只对你生效" }: ViewSettingsFooterProps) {
  const dirty = changes !== undefined && changes > 0;
  return (
    <div className="aui-vset-foot" data-dirty={dirty || undefined}>
      {dirty ? <span className="aui-vset-dirty" aria-hidden="true" /> : null}
      <span className="aui-vset-foot-note" aria-live="polite">{dirty ? <>已改 {changes} 处，只对你生效</> : note}</span>
      <span className="aui-vset-foot-actions">
        {onReset && <Button variant="ghost" size="sm" disabled={changes === 0} data-tip={changes === 0 ? "没有改动" : undefined} onClick={onReset}>恢复</Button>}
        {onSaveAsNew && <Button variant="outline" size="sm" onClick={onSaveAsNew}>另存为新视图</Button>}
        {onSaveForAll && <Button size="sm" onClick={onSaveForAll}>保存给所有人</Button>}
      </span>
    </div>
  );
}

export { countSettingChanges } from "./view-settings-core.ts";
