"use client";
import {
  useContext,
  useRef,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import { sharedContext } from "./context.ts";
import { Clock3, Download, History } from "lucide-react";
import { Button, StatusBadge } from "./primitives.tsx";
import { Dialog } from "./forms.tsx";
import {
  safeDownloadUrl,
  type AdminTask,
  type AuditEvent,
  type TaskAdapter,
} from "./workflow-core.ts";
import { useAdminResource } from "./workflow-hooks.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workflows.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/workflows.css";
type TaskContextValue = {
  tasks: readonly AdminTask[];
  loading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  adapter: TaskAdapter;
};
const TaskContext = sharedContext<TaskContextValue>("tasks");
function TaskScope({
  scope,
  adapter,
  intervalMs = 5000,
  active = true,
  children,
}: {
  scope: string;
  adapter: TaskAdapter;
  intervalMs?: number;
  active?: boolean;
  children: ReactNode;
}) {
  const resource = useAdminResource(
    scope,
    (signal) => adapter.list(signal),
    intervalMs,
    active,
  );
  return (
    <TaskContext.Provider
      value={{
        tasks: resource.data ?? [],
        loading: resource.loading,
        error: resource.error,
        refresh: resource.refresh,
        adapter,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}
export function TaskCenterProvider(props: ComponentProps<typeof TaskScope>) {
  return <TaskScope key={props.scope} {...props} />;
}
function useTaskCenter() {
  const value = useContext(TaskContext);
  if (!value) throw Error("useTaskCenter 必须位于 TaskCenterProvider 内");
  return value;
}
const taskLabels = {
  queued: "排队中",
  running: "进行中",
  success: "已完成",
  failed: "失败",
  cancelled: "已取消",
} as const;
export function TaskCenter() {
  const { tasks, loading, error, refresh, adapter } = useTaskCenter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [failure, setFailure] = useState("");
  const lock = useRef(false);
  const execute = async (
    id: string,
    fn?: (id: string, signal: AbortSignal) => Promise<void>,
  ) => {
    if (!fn || lock.current) return;
    lock.current = true;
    setBusy(id);
    setFailure("");
    try {
      await fn(id, new AbortController().signal);
      await refresh();
    } catch (e) {
      setFailure(String(e));
    } finally {
      lock.current = false;
      setBusy("");
    }
  };
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Clock3 size={17} />
        任务 (
        {
          tasks.filter((t) => t.status === "running" || t.status === "queued")
            .length
        }
        )
      </Button>
      <Dialog
        open={open}
        title="后台任务"
        onClose={() => setOpen(false)}
        footer={
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            刷新任务
          </Button>
        }
      >
        {(error || failure) && (
          <p role="alert" className="aui-error">
            {failure || error}
          </p>
        )}
        {!tasks.length && (
          <p role="status">{loading ? "正在加载任务…" : "暂无任务"}</p>
        )}
        <div className="aui-workflow-stack">
          {tasks.map((task) => (
            <article className="aui-task" key={task.id}>
              <strong>{task.title}</strong>
              <StatusBadge
                tone={
                  task.status === "failed"
                    ? "danger"
                    : task.status === "success"
                      ? "success"
                      : "neutral"
                }
              >
                {taskLabels[task.status]}
              </StatusBadge>
              {task.progress !== undefined && (
                <progress
                  aria-label={`${task.title}进度`}
                  value={Math.max(0, Math.min(100, task.progress))}
                  max={100}
                />
              )}
              {task.error && <p className="aui-error">{task.error}</p>}
              {task.updatedAt && <small>{task.updatedAt}</small>}
              <div className="aui-workflow-bar">
                {task.resultUrl && safeDownloadUrl(task.resultUrl) && (
                  <Button asChild variant="outline">
                    <a
                      href={safeDownloadUrl(task.resultUrl)}
                      download
                      rel="noopener noreferrer"
                    >
                      <Download size={14} />
                      下载结果
                    </a>
                  </Button>
                )}
                {task.cancellable &&
                  adapter.cancel &&
                  (task.status === "running" || task.status === "queued") && (
                    <Button
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => void execute(task.id, adapter.cancel)}
                    >
                      取消任务
                    </Button>
                  )}
                {task.retryable &&
                  task.status === "failed" &&
                  adapter.retry && (
                    <Button
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => void execute(task.id, adapter.retry)}
                    >
                      重试任务
                    </Button>
                  )}
              </div>
            </article>
          ))}
        </div>
      </Dialog>
    </>
  );
}
export function AuditTimeline({ events }: { events: readonly AuditEvent[] }) {
  return (
    <ol className="aui-audit">
      {events.map((event) => (
        <li key={event.id}>
          <History size={16} />
          <div>
            <strong>{event.action}</strong>
            {event.target && <span> · {event.target}</span>}
            <p>
              {event.actor} · <time dateTime={event.at}>{event.at}</time>
            </p>
            {event.detail && <p>{event.detail}</p>}
            {event.changes?.map((change) => (
              <p key={change.field}>
                {change.field}：<del>{change.before}</del> →{" "}
                <ins>{change.after}</ins>
              </p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
