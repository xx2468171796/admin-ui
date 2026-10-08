"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Settings2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge } from "./primitives.tsx";
import { Dialog, FormDialog } from "./forms.tsx";
import {
  normalizePreferences,
  selectionCount,
  viewUrl,
  type BatchResult,
  type SavedView,
  type Selection,
  type TablePreferences,
} from "./workflow-core.ts";
import { ROW_HEIGHT_LABELS, ROW_HEIGHT_PRESETS, rowLineBudget, type TableRowHeightPreset } from "./table-rows.ts";
import { IconButton } from "./buttons.tsx";
export type BatchAction = {
  id: string;
  label: string;
  destructive?: boolean;
  description: string;
  run: (
    selection: Selection,
    context: {
      signal: AbortSignal;
      operationId: string;
      onProgress: (percent: number) => void;
    },
  ) => Promise<BatchResult>;
};
export function BatchActionBar({
  selection,
  actions,
  onClear,
  onSelectAll,
  onComplete,
}: {
  selection: Selection;
  actions: readonly BatchAction[];
  onClear: () => void;
  onSelectAll?: () => void;
  onComplete?: (result: BatchResult) => void;
}) {
  const [confirm, setConfirm] = useState<{
    action: BatchAction;
    selection: Selection;
  } | null>(null);
  const [result, setResult] = useState<BatchResult>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<number>();
  const pending = useRef<AbortController | null>(null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const [last, setLast] = useState<BatchAction>();
  useEffect(() => () => pending.current?.abort(), []);
  async function execute(action: BatchAction, target: Selection) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setRunning(true);
    setProgress(undefined);
    setError("");
    const key = JSON.stringify([action.id, target]);
    if (operation.current?.key !== key)
      operation.current = { key, id: crypto.randomUUID() };
    try {
      const next = await action.run(target, {
        signal: controller.signal,
        operationId: operation.current.id,
        onProgress: (n) => {
          if (!controller.signal.aborted)
            setProgress(Math.max(0, Math.min(100, n)));
        },
      });
      if (!controller.signal.aborted) {
        setResult(next);
        setLast(action);
        operation.current = null;
        setConfirm(null);
        onComplete?.(next);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "操作失败，可重试");
    } finally {
      pending.current = null;
      setRunning(false);
    }
  }
  const count = selectionCount(selection);
  if (!count && !result) return null;
  return (
    <section className="aui-workflow-stack" aria-label="批量操作">
      <div className="aui-workflow-bar">
        <strong>
          {selection.mode === "query" ? "当前筛选全部" : "已选择"} {count} 条
        </strong>
        {onSelectAll && selection.mode === "ids" && (
          <Button variant="outline" disabled={running} onClick={onSelectAll}>
            选择筛选全部
          </Button>
        )}
        {actions.map((a) => (
          <Button
            key={a.id}
            variant={a.destructive ? "destructive" : "secondary"}
            disabled={running || !count}
            onClick={() => {
              setError("");
              setConfirm({ action: a, selection });
            }}
          >
            {a.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          disabled={running}
          onClick={() => {
            onClear();
            setResult(undefined);
          }}
        >
          清除选择
        </Button>
      </div>
      {result && (
        <div role="status">
          成功 {result.succeeded} 条，失败 {result.failures.length} 条
          {result.failures.length > 0 && (
            <>
              <ul>
                {result.failures.map((f) => (
                  <li key={f.id}>
                    {f.id}：{f.message}
                  </li>
                ))}
              </ul>
              <Button
                disabled={running}
                variant="outline"
                onClick={() =>
                  last &&
                  setConfirm({
                    action: last,
                    selection: {
                      mode: "ids",
                      ids: result.failures.map((f) => f.id),
                    },
                  })
                }
              >
                仅重试失败项
              </Button>
            </>
          )}
        </div>
      )}
      <Dialog
        open={Boolean(confirm)}
        title="确认批量操作"
        onClose={() => {
          if (!running) setConfirm(null);
        }}
        footer={
          <>
            <Button
              variant="outline"
              disabled={running}
              onClick={() => setConfirm(null)}
            >
              返回
            </Button>
            <Button
              variant={confirm?.action.destructive ? "destructive" : "default"}
              disabled={running}
              onClick={() =>
                confirm && void execute(confirm.action, confirm.selection)
              }
            >
              {running ? "处理中…" : "确认执行"}
            </Button>
            {running && (
              <Button
                variant="outline"
                onClick={() => {
                  pending.current?.abort();
                  setError(
                    "已停止等待；服务端可能仍在执行，请刷新核对。重试会复用操作编号。",
                  );
                }}
              >
                停止等待
              </Button>
            )}
          </>
        }
      >
        <p>{confirm?.action.description}</p>
        <p>
          本次影响 {confirm ? selectionCount(confirm.selection) : 0} 条记录。
        </p>
        {progress !== undefined && (
          <progress aria-label="批量处理进度" value={progress} max={100} />
        )}
        {error && (
          <p role="alert" className="aui-error">
            {error}
          </p>
        )}
      </Dialog>
    </section>
  );
}
export function SavedViewPicker<T>({
  views,
  value,
  current,
  onChange,
  onWrite,
  onDelete,
  shareValue,
}: {
  views: readonly SavedView<T>[];
  value?: string;
  current: T;
  onChange: (view: SavedView<T>) => void;
  onWrite: (view: SavedView<T>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  shareValue?: (value: T) => unknown;
}) {
  const [edit, setEdit] = useState<SavedView<T> | null>(null);
  const [message, setMessage] = useState("");
  const selected = views.find((v) => v.id === value);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="aui-workflow-bar">
      <Choice
        label="已保存视图"
        value={value || "__current"}
        onChange={(id) => {
          const view = views.find((v) => v.id === id);
          if (view) onChange(view);
        }}
        options={[
          { value: "__current", label: "当前筛选" },
          ...views.map((v) => ({
            value: v.id,
            label: `${v.name}${v.shared ? " · 团队" : ""}${v.isDefault ? " · 默认" : ""}`,
          })),
        ]}
      />
      <Button
        variant="outline"
        onClick={() =>
          setEdit({
            id: crypto.randomUUID(),
            name: "新视图",
            value: current,
            editable: true,
          })
        }
      >
        保存视图
      </Button>
      {selected?.editable && (
        <>
          <Button variant="ghost" onClick={() => setEdit(selected)}>
            编辑视图
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)}>
            删除视图
          </Button>
        </>
      )}
      {selected && (
        <Button
          variant="ghost"
          onClick={() =>
            setEdit({
              ...selected,
              id: crypto.randomUUID(),
              name: `${selected.name} 副本`,
              shared: false,
              isDefault: false,
              editable: true,
            })
          }
        >
          复制视图
        </Button>
      )}
      {shareValue && (
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                viewUrl(location.href, shareValue(current)),
              );
              setMessage("筛选链接已复制");
            } catch {
              setMessage("复制失败，请检查浏览器剪贴板权限");
            }
          }}
        >
          分享筛选
        </Button>
      )}
      {message && <span role="status">{message}</span>}
      <FormDialog
        open={Boolean(edit)}
        title="保存视图"
        description="保存筛选、排序和列设置；共享权限由服务端校验。"
        onClose={() => setEdit(null)}
        onSubmit={async () => {
          if (!edit?.name.trim()) throw Error("请输入视图名称");
          await onWrite({ ...edit, name: edit.name.trim() });
        }}
      >
        <Input
          aria-label="视图名称"
          value={edit?.name ?? ""}
          onChange={(e) => edit && setEdit({ ...edit, name: e.target.value })}
        />
        <label>
          <Checkbox
            checked={edit?.shared ?? false}
            onCheckedChange={(v) =>
              edit && setEdit({ ...edit, shared: v === true })
            }
          />
          团队共享
        </label>
        <label>
          <Checkbox
            checked={edit?.isDefault ?? false}
            onCheckedChange={(v) =>
              edit && setEdit({ ...edit, isDefault: v === true })
            }
          />
          设为默认
        </label>
      </FormDialog>
      <FormDialog
        open={deleting}
        title="删除视图？"
        description={selected?.name ?? ""}
        destructive
        submitLabel="删除"
        onClose={() => setDeleting(false)}
        onSubmit={async () => {
          if (selected) await onDelete(selected.id);
        }}
      >
        <p>删除视图不会删除业务数据。</p>
      </FormDialog>
    </div>
  );
}
export function TablePreferencesMenu({
  value,
  columns,
  onChange,
  defaults,
  rowHeightControl = false,
}: {
  value: TablePreferences;
  columns: readonly { key: string; title: string }[];
  onChange: (value: TablePreferences) => void;
  defaults?: TablePreferences;
  /** Let the user pick 行高：矮 / 中 / 高 / 超高, saved as `rowHeight` with the other preferences (3.0). */
  rowHeightControl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const keys = columns.map((c) => c.key);
  const normalized = normalizePreferences(value, keys);
  const [drag, setDrag] = useState<string>();
  const change = (next: TablePreferences) =>
    onChange(normalizePreferences(next, keys));
  const move = (key: string, index: number) => {
    const order = normalized.columns.filter((k) => k !== key);
    order.splice(index, 0, key);
    change({ ...normalized, columns: order });
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Settings2 size={16} />
        表格设置
      </Button>
      <Dialog
        open={open}
        title="表格设置"
        onClose={() => setOpen(false)}
        footer={
          <Button
            variant="outline"
            onClick={() =>
              change(
                defaults ?? {
                  density: "comfortable",
                  columns: keys,
                  hidden: [],
                  pageSize: 20,
                },
              )
            }
          >
            恢复默认
          </Button>
        }
      >
        <div className="aui-workflow-stack">
          <Choice
            label="表格密度"
            value={normalized.density}
            options={[
              { value: "comfortable", label: "舒适" },
              { value: "compact", label: "紧凑" },
            ]}
            onChange={(v) =>
              change({
                ...normalized,
                density: v as TablePreferences["density"],
              })
            }
          />
          {rowHeightControl && (
            <Choice
              label="行高"
              value={normalized.rowHeight && normalized.rowHeight !== "auto" ? normalized.rowHeight : "__default"}
              options={[
                { value: "__default", label: "默认" },
                ...(Object.keys(ROW_HEIGHT_LABELS) as TableRowHeightPreset[]).map((key) => ({
                  value: key,
                  label: `${ROW_HEIGHT_LABELS[key]} · ${rowLineBudget(ROW_HEIGHT_PRESETS[key])} 行`,
                })),
              ]}
              onChange={(v) => {
                const { rowHeight: _previous, ...rest } = normalized;
                change(v === "__default" ? rest : { ...rest, rowHeight: v as TableRowHeightPreset });
              }}
            />
          )}
          <Choice
            label="默认页大小"
            value={String(normalized.pageSize)}
            options={[10, 20, 25, 50, 100].map((n) => ({
              value: String(n),
              label: `${n} 条`,
            }))}
            onChange={(v) => change({ ...normalized, pageSize: Number(v) })}
          />
          <Choice
            label="固定列"
            value={normalized.pinned ?? "__none"}
            options={[
              { value: "__none", label: "不固定列" },
              ...columns.map((c) => ({ value: c.key, label: c.title })),
            ]}
            onChange={(v) =>
              change({ ...normalized, pinned: v === "__none" ? undefined : v })
            }
          />
          <p className="aui-note">拖动调整顺序，也可用上移、下移按钮。</p>
          {normalized.columns.map((key, i) => (
            <div
              key={key}
              className="aui-workflow-bar"
              draggable
              onDragStart={() => setDrag(key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag) move(drag, i);
                setDrag(undefined);
              }}
            >
              <label>
                <Checkbox
                  checked={!normalized.hidden.includes(key)}
                  disabled={
                    !normalized.hidden.includes(key) &&
                    normalized.columns.length - normalized.hidden.length === 1
                  }
                  onCheckedChange={(v) =>
                    change({
                      ...normalized,
                      hidden: v
                        ? normalized.hidden.filter((k) => k !== key)
                        : [...normalized.hidden, key],
                    })
                  }
                />
                {columns.find((c) => c.key === key)?.title}
              </label>
              <IconButton label={`上移 ${key}`} disabled={!i} onClick={() => move(key, i - 1)} icon={<ArrowUp />} />
              <IconButton label={`下移 ${key}`} disabled={i === normalized.columns.length - 1} onClick={() => move(key, i + 1)} icon={<ArrowDown />} />
              {normalized.pinned === key && <StatusBadge>固定</StatusBadge>}
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
export function DisabledReason({
  reason,
  children,
}: {
  reason: string;
  children: ReactNode;
}) {
  return (
    <div className="aui-workflow-stack">
      {children}
      <small className="aui-note">{reason}</small>
    </div>
  );
}
