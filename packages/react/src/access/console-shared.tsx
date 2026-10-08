"use client";
/**
 * Shared plumbing of AccessConsole sections: the console context (API + rights + shared lists),
 * in-place error alerts (403 / 409 with「重新加载」), a success line, the expiry field and the
 * assign-role dialog used by departments, posts and people.
 */
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button, Choice, Textarea } from "../primitives.tsx";
import { QuickDatePresets } from "../choices.tsx";
import { DateTimePicker } from "../date-picker.tsx";
import { FormDialog, FormField } from "../forms.tsx";
import { InlineAlert } from "../layout.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import type { AccessDimension, AssignScope, OrgNode } from "./contracts.ts";
import type { AccessApi } from "./console-api.ts";
import type { AccessCatalogDto, AccessSnapshot, AssignSubjectType, DeptDto, DimensionDto, DirectoryUser, GroupDto, PostDto, RoleDto, ViewAsDto } from "./console-contracts.ts";
import { ASSIGN_SUBJECT_LABEL } from "./console-contracts.ts";
import { asDialogError, assignPlaceOptions, errorView, futureIso, type AccessConsoleSection, type ConsoleRights, type DeptIndex } from "./console-core.ts";
import { OrgTreePicker } from "./org-picker.tsx";
import type { DimNamer } from "./matrix-core.ts";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type ConsoleShared = {
  api: AccessApi;
  rights: ConsoleRights;
  snapshot: AccessSnapshot;
  /** Everything is display-only (viewers, or a host-forced read-only mode). */
  readOnly: boolean;
  users: readonly DirectoryUser[];
  userName: (id: string | null | undefined) => string;
  depts: readonly DeptDto[];
  deptIdx: DeptIndex;
  orgTree: OrgNode[];
  posts: readonly PostDto[];
  roles: readonly RoleDto[];
  groups: readonly GroupDto[];
  catalog: AccessCatalogDto | null;
  /** Dimensions and their values (quanxian 2.2; empty when the host registered none or the API has no listDims). */
  dims: readonly DimensionDto[];
  /** The same as AccessDimension (scope dialogs / pickers). */
  dimensions: readonly AccessDimension[];
  /** Names of dimensions / values. */
  dimNames: DimNamer;
  /** Reload the shared lists (after a change elsewhere, or on a 409). */
  reload: (what?: "depts" | "posts" | "roles" | "groups" | "catalog" | "users" | "dims" | "all") => void;
  /** Jump to another section (e.g. 有效权限 → 权限解释 with a person). */
  go: (section: AccessConsoleSection, preset?: { userId?: string; roleId?: string }) => void;
  preset: { userId?: string; roleId?: string };
  /** Mark a section dirty (unsaved prompt + beforeunload). */
  setDirty: (key: string, dirty: boolean) => void;
  viewAs: ViewAsDto | null;
  setViewAs: (view: ViewAsDto | null) => void;
  now?: Date;
};

const Ctx = /* @__PURE__ */ createContext<ConsoleShared | null>(null);
export const ConsoleProvider = Ctx.Provider;
export function useConsole(): ConsoleShared {
  const v = useContext(Ctx);
  if (!v) throw new Error("AccessConsole 的分区必须放在 <AccessConsole> 里");
  return v;
}

/** In-place error: the server's Chinese message; a 409 offers「重新加载」. */
export function ErrorAlert({ error, onReload, onDismiss }: { error: unknown; onReload?: () => void; onDismiss?: () => void }) {
  if (!error) return null;
  const v = errorView(error);
  return (
    <InlineAlert
      tone={v.conflict ? "warning" : "error"}
      title={v.title}
      action={
        v.conflict && onReload ? (
          <Button size="sm" variant="outline" onClick={onReload}>
            重新加载
          </Button>
        ) : onDismiss ? (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            知道了
          </Button>
        ) : undefined
      }
    >
      {v.message}
      {v.permission ? `（缺少权限：${v.permission}）` : ""}
    </InlineAlert>
  );
}

/** useAdminResource that also keeps the thrown error (`failure`): a 403 shows why with no「重试」(listFailure). */
export function useConsoleResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const failure = useRef<unknown>(null);
  const res = useAdminResource(
    key,
    async (signal) => {
      try {
        const data = await load(signal);
        failure.current = null;
        return data;
      } catch (e) {
        failure.current = e;
        throw e;
      }
    },
    0,
    enabled,
  );
  return { ...res, failure: res.error ? failure.current : null };
}

/** The current time, refreshed every second while `enabled` (countdowns). */
export function useSecondTick(enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}

/** Polite success line (no toast dependency). */
export function StatusLine({ text }: { text: string }) {
  return (
    <p className="aui-access-status" role="status">
      {text}
    </p>
  );
}

/** Run an inline mutation: error and success text for the section. */
export function useAction() {
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setDone("");
    try {
      await fn();
      setDone(success);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { error, done, busy, run, clear: () => setError(null), fail: (e: unknown) => setError(e), setDone };
}

/** For FormDialog / ConfirmDialog: any failure becomes the in-place message. */
export async function inDialog<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw asDialogError(e);
  }
}

/** DateTimePicker (YYYY-MM-DDTHH:mm) + 1 / 7 / 30 天 / 永久. Empty = permanent. */
export function ExpiryField({ value, onChange, label = "到期时间", hint = "留空 = 永久；到期后立即失效", now }: { value: string; onChange: (v: string) => void; label?: string; hint?: string; now?: Date }) {
  const id = useId();
  return (
    <>
      <FormField label={label} htmlFor={id} hint={hint}>
        <DateTimePicker id={id} clearable value={value} onChange={onChange} />
      </FormField>
      <QuickDatePresets permanent onPick={onChange} now={now ? () => now : undefined} />
    </>
  );
}

export function ReasonField({ value, onChange, required = false, label = "原因" }: { value: string; onChange: (v: string) => void; required?: boolean; label?: string }) {
  const id = useId();
  return (
    <FormField label={label} htmlFor={id} required={required} hint="写进授权审计">
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  );
}

/** Sentinel for「不限」in a Choice (Radix select values cannot be empty). */
const ANY = "__any__";
const SEP = "\u0000";

/** Assign a role to a person / post / department (expiry + reason; quanxian 2.2: optionally only in one dimension value / department). */
export function AssignRoleDialog({
  open,
  onClose,
  subject,
  subjectName,
  exclude = [],
  targetDims = null,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  subject: { type: AssignSubjectType; id: string };
  subjectName: string;
  /** Role ids already assigned without a scope (not offered again unless a scope is picked). */
  exclude?: readonly string[];
  /** quanxian 2.2: the dimension values the person is in (UserOrgDto.dims) — only those are offered for「只在这个业务线上」. */
  targetDims?: readonly { dim: string; value: string }[] | null;
  onDone: () => void;
}) {
  const c = useConsole();
  const id = useId();
  const [roleId, setRoleId] = useState("");
  const [expires, setExpires] = useState("");
  const [reason, setReason] = useState("");
  // 带范围的分配只在服务端支持时给（老服务端不认 scope，会当成不带范围）
  const scoped = c.catalog?.scopedAssignments === true;
  // 只给他在的值；编辑人只在某些业务线管人时，只给那些（也不给「不限」——服务端会拒）
  const places = assignPlaceOptions(c.dimensions, { target: subject.type === "user" ? targetDims : null, editor: c.rights.assignWithin });
  const firstPlace = places.allowAny || !places.values[0] ? ANY : places.values[0].dim + SEP + places.values[0].value;
  const [dimValue, setDimValue] = useState(firstPlace);
  const [scopeDept, setScopeDept] = useState<string[]>([]);
  useEffect(() => {
    if (open) setDimValue((cur) => (cur === ANY && !places.allowAny ? firstPlace : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firstPlace]);
  const scopeOptions = [...(places.allowAny ? [{ value: ANY, label: "不限" }] : []), ...places.values.map((v) => ({ value: v.dim + SEP + v.value, label: v.label }))];
  const hasScope = dimValue !== ANY || scopeDept.length > 0;
  const options = c.roles.filter((r) => !r.disabled && (hasScope ? !r.superuser : !exclude.includes(r.id))).map((r) => ({ value: r.id, label: r.superuser ? `${r.name}（超级管理员）` : r.name }));
  const reset = () => {
    setRoleId("");
    setExpires("");
    setReason("");
    setDimValue(firstPlace);
    setScopeDept([]);
  };
  const scopeOf = (): AssignScope | null => {
    if (!hasScope) return null;
    const [dim, value] = dimValue === ANY ? [] : dimValue.split(SEP);
    return { ...(dim && value ? { dim, value } : {}), ...(scopeDept[0] ? { deptId: scopeDept[0] } : {}) };
  };
  return (
    <FormDialog
      open={open}
      title={`给${ASSIGN_SUBJECT_LABEL[subject.type]}「${subjectName}」分配角色`}
      description={subject.type === "user" ? "保存后对方下一次请求就生效；到期自动失效。" : `${ASSIGN_SUBJECT_LABEL[subject.type]}里的每个人都会得到这个角色。`}
      dirty={!!roleId || !!expires || !!reason || dimValue !== firstPlace || scopeDept.length > 0}
      submitLabel="分配"
      onClose={() => {
        reset();
        onClose();
      }}
      onSubmit={() =>
        inDialog(async () => {
          if (!roleId) throw new Error("请选择角色");
          const expiresAt = futureIso(expires, c.now);
          const scope = scopeOf();
          await c.api.assign({ subject, roleId, expiresAt, ...(reason.trim() ? { reason: reason.trim() } : {}), ...(scope ? { scope } : {}) });
          reset();
          onDone();
        })
      }
    >
      <FormField label="角色" htmlFor={id} required>
        <Choice id={id} label="角色" value={roleId} placeholder={options.length ? "选择角色" : "没有可分配的角色"} options={options} onChange={setRoleId} />
      </FormField>
      {scoped && c.dimensions.length > 0 && (
        <FormField label={c.dimensions.length === 1 ? `只在这个${c.dimensions[0]!.label}上` : "只在这个维度值上"} htmlFor={`${id}-dim`} hint={!places.allowAny ? `你只能在自己管的${c.dimensions.length === 1 ? c.dimensions[0]!.label : "维度值"}里分配` : subject.type === "user" ? "例如「在 A 业务线当经理」，他要已经在那里；不限 = 到处都算" : "只对在那里的成员生效；不限 = 到处都算"}>
          <Choice id={`${id}-dim`} label="分配范围" value={dimValue} placeholder={scopeOptions.length ? undefined : subject.type === "user" ? "他不在任何业务线里" : "没有可选的值"} options={scopeOptions} onChange={setDimValue} />
        </FormField>
      )}
      {scoped && (
        <FormField label="只在这个部门（含下级）里" htmlFor={`${id}-dept`} hint="例如「在一部是负责人」：本部门 / 本部门及下级按这个部门算；不选 = 不限">
          <OrgTreePicker id={`${id}-dept`} label="只在这个部门" nodes={c.orgTree} value={scopeDept} onChange={setScopeDept} placeholder="不限" />
        </FormField>
      )}
      <ExpiryField value={expires} onChange={setExpires} now={c.now} />
      <ReasonField value={reason} onChange={setReason} />
    </FormDialog>
  );
}

/**
 * On narrow screens the list and the detail of a split section stack; after picking from the list,
 * bring the detail into view (otherwise the change happens below the fold).
 */
export function revealDetail(origin?: Element | null) {
  if (typeof window === "undefined" || !window.matchMedia?.("(max-width: 960px)").matches) return;
  const from = origin ?? document.activeElement;
  const detail = from?.closest(".aui-access-split")?.children[1];
  if (detail) setTimeout(() => detail.scrollIntoView({ block: "start" }), 60);
}

/** In place of the action buttons of a locked assignment: a lock and the host's reason. */
export function LockedNote({ reason }: { reason: string }) {
  return (
    <span className="aui-note aui-access-locked" data-tip={reason}>
      <Lock size={12} aria-hidden="true" />
      <span>{reason}</span>
    </span>
  );
}

/** Read-only notice at the top of a section. */
export function ReadOnlyNote({ show, children = "你可以查看，不能修改。" }: { show: boolean; children?: ReactNode }) {
  if (!show) return null;
  return (
    <InlineAlert tone="info" title="只读">
      {children}
    </InlineAlert>
  );
}
