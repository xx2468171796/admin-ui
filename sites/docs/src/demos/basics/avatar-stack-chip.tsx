import { AvatarStack, PersonChip } from "@adminui/react";
import { PEOPLE } from "../../data/demo-data";

/** 叠放头像：悬停单个看「名字 · 在做什么」，点「+k」列出其余的人；人员块用在字段值、协作人。 */
export function Demo() {
  const viewers = PEOPLE.slice(0, 7).map((p, i) => ({ key: p.id, name: p.name, hint: i === 0 ? "在编辑" : p.title }));
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          正在看 <AvatarStack label="正在看的人" people={viewers} />
        </span>
        <AvatarStack label="项目成员" people={viewers.slice(0, 5)} size={32} max={4} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span>协作人：</span>
        <PersonChip name="陈一鸣" id="u02" hint="华东销售组 · 客户经理" />
        <PersonChip name="周可欣" id="u05" hint="客户成功部" />
        <PersonChip name="张晨" kind="gone" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <span>表格里（不加底）：</span>
        <PersonChip name="王佳宁" id="u03" plain />
        <PersonChip name="赵思远" id="u04" plain />
      </div>
    </div>
  );
}
