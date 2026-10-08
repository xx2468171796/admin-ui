import { ACTION_ICONS, ACTION_ICON_LABELS, iconStroke, type ActionIconName } from "@adminui/react";

/** 固定的 24 个动作图标：一个意思只用一个（「编辑」永远是 ACTION_ICONS.edit）。 */
export function Demo() {
  const names = Object.keys(ACTION_ICONS) as ActionIconName[];
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
      {names.map((name) => {
        const Icon = ACTION_ICONS[name];
        return (
          <li key={name} style={{ display: "grid", justifyItems: "center", gap: 6, padding: "10px 4px", textAlign: "center" }}>
            <Icon size={16} strokeWidth={iconStroke(16)} aria-hidden="true" />
            <span>{ACTION_ICON_LABELS[name]}</span>
            <span className="aui-text-note">{name}</span>
          </li>
        );
      })}
    </ul>
  );
}
