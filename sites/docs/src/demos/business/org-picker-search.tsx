import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, DescriptionList, SegmentedControl } from "@adminui/react";
import { OrgPicker, type OrgPick, type PickedSubject } from "@adminui/react/org-picker";
import { DEMO_TABS, DEMO_VIEWERS, createDemoOrgSource, demoViewerProps, type DemoViewer } from "../../data/org-picker-data";

/**
 * 搜索与默认定位：打开时树展开到「我」的部门并点中它（不勾）；在搜索框里试试下面这些词——人、部门、角色、业务线一起出，
 * 每条写路径。换「打开的人」：小王只看得到华南子公司，王总能搜到整个集团。
 */
const TRY = ["xw", "销售", "一组", "智能家居", "客服"];

export function Demo() {
  const source = useMemo(() => createDemoOrgSource(), []);
  const [viewer, setViewer] = useState<DemoViewer>("wang");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<PickedSubject[]>([]);
  const [picks, setPicks] = useState<OrgPick[]>([]);
  const common = useMemo(() => ({ source, ...demoViewerProps(viewer) }), [source, viewer]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SegmentedControl size="sm" label="打开的人" value={viewer} options={DEMO_VIEWERS} onValueChange={setViewer} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <Button onClick={() => setOpen(true)}>
          <Search aria-hidden="true" />
          打开选人
        </Button>
        <span className="aui-note">打开后按 / 聚焦搜索，试试：{TRY.map((w) => `「${w}」`).join(" ")}</span>
      </div>
      <DescriptionList
        items={[
          { label: "已选", value: value.length ? value.map((s) => s.label).join("、") : "—" },
          { label: "输出 picks", value: picks.length ? <code>{JSON.stringify(picks)}</code> : "—" },
        ]}
      />
      <OrgPicker
        {...common}
        open={open}
        onClose={() => setOpen(false)}
        title="添加成员"
        extraSources={DEMO_TABS}
        value={value}
        onChange={(next, out) => {
          setValue(next);
          setPicks(out);
        }}
      />
    </div>
  );
}
