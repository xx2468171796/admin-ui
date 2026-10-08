"use client";
/**
 * Right pane of the OrgPicker (and the phone's 「已选」 sheet): the draft grouped by kind (人 / 部门 /
 * 公司 / 角色 / 业务线), each with its path and head count, a 「含下级」 switch on departments, × to
 * remove; departed people stay struck through with 「已离职 · 还在名单里，点 × 去掉」 until removed
 * (a permission change is always explicit). Footer: 「共覆盖 N 人（去重）」.
 */
import { CircleAlert, Users, X } from "lucide-react";
import { Button, Switch } from "../primitives.tsx";
import { IconButton } from "../buttons.tsx";
import { groupByKind, hasSubTree, reachOf, type PickedSubject } from "./org-picker-core.ts";
import { kindLabel } from "./org-picker-text.ts";
import type { PickerModel } from "./org-picker-model.ts";
import { SubjectMark } from "./org-picker-parts.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/org-picker.css";

/** Second line of a picked subject: 「华南子公司 › 销售部 · 4 人」, or the departed note. */
export function pickedSub(model: PickerModel, s: PickedSubject): string {
  if (s.status === "left") return model.m.departedKeep;
  if (s.status === "disabled") return model.m.disabledPerson;
  const path = (s.path ?? []).join(" › ");
  const count = s.kind !== "person" && s.count !== undefined ? model.t(model.m.people, { n: s.count }) : "";
  return [path, count].filter(Boolean).join(" · ");
}

export function ReachLine({ model, reach }: { model: PickerModel; reach?: number }) {
  const r = reach === undefined ? reachOf(model.value, model.index) : { count: reach, exact: true };
  return (
    <p className="aui-orgp-reach" aria-live="polite">
      <Users aria-hidden="true" />
      <span>{model.t(r.exact ? model.m.reach : model.m.reachApprox, { n: r.count })}</span>
    </p>
  );
}

export function SelectedList({ model }: { model: PickerModel }) {
  const groups = groupByKind(model.value);
  if (!model.value.length) return <p className="aui-orgp-empty">{model.m.emptySelected}</p>;
  return (
    <div className="aui-orgp-picked">
      {groups.map((g) => (
        <section key={g.kind} aria-label={kindLabel(model.m, g.kind)}>
          <h4>
            {kindLabel(model.m, g.kind)} · {g.items.length}
          </h4>
          <ul>
            {g.items.map((s) => {
              const gone = s.status === "left" || s.status === "disabled";
              return (
                <li key={`${s.kind}:${s.id}`} className="aui-orgp-picked-row" data-gone={gone || undefined}>
                  <SubjectMark kind={s.kind} id={s.id} label={s.label} src={s.avatar} gone={gone} size={24} />
                  <span className="aui-orgp-row-text">
                    <span className="aui-orgp-row-name" data-struck={gone || undefined}>{s.label}</span>
                    <span className="aui-orgp-row-sub" data-tone={gone ? "warning" : undefined}>
                      {gone && <CircleAlert aria-hidden="true" />}
                      {pickedSub(model, s)}
                    </span>
                  </span>
                  {hasSubTree(s.kind) && !model.single && (
                    <label className="aui-orgp-sub-switch">
                      <Switch size="sm" checked={s.includeSub !== false} aria-label={`${s.label} ${model.m.includeSub}`} onCheckedChange={(on) => model.setSub(s, on)} />
                      <span>{model.m.includeSub}</span>
                    </label>
                  )}
                  <IconButton size="xs" variant="danger" className="aui-orgp-remove" label={model.t(model.m.remove, { name: s.label })} icon={<X />} onClick={() => model.remove(s)} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Desktop right column: header (已选 N · 清空) · max note · list · reach. */
export function SelectedPane({ model, reach }: { model: PickerModel; reach?: number }) {
  return (
    <aside className="aui-orgp-side" aria-label={model.m.selectedLabel}>
      <header className="aui-orgp-side-head">
        <b aria-live="polite">{model.t(model.m.selected, { n: model.value.length })}</b>
        {model.value.length > 0 && (
          <Button size="sm" variant="text" onClick={() => model.setValue([])}>
            {model.m.clear}
          </Button>
        )}
      </header>
      {model.full && <p className="aui-orgp-max">{model.t(model.m.maxReached, { n: model.max ?? 0 })}</p>}
      <div className="aui-orgp-side-list">
        <SelectedList model={model} />
      </div>
      <ReachLine model={model} reach={reach} />
    </aside>
  );
}
