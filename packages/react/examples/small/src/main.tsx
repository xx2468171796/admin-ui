// Small tier starter: a one-list admin tool built from the core entry only — shell, list page,
// form dialog, toasts, settings. No heavy peers; first screen ≈ the small-tier budget (scripts/size-budget.mjs).
// Need a table with grouping, a chart or a form builder later? Import that subpath and load it lazily — nothing is forbidden.
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Pencil, Plus, Settings, Trash2, Users } from "lucide-react";
import {
  AdminProvider,
  AdminShell,
  AppearanceButton,
  Button,
  Choice,
  DataTable,
  FormDialog,
  FormField,
  Input,
  NotificationProvider,
  PageBody,
  PageHeader,
  Panel,
  QueryBar,
  ResourcePanel,
  RowActionBar,
  StatusBadge,
  Switch,
  Textarea,
  useNotify,
  useUndoToast,
  type Column,
  type NavItem,
} from "@adminui/react";
import "@adminui/react/styles.css";

type Member = { id: string; name: string; phone: string; team: string; active: boolean; note: string };
const TEAMS = [
  { value: "sales", label: "销售一组" },
  { value: "care", label: "客服组" },
  { value: "ops", label: "运营组" },
];
const teamLabel = (value: string) => TEAMS.find((t) => t.value === value)?.label ?? value;
const SEED: Member[] = Array.from({ length: 26 }, (_, i) => ({
  id: `M${String(1001 + i)}`,
  name: ["赵静怡", "陈冠宇", "王小明", "孙佳宁", "李承恩", "黄志豪"][i % 6]! + (i >= 6 ? ` ${Math.floor(i / 6) + 1}` : ""),
  phone: `138${String(10000000 + i * 7919).slice(0, 8)}`,
  team: TEAMS[i % 3]!.value,
  active: i % 5 !== 3,
  note: "",
}));

function MemberDialog({ member, onClose, onSave }: { member: Member | null; onClose: () => void; onSave: (m: Member) => void }) {
  const [draft, setDraft] = useState<Member>(member ?? { id: "", name: "", phone: "", team: "sales", active: true, note: "" });
  const set = (patch: Partial<Member>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <FormDialog
      open
      title={member ? `编辑 ${member.name}` : "新增成员"}
      description="姓名必填，其余选填。"
      dirty={JSON.stringify(draft) !== JSON.stringify(member ?? draft)}
      onClose={onClose}
      onSubmit={async () => {
        if (!draft.name.trim()) throw new Error("请填写姓名");
        onSave({ ...draft, id: draft.id || `M${Date.now() % 100000}` });
      }}
      submitLabel="保存"
    >
      <FormField label="姓名" htmlFor="m-name" required>
        <Input id="m-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      </FormField>
      <FormField label="手机" htmlFor="m-phone" optional>
        <Input id="m-phone" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" />
      </FormField>
      <FormField label="小组" htmlFor="m-team">
        <Choice id="m-team" label="小组" value={draft.team} onChange={(team) => set({ team })} options={TEAMS} />
      </FormField>
      <FormField label="在职" htmlFor="m-active">
        <Switch id="m-active" checked={draft.active} onCheckedChange={(active) => set({ active })} />
      </FormField>
      <FormField label="备注" htmlFor="m-note" optional>
        <Textarea id="m-note" value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </FormField>
    </FormDialog>
  );
}

function Members() {
  const [rows, setRows] = useState(SEED);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Member | null | "new">(null);
  const notify = useNotify();
  const undoable = useUndoToast();
  const matched = useMemo(() => rows.filter((m) => `${m.id} ${m.name} ${m.phone}`.includes(search)), [rows, search]);
  const pageRows = matched.slice((page - 1) * pageSize, page * pageSize);
  const remove = (m: Member) =>
    void undoable({
      title: "已删除成员",
      description: m.name,
      run: () => setRows((list) => list.filter((x) => x.id !== m.id)),
      undo: () => setRows((list) => [m, ...list]),
    });
  const columns: Column<Member>[] = [
    { key: "id", title: "编号", width: 96, render: (m) => m.id },
    { key: "name", title: "姓名", render: (m) => <strong>{m.name}</strong>, mobile: "primary" },
    { key: "phone", title: "手机", render: (m) => m.phone || "—" },
    { key: "team", title: "小组", render: (m) => teamLabel(m.team) },
    { key: "active", title: "状态", width: 96, render: (m) => <StatusBadge tone={m.active ? "success" : "neutral"}>{m.active ? "在职" : "停用"}</StatusBadge>, mobile: "status" },
    {
      key: "actions", title: "操作", kind: "actions", width: 140,
      render: (m) => <RowActionBar label={`${m.name}的更多操作`} actions={[
        { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setEditing(m) },
        { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => remove(m) },
      ]} />,
    },
  ];
  return (
    <PageBody>
      <PageHeader title="成员" actions={<Button onClick={() => setEditing("new")}><Plus />新增成员</Button>} />
      <ResourcePanel title="成员" count={matched.length} unit="人"
        filters={<QueryBar value={draft} onChange={setDraft} onSearch={() => { setSearch(draft); setPage(1); }} onReset={() => { setDraft(""); setSearch(""); }} variant="flush" hits={search ? matched.length : null} />}>
        <DataTable caption="成员" columns={columns} rows={pageRows} rowKey={(m) => m.id}
          pagination={{ mode: "page", page, pageSize, total: matched.length, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }} />
      </ResourcePanel>
      {editing && (
        <MemberDialog member={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={(m) => {
            setRows((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [m, ...list]));
            setEditing(null);
            notify.show({ title: "已保存", description: m.name, tone: "success" });
          }} />
      )}
    </PageBody>
  );
}

function SettingsPage() {
  const [signup, setSignup] = useState(true);
  const [name, setName] = useState("华南子公司");
  const notify = useNotify();
  return (
    <PageBody>
      <PageHeader title="设置" />
      <Panel title="基本信息" actions={<Button onClick={() => notify.show({ title: "设置已保存", tone: "success" })}>保存</Button>}>
        <FormField label="公司名称" htmlFor="s-name">
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="开放注册" htmlFor="s-signup" hint="关掉后只有管理员能加成员">
          <Switch id="s-signup" checked={signup} onCheckedChange={setSignup} />
        </FormField>
      </Panel>
    </PageBody>
  );
}

const NAV: NavItem[] = [
  { id: "members", title: "成员", icon: Users },
  { id: "settings", title: "设置", icon: Settings },
];
function App() {
  const [active, setActive] = useState("members");
  const page = NAV.find((n) => n.id === active)!;
  return (
    <AdminShell
      brand="小工具"
      navigation={NAV}
      activeId={active}
      onNavigate={setActive}
      onCloseTab={() => undefined}
      account={{ name: "陈组长", detail: "管理员" }}
      onSignOut={() => undefined}
      headerActions={<AppearanceButton />}
      tabs={[{ id: page.id, title: page.title, icon: page.icon, closable: false, content: active === "members" ? <Members /> : <SettingsPage /> }]}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <AdminProvider storageKey="admin-ui-small" defaults={{ timeZone: "Asia/Shanghai", currency: "CNY", phoneCountry: "+86" }}>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </AdminProvider>,
);
