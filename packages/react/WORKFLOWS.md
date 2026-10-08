# 后台工作流

批量操作、保存视图、表格偏好、任务中心、刷新与事件、草稿与冲突、步骤、导入、命令面板、工作区。starter「系统 → 后台工作流」可操作（虚构数据、浏览器存储）。SDK 提供界面、状态机和 adapter 合同；共享视图权限、任务执行、审计写入、记录版本由宿主服务端实现。角色权限和审计中心见 [ACCESS.md](ACCESS.md)。

## 1. 列表：批量、视图、偏好

- **排序**：单列 `sort` / `onSortChange`；多列 `sorts` / `onSortsChange`（数组顺序是优先级），把 `ListQuery.sorts` 传到后端按白名单排序，最后加唯一 ID 保持稳定。两种回调只用一种。
- **表格偏好** `TablePreferencesMenu`：受控值 `{ density, columns, hidden, pinned?, pageSize, rowHeight? }`；`rowHeightControl` 多一项「行高」。同一个值传给 `DataTable preferences`，页大小另传给 pagination 和查询。`normalizePreferences` 删过期列、补新列、避免全部隐藏。改变筛选 / 排序 / 页大小时宿主重置页码和失效选择。
- **批量**：`DataTable bulkActions`（或单独的 `BulkActionBar`）是底部浮条，显示选中数量和批量按钮；`BatchActionBar` 负责确认、进度、结果和失败重试。`selection` 二选一：

```ts
type Selection =
  | { mode: 'ids'; ids: readonly string[] }
  | { mode: 'query'; token: string; count: number };
```

  `query` 的 token 由服务端签发，绑定用户、租户、筛选快照和有效期；服务端执行时重新鉴权，不信 count。`action.run(selection, { signal, operationId, onProgress })` 返回 `{ succeeded, failures: [{ id, message }] }`。失败项单独确认重试；请求异常重试沿用同一 `operationId`，服务端据此幂等。「停止等待」只触发 AbortSignal，不代表服务端回滚；真正取消长任务用 `TaskAdapter.cancel`。
- **保存视图** `SavedViewPicker<T>`：`views / current / value / onChange / onWrite / onDelete`，保存、改名、复制、删除、个人 / 团队、默认标记。服务端验证共享 / 编辑权限、保证一个用户 / 页面只有一个默认视图。`shareValue` 显式返回能进 URL 的字段，`readViewUrl(url, validator)` 读取并校验；敏感关键词不进 URL。
- **持久化** `usePersistentState(key, initial, adapter)`：按顺序保存（慢请求不覆盖新设置），错误可见。key 含项目、租户、用户、页面和 schema 版本。`browserPreferenceStore(validator)` 只放非敏感偏好；服务端偏好实现 `StoreAdapter`。

## 2. 任务、刷新、事件、审计

```tsx
<TaskCenterProvider scope={`${project}:${tenant}:${user}`} adapter={taskAdapter} active={active}>
  <TaskCenter />
  {children}
</TaskCenterProvider>
```

- `TaskAdapter.list(signal)` 查任务，`cancel(id, signal)` / `retry(id, signal)` 执行动作；任务形状见 `AdminTask`（ID、标题、五种状态、进度、错误、下载地址、更新时间、可用动作）。状态以接口成功后重新查询为准；下载地址只接受 HTTP(S) / 相对 URL，下载端点也要授权。
- **刷新**：列表用 `useDataSource` / `useCursorDataSource` 的 `refresh()`（保留当前行，失败给 `staleError`，配 `InlineAlert tone="error" title="刷新失败，当前数据可能已过期"`）。非列表数据用 `useAdminResource(key, load, intervalMs, active)`：同 key 刷新失败保留旧内容并返回 error，新 key 不显示旧结果，页面隐藏或 `active=false` 暂停，上一轮完成才开始下一轮。手动刷新放一个 `Button`，过期提示用 `InlineAlert`。实时面板（3 秒）用 `useLiveResource` + `LiveStatus`（[DASHBOARDS.md](DASHBOARDS.md) §7）。
- **事件** `useAdminEvents(subscribe, receive, active)`：SSE / WebSocket 建连、重连、鉴权、去重归宿主。收到事件提示「有新数据」，不强制覆盖正在编辑的输入。
- **审计时间线** `AuditTimeline`：操作人、时间、目标、说明、字段前后值。全量检索和导出用 `AuditLogPage`（[ACCESS.md](ACCESS.md) §1）。敏感字段先脱敏。

## 3. 编辑、草稿、冲突、导入

- **冲突**：默认保留别人较新的值，我的输入不丢。就地改一格撞车用 `EditConflictNotice`（「重新填入我的 / 用我的覆盖」，多维表格自动显示）；详情里一次保存多项用 `SaveConflictDialog`（`rows: FieldConflict[]` 每项「别人的 / 我的」二选一，`merged` = 自动合好的项数，`onSave(picks)` reject 留在弹框）；打开期间被别人改了用 `StaleRecordNotice`「刷新」。保存请求带 version / If-Match；409 / 412 时加载新版本再显示。覆盖也基于最新版本和专门权限。切换记录时给冲突组件和敏感值组件传记录 key。
- **草稿** `useFormDraft(key, version, adapter, ttlMs)` 返回 `draft / conflict / loading / saving / error / save / clear`；只存宿主筛出的允许持久化 DTO；过期草稿不恢复，版本不符要人工核对。`DraftBanner` 提供恢复 / 丢弃。`useDraftAutosave(value, save, enabled, intervalMs)` 在用户恢复或丢弃旧草稿后再启用。定时草稿不等于保存成功。
- **步骤**：`Steps` 显示步骤进度；分步表单用 `Stepper`（每步 `id / title / content / validate`，校验 reject 不前进，隐藏步骤保留 DOM，末步显示 summary）。
- **导入** `ImportWizard`：文件 → 字段映射 → 重复策略 → 前 10 行预览 → 校验全部 → 确认提交 → 结果。默认解析 CSV（引号、换行、BOM，拒绝重复 / 空表头和列数不符）；预览上限 2 MB / 1000 行，更大的接 `largeFile` 后台任务。`validate` 返回行号 / 字段 / 错误并可导出错误报告；`commit` 收稳定 `operationId`、重复策略和 signal。服务端全量重新校验。

Excel 用可选子路径（先装 `read-excel-file@9.3.10`）：

```tsx
const parse = async (file: File, signal: AbortSignal) =>
  (await import('@adminui/react/excel')).parseSpreadsheet(file, signal);
// 传给 ImportWizard 的 adapter.parse；validate / commit 不变。
```

支持 CSV / XLSX，读第一个工作表，数值以字符串保精度；不支持旧 XLS；不执行公式，读文件里的缓存值。不可信大文件交隔离服务解析。

## 4. 工作台与展示

- `CommandPalette`：搜索、最近使用、快捷键提示；按空格拆词、每个词都要出现；`AdminCommand.group` 显示为结果旁小字；`navCommands(navigation, onNavigate, extra?)` 从菜单生成命令。`useAdminShortcuts` 只处理焦点所在 Provider，输入框 / 弹框 / 输入法组合 / 重复按键不触发；`active=false` 时禁用。`allowed=false` 的命令不能搜也不能执行。
- `createPageRegistry`：拒绝重复 ID，按 feature 和 permission 筛出菜单 / 路由；`FeatureGate` 未配置默认关闭。没有权限的内容由宿主按注册结果不渲染，服务端每次请求仍校验。
- `WorkspaceSwitcher`：先显示切换目标和脏数据提示，await `onChange` 后关闭；宿主以新 scope 为 key 重挂载工作区、清旧订阅，服务端也校验租户。
- `DisabledReason` 解释不可用原因；`Breadcrumbs` 和 `PageHeader` 统一页面层级。
- `StatePanel`：`empty / no-results / error / forbidden / offline / unavailable / timeout`，`action` 插槽放创建、清空筛选或登录。
- 展示：`NumberDisplay`、`MoneyDisplay`（最小单位 bigint）、`DateTimeDisplay`（注明时区）、`RelativeTime`、`CopyableValue`、`SensitiveValue`（reveal 回调服务端鉴权并审计，切记录按 ID 重挂载）；空值一律「—」。

## 5. 验证

本包 `npm run check`、`npm run test:workflows`（请求乱序、偏好串行保存、权限过滤、批量部分失败与重试、真实 CSV / XLSX、任务 / 导入 / 草稿、手机布局、焦点）。消费项目另验接口鉴权、幂等、任务恢复和真机软键盘。
