import { useState } from "react";
import {
  ACTION_ICONS,
  ACTION_ICON_LABELS,
  ActivityFeed,
  Button,
  ContentSkeleton,
  CopyableValue,
  DescriptionList,
  CopyButton,
  CopyField,
  DataTable,
  Divider,
  Link,
  Meter,
  Panel,
  ProgressBar,
  Spinner,
  StatusBadge,
  StepProgress,
  type ActionIconName,
  type Column,
} from "@adminui/react";

// 基础元素第二部分：复制 / 分隔线、加载与进度、文字层级与链接、图标。
const ROW = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } as const;
type Customer = { id: string; name: string; phone: string; owner: string; status: "正常" | "已停用"; amount: string };
const CUSTOMERS: Customer[] = [
  { id: "c1", name: "上海智能家居", phone: "138 0013 8000", owner: "赵静怡", status: "正常", amount: "¥86,000" },
  { id: "c2", name: "深圳门锁批发", phone: "136 2210 0456", owner: "陈冠宇", status: "已停用", amount: "¥12,500" },
  { id: "c3", name: "广州影音工程", phone: "158 7654 3210", owner: "许雅婷", status: "正常", amount: "¥240,000" },
];
const COLUMNS: Column<Customer>[] = [
  { key: "name", title: "客户名称", render: (r) => r.name },
  { key: "owner", title: "负责人", render: (r) => r.owner, skeleton: "person" },
  { key: "status", title: "状态", render: (r) => <StatusBadge tone={r.status === "正常" ? "success" : "neutral"}>{r.status}</StatusBadge>, skeleton: "tag" },
  { key: "amount", title: "预计金额", render: (r) => r.amount, align: "right", numeric: true },
];
const FEED = [
  { id: "f1", at: "2026-10-07T09:12:00+08:00", who: "赵静怡", text: "电话跟进：约了周五上门量尺寸" },
  { id: "f2", at: "2026-10-06T16:40:00+08:00", who: "陈冠宇", text: "改了阶段：需求确认 → 报价" },
  { id: "f3", at: "2026-10-02T10:05:00+08:00", who: "许雅婷", text: "新建客户（官网表单）" },
];
const TYPE_SCALE = [
  ["大数字", "28", "aui-text-display", "1,284"],
  ["页面 / 记录标题", "22", "aui-text-title", "上海智能家居"],
  ["弹框标题", "18", "aui-text-dialog", "新建客户"],
  ["卡片标题", "14.5", "aui-text-card", "跟进记录"],
  ["正文", "14", "aui-text-body", "约了周五上门量尺寸。"],
  ["表格 / 控件 / 次要", "13", "aui-text-control", "共 128 条"],
  ["标签", "12.5", "aui-text-tag", "官网表单"],
  ["备注 / 表头", "12", "aui-text-note", "10 分钟前 · 赵静怡"],
] as const;

function CopyDividerSection() {
  return (
    <Panel title="快捷键 · 复制 · 分隔线" description="字段行的复制 = 24px 幽灵图标，悬停 / 聚焦整行才出现（手机常显）；整段要拿走的值 = 等宽字 + 「复制」，令牌打码、可显示 30 秒。">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }} id="basics-copy">
        <DescriptionList columns={1} items={[{ label: "客户名称", value: <CopyableValue variant="inline" value="上海智能家居" label="客户名称" /> }, { label: "手机", value: <CopyableValue variant="inline" value="138 0013 8000" label="手机" /> }, { label: "负责人", value: "赵静怡" }]} />
        <div style={ROW}>单独的复制图标 <CopyButton text="AUI-2026-0042" label="编号" /></div>
        <CopyField label="公开登记链接" value="https://forms.example.com/f/home-intake" />
        <CopyField label="API 令牌" value="aos_live_9f2c41e7b8d3a6c0e5f1" secret note="只显示这一次；关掉后找不回来，请先复制保存。" />
        <Divider />
        <ActivityFeed items={FEED} getId={(f) => f.id} time={(f) => f.at} title={(f) => f.text} actor={(f) => f.who} caption="跟进记录" timeZone="Asia/Shanghai" />
        <Divider label="更早" align="start" />
      </div>
    </Panel>
  );
}

function LoadingSection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Panel
      title="加载与进度"
      description="第一次打开：表头用这张表自己的字段名，骨架在原位置；数量先写「—」。刷新：旧数据留着，面板顶上 2px 细进度条。"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setLoading((v) => !v)}>{loading ? "显示数据" : "模拟首次加载"}</Button>
          <Button variant="outline" size="sm" loading={refreshing} onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 2500); }}>刷新</Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }} id="basics-loading">
        <DataTable rows={loading ? [] : CUSTOMERS} columns={COLUMNS} rowKey={(r) => r.id} caption="客户" loading={loading} refreshing={refreshing} pagination={{ mode: "page", page: 1, pageSize: 10, total: CUSTOMERS.length, onPageChange: () => undefined, onPageSizeChange: () => undefined }} />
        <div style={ROW}><Spinner /> <Spinner size={20} tone="brand" /> <Spinner size={32} tone="brand" label="正在打开…" /></div>
        <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <Meter label="席位" ratio={38 / 50} value="38 / 50 席" detail="还能加 12 人" />
          <Meter label="文件用量" ratio={0.86} detail="用到 86%，快满了：清理旧文件或加购空间" />
          <Meter label="短信额度" ratio={0.97} detail="只剩 3%：去加购" size={8} />
          <ProgressBar value={0.46} label="上传 3 个文件" size={4} />
          <ProgressBar value={null} label="正在导入" />
          <StepProgress total={6} done={3} label="阶段" />
          <ContentSkeleton rows={2} avatar />
        </div>
      </div>
    </Panel>
  );
}

function TypeSection() {
  return (
    <Panel title="文字层级与链接" description="8 档字号、只用 400 / 500 / 600 三种字重；链接 4 种：正文、安静、定位、去下一页 / 外部。">
      <div style={{ display: "grid", gap: 8 }} id="basics-type">
        {TYPE_SCALE.map(([name, size, cls, sample]) => (
          <div key={cls} style={{ display: "grid", gridTemplateColumns: "140px 48px 1fr", alignItems: "baseline", gap: 12 }}>
            <span className="aui-text-note">{name}</span>
            <span className="aui-text-note aui-num">{size}</span>
            <span className={cls}>{sample}</span>
          </div>
        ))}
        <Divider />
        <div style={ROW}>
          <Link href="#basics-type">正文链接</Link>
          <Link href="#basics-type" kind="quiet">安静链接（整列都是链接）</Link>
          未填写：<Link href="#basics-type" kind="anchor">地址</Link>、<Link href="#basics-type" kind="anchor">区域</Link>
          <Link href="#basics-type" kind="next">查看全部</Link>
          <Link href="https://example.com" kind="external">帮助中心</Link>
        </div>
      </div>
    </Panel>
  );
}

function IconsSection() {
  return (
    <Panel title="图标" description="5 档 12 / 14 / 16 / 20 / 24；16 以上线宽 1.75；一个意思只用一个图标（固定 24 个动作图标）。">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }} id="basics-icons">
        {(Object.keys(ACTION_ICONS) as ActionIconName[]).map((name) => {
          const Icon = ACTION_ICONS[name];
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 10px", border: "1px solid var(--aui-line)", borderRadius: 8, fontSize: 13 }}>
              <Icon size={16} aria-hidden="true" style={{ color: "var(--aui-secondary)" }} />
              {ACTION_ICON_LABELS[name]}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function BasicsMoreSections() {
  return (
    <>
      <CopyDividerSection />
      <LoadingSection />
      <TypeSection />
      <IconsSection />
    </>
  );
}
