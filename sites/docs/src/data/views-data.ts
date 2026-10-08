/**
 * Demo data for the views family (kanban, gallery, calendar, gantt): the deal pipeline of demo-data.ts as
 * `GridField` definitions, so one field list drives every view. Everything is fictional and stays in the browser.
 */
import type { MediaItem, OptionTone } from "@adminui/react";
import type { GridField, GridSelectOption } from "@adminui/react/grid";
import { toneOfOption, type RecordCardSlots, type WorkCalendar } from "@adminui/react/views";
import { CUSTOMERS, STAGES, formatAmount, personName, stageLabel, type Customer } from "./demo-data";

/** 「今天」 of every view demo (same as demo-data's day 0). */
export const TODAY = "2026-10-08";
export const TIME_ZONE = "Asia/Shanghai";

export type Deal = Customer & {
  ownerName: string;
  /** 采购模块（多选）。 */
  modules: string[];
  comments: number;
  /** 下一次会议（带时区的 ISO），没有 = 无日期。 */
  meetingAt: string | null;
  /** 实施排期（日期键）。 */
  kickoff: string | null;
  golive: string | null;
  files: MediaItem[];
};

export const MODULES: GridSelectOption[] = [
  { value: "crm", label: "CRM", tone: "blue" },
  { value: "bi", label: "报表", tone: "teal" },
  { value: "flow", label: "审批流", tone: "violet" },
  { value: "api", label: "开放接口", tone: "olive" },
];
const MODULE_SETS = [["crm"], ["crm", "bi"], ["flow"], ["crm", "flow", "api"], [], ["bi"]];
/** demo-data's stages cluster in two columns; spread the deals over the pipeline for the board. */
const STAGE_CYCLE: Deal["stage"][] = ["lead", "qualified", "proposal", "negotiation", "won", "lead", "proposal", "qualified", "lost"];

export const STAGE_OPTIONS: GridSelectOption[] = STAGES.map((s) => ({ value: s.value, label: s.label, tone: s.tone }));
export const stageTone = (value: string | null): OptionTone => {
  const option = STAGE_OPTIONS.find((s) => s.value === value);
  return option ? toneOfOption(option) : "gray";
};

/** Placeholder covers drawn as tiny SVGs (data URLs, no network). */
const SHADES = [["#dbeafe", "#93c5fd"], ["#dcfce7", "#86efac"], ["#ede9fe", "#c4b5fd"], ["#ffedd5", "#fdba74"]] as const;
const cover = (id: string, i: number): MediaItem => {
  const [a, b] = SHADES[i % SHADES.length] ?? SHADES[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${a}"/><circle cx="${60 + (i * 47) % 200}" cy="70" r="46" fill="${b}"/><rect x="0" y="140" width="320" height="60" fill="${b}" opacity=".6"/></svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { id, name: `现场照片-${i + 1}.png`, kind: "image", url, thumbUrl: url, size: 180_000 + i * 9_000 };
};

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const initialDeals = (): Deal[] =>
  CUSTOMERS.slice(0, 18).map((base, i) => {
    const c = { ...base, stage: STAGE_CYCLE[i % STAGE_CYCLE.length] ?? base.stage };
    const scheduled = c.stage === "won" || c.stage === "negotiation" || c.stage === "proposal";
    const kickoff = scheduled ? addDays(TODAY, (i % 7) - 4) : null;
    return {
      ...c,
      ownerName: personName(c.owner),
      modules: MODULE_SETS[i % MODULE_SETS.length] ?? [],
      comments: (i * 5) % 7,
      meetingAt: i % 5 === 4 ? null : `${c.nextFollowUp}T${String(9 + (i % 8)).padStart(2, "0")}:${i % 2 ? "30" : "00"}:00+08:00`,
      kickoff,
      golive: kickoff ? addDays(kickoff, 3 + (i % 6)) : null,
      files: i % 3 === 2 ? [] : [cover(`f${i}`, i), ...(i % 4 === 0 ? [cover(`g${i}`, i + 1)] : [])],
    };
  });

export const DEAL_FIELDS: GridField<Deal>[] = [
  { key: "name", title: "客户名称", type: "text", primary: true },
  { key: "stage", title: "阶段", type: "singleSelect", options: STAGE_OPTIONS },
  { key: "ownerName", title: "负责人", type: "user" },
  // money 的值是「分」：演示数据存的是元，这里乘 100
  { key: "amount", title: "预计金额", type: "money", precision: 0, value: (r) => r.amount * 100 },
  { key: "city", title: "城市", type: "text" },
  { key: "industry", title: "行业", type: "text" },
  { key: "nextFollowUp", title: "下次跟进", type: "date", timeZone: TIME_ZONE },
  { key: "seats", title: "席位数", type: "number" },
  { key: "modules", title: "采购模块", type: "multiSelect", options: MODULES },
  { key: "meetingAt", title: "会议时间", type: "datetime", timeZone: TIME_ZONE },
  { key: "kickoff", title: "实施开始", type: "date", timeZone: TIME_ZONE },
  { key: "golive", title: "上线日期", type: "date", timeZone: TIME_ZONE },
];
export const dealField = (key: string): GridField<Deal> => DEAL_FIELDS.find((f) => f.key === key) ?? { key, title: key, type: "text" };
export const dealFields = (keys: readonly string[]) => keys.map(dealField);
export const STAGE_FIELD = dealField("stage");
export const AMOUNT_FIELD = dealField("amount");

/** The card's five slots shared by kanban and gallery: tags · 金额 · 城市 · 负责人 · 评论 + 下次跟进. */
export const DEAL_SLOTS: RecordCardSlots<Deal> = {
  tags: dealFields(["stage", "modules"]),
  keyline: dealFields(["amount", "city"]),
  owner: dealField("ownerName"),
  due: dealField("nextFollowUp"),
  comments: (r) => r.comments,
};
/** On a board grouped by stage the tag row doesn't repeat the stage. */
export const BOARD_SLOTS: RecordCardSlots<Deal> = { ...DEAL_SLOTS, tags: dealFields(["modules"]) };

/** Host-supplied holidays (the library ships none): 10-01 … 10-07 off, 10-10 a make-up working day. */
export const WORK_CALENDAR: WorkCalendar = {
  holidays: Object.fromEntries(["01", "02", "03", "04", "05", "06", "07"].map((d) => [`2026-10-${d}`, "国庆日"])),
  workdays: { "2026-10-10": "调休上班" },
};

export const STAGE_LEGEND = STAGE_OPTIONS.slice(0, 5).map((s) => ({ label: s.label, tone: stageTone(s.value) }));
export { stageLabel, formatAmount };
