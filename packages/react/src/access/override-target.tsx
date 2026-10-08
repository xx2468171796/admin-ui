"use client";
/**
 * OverrideTargetFields — the 「加什么」 part of a personal add / deny (D15): 操作 (a permission code),
 * 数据范围 (a scoped code + tier), 字段 (resource field, 可读 / 可读写), 指定记录 (search a record,
 * 可读 / 可读写). Kinds the adapter / catalog cannot do are not offered (`targetKinds`). Presentational;
 * the dialog around it validates with `draftToTarget` and sends `setOverride` / `setTargetOverride`.
 */
import { useEffect, useId, useState } from "react";
import { Columns3, Filter, MousePointerClick, Table2 } from "lucide-react";
import { Choice, Input } from "../primitives.tsx";
import { SegmentedControl } from "../choices.tsx";
import { FormField } from "../forms.tsx";
import { SCOPE_TIER_LABEL, SCOPE_TIER_ORDER, type MatrixResource } from "./contracts.ts";
import { OVERRIDE_TARGET_LABEL, type OverrideTargetDraft, type OverrideTargetKind } from "./override-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

const KIND_ICON = { action: MousePointerClick, scope: Filter, field: Columns3, record: Table2 } as const;

export type OverrideTargetFieldsProps = {
  draft: OverrideTargetDraft;
  onChange: (draft: OverrideTargetDraft) => void;
  kinds: readonly OverrideTargetKind[];
  /** Permission codes (action kind). */
  codes: readonly { value: string; label: string }[];
  /** Codes whose action has a data scope (scope kind). */
  scopedCodes?: readonly { value: string; label: string }[];
  resources?: readonly MatrixResource[];
  findRecords?: (resource: string, query: string, signal: AbortSignal) => Promise<{ id: string; label: string; hint?: string }[]>;
  /** Editing an existing override: the target cannot change. */
  locked?: boolean;
};

export function OverrideTargetFields({ draft, onChange, kinds, codes, scopedCodes = [], resources = [], findRecords, locked }: OverrideTargetFieldsProps) {
  const id = useId();
  const set = (patch: Partial<OverrideTargetDraft>) => onChange({ ...draft, ...patch });
  const withFields = resources.filter((r) => r.fields?.length);
  const fields = resources.find((r) => r.id === draft.resource)?.fields ?? [];
  return (
    <>
      {kinds.length > 1 && (
        <FormField label="加什么" htmlFor={`${id}-kind`}>
          <SegmentedControl
            label="加什么"
            value={draft.kind}
            disabled={locked}
            onValueChange={(kind) => set({ kind, code: kind === draft.kind ? draft.code : "", resource: "", field: "", recordId: "", recordLabel: "" })}
            options={kinds.map((k) => ({ value: k, label: OVERRIDE_TARGET_LABEL[k], icon: KIND_ICON[k] }))}
          />
        </FormField>
      )}
      {draft.kind === "action" && (
        <FormField label="权限" htmlFor={`${id}-code`} required>
          <Choice id={`${id}-code`} label="权限" value={draft.code} disabled={locked} placeholder="选择权限码" options={codes} onChange={(code) => set({ code })} />
        </FormField>
      )}
      {draft.kind === "scope" && (
        <>
          <FormField label="哪个动作" htmlFor={`${id}-scode`} required>
            <Choice id={`${id}-scode`} label="哪个动作" value={draft.code} disabled={locked} placeholder="选择带数据范围的权限" options={scopedCodes} onChange={(code) => set({ code })} />
          </FormField>
          <FormField label="范围" htmlFor={`${id}-tier`}>
            <SegmentedControl label="范围" size="sm" value={draft.tier} disabled={locked} onValueChange={(tier) => set({ tier })} options={SCOPE_TIER_ORDER.map((t) => ({ value: t, label: SCOPE_TIER_LABEL[t] }))} />
          </FormField>
        </>
      )}
      {draft.kind === "field" && (
        <>
          <FormField label="字段" htmlFor={`${id}-res`} required>
            <div className="aui-access-target-row">
              <Choice id={`${id}-res`} label="表" value={draft.resource} disabled={locked} placeholder="选表" options={withFields.map((r) => ({ value: r.id, label: r.label }))} onChange={(resource) => set({ resource, field: "" })} />
              <Choice label="字段" value={draft.field} disabled={locked || !draft.resource} placeholder="选字段" options={fields.map((f) => ({ value: f.id, label: f.sensitive ? `${f.label}（敏感）` : f.label }))} onChange={(field) => set({ field })} />
              <SegmentedControl label="能做什么" size="sm" value={draft.ability} disabled={locked} onValueChange={(ability) => set({ ability })} options={[{ value: "read", label: "可读" }, { value: "write", label: "可读写" }]} />
            </div>
          </FormField>
        </>
      )}
      {draft.kind === "record" && <RecordPicker idPrefix={id} draft={draft} set={set} resources={resources} findRecords={findRecords} locked={locked} />}
    </>
  );
}

function RecordPicker({ idPrefix, draft, set, resources, findRecords, locked }: { idPrefix: string; draft: OverrideTargetDraft; set: (p: Partial<OverrideTargetDraft>) => void; resources: readonly MatrixResource[]; findRecords?: OverrideTargetFieldsProps["findRecords"]; locked?: boolean }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; label: string; hint?: string }[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    if (!findRecords || !draft.resource || !query.trim()) {
      setFound([]);
      setState("idle");
      return;
    }
    const ctrl = new AbortController();
    setState("loading");
    const timer = setTimeout(() => {
      findRecords(draft.resource, query.trim(), ctrl.signal).then(
        (list) => {
          if (ctrl.signal.aborted) return;
          setFound(list);
          setState("idle");
        },
        () => !ctrl.signal.aborted && setState("error"),
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [findRecords, draft.resource, query]);
  const options = [...(draft.recordId && !found.some((f) => f.id === draft.recordId) ? [{ value: draft.recordId, label: draft.recordLabel || draft.recordId }] : []), ...found.map((f) => ({ value: f.id, label: f.hint ? `${f.label} · ${f.hint}` : f.label }))];
  return (
    <>
      <FormField label="表" htmlFor={`${idPrefix}-rres`} required>
        <Choice id={`${idPrefix}-rres`} label="表" value={draft.resource} disabled={locked} placeholder="选表" options={resources.map((r) => ({ value: r.id, label: r.label }))} onChange={(resource) => set({ resource, recordId: "", recordLabel: "" })} />
      </FormField>
      <FormField label="记录" htmlFor={`${idPrefix}-rq`} required hint={state === "loading" ? "查找中…" : state === "error" ? "查找失败，换个词再试" : query && !found.length ? "没有找到，只能选你自己看得到的记录" : "输入名称或编号查找"}>
        <div className="aui-access-target-row">
          <Input id={`${idPrefix}-rq`} type="search" clearable placeholder="搜索记录" value={query} disabled={locked || !draft.resource} onChange={(e) => setQuery(e.target.value)} />
          <Choice label="选中的记录" value={draft.recordId} disabled={locked || !options.length} placeholder="选记录" options={options} onChange={(recordId) => set({ recordId, recordLabel: found.find((f) => f.id === recordId)?.label ?? draft.recordLabel })} />
          <SegmentedControl label="能做什么" size="sm" value={draft.level} disabled={locked} onValueChange={(level) => set({ level })} options={[{ value: "viewer", label: "可读" }, { value: "editor", label: "可读写" }]} />
        </div>
      </FormField>
    </>
  );
}
