# 权限、审计与配置页

做角色权限、成员授权、审计日志、字典 / 参数、多租户治理的页面时读这份。按项目规模选一档：

| 档 | 项目情况 | 用什么 | 入口 |
|---|---|---|---|
| 小 | 没有接 quanxian，几种角色、一张审计表 | `AccessManager` + `AuditLogPage` + 宿主 adapter | 根入口 `@adminui/react`（§1） |
| 中 | 接了 quanxian 2.0（标准表 + `quanxian/fastify`）：部门、岗位、角色矩阵、记录团队、授权审计 | 整页 `AccessConsole` + 详情页 `RecordTeam`；字典 / 参数 `DictManager` / `ParamManager` | `@adminui/react/access`、`@adminui/react/peizhi`（§3、§4） |
| 大 | 多租户 / 治理：租户、套餐、共享 / 收窄规则、职责分离、申请审批、紧急提权、复核、安全体检 | `GovernanceConsole` 及各治理页 | `@adminui/react/access`（§5） |
| 部件 | 自己拼页面：权限矩阵、数据范围、部门 / 人员选择、有效权限、权限解释、协作成员、申请 / 复核、审计差异 | 纯展示组件 | `@adminui/react/access`（§2） |

所有档都一样：**按钮显隐只是界面**。服务端从已验证会话取操作人和租户，逐条鉴权、校验版本、写审计。

## 1. 小档：AccessManager + AuditLogPage

`AccessManager`：角色列表、分组权限勾选、新建 / 编辑 / 删除确认、成员角色分配、有效权限、只读模式、提交错误保留表单。`AuditLogPage`：关键词、成功 / 拒绝 / 失败、UTC 日期范围、服务端分页、详情与变更前后、当前页导出。

```tsx
import { AccessManager, AuditLogPage, type AccessAdapter, type AuditAdapter } from '@adminui/react';

export function Governance({ scope, access, audit, permissions, active }: {
  scope: string; access: AccessAdapter; audit: AuditAdapter;
  permissions: readonly string[]; active: 'access' | 'audit';
}) {
  return <>
    {active === 'access' && permissions.includes('access:manage') && <AccessManager scope={scope} adapter={access} canManage />}
    {active === 'audit' && permissions.includes('audit:read') && <AuditLogPage scope={scope} adapter={audit} />}
  </>;
}
```

`scope` 包含项目 / 租户 / 当前账号，切换即重置弹框与查询。保留工作标签的宿主还要传 `active`，隐藏页停止加载；撤权后关闭相关工作标签并清缓存。`canManage` 默认 false，只控制交互。

### 1.1 adapter 映射

| 方法 | HTTP 示例 | 要求 |
|---|---|---|
| `AccessAdapter.load(signal)` | GET `/api/admin/access` | 返回 permissions / roles / members；只返回当前租户可管理范围 |
| `saveRole(role, signal)` | POST / PATCH `/api/admin/roles` | 空 id 表示创建；更新比对 version；受保护角色不可改 |
| `deleteRole(role, signal)` | DELETE `/api/admin/roles/:id` | 比对 version；仍有成员的角色拒绝删除 |
| `assignRoles(member, signal)` | PATCH `/api/admin/members/:id/roles` | 白名单角色；检查可授予范围与最后管理员 |
| `AuditAdapter.list(query, signal)` | GET `/api/admin/audit` | 返回 `{ rows, total }`；同一筛选与读快照，稳定次序分页 |
| `exportPage(query, signal)` | POST `/api/admin/audit/export-page` | 可选，省略不显示按钮；独立授权、写审计、只返回当前页 |

- adapter 透传 AbortSignal，检查 HTTP 状态并校验响应结构。401 进宿主登录流程；403 显示无权限；409 提示刷新重试。网络异常不能当成功。version 是服务端生成的不透明字符串。
- `AuditQuery` 的 `from / until` 是 UTC 日历日期、含首尾，空串表示不限；page 从 1 开始，宿主限制 pageSize（示例最大 100）。`AuditRecord`：`id / actor / action / at / result`，可选 `target / detail / changes / requestId / source`。大范围导出走任务中心。

### 1.2 服务端必做

- 权限统一 `resource:action`；actor 和租户从已验证会话取，不信 body / header 自报。
- 每个读写与导出接口都授权；可授予范围由服务端政策限制；撤权即时生效或使旧会话失效。
- 业务变更与成功日志同事务，日志失败回滚高风险修改；拒绝和失败在回滚后独立记录。
- 日志只写允许的字段，不写密码、验证码、token、完整手机号；日志接口没有编辑 / 删除。
- SDK 不建登录系统：沿用宿主身份模块（Node 项目优先 zhanghao），Cookie 写操作接 CSRF，按租户隔离，日志单独授权并落实保留周期与防篡改。

### 1.3 两种示例的边界

- starter「系统 → 角色与权限 / 审计日志」用 `governance-demo.ts`：角色与日志存在浏览器 localStorage（最多 2000 条），只为体验，不能当生产鉴权或合规审计。
- [服务端 SQLite 案例](examples/governance/README.md)：真实事务、逐次授权、版本冲突、最后管理员、持久审计、筛选分页和导出留痕。它是宿主服务模块参考，没有替任何生产项目接会话 / 租户。

## 2. 权限部件（`@adminui/react/access`）

全部是**纯展示组件**：props 进、回调出，自己不请求数据；宿主加载数据，在回调里调自己的接口（quanxian 2.0 是 `quanxian/server`）。样式在同一份 `styles.css`（`.aui-access-*`）。starter「系统 → 权限组件」七个分区可直接操作（`examples/starter/src/AccessShowcase.tsx`，`React.lazy` 按页加载）。

```tsx
import { PermissionMatrix, diffMatrix, matrixChangeItems, type OrgNode, type PermissionMatrixValue } from '@adminui/react/access';
import { Button, ConfirmDialog, ChangeList } from '@adminui/react';

const actions = [{ id: 'read', label: '查看', scoped: true }, { id: 'update', label: '编辑', scoped: true }, { id: 'export', label: '导出' }];
const resources = [{ id: 'customer', label: '客户', group: '客户管理', actions: ['read', 'update', 'export'], fields: [{ id: 'phone', label: '联系电话', sensitive: true }] }];

export function RolePermissions({ saved, orgTree, save }: { saved: PermissionMatrixValue; orgTree: OrgNode[]; save(v: PermissionMatrixValue, reason: string): Promise<void> }) {
  const [draft, setDraft] = useState(saved);
  const [confirm, setConfirm] = useState(false);
  const changes = diffMatrix(saved, draft, resources, actions);
  return <>
    <PermissionMatrix caption="销售经理的权限" resources={resources} actions={actions} value={draft} savedValue={saved} onChange={setDraft}
      orgTree={orgTree} disabledTiers={{ all: '不能宽于你自己的范围' }}
      toolbar={<Button disabled={!changes.length} onClick={() => setConfirm(true)}>保存</Button>} />
    <ConfirmDialog open={confirm} title="保存角色权限" reason={{ label: '修改原因', required: true }} onClose={() => setConfirm(false)}
      onConfirm={(reason) => save(draft, reason)}><ChangeList items={matrixChangeItems(changes)} /></ConfirmDialog>
  </>;
}
```

### 2.1 数据形状（`src/access/contracts.ts`，对齐 quanxian）

| 类型 | 要点 |
|---|---|
| `DataScope` | `{ tier, deptIds?, includeUnassigned? }`；`tier` = `own / subordinates / dept / dept_tree / all`（后一档包含前一档）或 `custom`（勾选的部门 ∪ 自己名下的，`deptIds` 至少一个）。内核里 own 叫 `self`、subordinates 叫 `self_and_subordinates`，由宿主适配层对应 |
| `PermissionMatrixValue` | `{ grants: { '资源:动作': { scope? } }, fields?: { '资源.字段': { read, write, export, mask } } }`；没有的格子 = 未授予；没有的字段 = 字段的 `defaultPolicy`（默认全否） |
| `TreeNode` / `OrgNode` | `{ id, label, children?, disabled?, hint?, keywords? }`，id 不重复 |
| `AccessUser` | `{ id, name, deptIds, hint?, disabled? }`（一人多部门） |
| `EffectiveAccessRow` | `{ code, label, group?, allowed, scope?, sources[], blocks[], risk? }`；来源 `role / post / personal / record_grant / share_rule / superuser / delegation / dept / implied / parent`，拦截 `restriction / denied / tenant / feature_off / step_up / expired / not_granted / condition` |
| `ExplainResult` | `decision` = `allow / deny / conditional`、`allowedBy`、`blockedBy`、`steps[]`（`pass / fail / unknown / skip`）、`unknown[]`（哪个字段为 NULL 导致未知，未知按拒绝）、`condition`、`fields[]` |
| `RecordTeamMember` | `{ id, subject: { type: user/group/dept/everyone, id, name }, level: viewer/editor/owner, expiresAt?, inheritedFrom?, grantedBy?, reason? }` |
| `AccessRequest` / `ReviewItem` | 申请 `draft → pending → approved → active → expired / revoked`（或 `rejected / cancelled`），`step` 是多级审批进度；复核项 `lastUsedAt: null` = 从没用过 |

### 2.2 组件

- `CheckableTree`：`nodes, value, onValueChange(value, { halfChecked }), label, mode?('multiple' | 'single'), linked?, onLinkedChange?, searchable?, toolbar?, readOnly?, disabled?, defaultExpanded?, isSelectable?, maxHeight?`。联动时值 = 叶子 + 全选的父节点，半选父节点在 `halfChecked`；禁用节点不被联动。≤ 50 个节点默认全展开。键盘：↑ ↓ Home End 移动，→ 展开，← 收起，空格 / 回车勾选。
- `PermissionMatrix`：`resources, actions, value, onChange?, savedValue?, readOnly?, orgTree?, disabledTiers?, caption, searchable?, toolbar?, defaultCollapsed?, dimensions?`（6.4：维度 + 值，资源的 `dims` 列出的维度在范围弹框里给过滤）。勾上带范围的格子默认最窄档；「指定部门…」或齿轮打开 `DataScopeDialog`；字段行的写 / 导出 / 脱敏自动带上读。改过的格子高亮 + 计数，「撤销改动」回到 `savedValue`。
- `DataScopeDialog`：`open, onClose, value, onSubmit(scope), orgTree?, tiers?, disabledTiers?, title?, subject?, allowUnassigned?, readOnly?, dimensions?`。`onSubmit` reject 就留在弹框显示原因。给了 `dimensions`（6.4，quanxian 2.2 维度）每个维度多一行过滤：不限 / 我的业务线 / 指定业务线（多选）+「也包括没填的」，和档位取交集，值放在 `DataScope.dims`。
- `OrgTreePicker`（**已弃用**，下个大版本删除 → `@adminui/react/org-picker` 的 `OrgPickerField` / `OrgPicker`，`selectable={["dept"]}`，见 AI-RULES 附录 V）：`nodes, label, value, onChange, multiple?, isSelectable?, linked?, placeholder?, disabled?, id?`。值永远是 id 数组；回显完整路径，已删除的显示「（已不存在）」。
- `UserTransfer`（**已弃用**，下个大版本删除 → `OrgPicker`，`selectable={["person"]}`、`max`，成员按部门分页、服务端搜索）：`orgTree?, users, value, onChange, max?, label?, disabled?, loading?, renderLimit?`。一次最多渲染 200 个候选人；几千人以上由宿主按部门 / 搜索分页传 `users`。
- `EffectiveAccessTable`：`rows, subject?, loading?, error?, onRetry?, deptName?, onSourceClick?, filter? / onFilterChange?, pageSize?, now?, dimNames?`。只经「只在某处」的分配持有的行（`row.within`）在范围列标「仅在业务线「A 线」」，来源带 `within` 的同样标出。
- `effectiveScopeLines(row, deptName?, dimNames?)`（6.4）：有效权限范围列的文字——只经带范围的分配持有时按来源各一行（档位 + 地方），没有那个字段的写「只跟随上级记录」。
- `assignPlaceOptions(dimensions, { target, editor })`（6.4）：分配弹窗「只在这个业务线上」的可选值——只给对方在的；编辑人只在某些地方管人（`consoleRights(snapshot).assignWithin`）时只给那些、不给「不限」。
- `consoleRights(snapshot)` 的显示开关（6.5）：`overrides`（个人加减要不带范围的授权）、`orgStructure`（建 / 改 / 删部门、岗位、维度值要不带范围的组织管理）、`superuser`（只有超管能换上级部门、任免负责人）；`editsSelf(snapshot, userId)` = 不是超管时在改自己（服务端会拒）。`assignmentActions(a, manage, { within, subtree?, subjectDept?, names? })`：编辑人只在某些地方管人时，范围外的分配 `unassign / renew` 为 false、`blockedReason` 写原因（列表里灰掉进 ⋯）。
- 能力字段（6.5，quanxian 2.2.1）：`AssignmentDto.editable` 有就照它（`assignmentActions` 优先用），没有才按编辑人范围自己算；`DeptDto / PostDto / UserOrgDto.canAssign` 交给 `assignButton(manage, canAssign)` 决定「分配角色」显示 / 灰掉 + 原因。`DataScope.label`（服务端人话）在 `describeScope` 里优先；视角预览的数据范围用 `snapshotScopeLines(snapshot, catalog, dimNames)`（带 `scopeDims`）。
- 角色保存（6.5）：`roleSaveBody(savedRole, draftMatrix)` 返回 `{ permissions, fieldConds }`——字段策略的按行条件（`RoleDto.fieldConds`）要和矩阵一起发（只发草稿里还有的字段），不发会被旧服务端清掉；`fieldCondChangeItems` 给确认弹窗写「保留 / 去掉」。宿主自己画角色编辑页时照这样发。
- `snapshotHolds(snapshot, code, where?)`（6.4，quanxian 2.2）：只在某条业务线 / 某个部门给的码不在 `codes` 里（默认不算）；`"anywhere"` = 在某处有（菜单入口），传地方（`{ dims: { line: "A" } }`）= 在那里有没有。只管显示，接口照样判。
- `ExplainPanel`：`subjects, actions, resources, query, onQueryChange, onEvaluate(query), result?, loading?, error?, subjectPicker?, deptName?, places?, placeLabel?`。宿主在 `onEvaluate` 里调解释接口，把 `ExplainResult` 传回；改了条件提示「结果对应上一次评估」。给了 `places`（6.4）多一个「按哪里看」选择，写进 `query.within`（「他在 A 线能不能」）。
- `RecordTeamPanel`：`members, canManage?, canTransfer?, candidates?, orgTree?, subjectTypes?, groups?, onAdd?, onUpdate?, onRemove?(member, reason), onTransferOwner?({ toUserId, keepPreviousAs, reason }), recordLabel?, loading?, error?, now?`。负责人只能经「转移负责人」换。
- `AccessRequestList`：`requests, can?, onAction?(request, action, { reason, expiresAt? }), statusFilter? / onStatusFilterChange?, pagination?, loading?, error?, now?`；只给状态机允许的按钮（`requestActions`）。
- `ReviewList`：`items, onDecide?(ids, decision, note), onSubmit?, dueAt?, staleDays?(90), readOnly?, loading?, error?, now?`；「收回」要原因，全部处理完才能提交。
- `AuditDiff`：`before, after, labels?, secretKeys?, caption?, maxEntries?, defaultView?`；密钥类键（password / token / secret / apikey / credential …）一律「（已隐藏）」，但能不能看这条审计由服务端决定。
- `ExpiryBadge`：到期状态徽标（`expiryState`）。

到期时间用浏览器本地时间输入，回调给 ISO 字符串（`null` = 永久）。可授范围、最后一个超管、职责分离、版本冲突、到期失效都在服务端判。

验收：`npm run test:access`（交互、键盘、七个分区 360 / 390 / 1440 不横向溢出、深色对比度）；纯函数 `test/access-core.test.ts`。

### 2.3 表格就地权限 `TableAccessPanel`（样稿 D13）

多维表格 / 业务表里「这张表的权限」页：按角色设这张表的记录范围、能做的操作和每个字段的 可读 / 可写 / 打码 / 可导出。和 `PermissionMatrix`（资源 × 动作的大矩阵）是同一套规则：字段策略 `FieldPolicy`、写 / 打码 / 导出自动带上读（`toggleFieldAbility`）、`custom` 档走 `DataScopeDialog`、按条件默认用治理页的 `CondBuilder`、影响用 `RuleImpactView`——只是换成一张表一个角色的视角，不另起一套。

```tsx
import { TableAccessPanel, tableAccessChanges, type TableAccessValue, type TableAccessField, type CondDraft } from '@adminui/react/access';

<TableAccessPanel<CondDraft>
  title="客户 · 权限设置" help="角色对所有表通用，这里只改它在「客户」表上的权限"
  roles={roles} selectedRole={roleId} onSelectRole={setRoleId}            // { id, name, members, admin?, dirty? }
  value={draft} savedValue={saved} onChange={setDraft}                    // { scope: { tier, condition?, deptIds?, keepAfterHandover? }, actions, fields }
  recordNoun="客户" conditionFields={condFields}                         // 或 renderCondition={(c, set) => <嵌套条件编辑器 …/>}
  actions={[{ id: 'read', label: '看' }, { id: 'create', label: '加' }, { id: 'update', label: '改' }, { id: 'delete', label: '删' }, { id: 'export', label: '导出' }]}
  fields={fields} fieldIcon={(f) => iconOf(f)}                            // primary 始终可见；ownedBy「运营专用，小B 加的」锁住；sensitive 才有打码
  members={people} membersText="技术部 6 人" onManageMembers={openMembers}
  impact={impact} impactStale={pending} impactLead="技术部 6 人里 "       // 服务端按草稿试算的 RuleImpactDto
  onDiscard={() => setDraft(saved)} onPreviewAs={openViewAs} onSave={() => setConfirm(true)} />
```

- 记录范围 6 档默认是 `TABLE_SCOPE_TIERS`（仅自己负责的 / 本人及下属 / 本部门 / 部门及下级 / 本业务线全部 / 按条件），`hint` 换成真实名字（「技术部」「智能家居全部客户」）；要「指定部门」就把 `custom` 加进 `tiers` 并给 `orgTree`。
- 「按条件」的编辑器是插槽 `renderCondition(condition, onChange)`；不传就用 `CondBuilder`（能写条件组，`density="compact"` 的 D13 样子）+ `conditionFields`，值是 `CondDraft`（`draftToCond` 校验后再发服务端）。
- 字段行：主字段（`primary`）可读锁死、标「始终可见」；别人建的字段（`ownedBy`）整行灰、只显示归属，由它自己的字段权限决定；不可读的行异常浅底 +「技术看不到」；打码列只对 `sensitive` 字段。表头显示「可读 11 / 15」等计数，「全部 / 看不到的」筛选。
- 有改动才出影响横幅（`impactSummary` +「看每个人的变化」展开 `RuleImpactView`）和「放弃改动」；角色列表里有改动的角色带黄点（当前角色按 `savedValue` 算，别的角色宿主给 `dirty`）。保存按钮显示改动数；确认弹框用 `tableAccessChanges(saved, draft, { fields, actions })` 的结果喂 `ChangeList`，要原因。
- 纯函数：`tableFieldPolicy`、`canToggleField`、`toggleTableField`、`tableFieldCounts`、`tableFieldTags`、`hiddenTableFields`、`tableAccessChanges`、`tableAccessDirty`（`src/access/table-access-core.ts`，服务端也能用来做同样的规整）。
- 服务端照样校验：能不能授这个范围（不能宽于操作者自己）、字段归属、最后一个管理员、版本冲突，并和业务变更同事务写审计。

字段级的「谁能看 / 谁能改」（D12 新建字段右栏）用根入口的 `GrantList mode="picked"`，见 [TABLES.md](TABLES.md) §3.6。

验收：`npm run test:records`（D13：影响横幅、黄点、档位方向键、条件、操作胶囊、字段矩阵计数 / 标签 / 锁、确认清单、放弃、390 / 深色）。

## 3. 中档整页：AccessConsole + RecordTeam

后端挂 `quanxianFastify`，前端挂一个 `AccessConsole`。完整样板：`packages/quanxian/examples/crm/web`（`npm run dev:crm -w quanxian`；浏览器验收 `npm run test:crm-web -w quanxian`）。

```tsx
import { AccessConsole, RecordTeam, createAccessApi, type AccessSnapshot, type DirectoryUser } from '@adminui/react/access';
import { DictManager, ParamManager, createPeizhiApi } from '@adminui/react/peizhi';

const qx = createAccessApi({ baseUrl: '/api/qx', headers: () => ({ 'x-csrf': csrf() }) });
const pz = createPeizhiApi({ baseUrl: '/api/peizhi' });

export function AccessPage({ me, active, setDirty }: { me: AccessSnapshot; active: boolean; setDirty(d: boolean): void }) {
  return <AccessConsole api={qx} snapshot={me}                       // me = GET /api/qx/me/access
    loadUsers={(signal) => api.get<DirectoryUser[]>('/api/users/directory', { signal })}   // 人员来自宿主账号模块
    active={active} onDirtyChange={setDirty}
    extraSections={[
      { id: 'dicts', label: '字典', visible: me.codes.includes('peizhi:dict.manage') || me.superuser, render: () => <DictManager api={pz} /> },
      { id: 'params', label: '参数', visible: me.codes.includes('peizhi:param.manage') || me.superuser, render: () => <ParamManager api={pz} /> },
    ]} />;
}

// 任意详情页的「协作成员」：负责人在业务表里，传 owner；按钮看服务端给这一行的 allowedActions
<RecordTeam api={qx} resourceType="customer" resourceId={row.id} recordLabel={row.name}
  owner={row.owner ? { id: row.owner, name: row.ownerName } : null} users={people} orgTree={depts}
  subjectTypes={['user', 'group', 'dept', 'everyone']} groups={groups}
  canManage={row.allowedActions.includes('share')} canTransfer={row.allowedActions.includes('transfer')} onChanged={reload} />
```

| 分区 | 谁看得到（默认码，`codes` 可改名） | 能做什么 |
|---|---|---|
| 部门 | `qx:org.view`（改：`qx:org.manage`） | 部门树、新建 / 改名 / 移动 / 启停 / 删除（空的才行）、负责人、直属成员、部门角色 |
| 岗位 | 同上 | 岗位列表、新建 / 编辑 / 删除、岗位角色 |
| 业务线（维度，6.4） | 同上；宿主登记了维度、适配器有 `listDims` 才出现（标签名 = 维度名，几个维度时叫「维度」） | 每个维度一个值列表（DataTable + RowActionBar）：新建 / 编辑 / 启停 / 删除（有人在里面不能删）；改值要不带范围的 `qx:org.manage` |
| 角色 | `qx:role.view`（改：`qx:role.manage`） | 角色列表、`PermissionMatrix`（每格数据范围 + 字段行）、改动清单 + 确认、切换前「放弃未保存的改动？」、409 原地「重新加载」、复制为新角色、谁有这个角色；内置角色只读 |
| 人员授权 | 有上面任一或 `qx:explain` | 多部门 + 主部门、岗位、他在哪些业务线里（一个主的，6.4）、分配角色带到期 / 原因 / 范围（「只在 A 业务线」「只在一部」，服务端 `catalog.scopedAssignments` 时才给）、个人加 / 减、有效权限；自己不能改自己 |
| 用户组 | `qx:role.view` / `qx:group.manage` | 组 / 团队、成员（可设到期） |
| 字段权限 | `qx:role.view` | 选角色 × 资源，逐字段读 / 写 / 导出 / 脱敏 |
| 权限解释 | `qx:explain` | `ExplainPanel`；「以他视角预览」要原因，只读、默认 10 分钟、记审计，顶部提示条倒计时 |
| 授权审计 | `qx:audit.view` | 按动作 / 操作人 / 对象筛选、`AuditDiff`、加载更多（游标） |

**锁定的分配（4.5）**：服务端给的 `AssignmentDto.locked = { reason }`（quanxian `createQuanxianServer({ lockedAssignment })`，例如按宿主账号角色推出来的内置角色持有人）——「谁有这个角色」、人员授权的角色表、部门 / 岗位角色表都不显示「取消分配 / 改期限」，操作列换成锁图标 + 原因；服务端照样拒（409 `LOCKED`，弹窗标题「已锁定，不能在这里改」）。纯函数 `assignmentActions(a, manage)` 给宿主自己画列表时用。

- 没有 manage 码的分区自动只读；`readOnly` 强制只读。
- 弹框里提交失败显示服务端原话（403 防提权、职责分离、409 冲突），弹框不关、输入保留。
- 角色 / 字段权限有改动时 `onDirtyChange(true)` + `beforeunload`；分区切换不丢草稿。
- `createAccessApi` 对 quanxian/fastify 40 条接口；别的后端照 `AccessApi` 类型实现。错误统一 `AccessApiError { status, code, message, field?, permission?, fields? }`；`errorView(e)` 给标题 / 文案 / 是否冲突。
- 契约：所有人的 id 是 `"*"`（`EVERYONE_ID`）；加协作成员只发 `{ type, id? }`（`teamAddPayload`）。

## 4. 字典 / 参数页（`@adminui/react/peizhi`，接 peizhi）

- `DictManager`：字典类型（内置 / 自定义 / 后台改过 / 停用）+ 字典项（标签颜色 `TonePicker` = `StatusBadge` 的 tone、排序、默认项、启停、英文标签）；内置项只能改显示 / 停用 / 恢复默认；类型码和值建了不能改。
- `ParamManager`：按组列出；按类型编辑（文本 / 多行 / 数字带范围和整数 / 开关 / 选项 / JSON），弹框里实时「原值 → 新值」，非法值说明原因（规则与 peizhi 服务端一致：`parseParamDraft`）；密钥只显示「已设置 / 未设置」，只能整体替换、不回显；内置参数可恢复默认，自定义参数可建可删。
- 改动记录：宿主存了 peizhi 的改动事件并提供 `GET ?kind=&target=` 时，`createPeizhiApi({ historyUrl })` 打开「改动记录」（`AuditDiff`，密钥打码）。
- 权限码 `peizhi:dict.manage` / `peizhi:param.manage`（`PEIZHI_CODES`）；没有 manage 就别显示这两页（或传 `readOnly`）。

## 5. 大档治理页（`@adminui/react/access`）

这些页面**自己加载和保存**：每页收一个 `api`，对着 quanxian 治理接口；宿主只给选项（人、角色、部门、资源字段）和权限开关。starter「系统 → 权限治理」是全部分区的示例（内存假服务端，`examples/starter/src/GovernanceAccessShowcase.tsx`，可切「普通成员（只读）」视角）。样式在 `styles.css` 的 `.aui-gov-*` 一节。

```tsx
import { createGovernanceApi, GovernanceConsole, type GovLookups } from '@adminui/react/access';

// 模块级创建一次；默认同源 /api/qx、带 cookie。换前缀或加 CSRF：createGovernanceApi({ baseUrl: '/admin/api/qx', headers: { 'x-csrf-token': token } })
const api = createGovernanceApi();

export function Governance({ me, codes, lookups, active }: { me: { id: string; name: string }; codes: string[]; lookups: GovLookups; active: boolean }) {
  return <GovernanceConsole api={api} me={me} permissions={codes} lookups={lookups} active={active} />;
}
```

**服务端**：quanxian 治理路由（`/tenant`、`/members`、`/rules/share|restrictions|sod`（含 `/preview`、`/rules/sod/violations`）、`/approval-policies`、`/requests`（`?view=mine|todo|all`，`/:id/submit|approve|reject|cancel|revoke`）、`/emergency`、`/reviews`、`/health`，平台 `/platform/packages|tenants|view-as|health`）挂在同一前缀（默认 `/api/qx`）。**租户永远取自服务端会话**。错误 `{ code, message, field?, permission? }`，`createGovernanceApi` 抛 `GovernanceApiError`（网络断开 `code: "NETWORK"`，取消原样抛 AbortError）。数据形状 `src/access/governance/contracts.ts` 逐字段对齐 quanxian，改合同两边一起改。

**单独挂某一页**：

| 组件 | 主要属性（都另有 `api, active?, now?`） |
|---|---|
| `TenantsPage` / `PackagesPage` | 平台页。`users?`、`roles? / features?`、`quotaLabels?`、`can.manage` |
| `TenantMembersPage` | `roles?, users?, orgSource?, orgPicker?, can.manage`；顶部当前租户、套餐和配额条（`TenantQuotas`，≥ 80% 注意色、满了异常色）。给了 `orgSource`（宿主的通讯录 `OrgDataSource`，按看的人能授权的范围过滤）时「添加成员」用组织选人选一个人（搜姓名带路径、「组织架构」开大弹框，现有成员灰着写「已是成员」），不再让人手填用户编号；`orgPicker` 透传 OrgPickerField 选项（`defaultFocus`、`availability`、`suggestions` …）。`GovernanceConsole` 同名属性传给成员分区 |
| `ShareRulesPage` / `RestrictionRulesPage` | `resources: { id, label, fields: { id, label, type, options? }[], actions? }[]`、`subjects?`、`can.manage` |
| `SodRulesPage` | `codes?`、`can.manage` |
| `AccessRequestsPage` | `targets?`、`resources?`、`can.viewAll`、`can.request`、`defaultView?` |
| `ApprovalPoliciesPage` | `roles?, users?, depts?, targets?, can.manage` |
| `EmergencyAccessPage` | `me`、`targets: { kind: 'role' \| 'permission', id, label }[]`、`supervisors`、`maxMinutes?`（默认 240）、`can.use` |
| `ReviewsPage` | `roles?, users?, depts?, resources?, can.manage` |
| `SecurityHealthPage` | `scope?: 'tenant' \| 'platform'`、`rls?` |

权限码 → 开关用 `governanceCan(codes)`（manage 蕴含 view，认 `*` / `qx:*` 通配），分区用 `governanceSections(can)`。没有 manage 时页面只读并写明缺哪个权限。

**页面行为（验收照这个看）**
- 每页：首次加载转圈；失败给原因和「重试」；刷新失败保留旧数据并提示「当前数据可能已过期」；空列表和筛选无结果分开说。
- 规则编辑：条件用 `CondBuilder`（字段 · 运算 · 值，值可以是填写的值或「当前用户 / 当前用户的部门 …」；「全部满足 / 任一满足」，可加**条件组**，组里有自己的全部满足 / 任一满足，默认嵌套 1 层、50 条，`limits` 可改）。底下是通用的 `ConditionTreeEditor`，和表格筛选同一个编辑器。`CondDraft` 没有条件组时还是原来的 `{ join, rows }`，加了组多一个 `groups`；`condToDraft` 能读嵌套的 and / or。空条件、类型不对拦在前端（`draftToCond`）。**必须先「预览影响」**（「3 人会多看到 120 条，1 人会少看到 4 条」），预览后再改任何地方，保存变灰直到重新预览；内置规则只读；删除也先算影响。条件太复杂时只读显示并给「清空重写」。
- 申请：按钮来自 DTO 的 `can` 和状态机（`govRequestActions`）；驳回 / 收回必须写原因；`ApprovalChain` 显示每级谁批的、现在等谁。
- 紧急提权：原因至少 10 字、监督人不能是自己、时长有上限；实时倒计时（最后 5 分钟异常色）和「立即结束」；监督人事后看操作记录，「有异常」必须写意见。
- 复核：活动列表看进度和截止；复核项复用 `ReviewList`。
- 租户删除：原样输入租户编号 + 原因；停用要原因。

验收：`npm run test:access-governance`（12 个分区 360 / 390 / 1440 不横向溢出、深色对比度）；纯函数和 API 客户端 `test/access-governance-core.test.ts`。另有 `npm run test:governance`（小档页面）。

<!-- bt/history -->
## 6. 一个人的有效权限（样稿 D15「按人员」）

- `AccessProfileHeader`：`name, avatar?, tags?, meta?, stats?, onStatSelect?, activeStat?`。`stats` 用 `accessProfileStats(rows)` 算（角色〔含岗位 / 部门带来的〕/ 单独加 / 单独减〔被个人禁用拦住的行〕/ 共享记录）；点「单独加」「单独减」配合表格的 `personalOnly` 只看那几行。
- `EffectiveAccessTable` 增补：来源 `shared_record`（共享记录，「阿杰共享的」）、`field_default`（字段默认可见性决定的）；`parent` 仍是「跟随上级记录」（子表跟着父记录）。行带 `category`（`action / scope / field / record / subtable`）出「类别」列；任一来源有 `expiresAt` 出「到期」列（7 天内注意色）；`rowActions(row)` 出行操作（撤销单独减、收回单独加，`RowActionBar`）；`personalOnly` / `onPersonalOnlyChange` 控制「只看单独加减」。
- 个人加减「加什么」：操作（权限码，`setOverride`）/ 数据范围（带范围的码 + 档位）/ 字段（表 · 字段 · 可读 / 可读写）/ 指定记录（搜记录 · 可读 / 可读写）。后三种是 `OverrideTarget`，发 `AccessApi.setTargetOverride(userId, { ...input, target })`（可选方法，quanxian 还没有这条路由时不实现，界面只给「操作」）；指定记录的搜索要 `findRecords(resource, query)`。自己拼页面时用 `OverrideTargetFields` + `draftToTarget`（校验）+ `targetLabel`（列表里的文字）。`AccessConsole` 人员授权的「个人加减」和「有效权限」两个标签页已经接上。
- 服务端必做：编辑人只能给管得着的人加、不能超过自己（「你：成交价 可读写」）；到期自动收回；每次加减写审计。

## 7. 权限按模块组织（演示 A1–A6，starter「系统 → 权限按模块」）

角色页不再是「所有模块 × 所有操作」的大表，而是**每个模块一行：档位 + 能看到的数据 + 细调**。四个纯展示组件（props 进、回调出，不请求），都在 `@adminui/react/access`：

| 组件 | 用在哪 | 要点 |
|---|---|---|
| `ModulePermissionEditor` | 角色页「模块权限」 | 每个模块一行；档位下拉每项带一句说明，授不出的档灰掉写原因、底部写模块没有的档；对不上任何一档显示「自定义」；改过的行打点 + 改动条「改了 N 个模块 · 撤销 · 保存…」；「系统管理」小节；`readOnly` 给集团下发的角色（横幅 +「复制后修改」，「细调」变「查看」）；≤ 760px 每个模块一张卡、细调变全屏面板 |
| `DataScopeSelect` | 「能看到的数据」下拉（编辑器里和细调里都用它） | 五档 + 有部门树时「指定部门…」（`DataScopeDialog`）；`disabledTiers` 写原因；`labels` 改显示名（例：本人 / 部门及下级） |
| `PermissionDiff` | 点「保存…」后的确认弹框 | 按模块列改动（~ / + / −，旧值划掉 → 新值，高危标出）、「影响 N 人」展开每人多了 / 少了 / 为什么不变、数据变了只提醒照样能保存、修改原因默认必填 |
| `EffectiveAccessView` | 「预览 / 诊断」 | 左边选人（窄屏变下拉），右边每个模块 最终档位 · 范围 · 来源标签，「明细」展开 `EffectiveAccessTable` |

### 7.1 数据形状（`src/access/module-core.ts`）

- **档位**全平台统一 5 档：`none / viewer / member_own / member_all / admin`，默认显示名 无 / 只看 / 成员·只看自己的 / 成员·按范围看 / 管理员（模块可在 `ModuleLevel.label` 改）。逐级包含。
- **`ModuleAccessDef`**（宿主由目录转来）：`levels[]`（只列声明了的档；`actions` = 这一档的全部动作键，含低档；`defaultScope`；`grantable: true | 原因`）、`resources[]`（对象：`scoped` 分范围、`actions[]`〔`risk: "high"`、`stepUp`、`minLevel`、`grantable`〕、`fields[]`〔三态，`defaultMode`〕）、`unavailable`（「本公司未开通」「套餐不含」+ 去处）、`scopeNote`（「按空间成员决定」，不给选范围）、`section: "system"`、`tiers / disabledTiers`。
- **`ModuleGrant`**：`level`（null = 自定义，`raw` 是直接给的动作键）· `scope`（null = 档位默认）· `deptIds`（指定部门）· `add`（档位外单独加的）· `mute`（档位里手动去掉的，升级不加回）· `pending`（新版本带来、等确认的高危动作，不算有）· `fields`（`{ read?, write?, export? }`：隐藏 = read false，只读 = write false）。
- 宿主项目对照（示例）：目录 `CatalogModule` → `ModuleAccessDef`（`levels[].codes` 去掉档位后缀 = 动作键，`canGrant=false` → `grantable` 原因，`unavailableReason` → `unavailable`）；`RoleModuleState` → `ModuleGrant`（`source: "raw"` → `level: null, raw`；`add` 是码，转成动作键）；试算 `roleImpact` 的码转成人话放进 `PermissionImpact.people`；诊断 `accessSource.kind` 的 `override_allow / override_deny` → `personal_add / personal_remove`。

### 7.2 规则

- 「成员·只看自己的」范围**固定本人**，不给选；「成员·按范围看」默认全部，可以收窄；选「无」清空细调。
- 换档位：范围回到新档默认；和新档重复的「加」、新档里没有的「去掉」自动丢掉；待确认只留新档里的。
- 新版本带来的高危权限不自动给，在角色细调里逐个「给 / 不给」（不给 = 记成去掉）；「角色与权限」菜单上的数字用 `pendingCount(grants)`。
- 保存前影响名单过期**只提醒、照样能保存**（服务端保存时再算）。
- 手机上能看也能改（全屏细调，每个操作一行 ≥ 48px）。
- 纯函数：`levelOf`（一组动作正好是哪一档，对不上 = `custom`）、`nearestLevel`（「比「只看自己的」多 1 项」）、`normalizeGrant`、`toggleAction` / `resolvePending` / `setLevel` / `resetToLevel` / `setScope` / `setFieldMode`、`grantChips`、`diffModuleGrants` + `changeSummaryText`、`impactSentence`。

```tsx
const changes = diffModuleGrants(modules, saved, draft, { scope: { own: "本人", dept_tree: "部门及下级" } });
<ModulePermissionEditor modules={modules} value={draft} savedValue={saved} onChange={setDraft}
  roleName="销售主管" onDiscard={() => setDraft(saved)} onSave={() => setConfirm(true)} />
<PermissionDiff open={confirm} title="保存「销售主管」的改动" changes={changes} impact={dryRun?.impact}
  stale={stale ? { message: "试算之后有人调了部门", onRecompute: rerun } : null}
  onClose={() => setConfirm(false)} onConfirm={(reason) => save(draft, reason)} />
```

服务端必做：按目录把档位 + 细调编译成码、只允许授出编辑人自己有的、试算 / 保存都再算一遍影响、写审计（带原因）。
