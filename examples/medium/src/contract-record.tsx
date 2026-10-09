import { lazy, Suspense } from "react";
import { AuditTimeline, MoneyDisplay, StatePanel, type OptionTone, type RecordLayout } from "@adminui/react";
import { CellLink, CellPeople, CellTags, DateTimeDisplay } from "@adminui/react";

const Chart = lazy(() => import("@adminui/react/charts").then((m) => ({ default: m.AdminChart })));

// 合同记录的详情布局：一份定义，三档通用（简要弹框 / 详情大弹框 / 整页）。
export type ContractRow = {
  id: string;
  name: string;
  stage: string;
  tags: string[];
  owners: { name: string; hint: string }[];
  amount: number;
  seats: number | null;
  signed: string | null;
  /** 下次跟进（截止日期，YYYY-MM-DD）。 */
  followUp: string | null;
  updated: string;
  paid: boolean;
  site: string;
  email: string;
  note: string;
};
type Option = { value: string; label: string; tone?: OptionTone };
/** Stage option colour → the record status tone of the header. */
const STATUS_OF: Partial<Record<OptionTone, "neutral" | "success" | "warning" | "danger" | "brand">> = { green: "brand", yellow: "warning", red: "danger", gray: "neutral" };
/** 标签只用 7 种选项色，不写任意颜色。 */
type TagOption = { value: string; label: string; tone?: OptionTone };

const money = (fen: number) => <MoneyDisplay value={BigInt(fen)} />;
// 演示用的回款计划：由合同号确定，刷新不变
function payments(row: ContractRow) {
  const n = Number(row.id.slice(3)) || 1;
  return ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月"].map((month, i) => ({ month, plan: Math.round(row.amount / 9 / 100), paid: row.paid || i < (n % 9) ? Math.round((row.amount / 9 / 100) * (0.6 + ((n * (i + 3)) % 5) / 10)) : 0 }));
}

export function contractLayout(stages: readonly Option[], tags: readonly TagOption[], actions: { togglePaid: (row: ContractRow) => void; copy: (row: ContractRow) => void }): Partial<RecordLayout<ContractRow>> {
  const stageOf = (row: ContractRow) => stages.find((s) => s.value === row.stage);
  return {
    subtitle: (row) => `${row.id} · 更新于 ${new Date(row.updated).toLocaleDateString("zh-CN")}`,
    status: (row) => {
      const stage = stageOf(row);
      return stage ? { label: stage.label, tone: (stage.tone && STATUS_OF[stage.tone]) ?? "neutral" } : null;
    },
    highlights: (row) => [
      { key: "amount", label: "合同金额", value: money(row.amount) },
      { key: "seats", label: "席位数", value: row.seats ?? "—" },
      { key: "paid", label: "回款", value: row.paid ? "已回款" : "未回款", tone: row.paid ? "success" : "warning" },
      { key: "signed", label: "签约日期", value: row.signed ? new Date(row.signed).toLocaleDateString("zh-CN") : "未签约" },
    ],
    sections: [
      {
        key: "basic",
        title: "基本信息",
        fields: [
          { key: "name", label: "客户名称", value: (row) => row.name, copy: true, peek: true },
          { key: "id", label: "合同编号", value: (row) => row.id, copy: true, peek: true },
          { key: "stage", label: "阶段", value: (row) => stageOf(row)?.label, peek: true },
          { key: "amount", label: "合同金额", value: (row) => money(row.amount), text: (row) => String(row.amount), peek: true },
          { key: "owners", label: "负责人", value: (row) => <CellPeople label="负责人" people={row.owners} />, text: (row) => row.owners.map((o) => o.name).join("、"), peek: true },
          { key: "tags", label: "标签", value: (row) => <CellTags label="标签" items={row.tags.map((t) => { const o = tags.find((x) => x.value === t); return { key: t, label: o?.label ?? t, tone: o?.tone }; })} />, text: (row) => row.tags.join(","), full: true },
        ],
      },
      {
        key: "contact",
        title: "联系方式",
        fields: [
          { key: "email", label: "联系邮箱", value: (row) => row.email, copy: true, peek: true },
          { key: "site", label: "客户档案", value: (row) => <CellLink href={row.site} />, text: (row) => row.site, copy: true },
        ],
      },
      {
        key: "note",
        title: "备注",
        collapsible: true,
        fields: [{ key: "note", label: "备注", value: (row) => row.note, full: true }],
      },
    ],
    aside: [
      {
        key: "meta",
        title: "概要",
        fields: [
          { key: "updated", label: "更新时间", value: (row) => <DateTimeDisplay value={row.updated} /> },
          { key: "signed", label: "签约日期", value: (row) => (row.signed ? <DateTimeDisplay value={row.signed} /> : null) },
          { key: "paid", label: "回款状态", value: (row) => (row.paid ? "已回款" : "未回款") },
        ],
      },
    ],
    tabs: [
      {
        key: "activity",
        label: "活动",
        count: () => 3,
        render: (row) => (
          <AuditTimeline events={[
            { id: "a3", actor: row.owners[0]?.name ?? "系统", action: "更新合同", target: row.id, at: row.updated, changes: [{ field: "阶段", before: "方案报价", after: stageOf(row)?.label ?? "" }] },
            { id: "a2", actor: "周敏", action: "上传方案", target: "报价单 v2.pdf", at: "2026-09-12T10:20:00Z" },
            { id: "a1", actor: "系统", action: "创建合同", target: row.id, at: "2026-08-30T02:00:00Z" },
          ]} />
        ),
      },
      {
        key: "payments",
        label: "回款计划",
        pageOnly: true,
        render: (row) => (
          <Suspense fallback={<StatePanel kind="loading" />}>
            <Chart label="每月计划回款与实际回款（元）" height={280}
              option={{ tooltip: { trigger: "axis" }, legend: {}, xAxis: { type: "category", data: payments(row).map((p) => p.month) }, yAxis: { type: "value" }, series: [{ name: "计划", type: "bar", data: payments(row).map((p) => p.plan) }, { name: "实际", type: "line", data: payments(row).map((p) => p.paid) }] }} />
          </Suspense>
        ),
      },
    ],
    actions: (row) => [
      { key: "paid", label: row.paid ? "标记未回款" : "标记已回款", primary: true, onSelect: () => actions.togglePaid(row) },
      { key: "copy", label: "复制合同编号", onSelect: () => actions.copy(row) },
      { key: "delete", label: "删除合同", destructive: true, disabled: true, disabledReason: "演示数据不能删除", onSelect: () => undefined },
    ],
    href: (row) => `#contract=${encodeURIComponent(row.id)}`,
  };
}

/** 整页「概览」：回款趋势图（数据可视化放这里，弹框里不放重图表）。 */
export function ContractOverview({ row }: { row: ContractRow }) {
  const list = payments(row);
  return (
    <Suspense fallback={<StatePanel kind="loading" />}>
      <Chart label="回款趋势（元）" height={260}
        option={{ tooltip: { trigger: "axis" }, legend: {}, xAxis: { type: "category", data: list.map((p) => p.month) }, yAxis: { type: "value" }, series: [{ name: "计划", type: "bar", data: list.map((p) => p.plan) }, { name: "实际", type: "line", smooth: true, data: list.map((p) => p.paid) }] }} />
    </Suspense>
  );
}
