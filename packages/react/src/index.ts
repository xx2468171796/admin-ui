"use client";
/**
 * `@adminui/react` root entry. Public = what the catalog (src/catalog.ts) lists plus the types of
 * public props. Modules whose internals the components or tests need are re-exported with explicit
 * value lists (`export type *` keeps all their types); tests import pure helpers from `../src/*.ts`.
 * test/contracts.test.ts checks every catalog name is exported and every 5.0 removal stays removed.
 */
export * from "./primitives.tsx";
export * from "./theme.tsx";
export { AdminDefaultsProvider, useAdminDefaults } from "./admin-defaults-context.tsx";
export { runtimeTimeZone, resolveAdminDefaults, utcOffsetOf, type AdminDefaults } from "./admin-defaults.ts";
export {
  PageHeader,
  PageBody,
  DescriptionList,
  Panel,
  ResourcePanel,
  InlineAlert,
  DetailLayout,
  MetricGrid,
  MetricCard,
  StatePanel,
  type PageHeaderProps,
  type DescriptionItem,
} from "./layout.tsx";
// 导航与布局（外壳、账号菜单、切换公司、工作标签胶囊、外观弹层）
export { AdminShell, type AdminShellProps, type NavItem, type WorkspaceItem } from "./admin-shell.tsx";
export { AccountMenu, AccountAvatar, CompanySwitcher, type AccountMenuProps, type AccountMenuItem, type CompanySwitcherProps, type CompanyOption, type ShellAccount } from "./shell-account.tsx";
export { shellCrumbs, tabsToClose, searchTabs, navBadgeText, railBadgeText, type ShellCrumb } from "./shell-core.ts";
export { AppearanceButton, AppearancePanel, ColorModeChoice, type AppearanceButtonProps } from "./appearance.tsx";
export { SettingsSheet, type SettingsSheetProps, type SettingsSheetSection } from "./settings-sheet.tsx";
export { LoadMore, type LoadMoreProps } from "./load-more.tsx";
export { AuthLayout, LoginForm, type AuthLayoutProps, type LoginFormProps, type LoginValues } from "./auth-layout.tsx";
export * from "./tabbed-page.tsx";
export * from "./choices.tsx";
export { toggleChoice, datePresetValue } from "./choice-core.ts";
export * from "./forms.tsx";
export * from "./data.tsx";
export * from "./cells.tsx";
export type { TableRowHeight, TableRowHeightPreset, ChipFit, RowLayout, RowLayoutInput } from "./table-rows.ts";
export { ROW_HEIGHT_PRESETS, rowLineBudget, resolveRowLayout, fitChips } from "./table-rows.ts";
export { compareGroupKeys, groupRows, flattenGroups, type RowGroup } from "./table-grouping.ts";
export * from "./row-actions.tsx";
export * from "./help-tip.tsx";
export type * from "./record-detail-core.ts";
export { arrangeRecordFields, peekRecordFields, suggestRecordLevel, readRecordParam, writeRecordParam } from "./record-detail-core.ts";
export * from "./record-detail.tsx";
// 记录详情卡片分区（RecordDetail / RecordLayout.cards）、可点的阶段路径、布局规则（也在 @adminui/react/record-detail-spec）
export { RecordDetail, RecordDetailBody, RecordDetailHeaderTools, FollowButton, recordDetailCatalog, useRecordDetailSpec, type RecordDetailProps, type RecordDetailBodyProps } from "./record-detail-view.tsx";
export { useRecordLayoutEditor, RecordLayoutBar, RecordLayoutButton, type RecordLayoutEditing } from "./record-detail-editor.tsx";
export { StagePath, stageDaysText, type StagePathProps } from "./stage-path.tsx";
export { ActivityComposer, ActivityComposerTool, type ActivityComposerProps, type ActivityComposerDue, type ActivityKind } from "./activity-composer.tsx";
export * from "./record-detail-spec.ts";
// 截止日期：按时区的日历天算逾期 / 今天 / 快到（也在 @adminui/react/grid-query，服务端可用）
export { deadlineState, deadlineTone, deadlineText, DEADLINE_SOON_DAYS, type DeadlineState, type DeadlineKind, type DeadlineOptions } from "./deadline-core.ts";
export type * from "./collections-core.ts";
export { suggestCollection, summarizeChecks, groupByDay } from "./collections-core.ts";
export * from "./collections.tsx";
// 统一时间线的积木（宿主自己的跟进记录用同一套长相）
export * from "./timeline.tsx";
export { dayHeading } from "./timeline-core.ts";
export * from "./kit.tsx";
export * from "./page-templates.tsx";
export { useMediaQuery, useIsMobile, MOBILE_QUERY } from "./media-query.ts";
export * from "./confirm-core.ts";
export * from "./reports.tsx";
export * from "./uploads.tsx";
export * from "./notifications.tsx";
export * from "./record-frame.tsx";
export * from "./motion.tsx";
export * from "./advanced.tsx";
export type * from "./workflow-core.ts";
export {
  normalizePreferences,
  selectionCount,
  viewUrl,
  readViewUrl,
  browserPreferenceStore,
  safeDownloadUrl,
  parseCsv,
} from "./workflow-core.ts";
export * from "./workflow-hooks.ts";
export * from "./operations.tsx";
export * from "./editing.tsx";
export * from "./imports.tsx";
export * from "./workbench.tsx";
export { commandMatches, navCommands, type AdminCommand, type NavCommandSource } from "./command-core.ts";
export * from "./displays.tsx";
export { formatDateTime, relativeTime, formatMinorMoney, type DateInput, type DateTimeFormatOptions, type MoneyFormatOptions } from "./format.ts";
export * from "./governance-core.ts";
export * from "./governance.tsx";
export * from "./dashboard.tsx";
export * from "./portal.tsx";
export type * from "./contracts.ts";
// bt/foundations：Menu / ContextMenu、PopoverPanel、SortableList、选项 7 色、小部件、SideSheet / BottomSheet
export * from "./menu.tsx";
export { placeLayer, menuTypeahead, menuLabel, type LayerRect, type LayerPoint, type LayerSize, type LayerPlacement, type LayerPosition } from "./menu-core.ts";
export { PopoverPanel, type PopoverPanelProps } from "./popover-panel.tsx";
export * from "./sortable.tsx";
export { reorder, moveNode, stepTarget, dropTarget, visibleRows, canPickUp, flattenIds, type SortableNode, type SortableTarget, type SortableRow, type SortableAllow } from "./sortable-core.ts";
export * from "./option-tone.ts";
export * from "./option-swatch.tsx";
// option colours from the palette, one select look (Choice is exported via primitives).
export { optionHueColors, hexToOklch, oklchToHex, type OptionHueColors, type OptionPaletteInput } from "./option-palette.ts";
export { MultiChoice, ChoiceTags, type MultiChoiceProps, type ChoiceTagsProps } from "./select.tsx";
export { OptionList, OptionContent, SelectSearch, SelectFooter, RemovableChip, type SelectItem, type OptionListProps, type SelectSearchProps } from "./option-list.tsx";
export { filterOptions, groupOptions, keyboardOrder, moveActive, initialActive, createCandidate, typeahead, toggleValue, chipsThatFit, showsSearch, SEARCH_THRESHOLD, type SelectOption, type OptionSection } from "./option-list-core.ts";
export { useOptionNav, type OptionNavInput } from "./use-option-nav.ts";
export type { PopoverSheet } from "./popover-panel.tsx";
export * from "./atoms.tsx";
// avatars, buttons, tooltip, keycaps
export * from "./avatar.tsx";
export { avatarTone, avatarLetter, avatarSize, AVATAR_TONES, AVATAR_SIZES, type AvatarSize } from "./avatar-core.ts";
export * from "./buttons.tsx";
export * from "./loading.tsx";
export * from "./divider.tsx";
// number / money / phone / percent inputs, slider
export * from "./number-inputs.tsx";
export * from "./phone-input.tsx";
export * from "./slider.tsx";
export { normalizeNumberText, roundTo, clampNumber, parseNumberText, stepValue, stepKeyTimes, rangeMessage, formatThousands, numberDisplayText, MONEY_CURRENCIES, currencySymbol, moneyTextToMinor, minorToMoneyText, approxMoney, PHONE_COUNTRIES, defaultPhoneCountry, phoneDigits, toE164, parsePhone, formatLocalPhone, formatPhoneDisplay, validatePhone, phoneCountryLabel, sliderRatio, sliderValueAt, sliderKey, sliderMarks, percentText, type MoneyCurrency, type PhoneCountry } from "./number-input-core.ts";
export { ratingWord } from "./atoms-core.ts";
export { ImageUploadGrid, type ImageUploadGridProps, type ImageUploadTile } from "./image-upload-grid.tsx";
export { PasswordInput, PasswordStrength, PasswordConfirmHint, InitialPasswordField, type PasswordInputProps, type PasswordStrengthProps, type PasswordConfirmHintProps, type InitialPasswordFieldProps, type InitialPasswordValue } from "./password-input.tsx";
export { passwordStrength, passwordsMatch, generatePassword, minLengthRule, DEFAULT_PASSWORD_RULES, PASSWORD_LEVEL_TEXT, READABLE_ALPHABET, type PasswordRule, type PasswordLevel, type PasswordCheck, type PasswordStrengthResult, type PasswordStrengthOptions, type PasswordMatch, type GeneratePasswordOptions } from "./password-core.ts";
export { ConditionSentence, type ConditionSentenceProps } from "./condition-sentence.tsx";
export { conditionValueItems, nextConditionValue } from "./condition-value-picker.tsx";
export { FIELD_TYPE_GROUPS, FIELD_TYPE_INFO, fieldTypeInfo, groupTypeTiles, type FieldTypeInfo, type FieldTypeSection } from "./field-dialog-core.ts";
export { conditionLeafText, opJoinsValue } from "./condition-describe.ts";
// search, settings change tracking
export { SearchBox, Highlight, highlightParts, type SearchBoxProps } from "./search.tsx";
export { useChangeTracker, changedKeys, sameValue, type ChangeTracker } from "./change-tracker.ts";
export { ACTION_ICONS, ACTION_ICON_LABELS, ICON_SIZES, iconStroke, type ActionIconName, type IconSize } from "./icons.ts";
export { CopyButton, CopyField, useCopy, maskSecret, COPY_FAILED_TEXT, type CopyButtonProps, type CopyFieldProps } from "./copy-button.tsx";
export { Tooltip, tipProps, useTipFlash, Kbd, useShortcutPlatform, type TooltipProps, type KbdProps } from "./tooltip.tsx";
export { formatShortcut, shortcutLabel, matchShortcut, detectPlatform, placeTip, placeCard, type ShortcutPlatform, type TipSide } from "./tooltip-core.ts";
export { stackPeople, ratingKey, fillCode, stepNumber, countdownText, countdownParts, type CodeCharset, type CountdownParts } from "./atoms-core.ts";
export * from "./sheets.tsx";
// 反馈与弹层——手机操作单、编辑冲突、提示条 / 撤销的纯规则、空 / 错状态文案
export { ActionSheet, type ActionSheetProps } from "./action-sheet.tsx";
export { EditConflictNotice, SaveConflictDialog, StaleRecordNotice, type EditConflictNoticeProps, type FieldConflict, type SaveConflictDialogProps, type StaleRecordNoticeProps } from "./edit-conflict.tsx";
export { resolveConflicts, overriddenKeys, conflictCounts, conflictHeadline, pickOf, type ConflictPick, type FieldConflictValues } from "./edit-conflict-core.ts";
export { confirmOrUndo, toastDuration, createCountdown, secondsLeft, stackToasts, TOAST_MS, type ToastCountdown, type ToastTone } from "./overlay-core.ts";
export { stateText, type StatePanelProps, type StateKind } from "./state-panel.tsx";
export { roundMinor } from "./format.ts";
// bt/media：媒体与附件（附件集、大图预览、音频播放、录音 / 按住说话；上传队列随 uploads.tsx 导出）
export { MediaThumb, MediaTypeIcon, MediaMeta, LockPill, type MediaItem, type MediaLock, type MediaUploadState } from "./media-parts.tsx";
export * from "./media-gallery.tsx";
export * from "./media-lightbox.tsx";
export { AudioPlayer, AudioWaveform, type AudioPlayerProps, type AudioWaveformProps } from "./media-audio.tsx";
export { MEDIA_ERR, mediaFailureOf, mediaFailureText, planMediaError, resumeAt, type MediaErrorInfo, type MediaErrorStep, type MediaFailure, type MediaRecover } from "./media-source-core.ts";
export { useMediaSource, type MediaSourceState } from "./media-source-hook.ts";
export * from "./media-recorder.tsx";
export { useAudioRecorder, type RecordingResult, type UseAudioRecorderOptions } from "./media-recorder-hook.ts";
export {
  detectMediaKind,
  fileExtension,
  fileFamily,
  fileTypeLabel,
  fileTypeName,
  acceptLabel,
  formatDuration,
  formatBytes,
  formatSpeed,
  formatTimeLeft,
  nextSpeed,
  clampTime,
  downsamplePeaks,
  barCountFor,
  levelFromTimeDomain,
  uploadQueueReducer,
  nextUploads,
  estimateSecondsLeft,
  summarizeUploads,
  holdGesture,
  pickRecorderMime,
  recorderErrorState,
  mediaThumbBox,
  DEFAULT_SPEEDS,
  HOLD_CANCEL_DISTANCE,
  type MediaKind,
  type FileFamily,
  type UploadItemState,
  type UploadQueueItem,
  type UploadQueueAction,
  type RecorderState,
} from "./media-core.ts";
// bt/dashboards
export { DeltaBadge, type DeltaBadgeProps } from "./delta-badge.tsx";
export { BulletBar, ProgressRing, type BulletBarProps, type ProgressRingProps } from "./bullet-bar.tsx";
export { StepFunnel, CohortTable, RollupCard, type FunnelStep, type StepFunnelProps, type CohortRow, type CohortTableProps, type RollupMetric, type RollupCardProps } from "./dashboard-widgets.tsx";
export * from "./dashboard-filters.tsx";
export { bulletGeometry, bulletLabels, funnelStats, cohortShade, cohortMax, ringGeometry } from "./dashboard-kit-core.ts";
export type { BulletGeometry, BulletMark, BulletMarkKind, FunnelStepInput, FunnelStepStats } from "./dashboard-kit-core.ts";
// bt/history — 版本回退（LogTimeline 操作记录模式在 page-templates 里再导出）、AI 审阅与提示词设置
export type * from "./history-core.ts";
export { DEFAULT_UNDO_WINDOW_DAYS, DEFAULT_CONFLICT_DECISIONS, inUndoWindow, splitUndoWindow, undoWindowStart, countByKind, filterByKind, conflictChoice, setConflictChoice, setConflictMode, conflictTally, scrubberScale, scrubberPercent, scrubberTimeAt, scrubberDayTicks, quickTimes, opsAfter, justBefore, zonedTime, zonedClock } from "./history-core.ts";
export * from "./conflict-chooser.tsx";
export * from "./time-machine.tsx";
export type * from "./ai-core.ts";
export { promptSegments, usedVariables, unknownVariables, insertVariable, countChars, estimateTokens, diffLines, lineMarks, answerSegments, missingCitations, winnerTally } from "./ai-core.ts";
export * from "./ai-review.tsx";
export * from "./prompt-editor.tsx";
// bt/grid-a: condition model v2 (shared by BitableGrid filters / 填色 and the governance CondBuilder)
export {
  CONDITION_KINDS,
  CONDITION_OPS,
  CONDITION_OP_LABELS,
  CONDITION_LIMITS,
  CONDITION_DYNAMIC_TOKENS,
  RELATIVE_DATE_TOKENS,
  RELATIVE_DATE_LABELS,
  VALUELESS_OPS,
  conditionKindOf,
  conditionOpLabel,
  isConditionComplete,
  isConditionGroup,
  isDynamicValue,
  isRelativeDate,
  isDateRange,
  isDay,
  resolveDynamic,
  relativeDateRange,
  relativeDateLabel,
  conditionDayRange,
  compareDay,
  todayIn,
  addDays,
  emptyConditionGroup,
  countConditions,
  countConditionGroups,
  flattenConditions,
  findConditionNode,
  nextConditionId,
  canAddCondition,
  canAddConditionGroup,
  addConditionNode,
  updateConditionNode,
  setConjunction,
  removeConditionNode,
  evaluateConditionTree,
  pruneConditionTree,
  conditionTreeSql,
  conditionTreeKey,
  conditionTreeIsContextual,
  normalizeConditionTree,
  conditionTreeFromList,
  conditionTreeToList,
} from "./condition-core.ts";
export type {
  Condition,
  ConditionGroup,
  ConditionNode,
  ConditionOp,
  ConditionKind,
  ConditionValue,
  ConditionConjunction,
  ConditionContext,
  ConditionLimits,
  DynamicValue,
  DynamicToken,
  RelativeDateToken,
  RelativeDateValue,
  DateRangeValue,
} from "./condition-core.ts";
// bt/records：字段弹窗（类型格子、选项编辑）、授权名单 GrantList、记录详情子表 / 看不到的字段 / 字段操作、评论、留痕查看
export { FieldTypePicker, type FieldTypePickerProps } from "./field-type-picker.tsx";
export { OptionsEditor, type OptionsEditorProps } from "./options-editor.tsx";
export { FieldDialog, type FieldDialogProps } from "./field-dialog.tsx";
export { filterTypeTiles, tileStep, isTypeTileEnabled, newOptionId, nextOptionTone, optionProblems, validateFieldDraft, hasFieldErrors, cleanOptions, FIELD_NAME_MAX, type FieldTypeTile, type EditableOption, type FieldDraft, type FieldDraftErrors } from "./field-dialog-core.ts";
export { GrantList, type GrantListProps, type GrantHolder } from "./grant-list.tsx";
// GrantList / ShareDialog 给 orgSource 就用组织选人（懒加载 @adminui/react/org-picker）；类型在这里也能拿到
export type { GrantOrgPickerOptions } from "./grant-org-field.tsx";
export type { OrgDataSource, OrgUnit, OrgUnitKind, OrgPerson, OrgPage, OrgSearchHit, PickedSubject, PickerSource, SubjectKind, SubjectRef, Availability, OrgPick } from "./org-picker/org-picker-core.ts";
export { filterSubjects, resolveEntry, grantAudienceText, subjectKind, applyGrantChange, revertGrantChange, grantChangeId, grantChangeText, entryFromPick, grantedNotes, grantKindOf, type GrantSubject, type GrantSubjectKind, type GrantEntry, type GrantLevel, type GrantAudience, type GrantChange } from "./grant-list-core.ts";
export { SubTableSection, HiddenFieldsPill, FieldTileButton, HIDDEN_FIELDS_HINT, type SubTableSectionProps, type SubTableColumn } from "./record-extras.tsx";
export { CommentThread, type CommentThreadProps } from "./comment-thread.tsx";
export { splitMentions, mentionQuery, insertMention, keptMentions, openCount, toggleReaction, isEdited, commentActions, editChanged, patchComment, removeComment, filterComments, commentCounts, mentionsViewer, isViewerMention, foldReplies, commentDayLabel, groupCommentsByDay, reactionTip, COMMENT_REACTION_KEYS, type CommentItem, type CommentPerson, type CommentReaction, type CommentReactionKey, type CommentQuote, type CommentFilter, type CommentDraft, type CommentEditAttachments, type CommentThreadAdapter, type MentionSegment } from "./comment-core.ts";
// 改前 → 改后统一写法；通用审批
export { ChangeValue, type ChangeValueProps } from "./change-value.tsx";
export { ApprovalList, ApprovalDetail, type ApprovalListProps, type ApprovalDetailProps, type ApprovalDetailField } from "./approval.tsx";
export { ApprovalProgress, ApprovalProgressCard, ApprovalMiniSteps, type ApprovalProgressProps, type ApprovalProgressCardProps } from "./approval-progress.tsx";
export { stepPassed, stepRejected, stepTally, pendingApprovers, currentStepIndex, stepStates, canDecide, canWithdraw, decisionError, approvalStatusMeta, filterApprovals, approvalCounts, modeText, waitDays, waitingSince, currentLine, type ApprovalStatus, type ApprovalMode, type ApprovalPerson, type ApprovalDecision, type ApprovalDecisionKind, type ApprovalStep, type ApprovalRequest, type ApprovalScope, type ApprovalStepState, type ApprovalStatusMeta } from "./approval-core.ts";
// bt/share：分享套件（ShareDialog、公开页、密码门、一次性密钥页、我的分享 + 访问记录、单元格修改历史、二维码）
export { QrCode, downloadQrPng, type QrCodeProps } from "./qr-code.tsx";
export { encodeQr, qrPath, type QrEcc, type QrMatrix } from "./qr-core.ts";
export { ShareDialog, type ShareDialogProps, type ShareSaveState } from "./share-dialog.tsx";
export type { ShareFieldChoice, SharePeople } from "./share-dialog-sections.tsx";
export { SharedPageShell, SharedRecordCard, SharedMediaCard, type SharedPageShellProps, type SharedRecordCardProps, type SharedMediaCardProps, type SharedField, type SharedFieldEdit, type SharedPermission, type SharedBy } from "./share-public.tsx";
export { PasswordGate, SecretReveal, type PasswordGateProps, type SecretRevealProps, type SecretField } from "./share-gate.tsx";
export { ShareManager, ShareAccessLog, SHARE_KIND_LABELS, type ShareManagerProps, type ShareAccessLogProps, type ShareItem, type ShareKind, type ShareState, type ShareAccessKindLabel } from "./share-manager.tsx";
export { CellHistoryPopover, type CellHistoryPopoverProps, type CellVersion, type CellHistoryScope } from "./cell-history.tsx";
export {
  AUDIENCE_LABELS,
  CAPABILITY_LABELS,
  ACCESS_KIND_LABELS,
  SOURCE_LABELS,
  PIN_ALPHABET,
  passwordForced,
  expiryPresetBlocked,
  applySharePolicy,
  randomPin,
  shareSentence,
  expiryPhrase,
  shareChangeLabel,
  shareWatermarkText,
  shareCopyText,
  attemptState,
  maskIp,
  accessFilters,
  filterAccess,
  remainingText,
  expiresInText,
  expiresSoon,
  opensLeft,
  openLimitMax,
  formatShareTime,
  relativeDay,
  machineSource,
  sharedByText,
  type ShareAudience,
  type ShareCapability,
  type ShareOpenLimit,
  type ShareFieldAccess,
  type ShareSettings,
  type ShareFieldOption,
  type SharePolicy,
  type ShareSentencePart,
  type ShareAccessKind,
  type ShareAccessEvent,
  type AccessFilter,
  type CellVersionSource,
} from "./share-core.ts";
export { hourPresetValue, datePresetKey, datePresetMs, type DatePresetKey } from "./choice-core.ts";
// bt/templates：T15 表格工作区外壳、T16 公开页、T17 看板搭建器框架
export { RailShell, NavTree, useRailShell, type RailShellProps, type RailModule, type RailAccount, type NavTreeProps, type NavTreeItem, type NavTreeFolder, type NavTreeNode } from "./rail-shell.tsx";
export { filterNavTree, isNavFolder, initialOpenFolders, folderOf, folderLabel, folderCount, visibleTreeIds, nextTreeId, railBottomNav, type NavTreeLeaf, type NavTreeFolderShape, type NavTreeShape } from "./rail-shell-core.ts";
export { WorkspaceTitleBar, ScopePill, type WorkspaceTitleBarProps, type ScopePillProps, type ScopeOption } from "./title-bar.tsx";
export { BuilderLayout, type BuilderLayoutProps, type BuilderHistory } from "./builder-layout.tsx";
export { PublicPageLayout, PublicResult, type PublicPageLayoutProps, type PublicResultProps, type PublicProgress } from "./public-layout.tsx";
// bt/builders-a：通用条件编辑器（表格筛选、治理规则、表格权限按条件、表单显示条件共用）
export { ConditionTreeEditor, ConditionValuePicker, type ConditionTreeEditorProps, type ConditionEditorField, type ConditionOperatorOption, type ConditionValueContext, type ConditionValuePickerProps, type ConditionChoice } from "./condition-editor.tsx";
// bt/builders-b：录音文字稿 TranscriptViewer（A1）、规则列表 RuleList + 条件摘要（A5）；看板搭建器在子路径 @adminui/react/dashboard-builder（D9）
export { TranscriptViewer, type TranscriptViewerProps, type TranscriptExportOptions } from "./transcript-viewer.tsx";
export type { TranscriptRevealer } from "./transcript-list.tsx";
export {
  sortSegments,
  segmentIndexAt,
  segmentAt,
  talkShare,
  findSilences,
  skipSilence,
  nextFocusTime,
  silenceLabel,
  splitSegmentText,
  annotationPins,
  countAnnotations,
  searchTranscript,
  speakerLane,
  barSpeakers,
  timeTicks,
  transcriptText,
  stackPins,
  SPEAKER_TONES,
  speakerTone,
  speakerToneAt,
  speakerColors,
  annotationStats,
  type TranscriptSpeaker,
  type TranscriptSegment,
  type TranscriptSpan,
  type TranscriptAnnotation,
  type TranscriptMask,
  type TranscriptCategory,
  type TranscriptPin,
  type TranscriptSilence,
  type TalkShare,
  type TranscriptPart,
  type TranscriptMatch,
  type TranscriptTextOptions,
} from "./transcript-core.ts";
export { RuleList, ConditionSummary, asGridFields, type RuleListProps, type RuleItem, type RuleFallback, type RuleEditorApi, type ConditionFieldDef } from "./rule-list.tsx";
export {
  describeConditionTree,
  conditionTreeParts,
  conditionValueParts,
  conditionOpText,
  conjunctionWord,
  type DescribeField,
  type DescribeOptions,
  type ConditionPart,
  type ConditionLeafPart,
  type ConditionGroupPart,
  type ConditionValuePart,
} from "./condition-describe.ts";
// bt/datepicker：日期 / 日期时间 / 时间 / 日期范围选择（替换原生 date / datetime-local / time 输入框，值格式不变）
export { Calendar, CalendarButton, type CalendarProps, type CalendarButtonProps, type DatePickerSize } from "./date-calendar.tsx";
export { DatePicker, DateTimePicker, TimeInput, type DatePickerProps, type DateTimePickerProps, type TimeInputProps, type DateFieldBaseProps, type DayRuleProps } from "./date-picker.tsx";
export { DateRangePicker, type DateRangePickerProps } from "./date-range-picker.tsx";
export {
  parseDateText,
  parseTimeText,
  parseDateTimeText,
  monthMatrix,
  dateRangePreset,
  dateRangePresets,
  DATE_RANGE_PRESET_LABELS,
  quickDays,
  relativeDayText,
  relativeDayWord,
  dueState,
  daysBetween,
  type QuickDay,
  type DayKey,
  type HolidayMarks,
  type DateRangePreset,
  type DateRangePresetKey,
} from "./date-picker-core.ts";
// 通知中心
export {
  NotificationCenter,
  type NotificationCenterProps,
  type NotificationCenterTab,
  type NotificationFilter,
  type NotificationActor,
  type NotificationItem,
  type NotificationPage,
  type InboxAction,
  type InboxItem,
} from "./notification-center.tsx";
export {
  dayGroupOf,
  groupNotificationsByDay,
  groupInboxByModule,
  unreadBadgeText,
  relativeTimeText,
  mergePages,
  markReadLocal,
  NOTIFICATION_DAY_GROUPS,
  type NotificationDayGroup,
} from "./notification-core.ts";
// 命令面板
export { type CommandPaletteProps, type CommandItem, type CommandProvider } from "./command-palette.tsx";
export {
  searchReady,
  scoreItem,
  rankItems,
  highlightRanges,
  limitGroups,
  pushRecent,
  runProviders,
  queryWords,
  type CommandSearchItem,
  type CommandSearchSource,
  type CommandGroupState,
  type CommandGroupStatus,
  type RunProvidersOptions,
} from "./command-core.ts";
