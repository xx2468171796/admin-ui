import { useState } from "react";
import { Plus, RefreshCw, UserPlus } from "lucide-react";
import {
  Button,
  DataTable,
  DescriptionList,
  ListDetailLayout,
  LogTimeline,
  Pane,
  PaneSection,
  Panel,
  QueryBar,
  ResourcePanel,
  SegmentedControl,
  SelectList,
  StatusBadge,
  TabbedPage,
  WorkspaceLayout,
  useNotify,
  type Column,
} from "@adminui/react";

// 8.6 页面贴边（2026-10-09）：同一个 TabbedPage 里「角色」是工作区、「部门」是普通 ResourcePanel + DataTable，
// 两个分区看起来一样——白底贴边、没有灰色画布、块与块之间一条线；只有一个带标题的块时不再重复标题（标题只留给读屏）。
// 「成员」= 两块上下叠（标题都保留，用来区分），「审计」= 筛选 + 按天分组的日志，「审批」= 列表 | 详情撑满到底。
// 「包装层」= 项目自己带 class 的包装层加 data-aui-flow="stack"（8.6.1）：包装层自己有 gap，里面再套一层，照样贴边、块之间一条线。
// 另有「租户成员」页：TabbedPage 只有一个分区时不出分区标签条；「单块数量」页：单块列表数量被页脚代替时不留空行。数据都是演示的。
const SECTIONS = [
  { id: "roles", label: "角色" },
  { id: "depts", label: "部门" },
  { id: "members", label: "成员" },
  { id: "audit", label: "审计" },
  { id: "approval", label: "审批" },
  { id: "wrap", label: "包装层" },
];

type Dept = { id: string; name: string; leader: string; people: number; status: "on" | "off" };
const DEPTS: Dept[] = [
  { id: "d1", name: "总经办", leader: "周经理", people: 3, status: "on" },
  { id: "d2", name: "大客户部", leader: "陈主管", people: 12, status: "on" },
  { id: "d3", name: "直营组", leader: "小赵", people: 6, status: "on" },
  { id: "d4", name: "财务部", leader: "未设置", people: 0, status: "off" },
];
const deptColumns: Column<Dept>[] = [
  { key: "name", title: "部门", render: (d) => <strong>{d.name}</strong> },
  { key: "leader", title: "负责人", render: (d) => d.leader },
  { key: "people", title: "人数", align: "right", render: (d) => d.people },
  { key: "status", title: "状态", render: (d) => <StatusBadge tone={d.status === "on" ? "success" : "neutral"}>{d.status === "on" ? "启用" : "停用"}</StatusBadge> },
];

type Member = { id: string; name: string; role: string; joined: string; status: "on" | "off" };
const MEMBERS: Member[] = [
  { id: "m1", name: "管理员", role: "子公司管理员", joined: "2026-10-05", status: "on" },
  { id: "m2", name: "周经理", role: "部门主管", joined: "2026-10-05", status: "on" },
  { id: "m3", name: "小赵", role: "员工 · 销售", joined: "2026-10-06", status: "on" },
  { id: "m4", name: "小孙", role: "员工", joined: "2026-10-07", status: "off" },
];
const memberColumns: Column<Member>[] = [
  { key: "name", title: "成员", render: (m) => <strong>{m.name}</strong> },
  { key: "role", title: "本租户角色", render: (m) => m.role },
  { key: "status", title: "状态", render: (m) => <StatusBadge tone={m.status === "on" ? "success" : "neutral"}>{m.status === "on" ? "正常" : "已停用"}</StatusBadge> },
  { key: "joined", title: "加入时间", render: (m) => m.joined },
];

const ROLES = [
  { key: "admin", title: "子公司管理员", meta: "1" },
  { key: "leader", title: "部门主管", meta: "2" },
  { key: "staff", title: "员工", meta: "9" },
];
function RolesSection() {
  const [role, setRole] = useState("admin");
  const current = ROLES.find((r) => r.key === role) ?? ROLES[0]!;
  return (
    <WorkspaceLayout left={<Pane label="角色列表"><SelectList label="角色" items={ROLES} selected={role} onSelect={setRole} /></Pane>}>
      <Pane title={current.title} label="角色详情" padding="md">
        <PaneSection title="能做什么">查看本公司客户、跟进记录；导出需要审批。</PaneSection>
        <PaneSection title="成员">{current.meta} 人</PaneSection>
      </Pane>
    </WorkspaceLayout>
  );
}

function DeptsSection() {
  const notify = useNotify();
  return (
    <ResourcePanel title="部门" count={DEPTS.length} unit="个" description="部门树在「部门与授权」里改；这里只列出来。"
      actions={<Button size="sm" onClick={() => notify("新建部门（演示）", "info")}><Plus />新建部门</Button>}>
      <DataTable caption="部门" rows={DEPTS} rowKey={(d) => d.id} columns={deptColumns} pagination={{ mode: "all" }} />
    </ResourcePanel>
  );
}

function MembersBlocks() {
  const notify = useNotify();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const rows = MEMBERS.filter((m) => (status === "all" || m.status === status) && (!query || m.name.includes(query)));
  return (
    <>
      <Panel title="当前租户" actions={<Button size="sm" onClick={() => notify("添加成员（演示）", "info")}><UserPlus />添加成员</Button>}>
        <DescriptionList columns={3} items={[{ label: "租户", value: "集团总部（演示）" }, { label: "套餐", value: "内部子公司" }, { label: "状态", value: <StatusBadge tone="success">正常</StatusBadge> }]} />
      </Panel>
      <ResourcePanel title="成员" count={rows.length} actions={<Button size="sm" variant="outline" onClick={() => notify("已刷新（演示）", "info")}><RefreshCw />刷新</Button>}
        filters={<div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <QueryBar variant="bare" value={draft} onChange={setDraft} onSearch={() => setQuery(draft.trim())} onReset={() => { setDraft(""); setQuery(""); }} placeholder="搜姓名、编号、角色" />
          <SegmentedControl size="sm" label="状态" value={status} onValueChange={setStatus} options={[{ value: "all", label: "全部" }, { value: "on", label: "正常" }, { value: "off", label: "已停用" }]} />
        </div>}>
        <DataTable caption="成员" rows={rows} rowKey={(m) => m.id} columns={memberColumns} pagination={{ mode: "all" }} />
      </ResourcePanel>
    </>
  );
}

type Audit = { id: string; at: string; actor: string; text: string; target: string };
const AUDIT: Audit[] = [
  { id: "a1", at: "2026-10-09T11:24:00+08:00", actor: "管理员", text: "业务线「hq_key」补上模板新字段 1 个", target: "crm · line hq_key" },
  { id: "a2", at: "2026-10-09T10:52:00+08:00", actor: "管理员", text: "打开文档（协同编辑）", target: "知识库 · 客户跟进指南" },
  { id: "a3", at: "2026-10-09T10:45:00+08:00", actor: "周经理", text: "把小赵加进「直营组」", target: "部门 · 直营组" },
  { id: "a4", at: "2026-10-08T17:30:00+08:00", actor: "管理员", text: "停用成员小孙", target: "成员 · 小孙" },
  { id: "a5", at: "2026-10-08T09:12:00+08:00", actor: "陈主管", text: "导出客户表（审批通过）", target: "crm · 客户" },
];
function AuditPanel() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("7d");
  const items = AUDIT.filter((a) => !query || a.actor.includes(query));
  return (
    <ResourcePanel title="审计" description="谁在什么时候改了什么；只读。"
      filters={<div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <QueryBar variant="bare" value={draft} onChange={setDraft} onSearch={() => setQuery(draft.trim())} onReset={() => { setDraft(""); setQuery(""); }} placeholder="操作人账号名（回车搜索）" />
        <SegmentedControl size="sm" label="时间" value={range} onValueChange={setRange} options={[{ value: "1d", label: "近 24 小时" }, { value: "7d", label: "近 7 天" }, { value: "30d", label: "近 30 天" }]} />
      </div>}>
      <LogTimeline caption="审计记录" items={items} getId={(a) => a.id} time={(a) => a.at} actor={(a) => ({ name: a.actor })} text={(a) => a.text} target={(a) => a.target}
        timeZone="Asia/Shanghai" now={Date.parse("2026-10-09T12:00:00+08:00")} />
    </ResourcePanel>
  );
}

const REQUESTS = [
  { key: "r1", title: "折扣申请 · 华南电器", hint: "小赵 · 待周经理审批" },
  { key: "r2", title: "请假 · 10-12", hint: "小孙 · 已批准" },
];
function ApprovalSection() {
  const [picked, setPicked] = useState("r1");
  const current = REQUESTS.find((r) => r.key === picked) ?? REQUESTS[0]!;
  return (
    <Panel flush>
      <ListDetailLayout list={<SelectList label="申请" items={REQUESTS} selected={picked} onSelect={setPicked} />}>
        <Pane title={current.title} label="申请详情" padding="md" bare>
          <DescriptionList columns={1} items={[{ label: "申请人", value: current.hint.split(" · ")[0] }, { label: "进度", value: current.hint.split(" · ")[1] }]} />
        </Pane>
      </ListDetailLayout>
    </Panel>
  );
}

// 项目自己的样式：包装层有 class 和 gap（下游项目的 .tc-stack 就是这样）；加了 data-aui-flow="stack" 后 gap 清零、不离边。
const HOST_CSS = ".pf-host-stack { display:flex; flex-direction:column; gap:12px; } .pf-host-inner { display:grid; gap:16px; }";
function WrapperSection() {
  return (
    <div className="pf-host-stack" data-aui-flow="stack">
      <style>{HOST_CSS}</style>
      <Panel title="包装层概况">
        <DescriptionList columns={3} items={[{ label: "包装层", value: "div.pf-host-stack" }, { label: "自己的 gap", value: "12px" }, { label: "标记", value: "data-aui-flow=\"stack\"" }]} />
      </Panel>
      <div className="pf-host-inner" data-aui-flow="stack">
        <ResourcePanel title="包装层成员" count={MEMBERS.length}>
          <DataTable caption="包装层成员" rows={MEMBERS} rowKey={(m) => m.id} columns={memberColumns} pagination={{ mode: "all" }} />
        </ResourcePanel>
      </div>
    </div>
  );
}

export function PageFlushShowcase() {
  const [section, setSection] = useState("depts");
  return (
    <TabbedPage title="页面贴边" description="8.6：普通页面和工作区一样贴边——白底、没有灰色画布、块与块之间一条线；页面只有一个带标题的块时不重复标题。"
      sections={SECTIONS} value={section} onValueChange={setSection}
      render={(id) => id === "roles" ? <RolesSection /> : id === "depts" ? <DeptsSection /> : id === "members" ? <MembersBlocks /> : id === "audit" ? <AuditPanel /> : id === "wrap" ? <WrapperSection /> : <ApprovalSection />} />
  );
}

/** TabbedPage with one section: no tab row (a lone 「租户成员」 tab only repeats the page name). */
export function SingleSectionShowcase() {
  return (
    <TabbedPage title="租户成员" sections={[{ id: "members", label: "租户成员" }]} value="members" onValueChange={() => {}} render={() => <MembersBlocks />} />
  );
}

// 8.6.1：页面里只有一个列表、表格页脚已经写了「共 N 条」时数量不再重复；这时工具行里什么都不剩就不出这一行。
// 这个 TabbedPage 没有说明（页面没有「?」），各分区看不同组合。
const LEAD_SECTIONS = [
  { id: "count", label: "仅数量" },
  { id: "help", label: "数量和说明" },
  { id: "actions", label: "数量和按钮" },
  { id: "cursor", label: "游标分页" },
  { id: "panel", label: "Panel 数量" },
];
function LeadCountSection({ id }: { id: string }) {
  const notify = useNotify();
  const [pageIndex, setPageIndex] = useState(0);
  const table = (cursor: boolean) => (
    <DataTable caption="部门" rows={DEPTS} rowKey={(d) => d.id} columns={deptColumns}
      pagination={cursor ? { mode: "cursor", pageIndex, pageSize: 20, onPageSizeChange: () => {}, canPrev: pageIndex > 0, canNext: false, onPrev: () => setPageIndex((i) => i - 1), onNext: () => setPageIndex((i) => i + 1) } : { mode: "all" }} />
  );
  if (id === "panel") return <Panel title="部门" count={`${DEPTS.length} 个`}>{table(false)}</Panel>;
  return (
    <ResourcePanel title="部门" count={DEPTS.length}
      description={id === "help" ? "部门树在「部门与授权」里改；这里只列出来。" : undefined}
      actions={id === "actions" ? <Button size="sm" onClick={() => notify("新建部门（演示）", "info")}><Plus />新建部门</Button> : undefined}>
      {table(id === "cursor")}
    </ResourcePanel>
  );
}
export function LeadCountShowcase() {
  const [section, setSection] = useState("count");
  return <TabbedPage title="单块数量" sections={LEAD_SECTIONS} value={section} onValueChange={setSection} render={(id) => <LeadCountSection id={id} />} />;
}
