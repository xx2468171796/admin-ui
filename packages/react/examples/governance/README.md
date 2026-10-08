# SQLite 权限与审计服务模块

`sqlite-store.mjs` 是不依赖 React 的服务端参考实现，使用 Node 内建 `node:sqlite`（Node ≥26）。不新增第二个后台服务，不内置账号密码、不开放网络端口；接到既有服务即可。

```js
import { openGovernanceStore } from './sqlite-store.mjs';
const store = openGovernanceStore('/persistent/admin.sqlite', {
  bootstrapActor: 'existing-admin-user-id',
  permissions: [
    { id: 'access:manage', label: '管理授权', group: '系统' },
    { id: 'audit:read', label: '查看审计', group: '系统' },
    { id: 'audit:export', label: '导出审计', group: '系统' },
  ],
});
// 在已完成会话认证、CSRF、租户校验的宿主路由内：
// store.load(session.userId)
// store.saveRole(session.userId, validatedRole)
// store.assignRoles(session.userId, validatedMember)
// store.list(session.userId, validatedQuery)
// store.exportPage(session.userId, validatedQuery)
```

不得把 request.body.actor 或浏览器角色选择作为第一个参数。`bootstrapActor` 仅由部署配置提供，数据库已有状态时不会重新赋权。`addMember` 由现有账号供应流程调用，只建成员映射、不创建账号；新成员默认无角色。管理授权是本例的全域管理员能力；需要部门/租户/可授予范围的业务必须扩展政策后才接入。

保存使用 BEGIN IMMEDIATE，授权在事务内重新读取；只采用白名单字段，拒绝未知权限/角色、重复名称、版本冲突、删除已分配角色及移除最后管理员。成功日志与角色修改同事务，失败回滚后追加失败/拒绝日志。只提供读取和授权导出日志，没有编辑/删除接口。此例是单租户；每租户数据库由可信服务配置选择，不能从请求路径拼文件名。动态权限目录迁移、数据规模治理、日志保留/备份/防篡改归宿主。

`load` 返回完整授权快照，适用于小型后台。大型组织应把成员检索分页做成业务页面，不能全量传输组织身份资料。SQLite 文件放持久可写目录，不允许静态文件服务访问。备份用 SQLite 在线备份能力，不能只复制启用 WAL 的主文件。

根目录 `npm run check` 包含此例的真实 SQLite 测试：允许与拒绝、版本冲突、回滚后记录、最后管理员保护、过滤/分页/授权导出、关闭重开持久化。页面与 adapter 合同见 [ACCESS.md](../../ACCESS.md)。
