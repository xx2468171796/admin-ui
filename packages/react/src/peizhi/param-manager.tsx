"use client";
/**
 * ParamManager —「参数」page: system parameters grouped, typed editors (文本 / 数字 / 开关 / 选项 /
 * JSON), secrets masked (only「已设置 / 未设置」, replace as a whole, never shown), invalid stored
 * values flagged with the reason, change confirmation (原值 → 新值 · 生效方式), reset to default for
 * built-in ones, create / delete custom ones, and the change history when the host stores it.
 */
import { useId, useMemo, useState } from "react";
import { History, KeyRound, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge, Switch, Textarea } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { ChangeList, ConfirmDialog, FormDialog, FormField } from "../forms.tsx";
import { InlineAlert, Panel, StatePanel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { RowActionBar, type RowAction } from "../row-actions.tsx";
import { CellText } from "../cells.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import { asDialogError, errorView } from "../access/console-core.ts";
import type { CustomParamType, ParamDto } from "./contracts.ts";
import type { PeizhiApi } from "./api.ts";
import { checkParamKey, groupParams, paramChange, paramDraft, paramGroup, paramTypeLabel, paramValueText, parseParamDraft, type ParamDraft } from "./core.ts";
import { ConfigHistoryDialog } from "./dict-manager.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

async function inDialog<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw asDialogError(e);
  }
}

/** The typed editor of one parameter (used in the edit dialog). */
export function ParamEditor({ param, draft, onChange, id }: { param: Pick<ParamDto, "type" | "label" | "secret" | "options" | "optionLabels" | "min" | "max" | "integer" | "maxLength" | "multiline">; draft: ParamDraft; onChange: (d: ParamDraft) => void; id: string }) {
  if (param.type === "boolean") return <Switch id={id} aria-label={param.label} checked={draft.on} onCheckedChange={(on) => onChange({ ...draft, on })} />;
  if (param.type === "enum")
    return <Choice id={id} label={param.label} value={draft.text} placeholder="请选择" options={(param.options ?? []).map((o) => ({ value: o, label: param.optionLabels?.[o] ?? o }))} onChange={(text) => onChange({ ...draft, text })} />;
  if (param.type === "json" || (param.type === "string" && param.multiline && !param.secret))
    return <Textarea id={id} rows={param.type === "json" ? 8 : 4} spellCheck={false} value={draft.text} onChange={(e) => onChange({ ...draft, text: e.target.value })} />;
  return (
    <Input
      id={id}
      type={param.secret ? "password" : "text"}
      autoComplete={param.secret ? "new-password" : "off"}
      inputMode={param.type === "number" ? "decimal" : undefined}
      maxLength={param.maxLength}
      placeholder={param.secret ? "输入新的值（原值看不到）" : undefined}
      value={draft.text}
      onChange={(e) => onChange({ ...draft, text: e.target.value })}
    />
  );
}

function rangeHint(p: ParamDto): string {
  const parts: string[] = [];
  if (p.type === "number") {
    if (p.min !== undefined && p.max !== undefined) parts.push(`${p.min}–${p.max}`);
    else if (p.min !== undefined) parts.push(`≥ ${p.min}`);
    else if (p.max !== undefined) parts.push(`≤ ${p.max}`);
    if (p.integer) parts.push("整数");
  }
  if (p.maxLength !== undefined) parts.push(`最多 ${p.maxLength} 字`);
  return parts.join("，");
}

type Editing = { param: ParamDto; draft: ParamDraft };

/** Live「原值 → 新值」of the edit dialog; a draft that does not parse shows why instead. */
function EditPreview({ param, draft }: { param: ParamDto; draft: ParamDraft }) {
  let next: unknown;
  try {
    next = parseParamDraft(param, draft);
  } catch (e) {
    return <p className="aui-note" role="status">{e instanceof Error ? e.message : String(e)}</p>;
  }
  return <ChangeList caption="改动预览" items={paramChange(param, next)} />;
}
type Creating = { key: string; label: string; group: string; hint: string; type: CustomParamType; draft: ParamDraft; secret: boolean; isPublic: boolean };

export type ParamManagerProps = {
  api: PeizhiApi;
  readOnly?: boolean;
  title?: string;
};

export function ParamManager({ api, readOnly = false, title = "参数" }: ParamManagerProps) {
  const ids = useId();
  const list = useAdminResource("pz-params", (s) => api.listParams(s));
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [resetting, setResetting] = useState<ParamDto | null>(null);
  const [deleting, setDeleting] = useState<ParamDto | null>(null);
  const [creating, setCreating] = useState<Creating | null>(null);
  const [history, setHistory] = useState<ParamDto | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const [error, setError] = useState<unknown>(null);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupParams(list.data ?? []).filter((p) => !q || p.key.toLowerCase().includes(q) || p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q));
  }, [list.data, query]);
  const invalid = (list.data ?? []).filter((p) => p.invalid);
  const saved = (msg: string) => {
    setDone(msg);
    void list.refresh();
  };
  const quickToggle = async (p: ParamDto, on: boolean) => {
    setError(null);
    try {
      await api.setParam(p.key, on);
      saved(`「${p.label}」已${on ? "打开" : "关闭"}`);
    } catch (e) {
      setError(e);
    }
  };
  if (list.error && !list.data) return <StatePanel kind="error" message={list.error} onRetry={list.refresh} />;
  if (!list.data) return <StatePanel kind="loading" />;
  const ev = error ? errorView(error) : null;
  return (
    <div className="aui-pz">
      {readOnly && <InlineAlert tone="info" title="只读">你可以查看参数，不能修改。</InlineAlert>}
      {invalid.length > 0 && (
        <InlineAlert tone="warning" title={`${invalid.length} 个参数库里的值不合法，正在用默认值`}>
          {invalid.map((p) => `${p.label}：${p.invalid}`).join("；")}。重新设置或恢复默认即可。
        </InlineAlert>
      )}
      {ev && <InlineAlert tone="error" title={ev.title} action={<Button size="sm" variant="ghost" onClick={() => setError(null)}>知道了</Button>}>{ev.message}</InlineAlert>}
      {done && <p className="aui-access-status" role="status">{done}</p>}
      <Panel
        title={title}
        description="代码里声明的是内置参数（不能删，只能恢复默认）；改动保存后各进程下一次读取就生效，不用刷新缓存。"
        actions={!readOnly ? <Button size="sm" onClick={() => setCreating({ key: "", label: "", group: "", hint: "", type: "string", draft: { text: "", on: false }, secret: false, isPublic: false })}><Plus size={14} aria-hidden="true" />新建参数</Button> : undefined}
      >
        <div className="aui-access-filters">
          <FormField label="搜索" htmlFor={`${ids}-q`}>
            <Input id={`${ids}-q`} type="search" clearable placeholder="名称 / 键 / 分组" value={query} onChange={(e) => setQuery(e.target.value)} />
          </FormField>
        </div>
      </Panel>
      <DataTable rowHeight="medium"
        caption="系统参数"
        rows={rows}
        rowKey={(p) => p.key}
        emptyKind={query ? "no-results" : "empty"}
        emptyLabel={query ? "没有符合条件的参数" : "还没有参数"}
        emptyAction={query ? <Button size="sm" variant="outline" onClick={() => setQuery("")}>清空搜索</Button> : undefined}
        pagination={{ mode: "all" }}
        grouping={{ by: paramGroup, header: (g, rs) => `${g}（${rs.length}）`, collapsed, onCollapsedChange: setCollapsed }}
        columns={[
          { key: "label", title: "参数", minWidth: 180, render: (p) => <CellText primary={p.label} secondary={p.key} /> },
          {
            key: "value",
            title: "当前值",
            minWidth: 160,
            maxWidth: 320,
            render: (p) =>
              p.type === "boolean" && !p.secret ? (
                <Switch aria-label={`${p.label}（开关）`} checked={p.value === true} disabled={readOnly} onCheckedChange={(on) => void quickToggle(p, on)} />
              ) : p.secret ? (
                <StatusBadge tone={p.hasValue ? "success" : "neutral"}>{paramValueText(p, p.value)}</StatusBadge>
              ) : (
                <span className={p.type === "json" ? "aui-pz-value" : undefined} data-tip={paramValueText(p, p.value)}>{paramValueText(p, p.value)}</span>
              ),
            truncate: (p) => paramValueText(p, p.value),
          },
          { key: "type", title: "类型", width: 80, render: (p) => paramTypeLabel(p) },
          {
            key: "state",
            title: "状态",
            minWidth: 130,
            render: (p) => (
              <span className="aui-access-badges">
                {p.invalid ? <StatusBadge tone="danger">值不合法</StatusBadge> : p.overridden ? <StatusBadge tone="warning">已改</StatusBadge> : <StatusBadge>默认</StatusBadge>}
                {!p.builtin && <StatusBadge tone="brand">{p.orphan ? "代码已删除" : "自定义"}</StatusBadge>}
                {p.secret && <StatusBadge tone="danger">密钥</StatusBadge>}
                {p.public && <StatusBadge>公开</StatusBadge>}
              </span>
            ),
          },
          {
            key: "actions",
            title: "操作",
            kind: "actions",
            render: (p) => {
              const actions: RowAction[] = [];
              if (!readOnly) actions.push(p.secret ? { key: "replace", label: "替换", icon: <KeyRound />, onSelect: () => setEditing({ param: p, draft: paramDraft(p) }) } : { key: "edit", label: "修改", icon: <Pencil />, onSelect: () => setEditing({ param: p, draft: paramDraft(p) }) });
              if (!readOnly && p.builtin && p.overridden) actions.push({ key: "reset", label: "恢复默认", icon: <RotateCcw />, onSelect: () => setResetting(p) });
              if (api.history) actions.push({ key: "history", label: "改动记录", ariaLabel: `${p.label}的改动记录`, icon: <History />, onSelect: () => setHistory(p) });
              if (!readOnly && !p.builtin) actions.push({ key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setDeleting(p) });
              return actions.length ? <RowActionBar label={`${p.label}的更多操作`} actions={actions} /> : null;
            },
          },
        ]}
      />
      <FormDialog
        open={editing !== null}
        title={editing ? `${editing.param.secret ? "替换" : "修改"}「${editing.param.label}」` : ""}
        description={editing?.param.hint || (editing?.param.secret ? "密钥只能整体替换，原值看不到。" : "核对下面的改动再保存。")}
        dirty={!!editing && (editing.param.secret ? !!editing.draft.text : JSON.stringify(editing.draft) !== JSON.stringify(paramDraft(editing.param)))}
        onClose={() => setEditing(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!editing) return;
            const next = parseParamDraft(editing.param, editing.draft);
            await api.setParam(editing.param.key, next);
            setEditing(null);
            saved(`已保存「${editing.param.label}」`);
          })
        }
      >
        {editing && (
          <>
            {editing.param.invalid && <InlineAlert tone="warning" title="库里的值不合法">{editing.param.invalid}；现在用的是默认值。</InlineAlert>}
            <FormField label={editing.param.label} htmlFor={`${ids}-edit`} hint={[rangeHint(editing.param), !editing.param.secret && editing.param.builtin ? `默认：${paramValueText(editing.param, editing.param.defaultValue)}` : ""].filter(Boolean).join("；") || undefined}>
              <ParamEditor id={`${ids}-edit`} param={editing.param} draft={editing.draft} onChange={(draft) => setEditing((e) => e && { ...e, draft })} />
            </FormField>
            <EditPreview param={editing.param} draft={editing.draft} />
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={resetting !== null}
        title="恢复默认"
        confirmLabel="恢复默认"
        impact={resetting ? `「${resetting.label}」删掉库里的覆盖值，回到代码里的默认值。` : undefined}
        onClose={() => setResetting(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!resetting) return;
            await api.resetParam(resetting.key);
            saved(`「${resetting.label}」已恢复默认`);
          })
        }
      >
        {resetting && <ChangeList items={[{ label: resetting.label, from: paramValueText(resetting, resetting.value), to: resetting.secret ? "默认值（隐藏）" : paramValueText(resetting, resetting.defaultValue), effect: "保存后各进程下一次读取即生效" }]} />}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleting !== null}
        title="删除参数"
        destructive
        confirmLabel="删除"
        typeToConfirm={deleting?.key}
        impact={deleting ? `删除自定义参数「${deleting.label}」（${deleting.key}）。读它的地方会拿到空值。` : undefined}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!deleting) return;
            await api.deleteParam(deleting.key);
            saved(`已删除「${deleting.label}」`);
          })
        }
      />
      <FormDialog
        open={creating !== null}
        title="新建自定义参数"
        description="给前端公开配置、临时开关用；要被业务逻辑依赖的参数请写进代码（defineParams）。"
        dirty={!!creating && !!(creating.key || creating.label)}
        submitLabel="新建"
        onClose={() => setCreating(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!creating) return;
            const bad = checkParamKey(creating.key);
            if (bad) throw new Error(bad);
            if (!creating.label.trim()) throw new Error("请填写名称");
            const value = parseParamDraft({ type: creating.type, label: creating.label, secret: creating.secret }, creating.draft);
            await api.createParam({ key: creating.key, type: creating.type, value, label: creating.label.trim(), ...(creating.group.trim() ? { group: creating.group.trim() } : {}), ...(creating.hint.trim() ? { hint: creating.hint.trim() } : {}), secret: creating.secret, public: creating.isPublic && !creating.secret });
            setCreating(null);
            saved(`已新建「${creating.label.trim()}」`);
          })
        }
      >
        {creating && (
          <>
            <div className="aui-access-form-row">
              <FormField label="键" htmlFor={`${ids}-new-key`} required hint="如 site.banner">
                <Input id={`${ids}-new-key`} value={creating.key} onChange={(e) => setCreating((c) => c && { ...c, key: e.target.value })} />
              </FormField>
              <FormField label="名称" htmlFor={`${ids}-new-label`} required>
                <Input id={`${ids}-new-label`} value={creating.label} onChange={(e) => setCreating((c) => c && { ...c, label: e.target.value })} />
              </FormField>
            </div>
            <FormField label="类型" htmlFor={`${ids}-new-type`}>
              <SegmentedControl label="类型" value={creating.type} options={(["string", "number", "boolean", "json"] as const).map((t) => ({ value: t, label: paramTypeLabel({ type: t }) }))} onValueChange={(type) => setCreating((c) => c && { ...c, type, draft: { text: "", on: false } })} />
            </FormField>
            <FormField label="值" htmlFor={`${ids}-new-value`} required>
              <ParamEditor id={`${ids}-new-value`} param={{ type: creating.type, label: creating.label || "值", secret: creating.secret }} draft={creating.draft} onChange={(draft) => setCreating((c) => c && { ...c, draft })} />
            </FormField>
            <div className="aui-access-form-row">
              <FormField label="分组" htmlFor={`${ids}-new-group`}>
                <Input id={`${ids}-new-group`} value={creating.group} onChange={(e) => setCreating((c) => c && { ...c, group: e.target.value })} />
              </FormField>
              <FormField label="说明" htmlFor={`${ids}-new-hint`}>
                <Input id={`${ids}-new-hint`} value={creating.hint} onChange={(e) => setCreating((c) => c && { ...c, hint: e.target.value })} />
              </FormField>
            </div>
            <div className="aui-access-form-row">
              <label className="aui-access-toggle">
                <Checkbox checked={creating.secret} disabled={creating.type !== "string"} aria-label="密钥" onCheckedChange={(v) => setCreating((c) => c && { ...c, secret: v === true, isPublic: v === true ? false : c.isPublic })} />
                <span>密钥<span className="aui-note">（接口里永远不回原值）</span></span>
              </label>
              <label className="aui-access-toggle">
                <Checkbox checked={creating.isPublic} disabled={creating.secret} aria-label="公开" onCheckedChange={(v) => setCreating((c) => c && { ...c, isPublic: v === true })} />
                <span>公开<span className="aui-note">（未登录也能读到）</span></span>
              </label>
            </div>
          </>
        )}
      </FormDialog>
      {api.history && <ConfigHistoryDialog api={api} target={history ? { kind: "param", target: history.key } : null} title={history ? `「${history.label}」的改动记录` : ""} onClose={() => setHistory(null)} />}
    </div>
  );
}
