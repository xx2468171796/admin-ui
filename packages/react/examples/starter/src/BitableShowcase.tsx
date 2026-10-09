import { useEffect, useMemo, useState } from "react";
import { Button, InlineAlert, PageBody, PageHeader, RecordPage, useNotify } from "@adminui/react";
import { contractLayout, ContractOverview, type ContractRow } from "./contract-record";
import { BitableGrid, ViewOverrideBar, gridViewReducer, normalizeGridView, useGridView, type GridCellChange, type GridDataSource, type GridField, type GridSelectOption, type GridView } from "@adminui/react/grid";
import { applyGridGroups, applyGridQuery, type ConditionContext } from "@adminui/react/grid-query";
import { SegmentedControl } from "@adminui/react";

// 多维表格示例：2000 条演示合同记录（内存数据，刷新后恢复）。视图（隐藏 / 顺序 / 列宽 / 排序 / 筛选 /
// 分组 / 行高 / 统计）存在浏览器 localStorage，键带项目和表名；生产按用户存到宿主自己的设置接口。
type Contract = ContractRow; // amount 单位：分

const STAGES = [
  { value: "lead", label: "线索", tone: "gray" as const },
  { value: "qualified", label: "已确认需求", tone: "green" as const },
  { value: "proposal", label: "方案报价", tone: "yellow" as const },
  { value: "won", label: "赢单", tone: "green" as const },
  { value: "lost", label: "输单", tone: "red" as const },
];
const TAGS = [
  { value: "vip", label: "大客户", tone: "greenSolid" as const },
  { value: "renew", label: "续约", tone: "green" as const },
  { value: "gov", label: "政企", tone: "blue" as const },
  { value: "trial", label: "试用中", tone: "teal" as const },
  { value: "risk", label: "回款风险", tone: "red" as const },
  { value: "channel", label: "渠道", tone: "yellow" as const },
];
const PEOPLE = [
  { name: "陈晓", hint: "华东销售" }, { name: "林宁", hint: "华南销售" }, { name: "周敏", hint: "售前" },
  { name: "王磊", hint: "大客户部" }, { name: "赵一鸣", hint: "渠道" }, { name: "孙悦", hint: "客户成功" },
];
const COMPANIES = ["远山精密制造", "北辰物流", "青禾医疗", "星河传媒", "安澜能源", "云杉教育", "海川零售", "东岳建设", "明川科技", "汇通金融"];
const SUFFIX = ["有限公司", "集团", "股份有限公司", "（华东）", "科技有限公司"];
const NOTES = [
  "年度框架合同，按季度结算。采购流程需走对方集团招采平台，预计两周。",
  "",
  "客户希望增加私有化部署选项，已提交产品评估；报价有效期 30 天，过期需重新审批。",
  "二期扩容，涉及三个子公司，合同主体待确认。",
];

// 下次跟进：相对今天的天数（按编号算，不占随机数序列）——有逾期、今天、快到、以后的
const dayFromToday = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// Deterministic demo data: the same 2000 records on every load.
function generate(count: number): Contract[] {
  let seed = 20260930;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  return Array.from({ length: count }, (_, i) => {
    const stage = pick(STAGES).value;
    const signed = stage === "won" || stage === "lost" ? new Date(Date.UTC(2026, Math.floor(rand() * 9), 1 + Math.floor(rand() * 28))).toISOString() : null;
    return {
      id: `HT-${String(i + 1).padStart(5, "0")}`,
      name: `${pick(COMPANIES)}${pick(SUFFIX)}${i % 7 === 0 ? " · 二期" : ""}`,
      stage,
      tags: TAGS.filter(() => rand() < 0.28).map((t) => t.value),
      owners: PEOPLE.filter(() => rand() < 0.25).slice(0, 3),
      amount: Math.round(rand() * 2_000_000) * 100 + (i % 3) * 50,
      seats: rand() < 0.1 ? null : 5 + Math.floor(rand() * 500),
      signed,
      followUp: i % 5 === 4 ? null : dayFromToday(((i * 7) % 23) - 8),
      updated: new Date(Date.UTC(2026, 8, 1 + Math.floor(rand() * 29), Math.floor(rand() * 24), Math.floor(rand() * 60))).toISOString(),
      paid: stage === "won" && rand() < 0.7,
      site: `https://www.example.com/customers/${i + 1}`,
      email: `contact${i + 1}@example.com`,
      note: pick(NOTES),
    };
  });
}

// 地区：演示用，由合同编号算出来（只读单选），给三级分组「阶段 → 负责人 → 地区」用
const REGIONS = [
  { value: "east", label: "华东", tone: "green" as const },
  { value: "south", label: "华南", tone: "teal" as const },
  { value: "north", label: "华北", tone: "blue" as const },
  { value: "west", label: "西部", tone: "gray" as const },
];
const regionOf = (row: Contract) => REGIONS[Number(row.id.slice(3)) % 4]!.value;
// 「我」是谁、「我的下属」有谁由宿主回答（真实项目从登录会话取；服务端模式在后端解析）
const CONDITIONS: ConditionContext = { resolve: (token) => (token === "me" ? ["陈晓"] : token === "mySubordinates" ? ["林宁", "周敏"] : null) };

// 4.0：字段 editable = 可在格子里直接改（双击 / Enter / 直接打字），粘贴、清空、撤销都走 onCellsChange
const fields: GridField<Contract>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true, width: 220, editable: true, required: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES, editable: true },
  // 截止日期：逾期红字 +「逾期 N 天」，今天 / 2 天内橙字；赢单 / 输单的合同办完了，不再提醒
  { key: "followUp", title: "下次跟进", type: "date", editable: true, deadline: { closed: (row) => row.stage === "won" || row.stage === "lost" } },
  { key: "tags", title: "标签", type: "multiSelect", options: TAGS, width: 200, editable: true },
  { key: "owners", title: "负责人", type: "user", width: 170, editable: true },
  { key: "amount", title: "合同金额", type: "money", summary: "sum", editable: true },
  { key: "seats", title: "席位数", type: "number", summary: "avg", precision: 0, editable: true, validate: (v) => (typeof v === "number" && (v < 0 || v > 10000) ? "席位数在 0–10000 之间" : null) },
  { key: "signed", title: "签约日期", type: "date", summary: "max", editable: true },
  { key: "paid", title: "已回款", type: "checkbox", summary: "filled", editable: true },
  { key: "note", title: "备注", type: "longText", width: 260, editable: true },
  { key: "updated", title: "更新时间", type: "datetime" },
  { key: "site", title: "客户档案", type: "url", editable: true, group: "联系方式" },
  { key: "email", title: "联系邮箱", type: "email", editable: true, group: "联系方式", restricted: "邮箱只有客户成功能看全，不能按它筛选" },
  { key: "id", title: "合同编号", type: "text", width: 130 },
  { key: "region", title: "地区", type: "singleSelect", options: REGIONS, value: regionOf },
];

// 模拟的服务端：10 万条记录，按 GridQuery 筛选排序后分块返回（真实项目在后端用 @adminui/react/grid-query 的
// parseGridQuery + buildGridSql / applyGridQuery 实现同一个接口）
let BIG = generate(100_000);
const serverSource: GridDataSource<Contract> = {
  capabilities: { search: true, filter: true, sort: true, summaries: ["sum", "avg", "min", "max", "filled", "empty"] },
  load: ({ query, offset, limit, summaries, signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(applyGridQuery(BIG, fields, query, { offset, limit, summaries }, CONDITIONS)), 250);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); });
    }),
  // 分组：组头（每级的组、条数、统计）；行由 load 按同样的分组顺序返回（后端用 buildGridGroupSql 或 applyGridGroups）
  loadGroups: ({ query, summaries, signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(applyGridGroups(BIG, fields, query, { summaries }, CONDITIONS)), 250);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); });
    }),
};
const PANEL_NOTE = "只改你的个人设置，自动保存";

/** 8.7 新增记录（服务端）：「服务端」在最后加一条空合同、返回 id，表格自己重取、滚到最后、打开第一格 */
function addServerRow(): string {
  const id = `HT-${BIG.length + 1}`;
  // 新数组：applyGridQuery 按数组缓存查询结果
  BIG = [...BIG, { ...BIG[0]!, id, name: "", tags: [], owners: [], note: "", amount: 0, signed: null, followUp: null }];
  return id;
}
function saveServerCells(changes: GridCellChange<Contract>[]) {
  for (const change of changes) {
    BIG = BIG.map((item) => (item.id === change.rowId ? { ...item, [change.field]: change.value } : item));
  }
}

export function BitableShowcase() {
  const [mode, setMode] = useState<"client" | "server">("client");
  return mode === "server" ? <ServerGrid onMode={setMode} /> : <ClientGrid onMode={setMode} />;
}

function ModeSwitch({ mode, onMode }: { mode: "client" | "server"; onMode: (mode: "client" | "server") => void }) {
  return <SegmentedControl label="数据来源" value={mode} options={[{ value: "client", label: "前端 2000 条（可编辑）" }, { value: "server", label: "服务端 10 万条（无限滚动）" }]} onValueChange={(v) => onMode(v === "server" ? "server" : "client")} />;
}

function ServerGrid({ onMode }: { onMode: (mode: "client" | "server") => void }) {
  const { view, onViewChange } = useGridView(fields, { storageKey: "starter:demo:bitable-server:view", defaults: { rowHeight: "short", summary: { amount: "sum" } } });
  return (
    <>
      <PageHeader title="多维表格" description="服务端模式：10 万条合同，滚到哪儿加载到哪儿（每块 100 条，模拟 250ms 网络延迟）；搜索、筛选、排序、底部统计都交给服务端算。" actions={<ModeSwitch mode="server" onMode={onMode} />} />
      <PageBody>
        <BitableGrid caption="合同台账（服务端）" dataSource={serverSource} getRowId={(row) => row.id} fields={fields} view={view} onViewChange={onViewChange} emptyLabel="没有合同" conditionContext={CONDITIONS} panelNote={PANEL_NOTE}
          onAddRow={() => new Promise<string>((resolve) => setTimeout(() => resolve(addServerRow()), 150))} onCellsChange={saveServerCells} />
      </PageBody>
    </>
  );
}

function ClientGrid({ onMode }: { onMode: (mode: "client" | "server") => void }) {
  const notify = useNotify();
  const [rows, setRows] = useState(() => generate(2000));
  const [selection, setSelection] = useState<string[]>([]);
  // 标签格子里搜不到时「+ 新建选项」：演示里 400ms 后加到选项末尾；名称含「失败」时模拟服务端拒绝
  const [tags, setTags] = useState<GridSelectOption[]>(TAGS);
  const gridFields = useMemo(() => fields.map((field) => (field.key !== "tags" ? field : {
    ...field,
    options: tags,
    onCreateOption: async (label: string) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (label.includes("失败")) throw new Error("演示：选项名不能含「失败」");
      const option = { value: `tag-${Date.now()}`, label, tone: "gray" as const };
      setTags((list) => [...list, option]);
      return option;
    },
  })), [tags]);
  // 共享视图（所有人看到的）：真实项目从服务端取；个人调整存在本浏览器，和它比出「你的个人设置」
  const shared = useMemo(() => normalizeGridView({ groupBy: "stage", rowHeight: "short" }, fields), []);
  const { view, onViewChange, reset } = useGridView(fields, {
    storageKey: "starter:demo:bitable-contracts:view",
    defaults: shared,
  });
  const addFieldGroup = () => onViewChange(gridViewReducer(view, { type: "addFieldGroup", id: `g${Date.now()}`, title: `新编组 ${view.fieldGroups.length + 1}` }, fields));
  const saveAsView = (base: GridView) => notify(`演示：已把当前设置另存为「我的视图 ${base.groupBy.length ? "（分组）" : ""}」`, "success");
  const paidCount = useMemo(() => rows.filter((row) => row.paid).length, [rows]);
  // 保存编辑：演示里 300ms 后写回内存；客户名称含「失败」时模拟服务端拒绝（表格按格回滚并显示原因）
  const save = async (changes: GridCellChange<Contract>[]) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rejected = changes.filter((c) => c.field === "name" && String(c.value).includes("失败")).map((c) => ({ rowId: c.rowId, field: c.field, error: "服务端拒绝：名称不能含「失败」" }));
    const ok = changes.filter((c) => !rejected.some((r) => r.rowId === c.rowId && r.field === c.field));
    const next = new Map<string, Contract>();
    for (const change of ok) next.set(change.rowId, { ...(next.get(change.rowId) ?? rows.find((r) => r.id === change.rowId)!), [change.field]: change.value } as Contract);
    setRows((list) => list.map((row) => next.get(row.id) ?? row));
    return { rejected };
  };
  const togglePaid = (row: Contract) => setRows((list) => list.map((item) => (item.id === row.id ? { ...item, paid: !item.paid } : item)));
  const copy = (row: Contract) => { void navigator.clipboard?.writeText(row.id).catch(() => undefined); notify(`已复制 ${row.id}`, "success"); };
  const layout = useMemo(() => contractLayout(STAGES, TAGS, { togglePaid, copy }), []); // eslint-disable-line react-hooks/exhaustive-deps
  // 第 3 档整页：演示里用 #contract=<编号> 当路由（真实项目用自己的路由 /contracts/:id）
  const readHash = () => (typeof location !== "undefined" ? decodeURIComponent(/^#contract=(.+)$/.exec(location.hash)?.[1] ?? "") : "");
  const [pageId, setPageId] = useState(readHash);
  useEffect(() => {
    const onHash = () => setPageId(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  if (pageId) {
    const index = rows.findIndex((row) => row.id === pageId);
    const row = rows[index];
    const go = (id: string) => { location.hash = `contract=${encodeURIComponent(id)}`; };
    return (
      <RecordPage layout={{ title: (r) => r.name, sections: [], ...layout }} row={row} notFound={!row}
        back={{ label: "合同台账", onClick: () => { history.pushState(null, "", location.pathname + location.search); setPageId(""); } }}
        nav={row ? { index, total: rows.length, onMove: (d) => go(rows[index + d]!.id) } : undefined}
        overview={(r) => <ContractOverview row={r} />} />
    );
  }
  return (
    <>
      <PageHeader
        title="多维表格"
        description="2000 条演示合同：双击、回车或直接打字修改格子，拖选多格后 Ctrl+C / Ctrl+V 与 Excel 互贴，Delete 清空，Ctrl+Z 撤销；拖动表头调列宽和顺序，点表头打开字段菜单；工具栏搜索、筛选、排序、分组、行高、显示字段；底部统计栏点一格换统计方式；行号列悬停勾选或展开整条记录。"
        actions={<><ModeSwitch mode="client" onMode={onMode} /><Button variant="outline" onClick={reset}>恢复默认视图</Button></>}
      />
      <PageBody>
        <InlineAlert title="浏览器演示">记录在内存里，刷新后恢复；视图保存在本浏览器。共 {rows.length} 条，已回款 {paidCount} 条。</InlineAlert>
        <BitableGrid
          caption="合同台账"
          rows={rows}
          getRowId={(row) => row.id}
          fields={gridFields}
          view={view}
          onViewChange={onViewChange}
          frozenColumns={1}
          selection={selection}
          onSelectionChange={setSelection}
          expandRecord={{ layout, url: "contract" }}
          onCellsChange={save}
          peopleOptions={{ owners: PEOPLE }}
          conditionContext={CONDITIONS}
          panelNote={PANEL_NOTE}
          onSaveAsView={() => saveAsView(view)}
          onCreateField={() => notify("演示：这里打开「新建字段」弹框", "info")}
          onCreateFieldGroup={addFieldGroup}
          banner={<ViewOverrideBar viewName="合同台账" base={shared} view={view} fields={fields} onReset={reset} onSaveAsNew={() => saveAsView(view)} onSaveForAll={() => notify("演示：已保存给所有人", "success")} />}
          rowActions={(row) => [
            { key: "copy", label: "复制合同编号", onSelect: () => copy(row) },
            { key: "paid", label: row.paid ? "标记为未回款" : "标记为已回款", onSelect: () => togglePaid(row) },
            { key: "delete", label: "删除", destructive: true, disabled: true, disabledReason: "演示数据不能删除", onSelect: () => {} },
          ]}
          bulkActions={(ids) => [
            { key: "paid", label: "标记已回款", onSelect: () => { setRows((list) => list.map((item) => (ids.includes(item.id) ? { ...item, paid: true } : item))); notify(`已把 ${ids.length} 条标记为已回款`, "success"); setSelection([]); } },
          ]}
          emptyLabel="还没有合同记录"
        />
      </PageBody>
    </>
  );
}
