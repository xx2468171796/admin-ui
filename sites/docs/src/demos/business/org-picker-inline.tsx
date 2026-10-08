import { useMemo, useState } from "react";
import { DescriptionList, GrantList, useNotify, type GrantEntry } from "@adminui/react";
import { OrgPickerField, type PickedSubject } from "@adminui/react/org-picker";
import { DEMO_TABS, createDemoOrgSource, demoViewerProps } from "../../data/org-picker-data";

/**
 * 行内输入 OrgPickerField：空着点进去给「我的部门 + 我」，打字按 人 / 部门 / 角色 / 业务线 分组带路径；「组织架构」打开大弹窗。
 * 左边选了立刻进名单，右边先攒成标签再点「添加 N 个」。下面是授权名单 GrantList 接 orgSource（懒加载组织选人）。
 */
const LEVELS = [
  { value: "read", label: "可读" },
  { value: "write", label: "可读写" },
  { value: "manage", label: "管理" },
];

export function Demo() {
  const notify = useNotify();
  const source = useMemo(() => createDemoOrgSource(), []);
  const common = useMemo(() => ({ source, ...demoViewerProps("wang") }), [source]);
  const suggestions = useMemo(() => common.shortcuts.slice(0, 2).map((s) => s.subject).reverse(), [common]);
  const [inline, setInline] = useState<PickedSubject[]>([]);
  const [batch, setBatch] = useState<PickedSubject[]>([]);
  const [grants, setGrants] = useState<GrantEntry[]>([
    { id: "hn-g2", kind: "dept", name: "二组", hint: "华南子公司 › 销售部", level: "read", includeSub: true },
    { id: "liwb", kind: "user", name: "李文博", hint: "华南子公司 › 销售部 › 一组", level: "write", status: "left" },
  ]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <OrgPickerField {...common} extraSources={DEMO_TABS} value={inline} onChange={setInline} suggestions={suggestions} dialogTitle="添加成员" />
        <OrgPickerField
          {...common}
          commit="batch"
          value={batch}
          onChange={(next) => {
            notify(`已添加 ${next.length - batch.length} 个`, "success");
            setBatch(next);
          }}
          placeholder="攒几个再一起添加"
          dialogTitle="添加成员"
        />
      </div>
      <DescriptionList
        items={[
          { label: "立刻进名单", value: inline.map((s) => s.label).join("、") || "—" },
          { label: "攒好添加的", value: batch.map((s) => s.label).join("、") || "—" },
        ]}
      />
      <GrantList
        mode="picked"
        label="字段权限 · 认领时间"
        title="再授权给"
        levelsHint="可读 / 可读写 / 管理（能再分给别人）"
        subjects={[]}
        value={grants}
        onChange={setGrants}
        levels={LEVELS}
        locked={[{ id: "wang", name: "小王", tag: "负责人", hint: "你 · 默认能改", level: "write" }]}
        addPlaceholder="添加人、部门或角色"
        orgSource={source}
        orgPicker={{ ...common, extraSources: DEMO_TABS, dialogTitle: "字段权限 · 认领时间 · 再授权给" }}
      />
    </div>
  );
}
