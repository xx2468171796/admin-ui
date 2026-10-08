"use client";
/**
 * DictManager —「字典」page: dictionary types (built-in from code / custom), their items with tag
 * colour (tone = StatusBadge tone), sort, default item, enable / disable, restore to code default,
 * built-in markers. Type codes and item values never change (business tables store them); built-in
 * items cannot be deleted, only relabelled or disabled. The server checks everything again.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { FolderOpen, History, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, Checkbox, Input, StatusBadge, Switch, Textarea } from "../primitives.tsx";
import { ChangeList, ConfirmDialog, Dialog, FormDialog, FormField } from "../forms.tsx";
import { DescriptionList, InlineAlert, Panel, StatePanel } from "../layout.tsx";
import { DataTable } from "../data.tsx";
import { SegmentedControl } from "../choices.tsx";
import { RowActionBar } from "../row-actions.tsx";
import { CellText } from "../cells.tsx";
import { DateTimeDisplay } from "../displays.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import { AuditDiff } from "../access/audit-diff.tsx";
import { asDialogError, errorView } from "../access/console-core.ts";
import { revealDetail } from "../access/console-shared.tsx";
import { DICT_TONES, DICT_TONE_LABEL, type ConfigChangeEvent, type DictItemDto, type DictTone, type DictTypeDto } from "./contracts.ts";
import type { PeizhiApi } from "./api.ts";
import { checkDictCode, checkItemValue, sortItems } from "./core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

const TONE_OPTIONS = DICT_TONES.map((t) => ({ value: t, label: DICT_TONE_LABEL[t] }));

/** Tag colour picker: a SegmentedControl of colour names (group name = `label`) and a StatusBadge preview of the result. */
export function TonePicker({ value, onChange, label, preview, disabled }: { value: DictTone; onChange: (tone: DictTone) => void; label: string; /** Badge text (e.g. the item label); default the colour name. */ preview?: string; disabled?: boolean }) {
  return (
    <div className="aui-pz-tones">
      <SegmentedControl size="sm" label={label} value={value} onValueChange={onChange} options={TONE_OPTIONS} disabled={disabled} />
      <StatusBadge tone={value}>{preview?.trim() || DICT_TONE_LABEL[value]}</StatusBadge>
    </div>
  );
}

async function inDialog<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw asDialogError(e);
  }
}

function Markers({ builtin, customized, disabled }: { builtin: boolean; customized: boolean; disabled?: boolean }) {
  return (
    <span className="aui-access-badges">
      {builtin ? <StatusBadge>内置</StatusBadge> : <StatusBadge tone="brand">自定义</StatusBadge>}
      {customized && <StatusBadge tone="warning">后台改过</StatusBadge>}
      {disabled && <StatusBadge tone="danger">已停用</StatusBadge>}
    </span>
  );
}

/** Change history of one target (only when the host serves `api.history`). */
export function ConfigHistoryDialog({ api, target, title, onClose }: { api: PeizhiApi; target: { kind: ConfigChangeEvent["kind"]; target: string } | null; title: string; onClose: () => void }) {
  const list = useAdminResource(`pz-hist:${target?.kind}:${target?.target}`, (s) => (target && api.history ? api.history(target, s) : Promise.resolve([])), 0, !!target);
  return (
    <Dialog open={target !== null} title={title} description="谁在什么时候改了什么；密钥只显示「已隐藏」。" size="lg" onClose={onClose}>
      {list.error ? (
        <StatePanel kind="error" message={list.error} onRetry={list.refresh} />
      ) : list.loading && !list.data ? (
        <StatePanel kind="loading" />
      ) : !list.data?.length ? (
        <StatePanel kind="empty" message="还没有改动记录" />
      ) : (
        <div className="aui-access-stack">
          {list.data.map((e, i) => (
            <Panel key={`${e.at}-${i}`} title={`${e.actor?.name ?? e.actor?.id ?? "系统"} · ${{ create: "新建", update: "修改", delete: "删除", reset: "恢复默认", restore: "恢复默认", sync: "启动同步", refresh: "刷新缓存" }[e.action] ?? e.action}`} description={new Date(e.at).toLocaleString("zh-CN")}>
              <AuditDiff before={e.before} after={e.after} caption="改动前后" />
            </Panel>
          ))}
        </div>
      )}
    </Dialog>
  );
}

type TypeForm = { type: DictTypeDto | null; code: string; name: string; remark: string; enabled: boolean };
type ItemForm = { item: DictItemDto | null; value: string; label: string; en: string; tone: DictTone; sort: string; isDefault: boolean; enabled: boolean; remark: string };

export type DictManagerProps = {
  api: PeizhiApi;
  /** Display only (no manage permission). */
  readOnly?: boolean;
  title?: string;
};

export function DictManager({ api, readOnly = false, title = "字典" }: DictManagerProps) {
  const ids = useId();
  const types = useAdminResource("pz-types", (s) => api.listDictTypes(s));
  const [picked, setPicked] = useState("");
  const items = useAdminResource(`pz-items:${picked}`, (s) => api.listDictItems(picked, s), 0, !!picked);
  const [typeForm, setTypeForm] = useState<TypeForm | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete-type" | "restore-type" | "delete-item" | "restore-item"; item?: DictItemDto } | null>(null);
  const [history, setHistory] = useState<{ kind: ConfigChangeEvent["kind"]; target: string; title: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState("");
  useEffect(() => {
    const list = types.data ?? [];
    if ((!picked || !list.some((t) => t.code === picked)) && list[0]) setPicked(list[0].code);
  }, [types.data, picked]);
  const type = (types.data ?? []).find((t) => t.code === picked) ?? null;
  const rows = useMemo(() => sortItems(items.data ?? []), [items.data]);
  const refreshAll = (msg: string) => {
    setDone(msg);
    void types.refresh();
    if (picked) void items.refresh();
  };
  const toggleItem = async (item: DictItemDto, on: boolean) => {
    setError(null);
    try {
      await api.updateDictItem(item.type, item.value, { status: on ? "enabled" : "disabled" });
      refreshAll(`「${item.label}」已${on ? "启用" : "停用"}`);
    } catch (e) {
      setError(e);
    }
  };
  if (types.error && !types.data) return <StatePanel kind="error" message={types.error} onRetry={types.refresh} />;
  if (!types.data) return <StatePanel kind="loading" />;
  const ev = error ? errorView(error) : null;
  const canAdd = !!type && !readOnly && (!type.builtin || type.extensible);
  return (
    <div className="aui-pz">
      {readOnly && <InlineAlert tone="info" title="只读">你可以查看字典，不能修改。</InlineAlert>}
      {ev && <InlineAlert tone="error" title={ev.title} action={<Button size="sm" variant="ghost" onClick={() => setError(null)}>知道了</Button>}>{ev.message}</InlineAlert>}
      {done && <p className="aui-access-status" role="status">{done}</p>}
      <div className="aui-access-split">
        <Panel title={title} description="业务表里存的是「值」；改标签、颜色、排序、停用都不影响已有数据。" actions={!readOnly ? <Button size="sm" onClick={() => setTypeForm({ type: null, code: "", name: "", remark: "", enabled: true })}><Plus size={14} aria-hidden="true" />新建字典</Button> : undefined}>
          <DataTable rowHeight="medium"
            caption="字典类型"
            rows={types.data}
            rowKey={(t) => t.code}
            emptyLabel="还没有字典"
            pagination={{ mode: "all" }}
            columns={[
              { key: "name", title: "字典", minWidth: 150, render: (t) => <CellText primary={t.code === picked ? `${t.name}（当前）` : t.name} secondary={[t.builtin ? "内置" : "自定义", `${t.itemCount} 项`, t.status === "disabled" ? "已停用" : "", t.customized ? "后台改过" : ""].filter(Boolean).join(" · ")} /> },
              {
                key: "open",
                title: "操作",
                kind: "actions",
                render: (t) => (
                  <RowActionBar
                    label={`${t.name}的更多操作`}
                    actions={[{ key: "open", label: "打开", ariaLabel: `打开字典 ${t.name}`, icon: <FolderOpen />, onSelect: () => { setPicked(t.code); revealDetail(); } }]}
                  />
                ),
              },
            ]}
          />
        </Panel>
        {type ? (
          <div className="aui-access-stack">
            <Panel
              title={type.name}
              description={type.code}
              actions={
                <>
                  {api.history && <Button size="sm" variant="ghost" onClick={() => setHistory({ kind: "dict_type", target: type.code, title: `「${type.name}」的改动记录` })}><History size={14} aria-hidden="true" />改动记录</Button>}
                  {!readOnly && <Button size="sm" variant="outline" onClick={() => setTypeForm({ type, code: type.code, name: type.name, remark: type.remark, enabled: type.status === "enabled" })}>编辑</Button>}
                  {!readOnly && type.builtin && type.customized && <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "restore-type" })}><RotateCcw size={14} aria-hidden="true" />恢复默认</Button>}
                  {!readOnly && !type.builtin && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "delete-type" })}>删除</Button>}
                </>
              }
            >
              <Markers builtin={type.builtin} customized={type.customized} disabled={type.status === "disabled"} />
              <DescriptionList
                items={[
                  { label: "说明", value: type.remark || "—" },
                  { label: "后台能否加项", value: type.builtin ? (type.extensible ? "能（代码允许扩展）" : "不能（代码按值写了分支）") : "能" },
                  { label: "最后修改", value: type.updatedAt ? <><DateTimeDisplay value={type.updatedAt} />{type.updatedBy ? ` · ${type.updatedBy}` : ""}</> : "—" },
                ]}
              />
            </Panel>
            <DataTable rowHeight="medium"
              caption={`${type.name}的字典项`}
              rows={rows}
              rowKey={(i) => i.value}
              loading={items.loading && !items.data}
              error={items.error}
              onRetry={items.refresh}
              emptyLabel="还没有字典项"
              pagination={{ mode: "all" }}
              toolbar={
                <div className="aui-access-bar">
                  <span className="aui-note">停用的项照样能翻译老数据，只是不进下拉。</span>
                  {canAdd && (
                    <span className="aui-access-bar-end">
                      <Button size="sm" onClick={() => setItemForm({ item: null, value: "", label: "", en: "", tone: "neutral", sort: String((rows.at(-1)?.sort ?? 0) + 10), isDefault: false, enabled: true, remark: "" })}><Plus size={14} aria-hidden="true" />添加项</Button>
                    </span>
                  )}
                </div>
              }
              columns={[
                { key: "label", title: "显示", minWidth: 120, render: (i) => <StatusBadge tone={i.tone}>{i.label}</StatusBadge> },
                { key: "value", title: "值", minWidth: 100, render: (i) => <code className="aui-pz-value">{i.value}</code> },
                { key: "sort", title: "排序", width: 70, numeric: true, render: (i) => i.sort },
                { key: "default", title: "默认", width: 70, render: (i) => (i.isDefault ? <StatusBadge tone="brand">默认</StatusBadge> : <span className="aui-note">—</span>) },
                { key: "mark", title: "标记", minWidth: 100, render: (i) => <Markers builtin={i.builtin} customized={i.customized} /> },
                { key: "status", title: "启用", width: 80, render: (i) => <Switch aria-label={`启用「${i.label}」`} checked={i.status === "enabled"} disabled={readOnly} onCheckedChange={(on) => void toggleItem(i, on)} /> },
                {
                  key: "actions",
                  title: "操作",
                  kind: "actions",
                  render: (i) =>
                    readOnly ? null : (
                      <RowActionBar
                        label={`「${i.label}」的更多操作`}
                        actions={[
                          { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setItemForm({ item: i, value: i.value, label: i.label, en: i.labels.en ?? "", tone: i.tone, sort: String(i.sort), isDefault: i.isDefault, enabled: i.status === "enabled", remark: i.remark }) },
                          ...(i.builtin && i.customized ? [{ key: "restore", label: "恢复默认", icon: <RotateCcw />, onSelect: () => setConfirm({ kind: "restore-item", item: i }) }] : []),
                          ...(!i.builtin ? [{ key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setConfirm({ kind: "delete-item", item: i }) }] : []),
                        ]}
                      />
                    ),
                },
              ]}
            />
          </div>
        ) : (
          <StatePanel kind="empty" message="在左边选一个字典" />
        )}
      </div>
      <FormDialog
        open={typeForm !== null}
        title={typeForm?.type ? `编辑字典「${typeForm.type.name}」` : "新建字典"}
        description={typeForm?.type ? "类型码建了以后不能改（业务表里存着它）。" : "类型码是代码 / 业务表里引用的键，建了以后不能改。"}
        dirty={!!typeForm && (typeForm.type ? typeForm.name !== typeForm.type.name || typeForm.remark !== typeForm.type.remark || typeForm.enabled !== (typeForm.type.status === "enabled") : !!(typeForm.code || typeForm.name))}
        onClose={() => setTypeForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!typeForm) return;
            if (!typeForm.name.trim()) throw new Error("请填写名称");
            const status = typeForm.enabled ? ("enabled" as const) : ("disabled" as const);
            if (typeForm.type) await api.updateDictType(typeForm.type.code, { name: typeForm.name.trim(), remark: typeForm.remark, status });
            else {
              const bad = checkDictCode(typeForm.code);
              if (bad) throw new Error(bad);
              await api.createDictType({ code: typeForm.code, name: typeForm.name.trim(), remark: typeForm.remark, status });
              setPicked(typeForm.code);
            }
            setTypeForm(null);
            refreshAll(`已保存字典「${typeForm.name.trim()}」`);
          })
        }
      >
        {typeForm && (
          <>
            <div className="aui-access-form-row">
              <FormField label="类型码" htmlFor={`${ids}-code`} required hint="如 customer_level">
                <Input id={`${ids}-code`} value={typeForm.code} disabled={!!typeForm.type} onChange={(e) => setTypeForm((f) => f && { ...f, code: e.target.value })} />
              </FormField>
              <FormField label="名称" htmlFor={`${ids}-name`} required>
                <Input id={`${ids}-name`} value={typeForm.name} onChange={(e) => setTypeForm((f) => f && { ...f, name: e.target.value })} />
              </FormField>
            </div>
            <FormField label="说明" htmlFor={`${ids}-remark`}>
              <Textarea id={`${ids}-remark`} value={typeForm.remark} onChange={(e) => setTypeForm((f) => f && { ...f, remark: e.target.value })} />
            </FormField>
            <FormField label="启用" htmlFor={`${ids}-on`} hint="停用后整个字典不进下拉，老数据照样能翻译">
              <Switch id={`${ids}-on`} checked={typeForm.enabled} onCheckedChange={(enabled) => setTypeForm((f) => f && { ...f, enabled })} />
            </FormField>
          </>
        )}
      </FormDialog>
      <FormDialog
        open={itemForm !== null}
        title={itemForm?.item ? `编辑「${itemForm.item.label}」` : `给「${type?.name ?? ""}」添加项`}
        description={itemForm?.item?.builtin ? "内置项：改了显示后代码里的标签不再覆盖它；「恢复默认」后重新跟代码走。" : "值建了以后不能改（业务表里存的就是它）。"}
        dirty={!!itemForm && (itemForm.item ? itemForm.label !== itemForm.item.label || itemForm.tone !== itemForm.item.tone || itemForm.sort !== String(itemForm.item.sort) || itemForm.isDefault !== itemForm.item.isDefault || itemForm.enabled !== (itemForm.item.status === "enabled") || itemForm.remark !== itemForm.item.remark || itemForm.en !== (itemForm.item.labels.en ?? "") : !!(itemForm.value || itemForm.label))}
        onClose={() => setItemForm(null)}
        onSubmit={() =>
          inDialog(async () => {
            if (!itemForm || !type) return;
            if (!itemForm.label.trim()) throw new Error("请填写显示标签");
            const sort = Number(itemForm.sort);
            if (!Number.isInteger(sort)) throw new Error("排序要填整数");
            const labels = { ...(itemForm.item?.labels ?? {}) } as Record<string, string>;
            if (itemForm.en.trim()) labels.en = itemForm.en.trim();
            else delete labels.en;
            const body = { label: itemForm.label.trim(), labels, tone: itemForm.tone, sort, isDefault: itemForm.isDefault, status: itemForm.enabled ? ("enabled" as const) : ("disabled" as const), remark: itemForm.remark };
            if (itemForm.item) await api.updateDictItem(type.code, itemForm.item.value, body);
            else {
              const bad = checkItemValue(itemForm.value);
              if (bad) throw new Error(bad);
              await api.createDictItem(type.code, { value: itemForm.value, ...body });
            }
            setItemForm(null);
            refreshAll(`已保存「${body.label}」`);
          })
        }
      >
        {itemForm && (
          <>
            <div className="aui-access-form-row">
              <FormField label="值" htmlFor={`${ids}-value`} required hint="存进业务表的键">
                <Input id={`${ids}-value`} value={itemForm.value} disabled={!!itemForm.item} onChange={(e) => setItemForm((f) => f && { ...f, value: e.target.value })} />
              </FormField>
              <FormField label="显示标签" htmlFor={`${ids}-label`} required>
                <Input id={`${ids}-label`} value={itemForm.label} onChange={(e) => setItemForm((f) => f && { ...f, label: e.target.value })} />
              </FormField>
            </div>
            <FormField label="标签颜色" htmlFor={`${ids}-tone`} hint="和列表里的状态徽标同一套颜色">
              <TonePicker label="标签颜色" preview={itemForm.label} value={itemForm.tone} onChange={(tone) => setItemForm((f) => f && { ...f, tone })} />
            </FormField>
            <div className="aui-access-form-row">
              <FormField label="排序" htmlFor={`${ids}-sort`} hint="小的在前">
                <Input id={`${ids}-sort`} inputMode="numeric" value={itemForm.sort} onChange={(e) => setItemForm((f) => f && { ...f, sort: e.target.value })} />
              </FormField>
              <FormField label="英文标签" htmlFor={`${ids}-en`} hint="可不填">
                <Input id={`${ids}-en`} value={itemForm.en} onChange={(e) => setItemForm((f) => f && { ...f, en: e.target.value })} />
              </FormField>
            </div>
            <div className="aui-access-form-row">
              <label className="aui-access-toggle">
                <Checkbox checked={itemForm.isDefault} aria-label="设为默认项" onCheckedChange={(v) => setItemForm((f) => f && { ...f, isDefault: v === true })} />
                <span>设为默认项<span className="aui-note">（一个字典只有一个，设新的旧的自动取消）</span></span>
              </label>
              <FormField label="启用" htmlFor={`${ids}-item-on`}>
                <Switch id={`${ids}-item-on`} checked={itemForm.enabled} onCheckedChange={(enabled) => setItemForm((f) => f && { ...f, enabled })} />
              </FormField>
            </div>
            <FormField label="备注" htmlFor={`${ids}-item-remark`}>
              <Textarea id={`${ids}-item-remark`} value={itemForm.remark} onChange={(e) => setItemForm((f) => f && { ...f, remark: e.target.value })} />
            </FormField>
          </>
        )}
      </FormDialog>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete-type" ? "删除字典" : confirm?.kind === "delete-item" ? "删除字典项" : "恢复默认"}
        destructive={confirm?.kind === "delete-type" || confirm?.kind === "delete-item"}
        confirmLabel={confirm?.kind?.startsWith("delete") ? "删除" : "恢复默认"}
        impact={
          confirm?.kind === "delete-type"
            ? `删除字典「${type?.name ?? ""}」。还有字典项时服务端会拒绝。`
            : confirm?.kind === "delete-item"
              ? `删除「${confirm.item?.label ?? ""}」（值 ${confirm.item?.value ?? ""}）。业务表里存着这个值的数据将只能显示原始值。`
              : confirm?.kind === "restore-type"
                ? `「${type?.name ?? ""}」的名称和说明恢复成代码里的定义。`
                : `「${confirm?.item?.label ?? ""}」的显示恢复成代码里的定义，之后跟代码走。`
        }
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          inDialog(async () => {
            if (!confirm || !type) return;
            if (confirm.kind === "delete-type") await api.deleteDictType(type.code);
            else if (confirm.kind === "restore-type") await api.restoreDictType(type.code);
            else if (confirm.kind === "delete-item") await api.deleteDictItem(type.code, confirm.item!.value);
            else await api.restoreDictItem(type.code, confirm.item!.value);
            refreshAll(confirm.kind.startsWith("delete") ? "已删除" : "已恢复默认");
          })
        }
      >
        {confirm?.kind === "restore-item" && confirm.item && <ChangeList items={[{ label: "当前显示", from: confirm.item.label, to: "代码里的标签" }]} />}
      </ConfirmDialog>
      {api.history && <ConfigHistoryDialog api={api} target={history} title={history?.title ?? ""} onClose={() => setHistory(null)} />}
    </div>
  );
}
