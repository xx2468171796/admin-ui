import { Avatar } from "@adminui/react";
import { PEOPLE } from "../../data/demo-data";

/** 5 档尺寸；颜色按账号 id 固定；照片 / 机器人 / 已离职 / 部门；在线状态点。 */
export function Demo() {
  const row = { display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" } as const;
  const [lin, chen, wang] = PEOPLE;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={row}>
        {([20, 24, 32, 40, 64] as const).map((size) => (
          <span key={size} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <Avatar name="林晓" id="u01" size={size} />
            <small>{size}</small>
          </span>
        ))}
      </div>
      <div style={row}>
        {PEOPLE.map((p) => (
          <Avatar key={p.id} name={p.name} id={p.id} tooltip={`${p.name} · ${p.title}`} />
        ))}
      </div>
      <div style={row}>
        <Avatar name={lin?.name ?? ""} id={lin?.id} presence="on" tooltip="林晓 · 在线" />
        <Avatar name={chen?.name ?? ""} id={chen?.id} presence="away" tooltip="陈一鸣 · 离开" />
        <Avatar name={wang?.name ?? ""} id={wang?.id} presence="off" tooltip="王佳宁 · 离线" />
        <Avatar name="自动分配机器人" kind="bot" tooltip="自动分配机器人" />
        <Avatar name="张晨" kind="gone" tooltip="张晨（已离职）" />
        <Avatar name="华东销售组" kind="group" tooltip="华东销售组" />
      </div>
    </div>
  );
}
