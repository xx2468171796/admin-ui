import { useState } from "react";
import { ConflictChooser, DEFAULT_CONFLICT_DECISIONS, type ConflictDecisions, type ConflictRow } from "@adminui/react";

const ROWS: readonly ConflictRow[] = [
  { key: "c1:stage", record: "远航精密制造", field: "阶段", then: "方案报价", now: "商务谈判", by: "陈一鸣", at: "10-07 15:05" },
  { key: "c2:owner", record: "青禾教育", field: "负责人", then: "王佳宁", now: "赵思远", by: "林晓", at: "10-07 16:20" },
  { key: "c3:amount", record: "星河物流", field: "年费", then: "¥96,000", now: "¥88,000", by: "周可欣", at: "10-08 09:12" },
];

/**
 * 撤回 / 回到某个时间点时，有些格子后来又被别人改过：上面两张选择卡定统一规则（ConflictModePicker），
 * 每行右边一个「保留 / 退回」小分段（ConflictToggle）单独改。值交给服务端逐格重新校验。
 */
export function Demo() {
  const [value, setValue] = useState<ConflictDecisions>(DEFAULT_CONFLICT_DECISIONS);
  return (
    <ConflictChooser
      rows={ROWS}
      value={value}
      onChange={setValue}
      title="其中 3 格在 10-07 09:00 之后被别人改过"
      thenLabel="10-07 09:00 时"
    />
  );
}
