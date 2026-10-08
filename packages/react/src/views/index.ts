/**
 * `@adminui/react/views` (bt/views): the record views next to the grid — view tabs and view
 * management, record cards, kanban, gallery, month / week / day calendar, gantt and their settings
 * panels. A separate entry so pages without these views don't load them; no extra dependencies.
 * Field and value types are BitableGrid's (`GridField<T>`), so one field list drives every view.
 * Docs: VIEWS.md.
 */
export * from "./view-tabs.tsx";
export * from "./view-create.tsx";
export * from "./dashboard-tabs.tsx";
export * from "./view-manager.tsx";
export * from "./record-card.tsx";
export { dueState, defaultCoverField, cardTags, cardKeyline, cardFieldEmpty, CARD_MAX_TAGS, NO_COVER, type DueState, type CardChip, type CardKeyPart } from "./record-card-core.ts";
export * from "./kanban-board.tsx";
export * from "./gallery-view.tsx";
export * from "./calendar-month.tsx";
export * from "./calendar-week.tsx";
export { CalendarToolbar, DayBadge, whenText, type CalendarEvent, type CalendarMode, type CalendarBaseProps, type CalendarLegendItem } from "./calendar-parts.tsx";
export * from "./gantt-view.tsx";
export type { GanttMilestone } from "./gantt-timeline.tsx";
export * from "./view-settings.tsx";
export { VIEW_KIND_ICONS, ViewKindIcon } from "./view-parts.tsx";
export {
  VIEW_KINDS,
  VIEW_KIND_LABELS,
  VIEW_TIERS,
  VIEW_TIER_LABELS,
  VIEW_KIND_HINTS,
  VIEW_AUDIENCE_LABELS,
  overflowGroups,
  searchViews,
  viewActions,
  can as canViewAction,
  tierViews,
  tabViews,
  managerCountText,
  newViewName,
  copyName,
  fitTabs,
  type ViewKind,
  type ViewTier,
  type ViewSummary,
  type ViewPolicy,
  type ViewAction,
  type ViewActionSet,
  type ViewAudience,
  type NewViewDraft,
} from "./view-core.ts";
export { KANBAN_UNSET, toneOfOption, kanbanColumns, placeCards, planMove, keyboardMove, dropIndex, columnKeyOf, columnValue, moveLabel, pageTo, type KanbanColumn, type KanbanColumnState, type KanbanMove } from "./kanban-core.ts";
export {
  resolveEvent,
  monthMatrix,
  weekDays,
  layoutMonth,
  eventsOnDay,
  layoutTimeGrid,
  overlapColumns,
  snapMinutes,
  minutesAt,
  moveTimed,
  resizeTimed,
  createRange,
  timedRange,
  moveDays,
  DEFAULT_EVENT_MINUTES,
  type CalendarEventInput,
  type ResolvedEvent,
  type MonthSegment,
  type MonthWeekLayout,
  type TimedPlacement,
} from "./calendar-core.ts";
export {
  GANTT_SCALES,
  GANTT_SCALE_LABELS,
  GANTT_DAY_WIDTH,
  GANTT_VISIBLE_DAYS,
  GANTT_LEAD_DAYS,
  GANTT_SPLIT,
  ganttAutoSplit,
  ganttFrame,
  ganttScaleLabel,
  ganttListColumns,
  ganttListNeed,
  ganttWindow,
  windowStart,
  windowTitle,
  shiftAnchor,
  ganttSpan,
  dragSpan,
  ganttResizable,
  dragDays,
  spanChange,
  durationText,
  nonWorkRuns,
  barBox,
  ganttTicks,
  ganttRows,
  groupKeys,
  spanText,
  barTextPlace,
  barTextWidth,
  ganttTrack,
  type GanttScale,
  type GanttWindow,
  type GanttFrame,
  type GanttFrameInput,
  type GanttEndMode,
  type GanttSpan,
  type GanttSpanOptions,
  type GanttGroup,
  type GanttRow,
  type GanttTick,
  type GanttTicks,
  type BarBox,
} from "./gantt-core.ts";
export {
  addDays,
  addMonths,
  diffDays,
  weekday,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  isoWeek,
  isDayKey,
  toDay,
  todayKey,
  zonedParts,
  zonedInstant,
  isWorkday,
  dayMark,
  workdaysBetween,
  addWorkdays,
  DEFAULT_WEEKEND,
  type DayKey,
  type Weekday,
  type WorkCalendar,
} from "./date-core.ts";
// bt/templates：颜色依据（按单选字段 / 按条件 = 表格填色规则 / 统一颜色）
export { viewColorBasis, viewRecordTone, softTone, type ViewColorBasis, type ViewColorConfig } from "./view-color-core.ts";
