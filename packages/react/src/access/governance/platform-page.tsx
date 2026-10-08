"use client";
/**
 * Platform (cross-tenant) pages. TenantsPage — open / edit / suspend / resume / delete tenants
 * (delete needs the tenant id typed back and a reason), with package and quota usage in the detail.
 * PackagesPage — packages = permission ceilings: codes (wildcards), features, seeded roles, quotas.
 * Built-in packages (defined in code) are read-only.
 */
import { useId, useState } from "react";
import { CirclePause, CirclePlay, Eye, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Checkbox, Choice, Input, StatusBadge, Textarea } from "../../primitives.tsx";
import { ChipGroup, SegmentedControl } from "../../choices.tsx";
import { ConfirmDialog, Dialog, FormDialog, FormField } from "../../forms.tsx";
import { DescriptionList, InlineAlert, PageBody, PageHeader, ResourcePanel, StatePanel } from "../../layout.tsx";
import { DataTable, QueryBar } from "../../data.tsx";
import { CellTags, CellText } from "../../cells.tsx";
import { CellDate } from "../../displays.tsx";
import { RowActionBar } from "../../row-actions.tsx";
import { TENANT_STATUS_LABEL, type GovOption, type PackageDto, type PackageInput, type TenantContextDto, type TenantDto, type TenantMemberDto } from "./contracts.ts";
import { effectiveQuotas, parseLines, parseQuotaRows, validatePackage, validateTenantCreate } from "./governance-core.ts";
import { govErrorMessage, type GovernanceApi } from "./api.ts";
import { TenantQuotas } from "./members-page.tsx";
import { GovLoad, feedbackOf, staleAlert, ReadOnlyNote, optionLabeler, toChoice, useGov, useNotice, type GovPageBaseProps } from "./shared.tsx";
import { IconButton } from "../../buttons.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

export type TenantsPageProps = GovPageBaseProps & {
  /** Candidates for the tenant admin (free text user id when omitted). */
  users?: readonly GovOption[];
  /** Quota key → label (e.g. members → 成员数). */
  quotaLabels?: Readonly<Record<string, string>>;
  /** manage: create / edit / suspend / delete (qx:tenant.manage). */
  can?: { manage?: boolean };
};

const quotaText = (quotas: Readonly<Record<string, number>>, label: (k: string) => string) =>
  Object.entries(quotas)
    .map(([k, v]) => `${label(k)} ${v}`)
    .join(" · ");

export function TenantsPage({ api, users, quotaLabels = {}, can = {}, active = true }: TenantsPageProps) {
  const res = useGov<TenantDto[]>("gov:platform:tenants", (signal) => api.platform.tenants.list({ signal }), active);
  const pkgs = useGov<PackageDto[]>("gov:platform:packages", (signal) => api.platform.packages.list({ signal }), active);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [editing, setEditing] = useState<{ tenant: TenantDto | null } | null>(null);
  const [detail, setDetail] = useState<TenantDto | null>(null);
  const [suspending, setSuspending] = useState<TenantDto | null>(null);
  const [deleting, setDeleting] = useState<TenantDto | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const pkgName = optionLabeler((pkgs.data ?? []).map((p) => ({ id: p.id, label: p.name })));
  const qLabel = (k: string) => quotaLabels[k] ?? k;
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (res.data ?? []).filter((t) => (status === "all" || t.status === status) && words.every((w) => `${t.name} ${t.id} ${pkgName(t.packageId)}`.toLowerCase().includes(w)));
  const filtered = words.length > 0 || status !== "all";
  const clear = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <>
      <PageHeader
        title="租户"
        description="每个客户 / 公司一个租户，数据互相隔离。套餐决定租户最多能有哪些权限和配额；停用后整个租户的人都不能操作。"
        actions={manage && <Button disabled={!pkgs.data?.length} disabledReason={!pkgs.data?.length ? "先建一个套餐" : undefined} onClick={() => setEditing({ tenant: null })}><Plus />开通租户</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="平台 · 开通 / 停用 / 删除租户" />}
        <ResourcePanel
          title="租户列表"
          count={res.data && !filtered ? res.data.length : undefined}
          actions={<Button variant="outline" disabled={res.loading} onClick={() => { void res.refresh(); void pkgs.refresh(); }}>刷新</Button>}
          filters={
            <QueryBar value={search} onChange={setSearch} onSearch={() => undefined} onReset={clear} placeholder="搜索租户名、编号、套餐">
              <SegmentedControl className="aui-gov-seg" label="状态" size="sm" value={status} onValueChange={setStatus} options={[{ value: "all", label: "全部" }, { value: "active", label: "正常" }, { value: "suspended", label: "已停用" }]} />
            </QueryBar>
          }
          feedback={feedbackOf(notice, staleAlert(res))}
        >
          <GovLoad res={res} label="租户">
            {() => (
              <DataTable rowHeight="medium"
                caption="租户列表"
                rows={rows}
                rowKey={(t) => t.id}
                pagination={{ mode: "all" }}
                emptyKind={filtered ? "no-results" : "empty"}
                emptyLabel={filtered ? "没有符合筛选的租户" : "还没有租户"}
                emptyAction={filtered ? <Button variant="outline" onClick={clear}>清空筛选</Button> : undefined}
                columns={[
                  { key: "name", title: "租户", minWidth: 160, maxWidth: 260, render: (t) => <CellText primary={t.name} secondary={t.id} /> },
                  { key: "pkg", title: "套餐", minWidth: 120, render: (t) => pkgName(t.packageId) },
                  { key: "status", title: "状态", minWidth: 120, maxWidth: 220, render: (t) => <CellText primary={<StatusBadge tone={t.status === "active" ? "success" : "danger"}>{TENANT_STATUS_LABEL[t.status]}</StatusBadge>} secondary={t.status === "suspended" ? t.statusReason || undefined : undefined} secondaryTitle={t.statusReason} /> },
                  { key: "quotas", title: "配额", minWidth: 140, maxWidth: 240, truncate: (t) => (Object.keys(t.quotas).length ? `自定义：${quotaText(t.quotas, qLabel)}` : "跟随套餐"), render: (t) => (Object.keys(t.quotas).length ? `自定义：${quotaText(t.quotas, qLabel)}` : <span className="aui-note">跟随套餐</span>) },
                  { key: "created", title: "开通时间", width: 150, render: (t) => <CellText primary={<CellDate value={t.createdAt} />} secondary={t.createdBy ?? undefined} /> },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (t) => (
                      <RowActionBar
                        label={`${t.name}的更多操作`}
                        actions={[
                          { key: "detail", label: "详情", icon: <Eye />, onSelect: () => setDetail(t) },
                          ...(manage
                            ? [
                                { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setEditing({ tenant: t }) },
                                t.status === "active"
                                  ? { key: "suspend", label: "停用", icon: <CirclePause />, destructive: true, onSelect: () => setSuspending(t) }
                                  : { key: "resume", label: "恢复", icon: <CirclePlay />, onSelect: () => setSuspending(t) },
                                { key: "delete", label: "删除租户", icon: <Trash2 />, destructive: true, onSelect: () => setDeleting(t) },
                              ]
                            : []),
                        ]}
                      />
                    ),
                  },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {editing && pkgs.data && (
        <TenantEditor
          tenant={editing.tenant}
          packages={pkgs.data}
          users={users}
          qLabel={qLabel}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              if (editing.tenant) {
                const t = await api.platform.tenants.update(editing.tenant.id, { name: input.name, packageId: input.packageId, quotas: input.quotas ?? {}, version: editing.tenant.version });
                setNotice(`已保存「${t.name}」`);
              } else {
                const t = await api.platform.tenants.create(input);
                setNotice(`已开通「${t.name}」（${t.id}）`);
              }
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            void res.refresh();
          }}
        />
      )}
      {detail && <TenantDetail api={api} tenant={detail} qLabel={qLabel} onClose={() => setDetail(null)} />}
      <ConfirmDialog
        open={suspending !== null}
        title={suspending?.status === "active" ? "停用租户" : "恢复租户"}
        destructive={suspending?.status === "active"}
        confirmLabel={suspending?.status === "active" ? "停用" : "恢复"}
        impact={suspending ? (suspending.status === "active" ? `停用「${suspending.name}」后，这个租户的所有人立即不能操作，数据保留。` : `恢复「${suspending.name}」，成员按原来的角色继续使用。`) : undefined}
        reason={suspending?.status === "active" ? { label: "停用原因", required: true, placeholder: "租户成员会看到，例如：欠费 / 合同到期" } : undefined}
        onClose={() => setSuspending(null)}
        onConfirm={async (reason) => {
          if (!suspending) return;
          try {
            if (suspending.status === "active") await api.platform.tenants.suspend(suspending.id, reason);
            else await api.platform.tenants.resume(suspending.id);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`${suspending.status === "active" ? "已停用" : "已恢复"}「${suspending.name}」`);
          void res.refresh();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="删除租户"
        destructive
        confirmLabel="永久删除"
        impact={deleting ? `永久删除「${deleting.name}」及其全部成员、角色、规则和业务数据，不能恢复。建议先停用观察一段时间。` : undefined}
        typeToConfirm={deleting?.id}
        reason={{ label: "删除原因", required: true, placeholder: "写进平台审计" }}
        onClose={() => setDeleting(null)}
        onConfirm={async (reason) => {
          if (!deleting) return;
          try {
            await api.platform.tenants.remove(deleting.id, { confirm: deleting.id, reason });
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`已删除「${deleting.name}」`);
          void res.refresh();
        }}
      />
    </>
  );
}

function TenantDetail({ api, tenant, qLabel, onClose }: { api: GovernanceApi; tenant: TenantDto; qLabel: (k: string) => string; onClose: () => void }) {
  const ctx = useGov<TenantContextDto>(`gov:platform:tenant:${tenant.id}`, (signal) => api.platform.tenants.get(tenant.id, { signal }));
  const members = useGov<TenantMemberDto[]>(`gov:platform:tenant:${tenant.id}:members`, (signal) => api.platform.tenants.members(tenant.id, { signal }));
  return (
    <Dialog open size="lg" title={tenant.name} description={tenant.id} titleAdornment={<StatusBadge tone={tenant.status === "active" ? "success" : "danger"}>{TENANT_STATUS_LABEL[tenant.status]}</StatusBadge>} onClose={onClose} footer={<Button variant="outline" onClick={onClose}>关闭</Button>}>
      <div className="aui-gov-body">
      <GovLoad res={ctx} label="租户详情">
        {(c) => (
          <div className="aui-gov-tenant">
            {c.tenant.status === "suspended" && <InlineAlert tone="error" title="已停用">{c.tenant.statusReason || "—"}</InlineAlert>}
            <DescriptionList
              items={[
                { label: "套餐", value: c.package.name, hint: c.package.description || undefined },
                { label: "开通时间", value: <CellDate value={c.tenant.createdAt} time />, hint: c.tenant.createdBy ?? undefined },
                { label: "配额来源", value: effectiveQuotas(c.package, c.tenant).map((q) => `${qLabel(q.key)} ${q.limit}${q.source === "tenant" ? "（自定义）" : ""}`).join(" · ") || "无", full: true },
              ]}
            />
            <TenantQuotas quotas={c.quotas} />
          </div>
        )}
      </GovLoad>
      <section aria-label="租户成员">
      <h3 className="aui-gov-subtitle">成员{members.data ? `（${members.data.length}）` : ""}</h3>
      {members.data === undefined ? (
        members.error ? <StatePanel kind="error" message={`成员加载失败：${members.error}`} onRetry={() => void members.refresh()} /> : <StatePanel kind="loading" />
      ) : (
        <DataTable rowHeight="medium"
          caption="租户成员"
          rows={members.data}
          rowKey={(m) => m.userId}
          pagination={{ mode: "all" }}
          maxHeight={280}
          emptyLabel="没有成员"
          columns={[
            { key: "name", title: "成员", minWidth: 120, render: (m) => <CellText primary={m.name} secondary={m.userId} /> },
            { key: "roles", title: "角色", minWidth: 140, maxWidth: 240, render: (m) => (m.roles.length ? <CellTags label="角色" items={m.roles.map((r) => ({ label: r, key: r }))} /> : "—") },
            { key: "status", title: "状态", width: 90, render: (m) => <StatusBadge tone={m.status === "active" ? "success" : "neutral"}>{TENANT_STATUS_LABEL[m.status]}</StatusBadge> },
          ]}
        />
      )}
      </section>
      </div>
    </Dialog>
  );
}

type TenantEditInput = { id?: string; name: string; packageId: string; adminUserId: string; quotas?: Record<string, number> };
function TenantEditor({ tenant, packages, users, qLabel, onClose, onSave }: { tenant: TenantDto | null; packages: readonly PackageDto[]; users?: readonly GovOption[]; qLabel: (k: string) => string; onClose: () => void; onSave: (input: TenantEditInput) => Promise<void> }) {
  const id = useId();
  const [name, setName] = useState(tenant?.name ?? "");
  const [tenantId, setTenantId] = useState("");
  const [packageId, setPackageId] = useState(tenant?.packageId ?? packages[0]?.id ?? "");
  const [admin, setAdmin] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(tenant?.quotas ?? {}).map(([k, v]) => [k, String(v)])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pkg = packages.find((p) => p.id === packageId);
  const keys = [...new Set([...Object.keys(pkg?.quotas ?? {}), ...Object.keys(overrides)])].sort();
  const initial = JSON.stringify([tenant?.name ?? "", "", tenant?.packageId ?? packages[0]?.id ?? "", "", Object.fromEntries(Object.entries(tenant?.quotas ?? {}).map(([k, v]) => [k, String(v)]))]);
  const dirty = JSON.stringify([name, tenantId, packageId, admin, overrides]) !== initial;
  return (
    <FormDialog
      open
      title={tenant ? `编辑「${tenant.name}」` : "开通租户"}
      description={tenant ? "换套餐会立即改变这个租户能用的权限上限。" : "开通后指定的管理员会成为成员，并拿到套餐里的管理员角色。"}
      dirty={dirty}
      submitLabel={tenant ? "保存" : "开通"}
      onClose={onClose}
      onSubmit={async () => {
        const parsed = parseQuotaRows(keys.map((k) => ({ key: k, value: overrides[k] ?? "" })));
        const input: TenantEditInput = { ...(tenantId.trim() ? { id: tenantId.trim() } : {}), name: name.trim(), packageId, adminUserId: tenant ? "-" : admin.trim(), ...(parsed.ok ? { quotas: parsed.quotas } : {}) };
        const e = validateTenantCreate(input);
        if (!parsed.ok) e.quotas = parsed.error;
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onSave(input);
      }}
    >
      <FormField label="租户名称" htmlFor={`${id}-name`} required error={errors.name}>
        <Input id={`${id}-name`} value={name} placeholder="例：华东贸易有限公司" onChange={(e) => setName(e.target.value)} />
      </FormField>
      {!tenant && (
        <FormField label="租户编号" htmlFor={`${id}-id`} error={errors.id} hint="留空自动生成；建好后不能改">
          <Input id={`${id}-id`} value={tenantId} placeholder="例：huadong" onChange={(e) => setTenantId(e.target.value)} />
        </FormField>
      )}
      <FormField label="套餐" htmlFor={`${id}-pkg`} required error={errors.packageId}>
        <Choice label="套餐" value={packageId} onChange={setPackageId} options={packages.map((p) => ({ value: p.id, label: p.name }))} />
      </FormField>
      {!tenant && (
        <FormField label="租户管理员" htmlFor={`${id}-admin`} required error={errors.adminUserId}>
          {users?.length ? <Choice label="租户管理员" placeholder="选择管理员" value={admin} onChange={setAdmin} options={toChoice(users)} /> : <Input id={`${id}-admin`} value={admin} placeholder="用户编号" onChange={(e) => setAdmin(e.target.value)} />}
        </FormField>
      )}
      {keys.length > 0 && (
        <fieldset className="aui-gov-quota-edit">
          <legend>配额（留空 = 跟随套餐）</legend>
          {errors.quotas && <p className="aui-error" role="alert">{errors.quotas}</p>}
          {keys.map((k) => (
            <FormField key={k} label={qLabel(k)} htmlFor={`${id}-q-${k}`} hint={pkg?.quotas[k] !== undefined ? `套餐：${pkg.quotas[k]}` : "套餐没有这项"}>
              <Input id={`${id}-q-${k}`} inputMode="numeric" value={overrides[k] ?? ""} placeholder={pkg?.quotas[k] !== undefined ? String(pkg.quotas[k]) : ""} onChange={(e) => setOverrides((o) => ({ ...o, [k]: e.target.value }))} />
            </FormField>
          ))}
        </fieldset>
      )}
    </FormDialog>
  );
}

// ---- Packages ------------------------------------------------------------------------------

export type PackagesPageProps = GovPageBaseProps & {
  /** Role templates (seeded roles / admin role). Free text when omitted. */
  roles?: readonly GovOption[];
  /** Feature modules. Free text when omitted. */
  features?: readonly GovOption[];
  quotaLabels?: Readonly<Record<string, string>>;
  /** manage: create / edit / delete (qx:package.manage). */
  can?: { manage?: boolean };
};

export function PackagesPage({ api, roles, features, quotaLabels = {}, can = {}, active = true }: PackagesPageProps) {
  const res = useGov<PackageDto[]>("gov:platform:packages", (signal) => api.platform.packages.list({ signal }), active);
  const [editing, setEditing] = useState<{ pkg: PackageDto | null } | null>(null);
  const [viewing, setViewing] = useState<PackageDto | null>(null);
  const [removing, setRemoving] = useState<PackageDto | null>(null);
  const [notice, setNotice] = useNotice();
  const manage = !!can.manage;
  const roleLabel = optionLabeler(roles);
  const featureLabel = optionLabeler(features);
  const qLabel = (k: string) => quotaLabels[k] ?? k;
  const featureTags = (p: PackageDto) => (p.features.includes("*") ? [{ label: "全部功能", tone: "green" as const }] : p.features.map((f) => ({ label: featureLabel(f), key: f })));
  return (
    <>
      <PageHeader
        title="套餐"
        description="套餐是租户的权限上限：租户里任何角色都给不出套餐以外的权限码；功能模块没开通的整块不可用。内置套餐写在代码里，只能查看。"
        actions={manage && <Button onClick={() => setEditing({ pkg: null })}><Plus />新建套餐</Button>}
      />
      <PageBody>
        {!manage && <ReadOnlyNote permission="平台 · 管理套餐" />}
        <ResourcePanel title="套餐列表" count={res.data?.length} actions={<Button variant="outline" disabled={res.loading} onClick={() => void res.refresh()}>刷新</Button>} feedback={feedbackOf(notice, staleAlert(res))}>
          <GovLoad res={res} label="套餐">
            {(list) => (
              <DataTable rowHeight="medium"
                caption="套餐列表"
                rows={list}
                rowKey={(p) => p.id}
                pagination={{ mode: "all" }}
                emptyLabel="还没有套餐"
                emptyAction={manage ? <Button onClick={() => setEditing({ pkg: null })}>新建套餐</Button> : undefined}
                columns={[
                  { key: "name", title: "套餐", minWidth: 160, maxWidth: 260, render: (p) => <CellText primary={p.name} secondary={p.description || p.id} /> },
                  { key: "codes", title: "权限码", minWidth: 160, maxWidth: 260, render: (p) => <CellTags label="权限码" items={p.codes.map((c) => ({ label: c, key: c }))} /> },
                  { key: "features", title: "功能模块", minWidth: 140, maxWidth: 220, render: (p) => (p.features.length ? <CellTags label="功能模块" items={featureTags(p)} /> : <span className="aui-note">无</span>) },
                  { key: "roles", title: "角色模板", minWidth: 140, maxWidth: 220, render: (p) => (p.roles.length ? <CellTags label="角色模板" items={p.roles.map((r) => ({ label: r === p.adminRole ? `${roleLabel(r)}（管理员）` : roleLabel(r), key: r, ...(r === p.adminRole ? { tone: "green" as const } : {}) }))} /> : <span className="aui-note">无</span>) },
                  { key: "quotas", title: "配额", minWidth: 120, maxWidth: 220, truncate: (p) => quotaText(p.quotas, qLabel) || "不限", render: (p) => quotaText(p.quotas, qLabel) || "不限" },
                  { key: "builtin", title: "来源", width: 90, render: (p) => <StatusBadge tone="neutral">{p.builtin ? "内置" : "自建"}</StatusBadge> },
                  {
                    key: "ops",
                    title: "操作",
                    kind: "actions",
                    render: (p) => (
                      <RowActionBar
                        label={`${p.name}的更多操作`}
                        actions={
                          manage && !p.builtin
                            ? [
                                { key: "edit", label: "编辑", icon: <Pencil />, onSelect: () => setEditing({ pkg: p }) },
                                { key: "view", label: "查看", icon: <Eye />, onSelect: () => setViewing(p) },
                                { key: "delete", label: "删除", icon: <Trash2 />, destructive: true, onSelect: () => setRemoving(p) },
                              ]
                            : [{ key: "view", label: "查看", icon: <Eye />, onSelect: () => setViewing(p) }]
                        }
                      />
                    ),
                  },
                ]}
              />
            )}
          </GovLoad>
        </ResourcePanel>
      </PageBody>
      {viewing && (
        <Dialog open size="lg" title={viewing.name} description={viewing.builtin ? "内置套餐（写在代码里，只能查看）" : viewing.id} onClose={() => setViewing(null)} footer={<Button variant="outline" onClick={() => setViewing(null)}>关闭</Button>}>
          <DescriptionList
            items={[
              { label: "说明", value: viewing.description || null, full: true },
              { label: "权限码", value: <CellTags label="权限码" items={viewing.codes.map((c) => ({ label: c, key: c }))} />, full: true },
              { label: "功能模块", value: viewing.features.length ? <CellTags label="功能模块" items={featureTags(viewing)} /> : null, full: true },
              { label: "角色模板", value: viewing.roles.map(roleLabel).join("、") || null },
              { label: "管理员角色", value: viewing.adminRole ? roleLabel(viewing.adminRole) : null },
              { label: "配额", value: quotaText(viewing.quotas, qLabel) || "不限" },
              { label: "更新时间", value: <CellDate value={viewing.updatedAt} time />, hint: `版本 ${viewing.version}` },
            ]}
          />
        </Dialog>
      )}
      {editing && (
        <PackageEditor
          pkg={editing.pkg}
          roles={roles}
          features={features}
          qLabel={qLabel}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              const saved = editing.pkg ? await api.platform.packages.update(editing.pkg.id, input) : await api.platform.packages.create(input);
              setNotice(`已保存「${saved.name}」`);
            } catch (e) {
              throw new Error(govErrorMessage(e));
            }
            void res.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        title="删除套餐"
        destructive
        confirmLabel="删除"
        impact={removing ? `删除「${removing.name}」。还有租户在用这个套餐时服务端会拒绝，请先给它们换套餐。` : undefined}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.platform.packages.remove(removing.id);
          } catch (e) {
            throw new Error(govErrorMessage(e));
          }
          setNotice(`已删除「${removing.name}」`);
          void res.refresh();
        }}
      />
    </>
  );
}

type QuotaRow = { key: string; value: string; id: number };
function PackageEditor({ pkg, roles, features, qLabel, onClose, onSave }: { pkg: PackageDto | null; roles?: readonly GovOption[]; features?: readonly GovOption[]; qLabel: (k: string) => string; onClose: () => void; onSave: (input: PackageInput) => Promise<void> }) {
  const id = useId();
  const [pkgId, setPkgId] = useState("");
  const [name, setName] = useState(pkg?.name ?? "");
  const [description, setDescription] = useState(pkg?.description ?? "");
  const [codes, setCodes] = useState((pkg?.codes ?? []).join("\n"));
  const [allFeatures, setAllFeatures] = useState(pkg?.features.includes("*") ?? false);
  const [featureIds, setFeatureIds] = useState<string[]>(pkg?.features.filter((f) => f !== "*") ?? []);
  const [roleIds, setRoleIds] = useState<string[]>(pkg?.roles ?? []);
  const [adminRole, setAdminRole] = useState(pkg?.adminRole ?? "");
  const [quotas, setQuotas] = useState<QuotaRow[]>(() => Object.entries(pkg?.quotas ?? {}).map(([key, v], i) => ({ key, value: String(v), id: i })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const snap = () => JSON.stringify([pkgId, name, description, codes, allFeatures, featureIds, roleIds, adminRole, quotas.map((q) => [q.key, q.value])]);
  const [initial] = useState(snap);
  return (
    <FormDialog
      open
      size="lg"
      title={pkg ? `编辑「${pkg.name}」` : "新建套餐"}
      description="改套餐会立即影响所有用这个套餐的租户。"
      dirty={snap() !== initial}
      onClose={onClose}
      onSubmit={async () => {
        const parsed = parseQuotaRows(quotas);
        const input: PackageInput = {
          ...(pkg ? { id: pkg.id, version: pkg.version } : pkgId.trim() ? { id: pkgId.trim() } : {}),
          name: name.trim(),
          description: description.trim(),
          codes: parseLines(codes),
          features: allFeatures ? ["*"] : featureIds,
          roles: roleIds,
          adminRole: adminRole && roleIds.includes(adminRole) ? adminRole : null,
          quotas: parsed.ok ? parsed.quotas : {},
        };
        const e = validatePackage(input, !pkg);
        if (!parsed.ok) e.quotas = parsed.error;
        setErrors(e);
        if (Object.keys(e).length) throw new Error("请先改正标红的项");
        await onSave(input);
      }}
    >
      <div className="aui-gov-form">
        {!pkg && (
          <FormField label="套餐编号" htmlFor={`${id}-id`} error={errors.id} hint="留空自动生成">
            <Input id={`${id}-id`} value={pkgId} placeholder="例：pro" onChange={(e) => setPkgId(e.target.value)} />
          </FormField>
        )}
        <FormField label="套餐名称" htmlFor={`${id}-name`} required error={errors.name}>
          <Input id={`${id}-name`} value={name} placeholder="例：专业版" onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="aui-gov-form-full">
          <FormField label="说明" htmlFor={`${id}-desc`}>
            <Input id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </div>
        <div className="aui-gov-form-full">
          <FormField label="包含的权限码" htmlFor={`${id}-codes`} required error={errors.codes} hint="一行一个，可用通配：crm:* = 客户管理的全部动作">
            <Textarea id={`${id}-codes`} rows={5} value={codes} onChange={(e) => setCodes(e.target.value)} />
          </FormField>
        </div>
        <div className="aui-gov-form-full">
          <FormField label="开通的功能模块" htmlFor={`${id}-features`}>
            <div className="aui-gov-stack">
              <label className="aui-gov-check">
                <Checkbox checked={allFeatures} onCheckedChange={(v) => setAllFeatures(v === true)} aria-label="全部功能模块" />
                全部功能模块
              </label>
              {!allFeatures &&
                (features?.length ? (
                  <ChipGroup label="功能模块" value={featureIds} onValueChange={setFeatureIds} options={features.map((f) => ({ value: f.id, label: f.label }))} />
                ) : (
                  <Input id={`${id}-features`} value={featureIds.join(", ")} placeholder="模块编号，多个用逗号隔开" onChange={(e) => setFeatureIds(parseLines(e.target.value))} />
                ))}
            </div>
          </FormField>
        </div>
        <div className="aui-gov-form-full">
          <FormField label="开租户时种进去的角色" htmlFor={`${id}-roles`}>
            {roles?.length ? <ChipGroup label="角色模板" value={roleIds} onValueChange={setRoleIds} options={roles.map((r) => ({ value: r.id, label: r.label }))} /> : <Input id={`${id}-roles`} value={roleIds.join(", ")} placeholder="角色编号，多个用逗号隔开" onChange={(e) => setRoleIds(parseLines(e.target.value))} />}
          </FormField>
        </div>
        <FormField label="租户管理员拿哪个角色" htmlFor={`${id}-admin`} hint="从上面勾选的角色里选">
          <Choice label="租户管理员拿哪个角色" placeholder={roleIds.length ? "选择" : "先勾选角色"} value={roleIds.includes(adminRole) ? adminRole : ""} disabled={!roleIds.length} onChange={setAdminRole} options={roleIds.map((r) => ({ value: r, label: roles?.find((o) => o.id === r)?.label ?? r }))} />
        </FormField>
      </div>
      <fieldset className="aui-gov-quota-edit">
        <legend>配额</legend>
        {errors.quotas && <p className="aui-error" role="alert">{errors.quotas}</p>}
        {quotas.map((q, i) => (
          <div key={q.id} className="aui-gov-quota-row">
            <Input aria-label={`第 ${i + 1} 项配额名称`} value={q.key} placeholder="例：members" onChange={(e) => setQuotas((l) => l.map((x) => (x.id === q.id ? { ...x, key: e.target.value } : x)))} />
            <Input aria-label={`${q.key ? qLabel(q.key) : `第 ${i + 1} 项`}上限`} inputMode="numeric" value={q.value} placeholder="上限" onChange={(e) => setQuotas((l) => l.map((x) => (x.id === q.id ? { ...x, value: e.target.value } : x)))} />
            <IconButton label={`删除第 ${i + 1} 项配额`} onClick={() => setQuotas((l) => l.filter((x) => x.id !== q.id))} icon={<Minus />} />
          </div>
        ))}
        <div>
          <Button size="sm" variant="outline" onClick={() => setQuotas((l) => [...l, { key: "", value: "", id: Date.now() }])}><Plus />加一项配额</Button>
        </div>
      </fieldset>
    </FormDialog>
  );
}
