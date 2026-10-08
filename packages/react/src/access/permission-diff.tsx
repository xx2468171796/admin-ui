"use client";
/**
 * PermissionDiff（演示 A4）：点「保存…」后的确认弹框——数据变了的提醒（只提醒，照样能保存）→
 * 按模块列改动（~ 改 / + 加 / − 去掉，旧值划掉 → 新值，一句人话）→「影响 N 人」展开每个人多了什么、少了什么、
 * 某项为什么不变 → 修改原因（默认必填）→ 取消 / 确认保存。基于 ConfirmDialog：onConfirm reject 就留在弹框显示原因。
 * changes 用 diffModuleGrants 生成；impact 由服务端试算（例如 `PUT …?dryRun=1` 的 roleImpact，码转成人话）。
 */
import { useState, type ReactNode } from "react";
import { ChevronRight, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { Button } from "../primitives.tsx";
import { ConfirmDialog } from "../forms.tsx";
import { IconBlock, PersonLine } from "../kit.tsx";
import { InlineAlert } from "../layout.tsx";
import { LoadingDots } from "../motion.tsx";
import { impactCounts, impactSentence, type ImpactItem, type ModuleChange, type ModuleChangeLine, type PermissionImpact } from "./module-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type PermissionDiffProps = {
  open: boolean;
  onClose: () => void;
  /** 收到修改原因（已去空格）；reject 留在弹框显示原因，resolve 关闭。 */
  onConfirm: (reason: string) => Promise<void> | void;
  /** 「保存「销售主管」的改动」 */
  title?: string;
  /** 不给就自动写「改了 N 个模块 · 影响 M 人 · 保存后他们下一次操作就生效」。 */
  description?: ReactNode;
  changes: readonly ModuleChange[];
  /** 服务端试算的影响；null / 不给 = 不显示这一块。 */
  impact?: PermissionImpact | null;
  /** 正在试算。 */
  loading?: boolean;
  /** 试算失败（照样能保存，服务端保存时会再算）。 */
  error?: string;
  onRetry?: () => void;
  /** 试算之后数据变了：只提醒，照样能保存。 */
  stale?: { message: ReactNode; onRecompute?: () => void } | null;
  reasonLabel?: string;
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  /** 弹框底部一行小字（默认「保存时服务端会再算一遍；有人同时改过会提示你」）。 */
  footnote?: ReactNode;
};

const SIGN: Record<ModuleChangeLine["kind"], string> = { change: "~", add: "+", remove: "−" };
const VERB: Record<ModuleChangeLine["kind"], string> = { change: "", add: "加上", remove: "去掉" };

function RiskChip({ line }: { line: Pick<ModuleChangeLine, "risk" | "stepUp"> }) {
  if (!line.risk) return null;
  return (
    <span className="aui-am-chip" data-kind="risk">
      <TriangleAlert aria-hidden="true" />
      {line.stepUp ? "高危 · 需二次验证" : "高危"}
    </span>
  );
}

function ChangeLine({ line }: { line: ModuleChangeLine }) {
  return (
    <li className="aui-am-pd-line">
      <span className="aui-am-sign" data-kind={line.kind} aria-label={line.kind === "change" ? "改" : line.kind === "add" ? "加" : "去掉"}>{SIGN[line.kind]}</span>
      <span className="aui-am-pd-what">
        {VERB[line.kind] && <span>{VERB[line.kind]}</span>}
        {line.kind === "change" ? <span>{line.what}</span> : <b>{line.what}</b>}
        {line.kind === "change" && (
          <>
            <s className="aui-am-old">{line.from}</s>
            <span className="aui-am-arr" aria-hidden="true">→</span>
            <span className="aui-sr-only">改为</span>
            <b>{line.to}</b>
          </>
        )}
        <RiskChip line={line} />
      </span>
      {line.note && <small>{line.note}</small>}
    </li>
  );
}

const itemText = (item: ImpactItem) => (typeof item === "string" ? { label: item } : item);
function ImpactLine({ kind, items }: { kind: "gain" | "lose" | "same"; items: readonly ImpactItem[] }) {
  if (!items.length) return null;
  const head = kind === "gain" ? "多：" : kind === "lose" ? "少：" : "不变：";
  return (
    <li data-kind={kind}>
      <span className="aui-am-ip-head">{head}</span>
      {items.map((raw, i) => {
        const it = itemText(raw);
        return (
          <span key={i} className="aui-am-ip-item">
            {i > 0 && <span aria-hidden="true"> · </span>}
            {it.label}
            {it.risk && <RiskChip line={{ risk: true }} />}
            {it.note && <span className="aui-am-ip-note"> —— {it.note}</span>}
          </span>
        );
      })}
    </li>
  );
}

function ImpactBlock({ impact }: { impact: PermissionImpact }) {
  const [open, setOpen] = useState(true);
  const { gain, lose } = impactCounts(impact.people);
  return (
    <div className="aui-am-imp" data-open={open || undefined}>
      <Button variant="ghost" className="aui-am-imp-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ChevronRight className="aui-am-car" aria-hidden="true" />
        <Users aria-hidden="true" />
        <b>影响 {impact.total} 人</b>
        <span className="aui-am-imp-sum">· {impactSentence(impact)}</span>
        <span className="aui-am-imp-chips">
          {gain > 0 && <span className="aui-am-chip" data-kind="add">多 {gain}</span>}
          {lose > 0 && <span className="aui-am-chip" data-kind="danger">少 {lose}</span>}
        </span>
      </Button>
      {open && (
        <ul className="aui-am-imp-list">
          {impact.people.map((p) => (
            <li key={p.id} className="aui-am-ip">
              <PersonLine name={p.name} hint={p.hint} />
              <ul>
                <ImpactLine kind="gain" items={p.gains} />
                <ImpactLine kind="lose" items={p.losses} />
                <ImpactLine kind="same" items={p.unchanged ?? []} />
              </ul>
            </li>
          ))}
          {impact.truncated && <li className="aui-am-imp-more aui-note">只列出前 {impact.people.length} 人，其余的保存后在「预览 / 诊断」里看</li>}
        </ul>
      )}
    </div>
  );
}

export function PermissionDiff({
  open,
  onClose,
  onConfirm,
  title = "保存改动",
  description,
  changes,
  impact,
  loading,
  error,
  onRetry,
  stale,
  reasonLabel = "修改原因",
  reasonRequired = true,
  reasonPlaceholder = "写进变更记录，受影响的人在「我的权限」里也能看到",
  confirmLabel = "确认保存",
  footnote = "保存时服务端会再算一遍；有人同时改过会提示你",
}: PermissionDiffProps) {
  const auto = [`改了 ${changes.length} 个模块`, impact ? `影响 ${impact.total} 人` : "", "保存后他们下一次操作就生效，不用重新登录"].filter(Boolean).join(" · ");
  return (
    <ConfirmDialog
      open={open}
      size="lg"
      title={title}
      description={description ?? auto}
      confirmLabel={confirmLabel}
      reason={{ label: reasonLabel, required: reasonRequired, placeholder: reasonPlaceholder }}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <div className="aui-am-pd">
        {stale && (
          <InlineAlert
            tone="warning"
            title="数据变了"
            action={
              stale.onRecompute ? (
                <Button size="sm" variant="outline" onClick={stale.onRecompute}>
                  <RefreshCw />
                  重新试算
                </Button>
              ) : undefined
            }
          >
            {stale.message}
          </InlineAlert>
        )}
        {changes.length === 0 && <p className="aui-note">没有改动</p>}
        {changes.map((c) => (
          <section key={c.moduleId} className="aui-am-pd-mod" aria-label={c.label}>
            <div className="aui-am-pd-head">
              {c.icon && <IconBlock size="sm">{c.icon}</IconBlock>}
              <b>{c.label}</b>
              <span className="aui-am-chip" data-kind="add">{c.lines.length} 处</span>
            </div>
            <ul>
              {c.lines.map((l, i) => (
                <ChangeLine key={i} line={l} />
              ))}
            </ul>
          </section>
        ))}
        {loading && (
          <div className="aui-am-imp-state">
            <LoadingDots label="正在试算影响" />
            正在试算影响的人…
          </div>
        )}
        {!loading && error && (
          <InlineAlert tone="error" title="影响没算出来" action={onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>重试</Button> : undefined}>
            {error}（照样能保存，服务端保存时会再算）
          </InlineAlert>
        )}
        {!loading && !error && impact && <ImpactBlock impact={impact} />}
        {footnote && <p className="aui-am-pd-foot aui-note">{footnote}</p>}
      </div>
    </ConfirmDialog>
  );
}
