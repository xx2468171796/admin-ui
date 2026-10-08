import { useEffect, useMemo, useState } from "react";
import { Rows3, Share2, UserRoundCheck, Users } from "lucide-react";
import { Button, DescriptionList, GrantList, PageBody, PageHeader, Panel, SegmentedControl, ShareDialog, useNotify, type GrantEntry, type ShareGrant, type ShareSettings } from "@adminui/react";
import { OrgPicker, OrgPickerField, type OrgPick, type PickedSubject } from "@adminui/react/org-picker";
import { DEMO_DEPARTED, DEMO_FOCUS, DEMO_TABS, DEMO_VIEWERS, createDemoOrgSource, demoAvailability, demoShortcuts, type DemoViewer } from "./org-picker-demo";
import { SHARE_SETTINGS, demoNow } from "./share-demo";

// 组织选人示例（样稿 A–I）：选人弹框（部门树 | 成员 | 已选）、单选转交、只选人最多 5 个、
// 行内输入（立刻进名单 / 攒成标签再添加）、授权名单 GrantList 和分享「指定的人」接 orgSource。
// 数据是内存里的一个集团（集团总部 + 华南 / 深圳子公司、500 人的客服中心、已离职的李俊杰）；真项目的 OrgDataSource
// 由服务端按看的人的可授权范围过滤，组件只负责显示和交互。
const LEVELS = [
  { value: "read", label: "可读" },
  { value: "write", label: "可读写" },
  { value: "manage", label: "管理" },
];
const SHARE_LEVELS = [
  { value: "view", label: "只能看" },
  { value: "comment", label: "可评论" },
  { value: "edit", label: "可编辑" },
];

type Mode = "share" | "transfer" | "max" | "late";

function PickText({ picks }: { picks: readonly OrgPick[] }) {
  if (!picks.length) return <span className="aui-note">还没有选</span>;
  return <code>{JSON.stringify(picks)}</code>;
}

export function OrgPickerShowcase() {
  const notify = useNotify();
  const source = useMemo(() => createDemoOrgSource(), []);
  const [viewer, setViewer] = useState<DemoViewer>("wang");
  const [mode, setMode] = useState<Mode | null>(null);
  // 以前分享过、后来离职的李俊杰还在名单里：右栏划掉写「已离职」，确定时不会悄悄去掉
  const [shared, setShared] = useState<PickedSubject[]>([DEMO_DEPARTED]);
  const [owner, setOwner] = useState<PickedSubject[]>([]);
  const [five, setFive] = useState<PickedSubject[]>([]);
  const [lastPicks, setLastPicks] = useState<OrgPick[]>([]);
  const [inline, setInline] = useState<PickedSubject[]>([]);
  const [batch, setBatch] = useState<PickedSubject[]>([]);
  const [grants, setGrants] = useState<GrantEntry[]>([
    { id: "hn-g2", kind: "dept", name: "二组", hint: "华南子公司 › 销售部", level: "read", includeSub: true },
    { id: "lijj", kind: "user", name: "李俊杰", hint: "华南子公司 › 销售部 › 一组", level: "write", status: "left" },
  ]);
  const [shareOpen, setShareOpen] = useState(false);
  const [settings, setSettings] = useState<ShareSettings>({ ...SHARE_SETTINGS, audience: "people" });
  const [people, setPeople] = useState<ShareGrant[]>([]);
  const availability = useMemo(() => demoAvailability(viewer), [viewer]);
  const shortcuts = useMemo(() => demoShortcuts(viewer), [viewer]);
  const common = { source, availability, defaultFocus: DEMO_FOCUS[viewer], shortcuts };
  // 「我的部门」由宿主另一个接口给、比弹框晚到：defaultFocus 晚到时弹框要重新定位，不能停在骨架上。
  const [lateFocus, setLateFocus] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (mode !== "late") return setLateFocus(undefined);
    const timer = window.setTimeout(() => setLateFocus(DEMO_FOCUS[viewer]), 600);
    return () => window.clearTimeout(timer);
  }, [mode, viewer]);
  const viewerLabel = DEMO_VIEWERS.find((v) => v.value === viewer)?.label ?? "";
  return (
    <>
      <PageHeader title="组织选人" description="所有「分享 / 授权给人、部门、角色、业务线、公司」的地方用同一个选择器：OrgPicker（大弹框）+ OrgPickerField（行内输入），数据走宿主的 OrgDataSource。" />
      <PageBody>
        <Panel
          title="选人弹框"
          description="左部门树（勾部门 = 含下级）、中间点中部门的人、右边已选；打开时停在「我」的部门但不勾。换身份看范围：别的公司对没有跨集团授权的人隐藏，本公司管不着的部门灰掉带锁写找谁开。"
          actions={<SegmentedControl size="sm" label="打开的人" value={viewer} options={DEMO_VIEWERS} onValueChange={setViewer} />}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button onClick={() => setMode("share")}>
              <Share2 />
              分享给同事
            </Button>
            <Button variant="outline" onClick={() => setMode("transfer")}>
              <UserRoundCheck />
              转交负责人（单选）
            </Button>
            <Button variant="outline" onClick={() => setMode("max")}>
              <Users />
              培训指派（只选人 · 最多 5 个）
            </Button>
            <Button variant="outline" onClick={() => setMode("late")}>
              <Share2 />
              分享（「我的部门」晚到）
            </Button>
          </div>
          <DescriptionList
            items={[
              { label: "分享给", value: shared.length ? shared.map((s) => s.label).join("、") : "—" },
              { label: "新负责人", value: owner[0]?.label ?? "—" },
              { label: "培训对象", value: five.length ? five.map((s) => s.label).join("、") : "—" },
              { label: "最近一次输出", value: <PickText picks={lastPicks} /> },
            ]}
          />
        </Panel>
        <Panel title="行内输入" description="点进去不打字给「我的部门 + 最近」，打字按 人 / 部门 / 角色 / 业务线 分组带路径，回车选第一个；「组织架构」打开大弹框。左：选了立刻进名单；右：先攒成标签，点「添加 N 个」。">
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <OrgPickerField
              {...common}
              extraSources={DEMO_TABS}
              value={inline}
              onChange={(next, picks) => {
                setInline(next);
                setLastPicks(picks);
              }}
              suggestions={[shortcuts[1]?.subject, shortcuts[0]?.subject].filter((s): s is PickedSubject => Boolean(s))}
              dialogTitle={`添加成员 · ${viewerLabel}`}
            />
            <OrgPickerField
              {...common}
              commit="batch"
              value={batch}
              onChange={(next) => {
                setBatch(next);
                notify(`已添加 ${next.length - batch.length} 个`, "success");
              }}
              placeholder="攒几个再一起添加"
              dialogTitle="添加成员"
            />
          </div>
          <DescriptionList items={[{ label: "立刻进名单", value: inline.map((s) => s.label).join("、") || "—" }, { label: "攒好添加的", value: batch.map((s) => s.label).join("、") || "—" }]} />
        </Panel>
        <Panel title="授权名单接组织选人" description="GrantList 给 orgSource：添加框换成组织选人（懒加载），已经在名单里的灰着写「已授权 · 可读写」；已离职但还在名单里的标「已离职」，要手动去掉。">
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
        </Panel>
        <Panel title="分享「指定的人」" description="ShareDialog 的 people.orgSource：「谁能打开」选「指定的人」时下面就是同一个行内输入 + 名单。">
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 />
            分享客户记录
          </Button>
        </Panel>
      </PageBody>
      <OrgPicker
        {...common}
        defaultFocus={lateFocus}
        open={mode === "late"}
        onClose={() => setMode(null)}
        title="分享给同事（定位晚到）"
        value={shared}
        onChange={(next, picks) => {
          setShared(next);
          setLastPicks(picks);
        }}
      />
      <OrgPicker
        {...common}
        open={mode === "share"}
        onClose={() => setMode(null)}
        title="分享给同事"
        description="客户记录「赵静怡（徐汇区别墅）」· 选的人按下一步设的权限能看"
        extraSources={DEMO_TABS}
        value={shared}
        lockedHint="跨公司分享要集团管理员（王总）开通"
        onChange={(next, picks) => {
          setShared(next);
          setLastPicks(picks);
        }}
      />
      <OrgPicker
        {...common}
        open={mode === "transfer"}
        onClose={() => setMode(null)}
        mode="single"
        selectable={["person"]}
        title="转交客户 · 孙佳宁"
        description="接手人会收到通知"
        existing={{ "person:wang": "已授权 · 现在的负责人" }}
        value={owner}
        onChange={(next, picks) => {
          setOwner(next);
          setLastPicks(picks);
        }}
      />
      <OrgPicker
        {...common}
        open={mode === "max"}
        onClose={() => setMode(null)}
        selectable={["person"]}
        max={5}
        title="培训指派 · 新人服务规范"
        value={five}
        onChange={(next, picks) => {
          setFive(next);
          setLastPicks(picks);
        }}
      />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="赵静怡（徐汇区别墅）"
        objectLabel="客户记录"
        objectIcon={<Rows3 />}
        meta="小王 10-05 创建 · 改了立刻生效"
        link={{ url: "https://app.example.com/s/Q8mZt3", token: "Q8mZt3" }}
        settings={settings}
        onChange={setSettings}
        audiences={["org", "people"]}
        people={{
          subjects: [],
          value: people,
          onChange: setPeople,
          levels: SHARE_LEVELS,
          locked: [{ id: "wang", name: "小王", tag: "负责人", hint: "默认能看，去不掉", level: "edit" }],
          orgSource: source,
          orgPicker: { ...common, extraSources: DEMO_TABS, dialogTitle: "分享给同事" },
        }}
        now={demoNow}
      />
    </>
  );
}
