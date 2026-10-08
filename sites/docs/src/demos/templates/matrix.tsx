import { useState } from "react";
import { Plus, Shield, Users } from "lucide-react";
import {
  Button, CellText, ChangeMark, Checkbox, DataTable, ListDetailLayout, PageBody, PageHeader, Pane, Panel, SaveBar, SelectList, useNotify, type Column,
} from "@adminui/react";

type Perm = "view" | "edit" | "export" | "remove";
type Row = { id: string; name: string; note: string } & Record<Perm, boolean>;
const PERMS: readonly { key: Perm; label: string }[] = [{ key: "view", label: "查看" }, { key: "edit", label: "编辑" }, { key: "export", label: "导出" }, { key: "remove", label: "删除" }];
const BASE: Row[] = [
  { id: "customers", name: "客户", note: "只看自己负责的 + 本组", view: true, edit: true, export: false, remove: false },
  { id: "deals", name: "商机", note: "金额、阶段、预计签约", view: true, edit: true, export: false, remove: false },
  { id: "tickets", name: "工单", note: "客户提交的问题", view: true, edit: false, export: false, remove: false },
  { id: "invoices", name: "发票", note: "含金额和开票信息", view: false, edit: false, export: false, remove: false },
  { id: "reports", name: "报表", note: "销售和客户成功报表", view: true, edit: false, export: true, remove: false },
];
const SUBJECTS = [
  { key: "sales", group: "角色", icon: <Shield />, title: "客户经理", hint: "陈一鸣、王佳宁、赵思远", meta: "3 人" },
  { key: "cs", group: "角色", icon: <Shield />, title: "客户成功", hint: "周可欣", meta: "1 人" },
  { key: "fin", group: "角色", icon: <Shield />, title: "财务", hint: "孙雨桐", meta: "1 人" },
  { key: "u06", group: "成员（单独授权）", avatar: "吴", title: "吴昊", hint: "解决方案工程师 · 只读", meta: "2 项" },
  { key: "u08", group: "成员（单独授权）", avatar: "郑", title: "郑明轩", hint: "前端工程师 · 测试数据", meta: "1 项" },
];

/** T09 权限配置页：左边选角色或成员，右边对象 × 权限的勾选格；改过的格带浅色框，下面一条改动汇总。手机上先列表、点进详情。 */
export function Demo() {
  const notify = useNotify();
  const [subject, setSubject] = useState<string | null>("sales");
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(BASE);
  // 演示：一开始就有一处没保存的改动（客户 加上导出）。
  const [draft, setDraft] = useState(() => BASE.map((r) => (r.id === "customers" ? { ...r, export: true } : r)));
  const current = SUBJECTS.find((s) => s.key === subject) ?? SUBJECTS[0];

  const base = (id: string) => saved.find((r) => r.id === id) ?? BASE[0];
  const flip = (id: string, key: Perm) => setDraft((list) => list.map((r) => (r.id === id ? { ...r, [key]: !r[key] } : r)));
  const changes = draft.flatMap((r) => PERMS.filter((p) => r[p.key] !== base(r.id)?.[p.key]).map((p) => `${r.name} ${r[p.key] ? "加上" : "去掉"}${p.label}`));

  const columns: Column<Row>[] = [
    { key: "name", title: "对象", render: (r) => <CellText primary={<strong>{r.name}</strong>} secondary={r.note} /> },
    ...PERMS.map((p): Column<Row> => ({
      key: p.key,
      title: p.label,
      width: 76,
      render: (r) => (
        <ChangeMark changed={r[p.key] !== base(r.id)?.[p.key]}>
          <Checkbox checked={r[p.key]} aria-label={`${r.name} ${p.label}`} onCheckedChange={() => flip(r.id, p.key)} />
        </ChangeMark>
      ),
    })),
  ];

  return (
    <div style={{ height: 680, overflow: "auto", padding: 16, background: "var(--aui-canvas)", display: "flex", flexDirection: "column" }}>
      <PageHeader title="权限" />
      <PageBody fill>
        <Panel title="谁能看、能改哪些数据" description="选左边的角色或成员，右边勾选权限；角色里的成员自动继承。" flush actions={<Button size="sm" onClick={() => notify("新建角色")}><Plus />新建角色</Button>}>
          <ListDetailLayout
            detailOpen={open}
            onBack={() => setOpen(false)}
            detailTitle={current?.title}
            list={<SelectList label="角色和成员" search="搜角色或成员" items={SUBJECTS} selected={subject} onSelect={(k) => { setSubject(k); setOpen(true); }} />}
          >
            <Pane bare icon={<Users />} title={current?.title ?? ""} hint={current?.hint} footer="勾选 = 有这项权限；浅色框 = 改过、还没保存">
              <DataTable caption={`${current?.title ?? ""}的数据权限`} rows={draft} rowKey={(r) => r.id} columns={columns} rowHeight="medium" pagination={{ mode: "all" }} />
              <SaveBar
                placement="inline"
                count={changes.length}
                summary={changes.join(" · ")}
                onDiscard={() => setDraft(saved)}
                onSave={async () => { await new Promise((r) => setTimeout(r, 400)); setSaved(draft); }}
              />
            </Pane>
          </ListDetailLayout>
        </Panel>
      </PageBody>
    </div>
  );
}
