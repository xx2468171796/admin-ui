import { useState } from "react";
import { Button, CellTags, ChangeValue, DescriptionList, Panel, useNotify } from "@adminui/react";
import { ViewOverrideBar, normalizeGridView, type GridField } from "@adminui/react/grid";
import { STAGES } from "../../data/demo-data";

/**
 * 上：视图个人设置条——用户改了共享视图的筛选 / 分组 / 列宽，只对自己生效，一行说清楚 + 恢复 / 另存 / 保存给所有人。
 * 下：「改前 → 改后」只有一种写法 ChangeValue：旧值删除线备注色 → 新值加粗；「空」不划线。
 */
type Row = { id: string; name: string; stage: string; amount: number };
const FIELDS: GridField<Row>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES.map((s) => ({ value: s.value, label: s.label, tone: s.tone })) },
  { key: "amount", title: "预计金额", type: "number" },
];
const BASE = normalizeGridView({}, FIELDS);
const MINE = normalizeGridView({ groupBy: "stage", widths: { name: 260, amount: 140 } }, FIELDS);

export function Demo() {
  const notify = useNotify();
  const [view, setView] = useState(MINE);
  return (
    <div className="aui-stack">
      <ViewOverrideBar
        viewName="续约看板"
        base={BASE}
        view={view}
        fields={FIELDS}
        onReset={() => setView(BASE)}
        onSaveAsNew={() => notify("已另存为「我的续约看板」", "success")}
        onSaveForAll={() => notify("已保存给所有人", "success")}
      />
      {view === BASE && <Button variant="text" size="sm" onClick={() => setView(MINE)}>再改一次视图</Button>}
      <Panel title="改前 → 改后">
        <DescriptionList
          items={[
            { label: "预计金额", value: <ChangeValue before="¥360,000" after="¥388,000" /> },
            { label: "阶段", value: <ChangeValue before={<CellTags items={[{ label: "已确认需求", tone: "blue" }]} />} after={<CellTags items={[{ label: "方案报价", tone: "violet" }]} />} /> },
            { label: "下次跟进", value: <ChangeValue before={null} after="10月13日" /> },
            { label: "折扣", value: <ChangeValue before="8" after="12" unit="%" /> },
            { label: "备注", value: <ChangeValue before="约下周复盘" after="" /> },
          ]}
        />
      </Panel>
    </div>
  );
}
