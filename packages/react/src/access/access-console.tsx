"use client";
/**
 * AccessConsole — the whole permission-management page a medium project mounts (quanxian 2.0 medium tier):
 * 部门 / 岗位 / 角色（矩阵 + 字段行 + 数据范围）/ 人员授权 / 用户组 / 字段权限 / 权限解释 + 以他视角预览 / 授权审计,
 * plus host sections (e.g. 字典 / 参数 from `@adminui/react/peizhi`). Only the sections the signed-in
 * person may see are shown; without the manage code a section is read-only. Every change goes through
 * `api` (quanxian/fastify via `createAccessApi`) and the server re-checks everything — anti-escalation,
 * versions, SoD — its messages show in place. Unsaved drafts are kept across tabs and guarded on unload.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TabbedPage } from "../tabbed-page.tsx";
import { StatePanel } from "../layout.tsx";
import { useAdminResource } from "../workflow-hooks.ts";
import type { AccessApi } from "./console-api.ts";
import type { AccessConsoleCodes, AccessSnapshot, DirectoryUser, ViewAsDto } from "./console-contracts.ts";
import { ACCESS_CONSOLE_SECTION_LABEL, consoleRights, deptIndex, deptTree, userNamer, type AccessConsoleSection } from "./console-core.ts";
import { ConsoleProvider, type ConsoleShared } from "./console-shared.tsx";
import { DeptSection, DimSection, PostSection } from "./console-org.tsx";
import { FieldSection, RoleSection } from "./console-roles.tsx";
import { PeopleSection } from "./console-people.tsx";
import { GroupSection } from "./console-groups.tsx";
import { AuditSection, ExplainSection, ViewAsBanner } from "./console-insight.tsx";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";
// aui-css: styles of the classes this module renders (scripts/css-chunks.mjs keeps this list in sync)
import "#aui-css/access.css";

/** A host section appended after the built-in ones (e.g. 字典 / 参数). */
export type AccessConsoleExtraSection = {
  id: string;
  label: string;
  render: (active: boolean) => ReactNode;
  /** Hide it (e.g. the person lacks its permission). Default true. */
  visible?: boolean;
};

export type AccessConsoleProps = {
  api: AccessApi;
  /** `GET /me/access` of the signed-in person: decides visible sections and read-only mode. */
  snapshot: AccessSnapshot;
  /** People from the host's identity module (quanxian has no user table). */
  users?: readonly DirectoryUser[];
  /** Or load them (called again after org changes so department membership stays fresh). */
  loadUsers?: (signal: AbortSignal) => Promise<DirectoryUser[]>;
  title?: string;
  description?: ReactNode;
  /** Force display-only (e.g. an auditor view). Without the manage codes it is read-only anyway. */
  readOnly?: boolean;
  /** Built-in sections to offer (default all that the person may see). */
  sections?: readonly AccessConsoleSection[];
  extraSections?: readonly AccessConsoleExtraSection[];
  /** Controlled section id (keep it in the URL); leave out for internal state. */
  section?: string;
  onSectionChange?: (id: string) => void;
  /** Rename the management codes if the host registered quanxian with other codes. */
  codes?: Partial<AccessConsoleCodes>;
  /** Any section has unsaved changes (the host can guard its own navigation). */
  onDirtyChange?: (dirty: boolean) => void;
  /** A view-as preview started / ended (hosts may show their own banner). */
  onViewAsChange?: (view: ViewAsDto | null) => void;
  /** Whether the page is visible (AdminShell tab active). */
  active?: boolean;
  /** Clock override for expiry badges (tests). */
  now?: Date;
};

export function AccessConsole({
  api,
  snapshot,
  users: givenUsers,
  loadUsers,
  title = "权限管理",
  description = "部门、岗位、角色、人员授权、权限解释和授权审计；每一次改动都有审计。",
  readOnly = false,
  sections,
  extraSections = [],
  section,
  onSectionChange,
  codes,
  onDirtyChange,
  onViewAsChange,
  active = true,
  now,
}: AccessConsoleProps) {
  const rights = useMemo(() => consoleRights(snapshot, codes), [snapshot, codes]);
  // Stable keys + refresh(): a reload keeps the current lists on screen (sections stay mounted, drafts kept).
  const depts = useAdminResource("qx-depts", (s) => api.listDepts(s), 0, rights.org.view);
  const posts = useAdminResource("qx-posts", (s) => api.listPosts(s), 0, rights.org.view);
  const roles = useAdminResource("qx-roles", (s) => api.listRoles(s), 0, rights.roles.view);
  const groups = useAdminResource("qx-groups", (s) => api.listGroups(s), 0, rights.groups.view);
  const catalog = useAdminResource("qx-catalog", (s) => api.catalog(s), 0, rights.roles.view || rights.explain);
  // 维度（quanxian 2.2）：适配器有 listDims 才读
  const dimsRes = useAdminResource("qx-dims", (s) => (api.listDims ? api.listDims(s) : Promise.resolve([])), 0, rights.org.view && !!api.listDims);
  const loaded = useAdminResource("qx-users", (s) => (loadUsers ? loadUsers(s) : Promise.resolve([...(givenUsers ?? [])])), 0, !!loadUsers);
  const users = (loadUsers ? loaded.data : givenUsers) ?? [];

  const deptList = depts.data ?? [];
  const idx = useMemo(() => deptIndex(deptList), [deptList]);
  const orgTree = useMemo(() => deptTree(deptList, (id) => users.filter((u) => u.deptIds.includes(id)).length), [deptList, users]);
  const userName = useMemo(() => userNamer(users), [users]);
  const dims = useMemo(() => dimsRes.data ?? [], [dimsRes.data]);
  const dimensions = useMemo(() => dims.map((d) => ({ id: d.id, label: d.label, values: d.values.map((v) => ({ id: v.id, name: v.name, disabled: v.status === "disabled" })) })), [dims]);
  const dimNames = useMemo(() => ({ dim: (id: string) => dims.find((d) => d.id === id)?.label ?? id, value: (dim: string, id: string) => dims.find((d) => d.id === dim)?.values.find((v) => v.id === id)?.name ?? id }), [dims]);

  const lists = { depts, posts, roles, groups, catalog, users: loaded, dims: dimsRes };
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const reload = useCallback((what: "depts" | "posts" | "roles" | "groups" | "catalog" | "users" | "dims" | "all" = "all") => {
    const l = listsRef.current;
    const pick = what === "all" ? Object.values(l) : what === "depts" ? [l.depts, l.users] : [l[what]];
    for (const r of pick) void r.refresh();
  }, []);

  const visible = rights.sections.filter((s) => !sections || sections.includes(s));
  const extras = extraSections.filter((x) => x.visible !== false);
  const all = [
    ...visible.flatMap((s) => (s === "org" ? [{ id: "depts", label: "部门" }, { id: "posts", label: "岗位" }, ...(dims.length ? [{ id: "dims", label: dims.length === 1 ? dims[0]!.label : "维度" }] : [])] : [{ id: s, label: ACCESS_CONSOLE_SECTION_LABEL[s] }])),
    ...extras.map((x) => ({ id: x.id, label: x.label })),
  ];
  const [inner, setInner] = useState<string>(all[0]?.id ?? "");
  const current = section ?? inner;
  const value = all.some((s) => s.id === current) ? current : (all[0]?.id ?? "");
  const [preset, setPreset] = useState<{ userId?: string; roleId?: string }>({});
  const go = useCallback(
    (to: AccessConsoleSection, p: { userId?: string; roleId?: string } = {}) => {
      const id = to === "org" ? "depts" : to;
      setPreset(p);
      setInner(id);
      onSectionChange?.(id);
    },
    [onSectionChange],
  );

  // Unsaved changes: per-section flags → onDirtyChange + beforeunload.
  const dirtyRef = useRef<Record<string, boolean>>({});
  const [anyDirty, setAnyDirty] = useState(false);
  const setDirty = useCallback((key: string, dirty: boolean) => {
    dirtyRef.current = { ...dirtyRef.current, [key]: dirty };
    setAnyDirty(Object.values(dirtyRef.current).some(Boolean));
  }, []);
  useEffect(() => {
    onDirtyChange?.(anyDirty);
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty, onDirtyChange]);

  const [viewAs, setViewAsState] = useState<ViewAsDto | null>(null);
  const setViewAs = useCallback(
    (v: ViewAsDto | null) => {
      setViewAsState(v);
      onViewAsChange?.(v);
    },
    [onViewAsChange],
  );
  const endViewAs = useCallback(() => setViewAs(null), [setViewAs]);

  const shared: ConsoleShared = {
    api,
    rights,
    snapshot,
    readOnly,
    users,
    userName,
    depts: deptList,
    deptIdx: idx,
    orgTree,
    posts: posts.data ?? [],
    roles: roles.data ?? [],
    groups: groups.data ?? [],
    catalog: catalog.data ?? null,
    dims,
    dimensions,
    dimNames,
    reload,
    go,
    preset,
    setDirty,
    viewAs,
    setViewAs,
    ...(now ? { now } : {}),
  };

  if (!all.length) return <StatePanel kind="forbidden" message="你没有任何权限管理的权限。需要的话请联系管理员。" />;
  const firstError = [depts, posts, roles, groups, catalog, loaded].find((r) => r.error && !r.data)?.error;
  const render = (id: string, isActive: boolean): ReactNode => {
    const extra = extras.find((x) => x.id === id);
    if (extra) return extra.render(isActive);
    if (firstError && !(id === "audit")) return <StatePanel kind="error" message={`加载失败：${firstError}`} onRetry={() => reload("all")} />;
    switch (id) {
      case "depts":
        return depts.loading && !depts.data ? <StatePanel kind="loading" /> : <DeptSection />;
      case "posts":
        return <PostSection />;
      case "dims":
        return <DimSection />;
      case "roles":
        return roles.loading && !roles.data ? <StatePanel kind="loading" /> : <RoleSection />;
      case "people":
        return <PeopleSection />;
      case "groups":
        return <GroupSection />;
      case "fields":
        return roles.loading && !roles.data ? <StatePanel kind="loading" /> : <FieldSection />;
      case "explain":
        return <ExplainSection />;
      case "audit":
        return <AuditSection />;
      default:
        return null;
    }
  };
  return (
    <ConsoleProvider value={shared}>
      <div className="aui-access-console">
        {viewAs && <ViewAsBanner view={viewAs} userName={userName(viewAs.userId)} onEnd={endViewAs} />}
        <TabbedPage
          title={title}
          description={description}
          sections={all}
          value={value}
          active={active}
          onValueChange={(id) => {
            setInner(id);
            setPreset({});
            onSectionChange?.(id);
          }}
          render={render}
        />
      </div>
    </ConsoleProvider>
  );
}
