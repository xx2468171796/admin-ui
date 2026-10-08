"use client";
/**
 * View settings panels (bt/views V8, demos D06 卡片配置 / D09 事件设置 / D10 甘特设置): bodies to put in a
 * PopoverPanel under the toolbar button (or a SideSheet on phones), each a controlled `value` +
 * `onChange`, plus the shared footer 「改了只对你生效 · 恢复共享设置 · 另存为新视图 · 保存给所有人」.
 *
 * - FieldOrderPicker: which fields show and in what order (SortableList + eye; the primary is locked).
 * - CardSettings: cover field, card fields, density, field names (kanban / gallery).
 * - CalendarSettings: start / end date fields, colour basis, week start, holiday calendar.
 * - GanttSettings: time (start, end mode end field / duration / fixed, workdays only, holiday
 *   calendar, make-up days, time zone, default scale), group levels (≤ 3, drag, order, empty groups),
 *   display (bar title, ≤ 2 extra fields, list fields, colour basis, milestone field).
 * Field lists come from the host's GridField definitions; holiday calendars are host data.
 */
import type { ReactNode } from "react";
import { Eye, EyeOff, Lock, Plus, X } from "lucide-react";
import { Choice, Input, Switch } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { CalendarButton } from "../date-calendar.tsx";
import { MenuButton } from "../menu.tsx";
import { SortableList } from "../sortable.tsx";
import { toneOfOption } from "./kanban-core.ts";
import { FIELD_ICONS } from "../grid-cells.tsx";
import type { GridField, GridFieldType } from "../grid-core.ts";
import { GRID_LIMITS, normalizeGroupLevels, type GridColorRule, type GroupLevel } from "../grid-view-v2.ts";
import { newColorRule } from "../grid-color-core.ts";
import { GridColorRules } from "../grid-color-rules.tsx";
import { viewColorBasis } from "./view-color-core.ts";
import { shortDay, weekday, weekdayName, WEEKDAY_SHORT, type DayKey, type Weekday } from "./date-core.ts";
import { GANTT_SCALE_LABELS, GANTT_SCALES } from "./gantt-core.ts";
import { GANTT_MAX_EXTRA, type GanttConfig } from "./gantt-view.tsx";
import type { RecordCardDensity } from "./record-card.tsx";
import { IconButton } from "../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/views.css";

const DATE_TYPES: readonly GridFieldType[] = ["date", "datetime"];
const NONE = "__none";
/** What the panels read of a field (any `GridField<T>` fits). */
export type ViewFieldMeta = Pick<GridField<unknown>, "key" | "title" | "type" | "primary" | "options">;
type AnyField = ViewFieldMeta;
const fieldOptions = (fields: readonly AnyField[], types?: readonly GridFieldType[]) => fields.filter((f) => !types || types.includes(f.type)).map((f) => ({ value: f.key, label: f.title }));

function Row({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="aui-vset-row">
      <span className="aui-vset-label">{label}</span>
      <span className="aui-vset-control">
        {children}
        {note && <small>{note}</small>}
      </span>
    </div>
  );
}
function Section({ title, icon, extra, children }: { title: string; icon?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="aui-vset-section" aria-label={title}>
      <h4 className="aui-vset-title">
        {icon}
        {title}
        {extra && <small>{extra}</small>}
      </h4>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- field order

export type FieldOrderPickerProps = {
  fields: readonly AnyField[];
  /** Shown field keys in order; the rest are hidden (listed after them). */
  value: readonly string[];
  onChange: (shown: string[]) => void;
  /** Accessible name (「卡片显示的字段」). */
  label: string;
  /** Field keys that always show and stay first (default: the primary field). */
  locked?: readonly string[];
  /** Right note per field (「安装日期」 under 「开始」). */
  note?: (field: AnyField) => string | undefined;
};
type OrderRow = { id: string; locked?: boolean };
/** Drag to reorder, eye to show / hide (D10 「左侧显示字段」, D06 卡片字段). */
export function FieldOrderPicker({ fields, value, onChange, label, locked, note }: FieldOrderPickerProps) {
  const lockedKeys = locked ?? fields.filter((f) => f.primary).map((f) => f.key);
  const shown = new Set([...lockedKeys, ...value]);
  const order = [...lockedKeys, ...value.filter((k) => !lockedKeys.includes(k)), ...fields.map((f) => f.key).filter((k) => !shown.has(k))];
  const items: OrderRow[] = order.filter((k) => fields.some((f) => f.key === k)).map((k) => ({ id: k, locked: lockedKeys.includes(k) }));
  const emit = (ids: readonly string[], visible: ReadonlySet<string>) => onChange(ids.filter((k) => visible.has(k) && !lockedKeys.includes(k)));
  return (
    <div className="aui-vset-fields">
      <SortableList
        items={items}
        dense
        label={label}
        lockedHint="固定在第一个，不能移动或隐藏"
        itemLabel={(row) => fields.find((f) => f.key === row.id)?.title ?? row.id}
        onChange={(next) => emit(next.map((r) => r.id), shown)}
        renderItem={(row) => {
          const field = fields.find((f) => f.key === row.id);
          if (!field) return null;
          const Icon = FIELD_ICONS[field.type];
          const on = shown.has(row.id);
          return (
            <span className="aui-vset-field" data-hidden={!on || undefined}>
              <Icon size={14} aria-hidden="true" />
              <span className="aui-vset-field-name">
                {field.title}
                {(note?.(field) ?? (row.locked ? "固定第一个" : undefined)) && <small>{note?.(field) ?? "固定第一个"}</small>}
              </span>
              {row.locked ? (
                <span className="aui-vset-eye" data-tip="不能隐藏" aria-label={`${field.title}不能隐藏`} role="img">
                  <Lock size={14} aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  className="aui-vset-eye"
                  aria-pressed={on}
                  aria-label={on ? `隐藏「${field.title}」` : `显示「${field.title}」`}
                  onClick={() => {
                    const next = new Set(shown);
                    if (on) next.delete(row.id);
                    else next.add(row.id);
                    emit(order, next);
                  }}
                >
                  {on ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                </button>
              )}
            </span>
          );
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- cards

export type CardConfig = { coverField?: string | null; fields: readonly string[]; density: RecordCardDensity; showLabels?: boolean };
export type CardSettingsProps = {
  fields: readonly AnyField[];
  /** Attachment fields a cover can come from. */
  coverFields?: readonly { value: string; label: string }[];
  value: CardConfig;
  onChange: (next: CardConfig) => void;
  /**
   * Live preview on top: usually a `RecordCard` of a sample record built from `value`, so changing
   * fields / density / field names shows at once.
   */
  preview?: ReactNode;
  /** Sections between the preview and 「卡片」 (kanban: 分组 — group field + 隐藏空列). */
  before?: ReactNode;
};
/** 卡片设置 for kanban / gallery: 预览 → (host sections) → 卡片（封面 · 密度 · 显示字段名）→ 卡片上的字段. */
export function CardSettings({ fields, coverFields = [], value, onChange, preview, before }: CardSettingsProps) {
  return (
    <div className="aui-vset">
      {preview && (
        <Section title="预览">
          <div className="aui-vset-preview">{preview}</div>
        </Section>
      )}
      {before}
      <Section title="卡片">
        {coverFields.length > 0 && (
          <Row label="封面">
            <Choice label="封面字段" value={value.coverField ?? NONE} onChange={(v) => onChange({ ...value, coverField: v === NONE ? null : v })} options={[...coverFields, { value: NONE, label: "不显示封面" }]} />
          </Row>
        )}
        <Row label="密度">
          <SegmentedControl size="sm" label="卡片密度" value={value.density} onValueChange={(density) => onChange({ ...value, density })} options={[{ value: "compact", label: "紧凑" }, { value: "normal", label: "常规" }]} />
        </Row>
        <Row label="显示字段名">
          <Switch checked={value.showLabels === true} aria-label="卡片上显示字段名" onCheckedChange={(on) => onChange({ ...value, showLabels: on })} />
        </Row>
      </Section>
      <Section title="卡片上的字段" extra="拖动排序 · 眼睛显示 / 隐藏 · 没填的字段自动不占行">
        <FieldOrderPicker fields={fields} value={value.fields} label="卡片上的字段" onChange={(next) => onChange({ ...value, fields: next })} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------- calendar

export type CalendarConfig = { startField: string; endField?: string | null; colorField?: string | null; weekStart: Weekday; calendarId?: string | null };
export type HolidayCalendarOption = { id: string; label: string };
export type CalendarSettingsProps = {
  fields: readonly AnyField[];
  value: CalendarConfig;
  onChange: (next: CalendarConfig) => void;
  /** Holiday calendars the host offers (中国大陆 / 新加坡 / 自定义 …). */
  calendars?: readonly HolidayCalendarOption[];
};
const WEEK_STARTS: Weekday[] = [1, 0, 6];
/** 事件设置 for the calendar views. */
export function CalendarSettings({ fields, value, onChange, calendars = [] }: CalendarSettingsProps) {
  const dates = fieldOptions(fields, DATE_TYPES);
  return (
    <div className="aui-vset">
      <Row label="开始">
        <Choice label="开始日期字段" value={value.startField} onChange={(startField) => onChange({ ...value, startField })} options={dates} />
      </Row>
      <Row label="结束" note="不选 = 只占开始那天 / 默认时长">
        <Choice label="结束日期字段" value={value.endField ?? NONE} onChange={(v) => onChange({ ...value, endField: v === NONE ? null : v })} options={[{ value: NONE, label: "不使用" }, ...dates.filter((d) => d.value !== value.startField)]} />
      </Row>
      <ColorBasis fields={fields} value={value.colorField ?? null} onChange={({ colorField }) => onChange({ ...value, colorField })} />
      <Row label="一周开始">
        <SegmentedControl size="sm" label="一周从哪天开始" value={String(value.weekStart)} onValueChange={(v) => onChange({ ...value, weekStart: Number(v) as Weekday })} options={WEEK_STARTS.map((d) => ({ value: String(d), label: weekdayName(d) }))} />
      </Row>
      {calendars.length > 0 && (
        <Row label="节假日日历">
          <Choice label="节假日日历" value={value.calendarId ?? NONE} onChange={(v) => onChange({ ...value, calendarId: v === NONE ? null : v })} options={[{ value: NONE, label: "不显示节假日" }, ...calendars.map((c) => ({ value: c.id, label: c.label }))]} />
        </Row>
      )}
    </div>
  );
}

/** 颜色依据: an option field (its tones, previewed), 填色 rules (gantt; the grid's G13 model) or one uniform colour. */
type ColorPatch = { colorField: string | null; colorRules?: readonly GridColorRule[] };
function ColorBasis({ fields, value, rules, onChange }: { fields: readonly AnyField[]; value: string | null; /** Gantt: 填色 rules (「按条件」); absent = no such option. */ rules?: readonly GridColorRule[]; onChange: (patch: ColorPatch) => void }) {
  const selects = fields.filter((f) => f.type === "singleSelect");
  const field = selects.find((f) => f.key === value);
  const basis = viewColorBasis({ colorField: value, colorRules: rules });
  // One patch per change: the field and the rules switch together (two separate updates would race).
  const pick = (next: string) => {
    if (next === "option") onChange({ colorField: selects[0]?.key ?? null, ...(rules ? { colorRules: [] } : {}) });
    else if (next === "condition") onChange({ colorField: null, colorRules: rules?.length ? rules : [newColorRule([], fields.find((f) => !f.primary) ?? fields[0])] });
    else onChange({ colorField: null, ...(rules ? { colorRules: [] } : {}) });
  };
  return (
    <>
      <Row label="颜色依据">
        <SegmentedControl size="sm" label="颜色依据" value={basis} onValueChange={pick} options={[{ value: "option", label: "按单选字段", disabled: !selects.length }, ...(rules ? [{ value: "condition", label: "按条件" }] : []), { value: "uniform", label: "统一颜色" }]} />
      </Row>
      {value && (
        <Row label="" note="跟选项颜色">
          <Choice label="着色的单选字段" value={value} onChange={(colorField) => onChange({ colorField })} options={selects.map((f) => ({ value: f.key, label: f.title }))} />
          <span className="aui-vset-tones" aria-hidden="true">
            {(field?.options ?? []).slice(0, 6).map((o) => <i key={o.value} className="aui-swatch" data-tone={toneOfOption(o)} />)}
          </span>
        </Row>
      )}
      {rules && basis === "condition" && (
        <div className="aui-vset-rules" role="group" aria-label="按条件着色的规则">
          <GridColorRules fields={fields} rules={rules} onChange={(colorRules) => onChange({ colorField: null, colorRules })} targets="row" addLimit={GRID_LIMITS.maxColorRules} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- gantt

/**
 * One group level of a view (gantt / calendar); the host groups records with it. Same type as the
 * grid's `GroupLevel` (bt/templates): single-select fields go by option order when `asc`, reversed when
 * `desc`. A stored legacy `order: "option"` reads as `asc`.
 */
export type ViewGroupLevel = GroupLevel;
export type GanttSettingsValue = GanttConfig & {
  calendarId?: string | null;
  /** Extra make-up working days the user added (the host merges them into its WorkCalendar). */
  makeupDays?: readonly DayKey[];
  timeZone?: string;
  groups?: readonly ViewGroupLevel[];
  showEmptyGroups?: boolean;
};
export type GanttSettingsProps = {
  fields: readonly AnyField[];
  value: GanttSettingsValue;
  onChange: (next: GanttSettingsValue) => void;
  calendars?: readonly HolidayCalendarOption[];
  timeZones?: readonly { value: string; label: string }[];
  /** Group level limit (default 3). */
  maxGroupLevels?: number;
};
const ORDER_LABELS = { asc: "A → Z", desc: "Z → A" } as const;
const OPTION_ORDER_LABELS = { asc: "按选项顺序", desc: "选项倒序" } as const;

/** 甘特设置 (D10): 时间 + 分组 on the left, 显示 on the right. */
export function GanttSettings({ fields, value, onChange, calendars = [], timeZones = [], maxGroupLevels = 3 }: GanttSettingsProps) {
  const set = (patch: Partial<GanttSettingsValue>) => onChange({ ...value, ...patch });
  const dates = fieldOptions(fields, DATE_TYPES);
  const numbers = fieldOptions(fields, ["number"]);
  const groupable = fields.filter((f) => ["singleSelect", "user", "text", "checkbox", "date"].includes(f.type));
  const levels = normalizeGroupLevels(value.groups, fields, maxGroupLevels);
  const extra = value.extraFields ?? [];
  const primary = fields.find((f) => f.primary) ?? fields[0];
  const listShown = value.listFields ?? [primary?.key ?? "", value.startField, value.endField ?? ""].filter(Boolean);
  const addMakeup = (day: string) => {
    if (day && !(value.makeupDays ?? []).includes(day)) set({ makeupDays: [...(value.makeupDays ?? []), day].sort() });
  };
  return (
    <div className="aui-vset aui-vset-gantt">
      <div className="aui-vset-col">
        <Section title="时间" extra="条形从哪天画到哪天">
          <Row label="开始时间">
            <Choice label="开始时间字段" value={value.startField} onChange={(startField) => set({ startField })} options={dates} />
          </Row>
          <Row label="结束方式">
            <SegmentedControl size="sm" label="结束方式" value={value.endMode} onValueChange={(endMode) => set({ endMode })} options={[{ value: "field", label: "结束时间字段" }, { value: "duration", label: "工期字段（天）" }, { value: "fixed", label: "固定时长" }]} />
          </Row>
          {value.endMode === "field" && (
            <Row label="结束时间">
              <Choice label="结束时间字段" value={value.endField ?? NONE} onChange={(v) => set({ endField: v === NONE ? undefined : v })} options={[{ value: NONE, label: "和开始同一天" }, ...dates.filter((d) => d.value !== value.startField)]} />
            </Row>
          )}
          {value.endMode === "duration" && (
            <Row label="工期字段">
              <Choice label="工期字段" value={value.durationField ?? NONE} onChange={(v) => set({ durationField: v === NONE ? undefined : v })} options={[{ value: NONE, label: "选一个数字字段" }, ...numbers]} />
            </Row>
          )}
          {value.endMode === "fixed" && (
            <Row label="固定时长" note="天">
              <Input type="number" min={1} max={365} className="aui-vset-num" aria-label="固定时长（天）" value={value.fixedDays ?? 1} onChange={(e) => set({ fixedDays: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} />
            </Row>
          )}
          <Row label="只算工作日" note="工期跳过周末和节假日">
            <Switch checked={Boolean(value.workdaysOnly)} aria-label="工期只算工作日" onCheckedChange={(workdaysOnly) => set({ workdaysOnly })} />
          </Row>
          {calendars.length > 0 && (
            <Row label="节假日日历">
              <SegmentedControl size="sm" label="节假日日历" value={value.calendarId ?? NONE} onValueChange={(v) => set({ calendarId: v === NONE ? null : v })} options={[...calendars.map((c) => ({ value: c.id, label: c.label })), ...(calendars.length < 4 ? [{ value: NONE, label: "不用" }] : [])]} />
            </Row>
          )}
          <Row label="补班日">
            <span className="aui-vset-chips">
              {(value.makeupDays ?? []).map((day) => (
                <span key={day} className="aui-vset-chip" data-kind="day">
                  {shortDay(day)}（周{WEEKDAY_SHORT[weekday(day)]}）
                  <button type="button" aria-label={`移除补班日 ${day}`} onClick={() => set({ makeupDays: (value.makeupDays ?? []).filter((d) => d !== day) })}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <CalendarButton
                label="添加补班日"
                className="aui-vset-addday"
                variant="outline"
                holidays={Object.fromEntries((value.makeupDays ?? []).map((d) => [d, "work" as const]))}
                isDisabledDate={(d) => (value.makeupDays ?? []).includes(d)}
                onSelect={addMakeup}
              >
                <Plus aria-hidden="true" />添加
              </CalendarButton>
            </span>
          </Row>
          {timeZones.length > 0 && (
            <Row label="时区">
              <Choice label="时区" value={value.timeZone ?? timeZones[0]?.value ?? ""} onChange={(timeZone) => set({ timeZone })} options={timeZones} />
            </Row>
          )}
          <Row label="默认刻度" note="打开视图时的时间刻度">
            <SegmentedControl size="sm" label="默认刻度" value={value.scale ?? "month"} onValueChange={(scale) => set({ scale })} options={GANTT_SCALES.map((s) => ({ value: s, label: GANTT_SCALE_LABELS[s] }))} />
          </Row>
        </Section>
        <Section title="分组" extra={`${levels.length} / ${maxGroupLevels} 级`}>
          {levels.length > 0 && (
            <SortableList
              items={levels.map((l, i) => ({ id: `${i}:${l.field}`, level: l }))}
              dense
              label="分组层级"
              itemLabel={(row) => fields.find((f) => f.key === row.level.field)?.title ?? row.level.field}
              onChange={(next) => set({ groups: next.map((r) => r.level) })}
              renderItem={(row) => {
                const index = levels.indexOf(row.level);
                const f = fields.find((x) => x.key === row.level.field);
                return (
                  <span className="aui-vset-level">
                    <span className="aui-vset-level-no">第 {index + 1} 级</span>
                    <Choice label={`第 ${index + 1} 级分组字段`} value={row.level.field} onChange={(field) => set({ groups: levels.map((l, i) => (i === index ? { ...l, field } : l)) })} options={groupable.map((x) => ({ value: x.key, label: x.title }))} />
                    <Choice label={`第 ${index + 1} 级顺序`} value={row.level.order} onChange={(order) => set({ groups: levels.map((l, i) => (i === index ? { ...l, order: order === "desc" ? "desc" : "asc" } : l)) })} options={(["asc", "desc"] as const).map((o) => ({ value: o, label: (f?.type === "singleSelect" ? OPTION_ORDER_LABELS : ORDER_LABELS)[o] }))} />
                    <IconButton label={`删除第 ${index + 1} 级分组`} onClick={() => set({ groups: levels.filter((_, i) => i !== index) })} icon={<X size={14} aria-hidden="true" />} />
                  </span>
                );
              }}
            />
          )}
          <div className="aui-vset-row" data-inline="">
            <MenuButton
              variant="ghost"
              size="sm"
              label="添加分组"
              align="start"
              disabled={levels.length >= maxGroupLevels}
              sections={[{ items: groupable.filter((f) => !levels.some((l) => l.field === f.key)).map((f) => ({ key: f.key, label: f.title, onSelect: () => set({ groups: [...levels, { field: f.key, order: "asc" }] }) })) }]}
            >
              <Plus size={14} aria-hidden="true" />
              添加分组
            </MenuButton>
            <small>最多 {maxGroupLevels} 级</small>
            <label className="aui-vset-inline">
              显示空分组
              <Switch checked={Boolean(value.showEmptyGroups)} aria-label="显示空分组" onCheckedChange={(showEmptyGroups) => set({ showEmptyGroups })} />
            </label>
          </div>
        </Section>
      </div>
      <div className="aui-vset-col">
        <Section title="显示">
          <Row label="条形标题">
            <Choice label="条形标题字段" value={value.titleField ?? primary?.key ?? ""} onChange={(titleField) => set({ titleField })} options={fieldOptions(fields)} />
          </Row>
          <Row label="条上额外显示" note={`最多 ${GANTT_MAX_EXTRA} 个`}>
            <span className="aui-vset-chips">
              {extra.map((key) => (
                <span key={key} className="aui-vset-chip">
                  {fields.find((f) => f.key === key)?.title ?? key}
                  <button type="button" aria-label={`不在条上显示「${fields.find((f) => f.key === key)?.title ?? key}」`} onClick={() => set({ extraFields: extra.filter((k) => k !== key) })}>
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <MenuButton
                variant="outline"
                size="sm"
                className="aui-vset-add"
                label="添加条上字段"
                align="start"
                disabled={extra.length >= GANTT_MAX_EXTRA}
                sections={[{ items: fields.filter((f) => !extra.includes(f.key) && f.key !== (value.titleField ?? primary?.key)).map((f) => ({ key: f.key, label: f.title, onSelect: () => set({ extraFields: [...extra, f.key] }) })) }]}
              >
                <Plus size={12} aria-hidden="true" />
                添加字段
              </MenuButton>
            </span>
          </Row>
          <div className="aui-vset-row" data-stack="">
            <span className="aui-vset-label">左侧显示字段</span>
            <small className="aui-vset-hint">拖动调整顺序，点眼睛显示 / 隐藏</small>
          </div>
          <FieldOrderPicker
            fields={fields}
            value={listShown.filter((k) => k !== primary?.key)}
            label="左侧显示的字段"
            note={(f) => (f.key === value.startField ? "开始" : f.key === value.endField ? "结束" : undefined)}
            onChange={(next) => set({ listFields: [primary?.key ?? "", ...next].filter(Boolean) })}
          />
          <ColorBasis fields={fields} value={value.colorField ?? null} rules={value.colorRules ?? []} onChange={set} />
          <Row label="里程碑字段">
            <Choice label="里程碑字段" value={value.milestoneField ?? NONE} onChange={(v) => set({ milestoneField: v === NONE ? null : v })} options={[{ value: NONE, label: "不使用（可选一个日期字段）" }, ...dates]} />
          </Row>
        </Section>
      </div>
    </div>
  );
}

export { ViewSettingsFooter, countSettingChanges, type ViewSettingsFooterProps } from "./view-settings-footer.tsx";
