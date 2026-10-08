/** Server-only reference adapter. Actor IDs MUST come from verified host sessions. */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export function openGovernanceStore(filename, { permissions, bootstrapActor }) {
  if (!bootstrapActor || !permissions.some(p => p.id === 'access:manage') || !permissions.some(p => p.id === 'audit:read')) throw Error('Invalid bootstrap configuration');
  const ids = new Set(permissions.map(p => p.id));
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS access_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, result TEXT NOT NULL, at TEXT NOT NULL, record TEXT NOT NULL);');
  db.prepare('INSERT OR IGNORE INTO access_state VALUES (1, ?)').run(JSON.stringify({ roles: [{ id: 'admin', name: '管理员', permissions: [...ids], protected: true, version: '1' }], members: [{ id: bootstrapActor, name: bootstrapActor, roleIds: ['admin'], version: '1' }] }));
  const snapshot = () => JSON.parse(db.prepare('SELECT value FROM access_state WHERE id=1').get().value);
  const effective = (state, actor) => {
    const member = state.members.find(m => m.id === actor);
    return state.roles.filter(r => member?.roleIds.includes(r.id)).flatMap(r => r.permissions);
  };
  const append = (actor, action, target, result, changes) => {
    const record = { actor, action, target, result, changes, at: new Date().toISOString(), requestId: randomUUID(), source: 'server' };
    db.prepare('INSERT INTO audit(actor,action,target,result,at,record) VALUES(?,?,?,?,?,?)').run(actor, action, target, result, record.at, JSON.stringify(record));
  };
  const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
  const requirePermission = (actor, permission) => {
    if (typeof actor !== 'string' || !actor) fail('未登录', 401);
    if (!effective(snapshot(), actor).includes(permission)) fail('权限不足', 403);
  };
  const execute = (actor, permission, action, target, work) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      requirePermission(actor, permission);
      const state = snapshot();
      const changes = work(state);
      if (!state.members.some(m => effective(state, m.id).includes('access:manage'))) fail('不能移除最后一个管理员');
      db.prepare('UPDATE access_state SET value=? WHERE id=1').run(JSON.stringify(state));
      append(actor, action, target, 'success', changes);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      append(typeof actor === 'string' ? actor : 'anonymous', action, target, error.status === 403 || error.status === 401 ? 'denied' : 'failed');
      throw error;
    }
  };
  const version = (record, submitted) => { if (!record || record.version !== submitted.version) fail('版本冲突，请刷新', 409); };
  const validateIds = (values, allowed) => { if (!Array.isArray(values) || values.length > allowed.size || values.some(v => !allowed.has(v)) || new Set(values).size !== values.length) fail('未知或重复授权'); };
  const validateQuery = query => {
    if (!Number.isSafeInteger(query.page) || query.page < 1 || !Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) fail('分页范围错误');
    if (!['', 'success', 'denied', 'failed'].includes(query.result) || typeof query.search !== 'string' || query.search.length > 200) fail('筛选错误');
    for (const date of [query.from, query.until]) if (typeof date !== 'string' || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))) fail('日期错误');
    if (query.from && query.until && query.from > query.until) fail('日期倒序');
  };
  const queryRows = query => {
    validateQuery(query);
    const clauses = [], args = [];
    if (query.search) { clauses.push("instr(lower(actor || ' ' || action || ' ' || target || ' ' || record), lower(?)) > 0"); args.push(query.search); }
    if (query.result) { clauses.push('result=?'); args.push(query.result); }
    if (query.from) { clauses.push('at>=?'); args.push(`${query.from}T00:00:00.000Z`); }
    if (query.until) { clauses.push('at<=?'); args.push(`${query.until}T23:59:59.999Z`); }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const total = db.prepare(`SELECT count(*) AS total FROM audit${where}`).get(...args).total;
    const rows = db.prepare(`SELECT id,record FROM audit${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, query.pageSize, (query.page - 1) * query.pageSize).map(row => ({ ...JSON.parse(row.record), id: String(row.id) }));
    return { rows, total };
  };
  return {
    load(actor) { requirePermission(actor, 'access:manage'); return { ...snapshot(), permissions }; },
    saveRole(actor, role) { execute(actor, 'access:manage', 'access:save-role', String(role.id ?? ''), state => {
      if (typeof role.name !== 'string' || !role.name.trim() || role.name.length > 80) fail('角色名称错误');
      validateIds(role.permissions, ids);
      const old = state.roles.find(r => r.id === role.id);
      if (role.id) version(old, role);
      if (old?.protected) fail('角色受保护');
      if (state.roles.some(r => r.id !== role.id && r.name === role.name.trim())) fail('角色名称重复');
      const next = { id: old?.id ?? randomUUID(), name: role.name.trim(), permissions: role.permissions, version: String(Number(old?.version ?? 0) + 1), protected: false };
      state.roles = old ? state.roles.map(r => r.id === old.id ? next : r) : [...state.roles, next];
      return [{ field: 'role', before: JSON.stringify(old ?? null), after: JSON.stringify(next) }];
    }); },
    deleteRole(actor, role) { execute(actor, 'access:manage', 'access:delete-role', String(role.id), state => {
      const old = state.roles.find(r => r.id === role.id); version(old, role);
      if (old.protected || state.members.some(m => m.roleIds.includes(old.id))) fail('角色受保护或已分配');
      state.roles = state.roles.filter(r => r.id !== old.id);
      return [{ field: 'role', before: JSON.stringify(old), after: 'null' }];
    }); },
    assignRoles(actor, member) { execute(actor, 'access:manage', 'access:assign', String(member.id), state => {
      const old = state.members.find(m => m.id === member.id); version(old, member);
      validateIds(member.roleIds, new Set(state.roles.map(r => r.id)));
      state.members = state.members.map(m => m.id === old.id ? { ...m, roleIds: member.roleIds, version: String(Number(m.version) + 1) } : m);
      return [{ field: 'roles', before: old.roleIds.join(','), after: member.roleIds.join(',') }];
    }); },
    /** Host identity provisioning: never expose this as an unauthenticated route. */
    addMember(actor, { id, name }) { execute(actor, 'access:manage', 'access:add-member', String(id), state => {
      if (typeof id !== 'string' || !id || id.length > 200 || typeof name !== 'string' || !name || name.length > 80 || state.members.some(m => m.id === id)) fail('成员不存在于合法输入或重复');
      state.members.push({ id, name, roleIds: [], version: '1' });
      return [{ field: 'member', before: 'null', after: id }];
    }); },
    list(actor, query) {
      try { requirePermission(actor, 'audit:read'); }
      catch (error) { append(typeof actor === 'string' ? actor : 'anonymous', 'audit:read', '', 'denied'); throw error; }
      db.exec('BEGIN'); try { const result = queryRows(query); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    exportPage(actor, query) {
      let rows;
      execute(actor, 'audit:export', 'audit:export', 'current-page', () => { requirePermission(actor, 'audit:read'); rows = queryRows(query).rows; return [{ field: 'count', before: '', after: String(rows.length) }]; });
      return rows;
    },
    close() { db.close(); },
  };
}
