import { recordDemoAudit } from "./governance-demo";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AdminProvider,
  AuditTimeline,
  BatchActionBar,
  Breadcrumbs,
  Button,
  Checkbox,
  Choice,
  CommandPalette,
  SaveConflictDialog,
  CopyableValue,
  DataTable,
  DateTimeDisplay,
  DraftBanner,
  FeatureGate,
  ImportWizard,
  InlineAlert,
  Input,
  MoneyDisplay,
  NumberDisplay,
  PageHeader,
  Panel,
  RelativeTime,
  SavedViewPicker,
  SensitiveValue,
  StatePanel,
  Stepper,
  TablePreferencesMenu,
  TaskCenter,
  TaskCenterProvider,
  WorkspaceSwitcher,
  browserPreferenceStore,
  createPageRegistry,
  normalizePreferences,
  readViewUrl,
  useAdminEvents,
  useAdminResource,
  useDraftAutosave,
  useFormDraft,
  usePersistentState,
  type AdminTask,
  type AuditEvent,
  type Draft,
  type EventAdapter,
  type SavedView,
  type Selection,
  type SortRule,
  type TablePreferences,
  type TaskAdapter,
} from "@adminui/react";

type Row = { id: string; name: string; status: string; version: number };
type View = {
  search: string;
  sorts: readonly SortRule[];
  preferences: TablePreferences;
};
const defaults: TablePreferences = {
  density: "comfortable",
  columns: ["id", "name", "status"],
  hidden: [],
  pageSize: 10,
};
const isPreferences = (v: unknown): v is TablePreferences => {
  const x = v as TablePreferences | null;
  return Boolean(
    x &&
      ["compact", "comfortable"].includes(x.density) &&
      Array.isArray(x.columns) &&
      x.columns.every((k) => typeof k === "string") &&
      Array.isArray(x.hidden) &&
      x.hidden.every((k) => typeof k === "string") &&
      typeof x.pageSize === "number",
  );
};
const isView = (v: unknown): v is View => {
  const x = v as View | null;
  return Boolean(
    x &&
      typeof x.search === "string" &&
      Array.isArray(x.sorts) &&
      x.sorts.every(
        (s) =>
          ["id", "name", "status"].includes(s.key) &&
          ["asc", "desc"].includes(s.direction),
      ) &&
      isPreferences(x.preferences),
  );
};
const prefStore = browserPreferenceStore(isPreferences);
const viewStore = browserPreferenceStore(
  (v): v is SavedView<View>[] =>
    Array.isArray(v) &&
    v.every(
      (x) =>
        x &&
        typeof x.id === "string" &&
        typeof x.name === "string" &&
        isView(x.value),
    ),
);
const draftStore = browserPreferenceStore(
  (v): v is Draft<{ title: string }> => {
    const x = v as Draft<{ title: string }> | null;
    return Boolean(
      x &&
        typeof x.version === "string" &&
        typeof x.expiresAt === "number" &&
        typeof x.value?.title === "string",
    );
  },
);
const taskStore = browserPreferenceStore(
  (v): v is AdminTask[] =>
    Array.isArray(v) &&
    v.every(
      (x) => x && typeof x.id === "string" && typeof x.status === "string",
    ),
);
const demoEvent = "adminui-demo-event";
const subscribe: EventAdapter = (receive, signal) => {
  const listener = () => receive({ type: "updated", resource: "users" });
  window.addEventListener(demoEvent, listener, { signal });
};
const registry = createPageRegistry([
  { id: "users", title: "用户列表", render: () => <span>用户列表已注册</span> },
  {
    id: "audit",
    title: "审计中心",
    permission: "audit.read",
    feature: "audit",
    render: () => <span>审计页面已注册</span>,
  },
]);
export function WorkflowShowcase({ active = true }: { active?: boolean }) {
  const [scope, setScope] = useState("demo-a");
  return (
    <div className="aui-workflow-stack">
      <WorkspaceSwitcher
        value={scope}
        options={[
          { value: "demo-a", label: "演示项目 A" },
          { value: "demo-b", label: "演示项目 B" },
        ]}
        onChange={async (id) => setScope(id)}
        dirty
      />
      <Workflow key={scope} scope={scope} active={active} />
    </div>
  );
}
function Workflow({ scope, active }: { scope: string; active: boolean }) {
  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: 24 }, (_, i) => ({
      id: `U${String(i + 1).padStart(3, "0")}`,
      name: `演示用户 ${i + 1}`,
      status: "启用",
      version: 1,
    })),
  );
  const [search, setSearch] = useState("");
  const [sorts, setSorts] = useState<readonly SortRule[]>([]);
  const [page, setPage] = useState(1);
  const preferences = usePersistentState(
    `${scope}:preferences`,
    defaults,
    prefStore,
  );
  const views = usePersistentState<SavedView<View>[]>(
    `${scope}:views`,
    [],
    viewStore,
  );
  const [view, setView] = useState<string>();
  const current = { search, sorts, preferences: preferences.value };
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (!views.ready || !preferences.ready || appliedDefault.current) return;
    appliedDefault.current = true;
    const shared = readViewUrl(location.href, isView);
    const saved = views.value.find((v) => v.isDefault);
    const value = shared ?? saved?.value;
    if (value) {
      setSearch(value.search);
      setSorts(value.sorts);
      preferences.setValue(value.preferences);
      setView(shared ? undefined : saved?.id);
    }
  }, [views.ready, preferences.ready]);
  const [selection, setSelection] = useState<Selection>({
    mode: "ids",
    ids: [],
  });
  const [detail, setDetail] = useState<string>();
  const [interval, setIntervalMs] = useState(0);
  const [failRefresh, setFailRefresh] = useState(false);
  const [updates, setUpdates] = useState(false);
  const filtered = rows.filter((r) =>
    [r.id, r.name, r.status].join(" ").includes(search),
  );
  const ordered = [...filtered].sort((a, b) => {
    for (const s of sorts) {
      const key = s.key as "id" | "name" | "status";
      const n = a[key].localeCompare(b[key]);
      if (n) return s.direction === "asc" ? n : -n;
    }
    return a.id.localeCompare(b.id);
  });
  const resource = useAdminResource(
    `${scope}:${search}:${JSON.stringify(sorts)}:${page}:${preferences.value.pageSize}`,
    async () => {
      if (failRefresh) throw Error("演示服务暂不可用");
      setUpdates(false);
      return {
        rows: ordered.slice(
          (page - 1) * preferences.value.pageSize,
          page * preferences.value.pageSize,
        ),
        total: ordered.length,
      };
    },
    interval,
    active,
  );
  const event = useAdminEvents(subscribe, () => setUpdates(true), active);
  useEffect(() => {
    if (active) void resource.refresh();
  }, [rows]);
  const [audit, setAudit] = useState<AuditEvent[]>([
    {
      id: "a1",
      actor: "演示管理员",
      action: "创建演示记录",
      target: scope,
      at: new Date().toISOString(),
      changes: [{ field: "状态", before: "无", after: "启用" }],
    },
  ]);
  const log = (action: string) => {
    recordDemoAudit(action, scope);
    setAudit((v) => [
      {
        id: crypto.randomUUID(),
        actor: "演示管理员",
        action,
        at: new Date().toISOString(),
      },
      ...v,
    ]);
  };
  const taskAdapter = useMemo<TaskAdapter>(
    () => ({
      list: async (signal) =>
        (await taskStore.load(`${scope}:tasks`, signal)) ?? [],
      cancel: async (id, signal) => {
        const tasks = (await taskStore.load(`${scope}:tasks`, signal)) ?? [];
        await taskStore.save(
          `${scope}:tasks`,
          tasks.map((t) => (t.id === id ? { ...t, status: "cancelled" } : t)),
          signal,
        );
      },
      retry: async (id, signal) => {
        const tasks = (await taskStore.load(`${scope}:tasks`, signal)) ?? [];
        await taskStore.save(
          `${scope}:tasks`,
          tasks.map((t) =>
            t.id === id
              ? { ...t, status: "success", progress: 100, error: undefined }
              : t,
          ),
          signal,
        );
      },
    }),
    [scope],
  );
  const addTasks = async () => {
    await taskStore.save(
      `${scope}:tasks`,
      [
        {
          id: "export",
          title: "导出演示记录",
          status: "running",
          progress: 45,
          cancellable: true,
        },
        {
          id: "sync",
          title: "同步演示记录",
          status: "failed",
          error: "演示超时",
          retryable: true,
        },
      ],
      new AbortController().signal,
    );
    log("创建演示任务");
  };
  const [title, setTitle] = useState("");
  const draft = useFormDraft(`${scope}:draft`, "1", draftStore);
  const [draftResolved, setDraftResolved] = useState(false);
  useEffect(() => {
    if (!draft.loading && !draft.draft) setDraftResolved(true);
  }, [draft.loading, draft.draft]);
  useDraftAutosave(
    { title },
    draft.save,
    active &&
      !draft.loading &&
      Boolean(title) &&
      (draftResolved || !draft.draft),
  );
  const [conflict, setConflict] = useState(false);
  const [localName, setLocalName] = useState("我的修改");
  const [serverName, setServerName] = useState("其他管理员的修改");
  const [allowed, setAllowed] = useState(true);
  const [feature, setFeature] = useState(true);
  const [mode, setMode] = useState<"light" | "dark" | "system">("light");
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );
  const [motion, setMotion] = useState<"system" | "none">("system");
  const [stepName, setStepName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const batchAttempts = useRef(new Set<string>());
  return (
    <TaskCenterProvider
      scope={scope}
      adapter={taskAdapter}
      active={active}
      intervalMs={1000}
    >
      <div className="aui-workflow-gallery">
        <Breadcrumbs items={[{ label: "系统" }, { label: "后台工作流" }]} />
        <PageHeader
          title="后台工作流"
          sticky
          description="管理资源、处理任务和追踪操作记录。演示数据保存在当前浏览器。"
          actions={
            <>
              <TaskCenter />
              <CommandPalette
                enabled={active}
                commands={[
                  {
                    id: "search",
                    label: "搜索用户",
                    shortcut: "/",
                    run: () => input.current?.focus(),
                  },
                  {
                    id: "refresh",
                    label: "刷新列表",
                    shortcut: "r",
                    run: () => resource.refresh(),
                  },
                  {
                    id: "new",
                    label: "创建后台任务",
                    shortcut: "n",
                    run: addTasks,
                  },
                  {
                    id: "help",
                    label: "快捷键帮助：/ 搜索，r 刷新，n 创建任务",
                    shortcut: "?",
                    run: () => log("查看快捷键帮助"),
                  },
                ]}
              />
            </>
          }
        />
        <Panel title="资源列表与视图" className="aui-workflow-resource" description="保存常用筛选，批量处理用户，点编号在详情弹框里查看和编辑。">
          <div className="aui-workflow-stack">
            {!preferences.ready || !views.ready ? (
              <StatePanel kind="loading" />
            ) : (
              <>
                {(preferences.error || views.error) && (
                  <p role="alert">{preferences.error || views.error}</p>
                )}
                <SavedViewPicker
                  views={views.value}
                  value={view}
                  current={current}
                  shareValue={(v) => v}
                  onChange={(v) => {
                    setView(v.id);
                    setSearch(v.value.search);
                    setSorts(v.value.sorts);
                    preferences.setValue(v.value.preferences);
                    setPage(1);
                    setSelection({ mode: "ids", ids: [] });
                  }}
                  onWrite={async (v) => {
                    const next = [
                      ...views.value
                        .filter((x) => x.id !== v.id)
                        .map((x) =>
                          v.isDefault ? { ...x, isDefault: false } : x,
                        ),
                      v,
                    ];
                    await viewStore.save(
                      `${scope}:views`,
                      next,
                      new AbortController().signal,
                    );
                    views.setValue(next);
                    setView(v.id);
                  }}
                  onDelete={async (id) => {
                    const next = views.value.filter((x) => x.id !== id);
                    await viewStore.save(
                      `${scope}:views`,
                      next,
                      new AbortController().signal,
                    );
                    views.setValue(next);
                    setView(undefined);
                  }}
                />
                <div className="aui-workflow-bar">
                  <Input
                    ref={input}
                    aria-label="工作流搜索"
                    placeholder="搜索用户"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                      setSelection({ mode: "ids", ids: [] });
                    }}
                  />
                  <TablePreferencesMenu
                    value={preferences.value}
                    columns={[
                      { key: "id", title: "编号" },
                      { key: "name", title: "姓名" },
                      { key: "status", title: "状态" },
                    ]}
                    defaults={defaults}
                    onChange={(v) => {
                      preferences.setValue(v);
                      setPage(1);
                    }}
                  />
                </div>
                {/* 刷新条：更新时间 + 刷新按钮（有推送时提示新数据）+ 自动刷新间隔；失败保留旧行并提示过期 */}
                <div className="aui-workflow-bar">
                  <span>更新时间：{resource.updatedAt ? <DateTimeDisplay value={resource.updatedAt} /> : "—"}</span>
                  <Button variant="outline" disabled={resource.loading} onClick={() => void resource.refresh()}>
                    {resource.loading ? "刷新中…" : updates ? "有新数据，刷新" : "刷新"}
                  </Button>
                  <Choice
                    label="自动刷新"
                    value={String(interval)}
                    options={[
                      { value: "0", label: "手动刷新" },
                      { value: "3000", label: "每 3 秒（实时）" },
                      { value: "30000", label: "每 30 秒" },
                    ]}
                    onChange={(v) => setIntervalMs(Number(v))}
                  />
                </div>
                {resource.error && <InlineAlert tone="error" title="刷新失败，当前数据可能已过期">{resource.error}</InlineAlert>}
                <div className="aui-workflow-bar">
                  <Button
                    variant="outline"
                    onClick={() => setFailRefresh((v) => !v)}
                  >
                    {failRefresh ? "恢复服务" : "模拟刷新失败"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.dispatchEvent(new Event(demoEvent))}
                  >
                    模拟实时更新
                  </Button>
                  <Button variant="outline" onClick={() => void addTasks()}>
                    创建演示任务
                  </Button>
                </div>
                {event.error && <p role="alert">{event.error}</p>}
                <BatchActionBar
                  selection={selection}
                  onClear={() => setSelection({ mode: "ids", ids: [] })}
                  onSelectAll={() =>
                    setSelection({
                      mode: "query",
                      token: JSON.stringify(filtered.map((r) => r.id)),
                      count: filtered.length,
                    })
                  }
                  onComplete={() => {
                    log("批量停用");
                    void resource.refresh();
                  }}
                  actions={[
                    {
                      id: "disable",
                      label: "批量停用",
                      destructive: true,
                      description:
                        "选中用户将不能使用演示功能；U002 首次模拟失败，可单独重试。",
                      run: async (target, { signal, onProgress }) => {
                        await new Promise((resolve) =>
                          setTimeout(resolve, 150),
                        );
                        if (signal.aborted) throw Error("已取消");
                        const ids: string[] =
                          target.mode === "ids"
                            ? [...target.ids]
                            : JSON.parse(target.token);
                        const fail =
                          ids.includes("U002") &&
                          !batchAttempts.current.has("U002");
                        batchAttempts.current.add("U002");
                        const success = ids.filter(
                          (id) => !fail || id !== "U002",
                        );
                        setRows((v) =>
                          v.map((r) =>
                            success.includes(r.id)
                              ? { ...r, status: "停用", version: r.version + 1 }
                              : r,
                          ),
                        );
                        onProgress(100);
                        return {
                          succeeded: success.length,
                          failures: fail
                            ? [{ id: "U002", message: "演示临时失败" }]
                            : [],
                        };
                      },
                    },
                  ]}
                />
                    <DataTable
                      caption="演示用户"
                      rows={resource.data?.rows ?? []}
                      loading={resource.loading && !resource.data}
                      error={!resource.data ? resource.error : undefined}
                      onRetry={() => void resource.refresh()}
                      columns={[
                        {
                          key: "id",
                          title: "编号",
                          sortable: true,
                          render: (r) => (
                            <Button
                              variant="text"
                              onClick={() => setDetail(r.id)}
                            >
                              {r.id}
                            </Button>
                          ),
                        },
                        {
                          key: "name",
                          title: "姓名",
                          sortable: true,
                          render: (r) => r.name,
                        },
                        {
                          key: "status",
                          title: "状态",
                          sortable: true,
                          render: (r) => r.status,
                        },
                      ]}
                      rowKey={(r) => r.id}
                      preferences={preferences.value}
                      sorts={sorts}
                      onSortsChange={(v) => {
                        setSorts(v);
                        setPage(1);
                        setSelection({ mode: "ids", ids: [] });
                      }}
                      selected={
                        selection.mode === "ids"
                          ? selection.ids
                          : resource.data?.rows.map((r) => r.id)
                      }
                      onSelectionChange={(ids) =>
                        setSelection({ mode: "ids", ids })
                      }
                      pagination={{
                        mode: "page",
                        page,
                        pageSize: preferences.value.pageSize,
                        pageSizes: [10, 20, 25, 50, 100],
                        total: resource.data?.total ?? 0,
                        onPageChange: setPage,
                        onPageSizeChange: (size) => {
                          preferences.setValue({
                            ...preferences.value,
                            pageSize: size,
                          });
                          setPage(1);
                        },
                      }}
                      expandRecord={{
                        openKey: detail ?? null,
                        onOpenChange: (key) => setDetail(key ?? undefined),
                        title: (r) => r.name,
                        label: (r) => r.id,
                        render: (r, context) => (
                          <>
                            {context.fields}
                            <CopyableValue value={r.id} />
                            <Button
                              variant="outline"
                              onClick={() => {
                                context.close();
                                setConflict(true);
                              }}
                            >
                              模拟编辑冲突
                            </Button>
                          </>
                        ),
                      }}
                    />
              </>
            )}
          </div>
        </Panel>
        <Panel title="草稿与步骤表单">
          <div className="aui-workflow-stack">
            <DraftBanner
              draft={draft.draft}
              conflict={draft.conflict}
              onRestore={(v) => {
                setTitle(v.title);
                setDraftResolved(true);
              }}
              onDiscard={() => {
                setTitle("");
                setDraftResolved(true);
                void draft.clear();
              }}
            />
            <Input
              aria-label="草稿标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={draft.saving}
              onClick={() => void draft.save({ title })}
            >
              保存草稿
            </Button>
            {draft.error && <p role="alert">{draft.error}</p>}
            <Stepper
              steps={[
                {
                  id: "name",
                  title: "填写名称",
                  content: (
                    <Input
                      aria-label="步骤名称"
                      value={stepName}
                      onChange={(e) => setStepName(e.target.value)}
                    />
                  ),
                  validate: async () => {
                    if (!stepName.trim()) throw Error("名称不能为空");
                  },
                },
                {
                  id: "review",
                  title: "确认规则",
                  content: <p>此示例只创建虚构记录。</p>,
                },
              ]}
              summary={<p>即将创建：{stepName}</p>}
              onFinish={async () => log(`创建 ${stepName}`)}
            />
          </div>
        </Panel>
        <SaveConflictDialog
          open={conflict}
          onClose={() => setConflict(false)}
          rows={[{ key: "name", field: "名称", theirs: serverName, mine: localName, by: "另一位同事" }]}
          onSave={async (picks) => {
            if (picks.name === "theirs") setLocalName(serverName);
            else setServerName(localName);
            log("解决编辑冲突");
          }}
        />
        <Panel title="数据导入">
          <ImportWizard
            fields={[{ key: "name", label: "名称", required: true }]}
            adapter={{
              parse: async (file, signal) =>
                (await import("@adminui/react/excel")).parseSpreadsheet(
                  file,
                  signal,
                ),
              validate: async (values) =>
                values.flatMap((r, i) =>
                  r.name?.trim()
                    ? []
                    : [{ row: i + 2, field: "name", message: "名称不能为空" }],
                ),
              commit: async (values) => {
                log(`导入 ${values.length} 条`);
                setRows((v) => [
                  ...v,
                  ...values.map((r, i) => ({
                    id: `I${Date.now()}-${i}`,
                    name: r.name ?? "",
                    status: "启用",
                    version: 1,
                  })),
                ]);
                return { message: `导入成功 ${values.length} 行` };
              },
            }}
          />
        </Panel>
        <Panel title="审计">
          <AuditTimeline events={audit} />
        </Panel>
        <Panel title="权限与页面注册">
          <div className="aui-workflow-stack">
            <label>
              <Checkbox
                checked={allowed}
                onCheckedChange={(v) => setAllowed(v === true)}
              />
              拥有审计权限
            </label>
            <label>
              <Checkbox
                checked={feature}
                onCheckedChange={(v) => setFeature(v === true)}
              />
              启用审计功能
            </label>
            {/* 无权限时说明原因，不渲染受保护内容；服务端仍逐条鉴权 */}
            {allowed ? (
              <FeatureGate
                name="audit"
                flags={{ audit: feature }}
                fallback={<p>审计功能未启用</p>}
              >
                <p>审计功能可访问</p>
              </FeatureGate>
            ) : (
              <p role="status">你没有执行此操作的权限</p>
            )}
            {registry
              .list({
                features: { audit: feature },
                permissions: allowed ? ["audit.read"] : [],
              })
              .map((p) => (
                <div key={p.id}>{p.render()}</div>
              ))}
          </div>
        </Panel>
        <Panel title="格式与外观">
          <div className="aui-workflow-bar">
            <Choice
              label="明暗模式"
              value={mode}
              options={[
                { value: "light", label: "浅色" },
                { value: "dark", label: "深色" },
                { value: "system", label: "跟随系统" },
              ]}
              onChange={(v) => setMode(v as typeof mode)}
            />
            <Choice
              label="内容密度"
              value={density}
              options={[
                { value: "comfortable", label: "舒适" },
                { value: "compact", label: "紧凑" },
              ]}
              onChange={(v) => setDensity(v as typeof density)}
            />
            <Choice
              label="动效偏好"
              value={motion}
              options={[
                { value: "system", label: "跟随系统动效" },
                { value: "none", label: "关闭动效" },
              ]}
              onChange={(v) => setMotion(v as typeof motion)}
            />
          </div>
          <AdminProvider
            storageKey={`${scope}:appearance`}
            mode={mode}
            density={density}
            motion={motion}
          >
            <Panel title="局部外观预览">
              <div className="aui-workflow-stack">
                <NumberDisplay value={1234567} unit="条" />
                <MoneyDisplay value={12345678901234567n} />
                <DateTimeDisplay value="2026-09-21T00:00:00Z" />
                <RelativeTime value={audit[0]?.at ?? null} />
                <SensitiveValue
                  masked="演示值 ***"
                  reveal={async () => {
                    log("查看敏感字段");
                    return "演示公开内容";
                  }}
                />
              </div>
            </Panel>
          </AdminProvider>
        </Panel>
        <Panel title="状态分类">
          <div className="aui-workflow-stack">
            <StatePanel
              kind="no-results"
              action={
                <Button variant="outline" onClick={() => setSearch("")}>
                  清空筛选
                </Button>
              }
            />
            <StatePanel kind="forbidden" />
            <StatePanel
              kind="timeout"
              onRetry={() => void resource.refresh()}
            />
          </div>
        </Panel>
      </div>
    </TaskCenterProvider>
  );
}
