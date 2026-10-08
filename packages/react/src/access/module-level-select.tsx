"use client";
/**
 * 档位下拉（ModulePermissionEditor 内部用）：每一项 = 档名 + 一句说明；编辑人授不出的档灰掉、钥匙图标、
 * 说明换成原因；底部一行小字说明模块没有的档。值是 null（自定义）时触发器显示「自定义」虚线框。
 * 用 Radix Select（listbox 语义、键盘、挂 Provider 的 portal），和 `Choice` 同一套样式。
 */
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, KeyRound } from "lucide-react";
import { useAdminTheme } from "../theme.tsx";
import { CUSTOM_LEVEL_LABEL, levelBlocked, levelHint, levelLabel, levelsNote, moduleLevels, type AccessLevelId, type ModuleAccessDef } from "./module-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type ModuleLevelSelectProps = {
  def: ModuleAccessDef;
  value: AccessLevelId | null;
  onChange: (level: AccessLevelId) => void;
  changed?: boolean;
  disabled?: boolean;
  /** 手机上更高（44px）。 */
  touch?: boolean;
};

export function ModuleLevelSelect({ def, value, onChange, changed, disabled, touch }: ModuleLevelSelectProps) {
  const { portal } = useAdminTheme();
  const note = levelsNote(def);
  return (
    <SelectPrimitive.Root value={value ?? ""} onValueChange={(v) => onChange(v as AccessLevelId)} disabled={disabled}>
      <SelectPrimitive.Trigger
        className="aui-input aui-select aui-am-level"
        aria-label={`${def.label} 档位`}
        data-changed={changed || undefined}
        data-custom={value === null || undefined}
        data-touch={touch || undefined}
        title={value === null ? "角色现在的勾选和任何一档都对不上" : undefined}
      >
        <SelectPrimitive.Value placeholder={CUSTOM_LEVEL_LABEL} />
        <SelectPrimitive.Icon>
          <ChevronDown size={15} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      {portal && (
        <SelectPrimitive.Portal container={portal}>
          <SelectPrimitive.Content className="aui-select-content aui-am-level-menu" position="popper" sideOffset={4}>
            <SelectPrimitive.Viewport>
              {moduleLevels(def).map((id) => {
                const blocked = levelBlocked(def, id);
                return (
                  <SelectPrimitive.Item key={id} value={id} disabled={!!blocked} className="aui-select-item aui-am-level-item" data-blocked={blocked ? true : undefined}>
                    <span className="aui-am-level-mark" aria-hidden="true">
                      {blocked ? <KeyRound size={13} /> : <SelectPrimitive.ItemIndicator><Check size={14} /></SelectPrimitive.ItemIndicator>}
                    </span>
                    <span className="aui-am-level-text">
                      <SelectPrimitive.ItemText>{levelLabel(def, id)}</SelectPrimitive.ItemText>
                      <small>{blocked ?? levelHint(def, id)}</small>
                    </span>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
            {note && <div className="aui-am-level-note">{note}</div>}
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      )}
    </SelectPrimitive.Root>
  );
}

/** 只读时的档位 / 范围框（没有箭头，不能点）。 */
export function StaticBox({ children, label }: { children: string; label: string }) {
  return (
    <span className="aui-am-static" aria-label={`${label}：${children}`}>
      {children}
    </span>
  );
}
