import { useState, type ReactNode } from "react";
import { AvatarStack, Choice, InlineAlert, KpiCard, PersonChip, StatusBadge, computeDelta, formatNumber } from "@adminui/react";
import { Demo as CalendarDemo } from "../../demos/views/calendar-month";
import { defineIsland } from "./runtime";
import "./east.css";

/** 10-01 … 10-07 off for National Day, 10-10 a make-up working day — the same work calendar the live calendar uses. */
const DAYS: readonly { d: number; k?: "off" | "work" }[] = [
  ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({ d, k: "off" as const })),
  { d: 8 },
  { d: 9 },
  { d: 10, k: "work" },
];

function MiniCal() {
  return (
    <div className="h-mini-cal" role="img" aria-label="10 月 1 日到 7 日休，10 日调休上班">
      {DAYS.map(({ d, k }) => (
        <i key={d} data-k={k}>
          {d}
          <small>{k === "off" ? "休" : k === "work" ? "班" : " "}</small>
        </i>
      ))}
    </div>
  );
}

const PEOPLE = [
  { key: "u01", name: "林晓" },
  { key: "u02", name: "陈一鸣" },
  { key: "u03", name: "王佳宁" },
  { key: "u05", name: "周可欣" },
];

function Details() {
  const [plan, setPlan] = useState("pro");
  const items: { n: string; t: string; d: string; body: ReactNode }[] = [
    {
      n: "01",
      t: "节假日与调休",
      d: "日历、甘特、「只算工作日」都认宿主给的节假日和调休上班日：国庆七天标「休」，10 月 10 日标「班」。",
      body: <MiniCal />,
    },
    {
      n: "02",
      t: "数字按「万」读",
      d: "指标卡、表格合计默认用「万 / 亿」缩写，悬停看精确值；比上月、比去年同期写清楚。",
      body: <KpiCard size="sm" title="付费席位" value={formatNumber(38_330, { compact: true })} fullValue="38,330" unit="个" delta={computeDelta(38_330, 35_860)} comparison="比上月末" />,
    },
    {
      n: "03",
      t: "头像取姓，名字不截断",
      d: "头像默认取姓氏一个字、按账号稳定配色；同名的人一眼能分开，人名在表格里不会被截成半个字。",
      body: (
        <div className="h-row">
          <AvatarStack people={PEOPLE} max={4} label="正在看的人" size={32} />
          <PersonChip id="u04" name="赵思远" hint="华南销售组" />
        </div>
      ),
    },
    {
      n: "04",
      t: "提示说中文，也说怎么改",
      d: "「请选择」「更多」「加载比较慢…」都是写好的中文；出错时说原因和怎么改，不只说「失败」。",
      body: (
        <div className="h-col">
          <Choice label="套餐" value={plan} onChange={setPlan} options={[{ value: "basic", label: "基础版" }, { value: "pro", label: "专业版" }, { value: "ent", label: "企业版" }]} />
          <InlineAlert tone="warning" title="合同 30 天内到期" density="compact">
            续约提醒已发给负责人；要改提醒时间，到「设置 · 提醒」。
          </InlineAlert>
          <StatusBadge tone="danger" variant="dot">已逾期 3 天</StatusBadge>
        </div>
      ),
    },
  ];
  return (
    <div className="h-details">
      {items.map((it) => (
        <div key={it.n} className="h-detail">
          <span className="h-detail-n">{it.n}</span>
          <strong>{it.t}</strong>
          <p>{it.d}</p>
          <div className="h-detail-live">{it.body}</div>
        </div>
      ))}
    </div>
  );
}

/** The live holiday calendar, a little taller than the docs demo so the whole of October fits without scrolling. */
const Calendar = () => <div className="h-east-cal"><CalendarDemo /></div>;

defineIsland("east", { details: { view: Details }, calendar: { view: Calendar } });
