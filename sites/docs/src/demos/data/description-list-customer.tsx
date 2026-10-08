import { useState } from "react";
import { CellTags, CopyableValue, DescriptionList, Panel, PersonChip, SegmentedControl } from "@adminui/react";
import { CUSTOMERS, STAGES, formatAmount, personName } from "../../data/demo-data";

const c = CUSTOMERS[0];
const stage = STAGES.find((s) => s.value === c?.stage);

/** 客户资料：每项标签在上、值在下；值按类型渲染（人员、标签、可复制的编号、金额）；空值写「—」，补充说明跟在后面。 */
export function Demo() {
  const [columns, setColumns] = useState<"1" | "2" | "3">("2");
  if (!c) return null;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <SegmentedControl size="sm" label="列数" value={columns} onValueChange={setColumns}
        options={[{ value: "1", label: "一列" }, { value: "2", label: "两列" }, { value: "3", label: "三列" }]} />
      </div>
      <Panel title={c.name}>
        <DescriptionList
          columns={Number(columns) as 1 | 2 | 3}
          items={[
            { label: "客户编号", value: <CopyableValue variant="inline" value={c.id} label="客户编号" /> },
            { label: "阶段", value: stage ? <CellTags items={[{ label: stage.label, tone: stage.tone }]} /> : null },
            { label: "负责人", value: <PersonChip plain name={personName(c.owner)} id={c.owner} /> },
            { label: "行业", value: c.industry },
            { label: "合同金额", value: formatAmount(c.amount), hint: "含税，按年付" },
            { label: "席位", value: `${c.seats} 个` },
            { label: "创建日期", value: c.createdAt },
            { label: "合同到期", value: null, hint: "还没有签约" },
            { label: "备注", value: "希望先在一个部门试用两周，再决定全员上线；IT 负责人要求支持单点登录。", full: true },
          ]}
        />
      </Panel>
    </div>
  );
}
