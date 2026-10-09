// bt/grid-b：多维表格进阶示例（样稿 D01 / D02 / D03 / D19）——客户表：表头菜单（修改 / 说明 / 插入 / 复制 / 隐藏 /
// 冻结 / 排序 / 筛选 / 分组 / 字段权限 / 字段编组 / 删除）、单元格右键菜单、可拖动的冻结线、填充柄、悬停拖动手柄与展开、
// 每组「新增一行」、评论角标、逾期标红，以及评分 / 掩码电话 / 附件 / 录音 / 进度 / 自动编号 / 系统字段 / 公式 / 关联 / 查找引用字段。
// 数据在内存里，刷新后恢复；视图（冻结线、列宽、分组……）存在本浏览器。
import { useMemo, useState } from "react";
import { ArrowRightLeft, Download, Folder, History, Link, ListTree, MessageSquare, Pencil, Plus, Settings2, Share2, Shield, Trash2 } from "lucide-react";
import { Button, ChipGroup, ConfirmDialog, PageBody, PageHeader, useNotify } from "@adminui/react";
import { BitableGrid, useGridView, type GridAttachment, type GridCellChange, type GridField, type GridRowMove } from "@adminui/react/grid";
import { demoPhoto, demoTone } from "./media-demo";

type Customer = {
  id: string;
  no: number;
  name: string;
  stage: string;
  owner: { name: string; hint?: string }[];
  phone: string; // 服务端已脱敏，完整号码要 onReveal 再取（并留痕）
  intent: number | null;
  amount: number | null; // 分
  deal: number | null;
  last: string | null;
  follow: number;
  next: string | null;
  files: GridAttachment[];
  calls: GridAttachment[];
  area: string;
  source: string;
  progress: number | null;
  opportunity: { id: string; title: string }[];
  oppStage: string[];
  commission: number | null; // 分，由「服务端公式」算好
  createdBy: { name: string };
  createdAt: string;
  modifiedBy: { name: string };
  modifiedAt: string;
};

const STAGES = [
  { value: "first", label: "首通", tone: "green" as const },
  { value: "quote", label: "报价", tone: "yellow" as const },
  { value: "install", label: "安装", tone: "teal" as const },
  { value: "won", label: "成交", tone: "greenSolid" as const },
];
const AREAS = ["上海", "杭州", "苏州", "广州"].map((label) => ({ value: label, label, tone: "gray" as const }));
const SOURCES = [
  { value: "web", label: "官网表单", tone: "blue" as const },
  { value: "referral", label: "转介绍", tone: "teal" as const },
  { value: "expo", label: "展会", tone: "gray" as const },
  { value: "line", label: "LINE", tone: "green" as const },
];
const PEOPLE = [{ name: "小王", hint: "销售" }, { name: "小李", hint: "销售" }, { name: "阿杰", hint: "销售" }, { name: "美华", hint: "销售主管" }];
const NAMES = ["陈雅婷", "林志明", "王美玲", "张家豪（徐汇区别墅）", "黄淑芬", "李承恩（滨江豪宅）", "吴宗翰", "蔡依琳", "刘建宏", "郑淑惠", "许文杰", "杨佩珊", "陈雅婷（徐汇二期）", "林志明（西湖公寓）", "王美玲（苏州店面）", "黄淑芬（鼓楼老宅）", "李承恩（滨江二期）", "吴宗翰（苏州别墅）", "蔡依琳（姑苏）", "刘建宏（天河）"];
const TODAY = "2026-10-05"; // 演示固定「今天」，逾期标红稳定可复现
const FULL_PHONES = new Map<string, string>(); // 模拟服务端：完整号码只在服务端

function build(): Customer[] {
  let seed = 20261005;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const photo = [demoPhoto(0), demoPhoto(1)];
  const tones = [demoTone(23, 1), demoTone(72, 2), demoTone(9, 3), demoTone(48, 4)];
  return NAMES.map((name, i) => {
    const stage = STAGES[i < 6 ? (i < 3 ? 0 : 1) : Math.floor(rand() * 4)]!.value;
    const day = (offset: number) => `2026-${offset < 1 ? "09" : "10"}-${String(offset < 1 ? 30 + offset : offset).padStart(2, "0")}`;
    const phone = `1${String(30 + Math.floor(rand() * 60))}-${String(1000 + Math.floor(rand() * 9000))}-${String(1000 + Math.floor(rand() * 9000))}`;
    const id = `KH-${String(i + 1).padStart(4, "0")}`;
    FULL_PHONES.set(id, phone);
    const fileCount = Math.floor(rand() * 4);
    const files: GridAttachment[] = Array.from({ length: fileCount }, (_, k) =>
      k === 2 ? { id: `${id}-f${k}`, name: "报价单.pdf", kind: "pdf", size: 2_300_000, pages: 6 }
        : k === 1 && i % 2 ? { id: `${id}-f${k}`, name: "现场走一圈.mp4", kind: "video", duration: 65 }
          : { id: `${id}-f${k}`, name: `现场照片-${k + 1}.jpg`, kind: "image", url: photo[k % 2], thumbUrl: photo[k % 2], size: 2_100_000 });
    const tone = tones[i % tones.length]!;
    const calls: GridAttachment[] = i % 4 === 2 ? [] : Array.from({ length: 1 + (i % 3 === 0 ? 1 : 0) + (i % 5 === 0 ? 1 : 0) }, (_, k) => ({ id: `${id}-a${k}`, name: `通话录音-${k + 1}.m4a`, kind: "audio", url: tone.url, peaks: tone.peaks, duration: [23, 72, 9, 48][i % 4] }));
    const amount = (5 + Math.floor(rand() * 200)) * 1_000_000;
    return {
      id,
      no: i + 1,
      name,
      stage,
      owner: [pick(PEOPLE)],
      phone: phone.replace(/-(\d{4})-/, "-****-"),
      intent: 1 + Math.floor(rand() * 5),
      amount,
      deal: stage === "won" || i === 5 ? Math.round(amount * 0.94) : null,
      last: day(Math.floor(rand() * 6)),
      follow: 1 + Math.floor(rand() * 9),
      next: day(1 + Math.floor(rand() * 10)),
      files,
      calls,
      area: pick(AREAS).value,
      source: pick(SOURCES).value,
      progress: stage === "install" || stage === "won" ? Math.round(rand() * 100) : null,
      opportunity: i % 3 === 1 ? [] : [{ id: `SJ-${i + 1}`, title: `${name.replace(/（.*）/, "")}的全屋智能` }],
      oppStage: i % 3 === 1 ? [] : [pick(["方案中", "已报价", "待签约"])],
      commission: Math.round(amount * 0.03),
      createdBy: { name: "运营小B" },
      createdAt: `2026-09-${String(10 + (i % 18)).padStart(2, "0")}T02:00:00.000Z`,
      modifiedBy: pick(PEOPLE),
      modifiedAt: `2026-10-0${1 + (i % 5)}T06:20:00.000Z`,
    };
  });
}

/** 有评论的格子（行 → 字段 → 条数），演示 cellBadge */
const COMMENTS: Record<string, Record<string, number>> = { "KH-0006": { follow: 2 }, "KH-0004": { amount: 1 } };

export function GridCustomersShowcase() {
  const notify = useNotify();
  const [rows, setRows] = useState(build);
  const [selection, setSelection] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [quick, setQuick] = useState<string[]>([]);
  const fields = useMemo<GridField<Customer>[]>(() => [
    { key: "name", title: "客户名称", type: "text", primary: true, width: 200, editable: true, required: true },
    { key: "stage", title: "阶段", type: "singleSelect", options: STAGES, width: 104, editable: true },
    { key: "owner", title: "负责人", type: "user", width: 104, editable: true },
    { key: "phone", title: "手机", type: "phone", width: 128, mask: true, phoneCountry: "+86", description: "号码在服务端脱敏；点眼睛查看完整号码，会记录查看人",
      onReveal: async (row) => { await new Promise((r) => setTimeout(r, 200)); notify(`已记录：查看了「${row.name}」的完整号码`, "info"); return FULL_PHONES.get(row.id) ?? row.phone; } },
    { key: "intent", title: "意向", type: "rating", width: 100, editable: true, summary: "avg" },
    { key: "amount", title: "预计金额", type: "money", precision: 0, width: 150, editable: true, summary: "sum" },
    { key: "deal", title: "成交价", type: "money", precision: 0, width: 124, editable: true, locked: "字段有查看权限：技术、客服看不到", summary: "filled" },
    { key: "last", title: "最后跟进", type: "date", width: 108, editable: true, summary: "max" },
    { key: "follow", title: "跟进", type: "number", precision: 0, width: 84, description: "来自子表「跟进记录」的条数", summary: "avg" },
    { key: "next", title: "下次跟进", type: "date", width: 108, editable: true, tone: (row) => (row.next && row.next < TODAY ? "danger" : null) },
    { key: "files", title: "现场资料", type: "attachment", width: 128, editable: true, openEditor: (row) => notify(`演示：打开「${row.name}」的附件抽屉（上传 / 删除）`, "info") },
    { key: "calls", title: "通话录音", type: "attachment", width: 150 },
    { key: "area", title: "地区", type: "singleSelect", options: AREAS, width: 88, editable: true },
    { key: "source", title: "来源", type: "singleSelect", options: SOURCES, width: 104, editable: true },
    { key: "progress", title: "安装进度", type: "progress", width: 130, editable: true, summary: "avg" },
    { key: "no", title: "编号", type: "autoNumber", width: 80 },
    { key: "opportunity", title: "关联商机", type: "link", width: 180, editable: true,
      openRef: (ref) => notify(`演示：打开商机「${ref.title}」`, "info"), openEditor: (row) => notify(`演示：为「${row.name}」选择关联商机`, "info") },
    { key: "oppStage", title: "商机阶段", type: "lookup", width: 110, description: "查找引用：来自关联商机的「阶段」" },
    { key: "commission", title: "预计佣金", type: "formula", resultType: "money", currency: "CN¥", precision: 0, width: 120, description: "公式：预计金额 × 3%（服务端计算）", summary: "sum" },
    { key: "createdBy", title: "创建人", type: "createdBy", width: 100 },
    { key: "createdAt", title: "创建时间", type: "createdAt", width: 150 },
    { key: "modifiedBy", title: "修改人", type: "modifiedBy", width: 100 },
    { key: "modifiedAt", title: "修改时间", type: "modifiedAt", width: 150 },
  ], [notify]);
  const { view, onViewChange, reset } = useGridView(fields, {
    storageKey: "starter:demo:grid-customers:view",
    defaults: { groupBy: "stage", rowHeight: "short" },
  });
  const save = async (changes: GridCellChange<Customer>[]) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const next = new Map<string, Customer>();
    for (const change of changes) next.set(change.rowId, { ...(next.get(change.rowId) ?? rows.find((r) => r.id === change.rowId)!), [change.field]: change.value } as Customer);
    setRows((list) => list.map((row) => next.get(row.id) ?? row));
  };
  const blank = (stage: string): Customer => {
    const no = Math.max(0, ...rows.map((r) => r.no)) + 1;
    const now = new Date().toISOString();
    return { id: `KH-${String(no).padStart(4, "0")}`, no, name: "", stage, owner: [], phone: "", intent: null, amount: null, deal: null, last: null, follow: 0, next: null, files: [], calls: [], area: "上海", source: "web", progress: null, opportunity: [], oppStage: [], commission: null, createdBy: { name: "我" }, createdAt: now, modifiedBy: { name: "我" }, modifiedAt: now };
  };
  const insertAt = (anchorId: string, position: "above" | "below") => setRows((list) => {
    const at = list.findIndex((r) => r.id === anchorId);
    const copy = list.slice();
    copy.splice(position === "above" ? at : at + 1, 0, blank(list[at]?.stage ?? "first"));
    return copy;
  });
  const move = ({ rowId, afterId, beforeId, group }: GridRowMove) => setRows((list) => {
    const moving = list.find((r) => r.id === rowId);
    if (!moving) return list;
    const rest = list.filter((r) => r.id !== rowId);
    const at = afterId ? rest.findIndex((r) => r.id === afterId) + 1 : beforeId ? rest.findIndex((r) => r.id === beforeId) : rest.length;
    rest.splice(at, 0, group?.stage ? { ...moving, stage: group.stage } : moving);
    return rest;
  });
  return (
    <>
      <PageHeader title="多维表格 · 客户" description="样稿 D01 / D02 / D03 / D19：点表头或右键打开字段菜单（冻结至此列、按此字段筛选、字段权限…），拖动表头上的冻结线手柄调整冻结列；格子右键打开记录菜单；选中格子拖右下角小方块填充（两格以上数字 / 日期按步长续写，Ctrl + D 向下填充）；悬停行可拖动排序、展开记录（Ctrl + E）；每组底部「新增一行」。" />
      <PageBody>
        <BitableGrid
          caption="客户"
          rows={rows}
          getRowId={(row) => row.id}
          fields={fields}
          view={view}
          onViewChange={onViewChange}
          frozenColumns={1}
          selection={selection}
          onSelectionChange={setSelection}
          onCellsChange={save}
          peopleOptions={{ owner: PEOPLE }}
          expandRecord
          // 工具栏固定一行：快捷筛选在右边、搜索收成图标、少用的进「⋯」、一个主按钮
          toolbarQuick={<ChipGroup label="快捷筛选" value={quick} options={[{ value: "pool", label: "公海", count: 15 }, { value: "mine", label: "我跟进中的", count: 32 }, { value: "stalled", label: "停滞", count: 4 }]} onValueChange={(next) => setQuick(next.filter((v) => !quick.includes(v)).slice(0, 1))} />}
          toolbarSearch="icon"
          toolbarMore={[
            { key: "table", items: [
              { key: "settings", label: "表设置", icon: <Settings2 aria-hidden="true" />, onSelect: () => notify("演示：表设置", "info") },
              { key: "access", label: "权限", icon: <Shield aria-hidden="true" />, onSelect: () => notify("演示：权限", "info") },
              { key: "ops", label: "操作记录", icon: <History aria-hidden="true" />, onSelect: () => notify("演示：操作记录", "info") },
              { key: "public", label: "公开登记链接", icon: <Link aria-hidden="true" />, onSelect: () => notify("演示：公开登记链接", "info") },
            ] },
            { key: "data", items: [
              { key: "reset", label: "恢复默认视图", onSelect: reset },
              { key: "export", label: "导出 Excel", icon: <Download aria-hidden="true" />, onSelect: () => notify("演示：导出", "info") },
            ] },
          ]}
          actions={<Button size="sm" onClick={() => notify("演示：新记录", "info")}><Plus aria-hidden="true" />新记录</Button>}
          bulkActions={(ids) => [
            { key: "transfer", label: "转交", icon: <ArrowRightLeft aria-hidden="true" />, onSelect: () => notify(`演示：转交 ${ids.length} 条`, "info") },
            { key: "edit", label: "批量修改", icon: <Pencil aria-hidden="true" />, onSelect: () => notify(`演示：批量修改 ${ids.length} 条`, "info") },
            { key: "delete", label: "删除", icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => setDeleting([...ids]) },
          ]}
          onFieldAction={(action, field) => notify(`演示：${{ edit: "修改字段", describe: "编辑字段说明", insertLeft: "向左插入字段", insertRight: "向右插入字段", duplicate: "复制字段", permission: "字段权限（谁能看 / 改）", delete: "删除字段" }[action]}「${field.title}」`, "info")}
          headerMenuItems={(field) => [{
            slot: "manage", key: "fieldGroup", label: "加入字段编组", icon: <Folder aria-hidden="true" />,
            items: [{ items: ["客户资料", "跟进", "成交"].map((name) => ({ key: name, label: name, onSelect: () => notify(`演示：「${field.title}」加入编组「${name}」`, "success") })) }],
          }]}
          onAddField={() => notify("演示：打开「新建字段」弹框", "info")}
          onRowsInsert={(position, anchorId) => insertAt(anchorId, position)}
          onRowsDuplicate={(ids) => setRows((list) => list.flatMap((row) => (ids.includes(row.id) ? [row, { ...row, id: `${row.id}-副本`, no: row.no + 1000, name: `${row.name}（副本）` }] : [row])))}
          onRowsDelete={setDeleting}
          cellMenuItems={({ row }) => [
            { key: "share", label: "分享记录", icon: <Share2 aria-hidden="true" />, onSelect: () => notify(`演示：分享「${row.name}」`, "info") },
            { key: "link", label: "复制记录链接", icon: <Link aria-hidden="true" />, onSelect: () => notify("已复制记录链接", "success") },
            { key: "history", label: "查看修改历史", icon: <History aria-hidden="true" />, onSelect: () => notify(`演示：「${row.name}」的修改历史`, "info") },
            { key: "child", label: "添加子记录", icon: <ListTree aria-hidden="true" />, onSelect: () => notify("演示：添加一条跟进记录", "info") },
            { key: "comment", label: "添加评论", icon: <MessageSquare aria-hidden="true" />, onSelect: () => notify("演示：打开评论", "info") },
          ]}
          onAddRow={(group) => {
            const row = blank(group.stage || "first");
            setRows((list) => [...list, row]);
            return row.id;
          }}
          onRowMove={move}
          cellBadge={(row, field) => {
            const n = COMMENTS[row.id]?.[field.key];
            return n ? { label: `${n} 条评论` } : null;
          }}
          emptyLabel="还没有客户"
        />
        <ConfirmDialog open={Boolean(deleting)} destructive title={`删除 ${deleting?.length ?? 0} 条记录`} impact="删除后可以在回收站里恢复（演示：直接从内存里移除）" confirmLabel="删除"
          onConfirm={() => { setRows((list) => list.filter((row) => !deleting?.includes(row.id))); setSelection([]); }} onClose={() => setDeleting(null)} />
      </PageBody>
    </>
  );
}
