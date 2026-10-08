import { useState } from "react";
import {
  AlignLeft, AtSign, Bot, Calculator, Calendar, CalendarClock, CircleDollarSign, CircleDot, ExternalLink, GitBranch, Hash, Link2, ListChecks,
  MapPin, MousePointerClick, Paperclip, Percent, PenLine, Phone, Search, Sigma, SquareCheck, Star, Table2, TrendingUp, Type, User, UserPen, UserPlus,
} from "lucide-react";
import {
  Button, Choice, ConditionSentence, FieldDialog, FieldTypePicker, OptionsEditor, Panel, useNotify,
  type EditableOption, type FieldDraft, type FieldTypeTile,
} from "@adminui/react";
import { GridConditionTree, GridToolbar, normalizeGridView, type GridField, type GridFilterGroup, type GridView } from "@adminui/react/grid";
// 新增、还没进 index.ts 的组件：先从源码引（纯展示，不依赖 Provider 上下文）。

// 演示分区：条件编辑器（表格筛选面板）+ 字段配置（类型分组、说明卡、选项行）。数据都是演示。

type Deal = { id: string; name: string; stage: string; owner: { name: string }[]; next: string; amount: number; phone: string; products: string[] };

const STAGES = [
  { value: "lead", label: "线索", tone: "gray" as const },
  { value: "first", label: "首通", tone: "blue" as const },
  { value: "quote", label: "报价", tone: "yellow" as const },
  { value: "deal", label: "谈判", tone: "orange" as const },
  { value: "won", label: "赢单", tone: "green" as const },
];
const PRODUCTS = [
  { value: "lock", label: "门锁", tone: "teal" as const },
  { value: "curtain", label: "窗帘", tone: "violet" as const },
  { value: "light", label: "灯光", tone: "yellow" as const },
];
const FIELDS: GridField<Deal>[] = [
  { key: "name", title: "客户", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGES },
  { key: "owner", title: "负责人", type: "user" },
  { key: "next", title: "下次跟进", type: "date" },
  { key: "amount", title: "预计金额", type: "money", currency: "CN¥", precision: 0 },
  { key: "phone", title: "手机", type: "text" },
  { key: "products", title: "产品", type: "multiSelect", options: PRODUCTS },
];
const PEOPLE = { owner: [{ value: "小王", label: "小王" }, { value: "小李", label: "小李" }, { value: "陈组长", label: "陈组长" }] };

const FULL: GridFilterGroup = {
  id: "root",
  conjunction: "and",
  items: [
    { id: "f1", field: "stage", op: "anyOf", value: ["quote", "deal"] },
    { id: "f2", field: "owner", op: "hasAny", value: { dynamic: "me" } },
    { id: "g1", conjunction: "or", items: [{ id: "f3", field: "next", op: "is", value: { relative: "nextDays", days: 7 } }, { id: "f4", field: "amount", op: "gte", value: "50000" }] },
  ],
};
const UNFINISHED: GridFilterGroup = {
  id: "root",
  conjunction: "and",
  items: [{ id: "f1", field: "phone", op: "contains" }, { id: "f2", field: "amount", op: "gte", value: "九万" }],
};
const LIMITS = { maxDepth: 1, maxConditions: 50 };

function FilterCard() {
  const [view, setView] = useState<GridView>(() => ({ ...normalizeGridView({}, FIELDS), filter: FULL }));
  return (
    <Panel title="表格筛选面板" description="字段 / 条件 / 值 = 已通过的 28px 小号下拉；删除是 ×；值按字段类型换（标签多选、人含「我」、相对日期、带币种金额）；面板顶上一句话读出当前条件，工具栏写「筛选 3」">
      <div className="demo-cond-stage" id="cond-filter">
        <GridToolbar fields={FIELDS} view={view} onViewChange={setView} total={153} valueOptions={PEOPLE} features={{ rowHeight: false, color: false, group: false, fields: false }} panelNote="只改你自己的视图 · 自动保存" />
      </div>
      <ConditionSentence tree={view.filter} fields={FIELDS} />
    </Panel>
  );
}

function EmptyCard() {
  const [view, setView] = useState<GridView>(() => normalizeGridView({}, FIELDS));
  return (
    <Panel title="没有条件时" description="不放空的一行，给「添加条件」和常用字段的快捷按钮">
      <div id="cond-empty">
        <GridToolbar fields={FIELDS} view={view} onViewChange={setView} total={153} valueOptions={PEOPLE} features={{ rowHeight: false, color: false, group: false, fields: false, sort: false }} />
      </div>
    </Panel>
  );
}

function UnfinishedCard() {
  const [tree, setTree] = useState<GridFilterGroup>(UNFINISHED);
  return (
    <Panel title="没填完 / 出错" description="没填值的条件灰着写「先不生效」；值不合法标红">
      <div id="cond-unfinished">
        <GridConditionTree fields={FIELDS} tree={tree} onChange={setTree} limits={LIMITS} valueOptions={PEOPLE} />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- 字段配置

type FieldType = "text" | "longText" | "number" | "money" | "percent" | "date" | "checkbox" | "singleSelect" | "multiSelect" | "rating" | "progress" | "user" | "phone" | "email" | "url" | "attachment" | "subTable" | "link" | "lookup" | "rollup" | "count" | "autoNumber" | "createdBy" | "createdAt" | "updatedBy" | "updatedAt";
const TYPES: FieldTypeTile<FieldType>[] = [
  { label: "文本", icon: <Type />, value: "text" },
  { label: "多行文本", icon: <AlignLeft />, value: "longText" },
  { label: "数字", icon: <Hash />, value: "number" },
  { label: "货币", icon: <CircleDollarSign />, value: "money" },
  { label: "百分比", icon: <Percent />, value: "percent" },
  { label: "日期", icon: <Calendar />, value: "date" },
  { label: "复选框", icon: <SquareCheck />, value: "checkbox" },
  { label: "单选", icon: <CircleDot />, value: "singleSelect", keywords: "select 下拉" },
  { label: "多选", icon: <ListChecks />, value: "multiSelect", keywords: "select 标签" },
  { label: "评分", icon: <Star />, value: "rating" },
  { label: "进度", icon: <TrendingUp />, value: "progress" },
  { label: "人员", icon: <User />, value: "user" },
  { label: "电话", icon: <Phone />, value: "phone" },
  { label: "邮箱", icon: <AtSign />, value: "email" },
  { label: "超链接", icon: <ExternalLink />, value: "url" },
  { label: "附件", icon: <Paperclip />, value: "attachment" },
  { label: "子表", icon: <Table2 />, value: "subTable" },
  { label: "关联", icon: <Link2 />, value: "link" },
  { label: "查找引用", icon: <Search />, value: "lookup" },
  { label: "汇总", icon: <Sigma />, value: "rollup" },
  { label: "计数", icon: <Calculator />, value: "count" },
  { label: "自动编号", icon: <Hash />, value: "autoNumber" },
  { label: "创建人", icon: <UserPlus />, value: "createdBy" },
  { label: "创建时间", icon: <CalendarClock />, value: "createdAt" },
  { label: "修改人", icon: <UserPen />, value: "updatedBy" },
  { label: "修改时间", icon: <CalendarClock />, value: "updatedAt" },
  { label: "公式", icon: <Sigma />, later: "接计算引擎之后" },
  { label: "流程", icon: <GitBranch />, later: "接自动化之后" },
  { label: "按钮", icon: <MousePointerClick />, later: "接自动化之后" },
  { label: "地理位置", icon: <MapPin />, later: "以后" },
  { label: "签名", icon: <PenLine />, later: "以后" },
  { label: "AI 字段", icon: <Bot />, later: "以后" },
];
const OPTION_TYPES: FieldType[] = ["singleSelect", "multiSelect"];
const LEVEL_OPTIONS: EditableOption[] = [
  { id: "o1norm", label: "普通", tone: "gray" },
  { id: "o2key0", label: "重点", tone: "blue" },
  { id: "o3vip0", label: "VIP", tone: "yellow" },
  { id: "o4ref0", label: "老客户转介绍", tone: "violet" },
];
const LEVEL_USAGE = { o1norm: 61, o2key0: 24, o3vip0: 9, o4ref0: 4 };
const STAGE_OPTIONS: EditableOption[] = [
  { id: "s1first", label: "首通", tone: "blue" },
  { id: "s2quot", label: "报价", tone: "teal" },
  { id: "s3quot", label: "报价", tone: "yellow" },
];
const STAGE_USAGE = { s1first: 32, s2quot: 18 };

function FieldDialogDemo() {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FieldDraft<FieldType>>({ name: "客户等级", type: "singleSelect", options: LEVEL_OPTIONS, allowCreate: true, description: "" });
  return (
    <>
      <Button onClick={() => setOpen(true)}>新建字段</Button>
      <FieldDialog<FieldType> open={open} onClose={() => setOpen(false)} value={draft} onChange={setDraft} types={TYPES} optionTypes={OPTION_TYPES} optionUsage={LEVEL_USAGE} recordNoun="客户"
        existingNames={["客户名称", "阶段"]} footerNote="以后在表头菜单「字段权限」里还能改"
        settings={draft.type === "money" ? <Choice label="币种" value="CNY" onChange={() => undefined} options={[{ value: "CNY", label: "人民币 ¥" }, { value: "USD", label: "美元 US$" }]} /> : undefined}
        onSubmit={async (d) => { notify(`已新建字段「${d.name}」`, "success"); setOpen(false); }} />
    </>
  );
}

function FieldCard() {
  const [type, setType] = useState<FieldType | null>("singleSelect");
  const [levels, setLevels] = useState<EditableOption[]>(LEVEL_OPTIONS);
  const [stages, setStages] = useState<EditableOption[]>(STAGE_OPTIONS);
  const [allow, setAllow] = useState(true);
  return (
    <Panel title="字段配置" description="类型按「基础 / 选择 / 人与联系 / 关联与计算 / 系统自动」分组，可搜索，还没做的收成「还有 N 种在做」；选中后一张说明卡；选项行 = 拖柄 + 色点 + 框 + 已用条数" actions={<FieldDialogDemo />}>
      <div className="demo-field-grid" id="field-config">
        <FieldTypePicker<FieldType> types={TYPES} value={type} onChange={setType} />
        <div className="demo-field-opts">
          <OptionsEditor label="客户等级选项" options={levels} onChange={setLevels} usage={LEVEL_USAGE} fieldName="客户等级" recordNoun="客户" allowCreate={allow} onAllowCreateChange={setAllow} allowCreateLabel="格子里能直接新建" />
          <OptionsEditor label="阶段选项" options={stages} onChange={setStages} usage={STAGE_USAGE} fieldName="阶段" recordNoun="客户" />
        </div>
      </div>
    </Panel>
  );
}

/** 条件编辑器 + 字段配置。 */
export function ConditionFieldSection() {
  return (
    <div className="demo-cond-section">
      <FilterCard />
      <div className="demo-cond-two">
        <EmptyCard />
        <UnfinishedCard />
      </div>
      <FieldCard />
      <style>{`
        .demo-cond-section { display: grid; gap: 16px; }
        .demo-cond-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .demo-cond-section .demo-cond-stage { margin-bottom: 12px; border: 1px solid var(--aui-line); border-radius: 10px; }
        .demo-cond-section #cond-empty { border: 1px solid var(--aui-line); border-radius: 10px; }
        .demo-field-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 420px); gap: 20px; align-items: start; }
        .demo-field-opts { display: grid; gap: 12px; }
        @media (max-width: 900px) { .demo-cond-two, .demo-field-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  );
}
