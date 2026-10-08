import { useMemo, useState } from "react";
import { Share2, UserRoundCheck, Users } from "lucide-react";
import { Button, DescriptionList, SegmentedControl } from "@adminui/react";
import { OrgPicker, type PickedSubject } from "@adminui/react/org-picker";
import { DEMO_DEPARTED, DEMO_TABS, DEMO_VIEWERS, createDemoOrgSource, demoViewerProps, type DemoViewer } from "../../data/org-picker-data";

/**
 * 桌面三栏：部门树 | 成员 | 已选。三种用法：分享（多选，带角色 / 业务线 / 公司分页，名单里有一个已离职的人）、
 * 转交负责人（单选、只选人）、培训指派（只选人、最多 5 个）。换「打开的人」看管辖范围：别的公司隐藏，管不着的部门灰掉带锁。
 */
type Mode = "share" | "transfer" | "max";
const names = (list: readonly PickedSubject[]) => (list.length ? list.map((s) => s.label).join("、") : "—");

export function Demo() {
  const source = useMemo(() => createDemoOrgSource(), []);
  const [viewer, setViewer] = useState<DemoViewer>("wang");
  const [mode, setMode] = useState<Mode | null>(null);
  const [shared, setShared] = useState<PickedSubject[]>([DEMO_DEPARTED]);
  const [owner, setOwner] = useState<PickedSubject[]>([]);
  const [five, setFive] = useState<PickedSubject[]>([]);
  const common = useMemo(() => ({ source, ...demoViewerProps(viewer) }), [source, viewer]);
  const close = () => setMode(null);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <SegmentedControl size="sm" label="打开的人" value={viewer} options={DEMO_VIEWERS} onValueChange={setViewer} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button onClick={() => setMode("share")}>
          <Share2 aria-hidden="true" />
          分享给同事
        </Button>
        <Button variant="outline" onClick={() => setMode("transfer")}>
          <UserRoundCheck aria-hidden="true" />
          转交负责人（单选）
        </Button>
        <Button variant="outline" onClick={() => setMode("max")}>
          <Users aria-hidden="true" />
          培训指派（只选人 · 最多 5 个）
        </Button>
      </div>
      <DescriptionList
        items={[
          { label: "分享给", value: names(shared) },
          { label: "新负责人", value: names(owner) },
          { label: "培训对象", value: names(five) },
        ]}
      />
      <OrgPicker
        {...common}
        open={mode === "share"}
        onClose={close}
        title="分享给同事"
        description="客户记录「远航精密制造」· 选的人按下一步设的权限能看"
        extraSources={DEMO_TABS}
        value={shared}
        lockedHint="跨公司分享要集团管理员（王总）开通"
        onChange={setShared}
      />
      <OrgPicker
        {...common}
        open={mode === "transfer"}
        onClose={close}
        mode="single"
        selectable={["person"]}
        title="转交客户 · 远航精密制造"
        description="接手人会收到通知"
        existing={{ "person:wang": "已授权 · 现在的负责人" }}
        value={owner}
        onChange={setOwner}
      />
      <OrgPicker {...common} open={mode === "max"} onClose={close} selectable={["person"]} max={5} title="培训指派 · 新人服务规范" value={five} onChange={setFive} />
    </div>
  );
}
