import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { effectivePermissions, hasAdminPermission } from '../src/governance-core.ts';
// @ts-ignore JavaScript server reference is intentionally shipped without React dependencies.
import { openGovernanceStore } from '../examples/governance/sqlite-store.mjs';

test('permission union is exact, unknown roles and wildcards grant nothing', () => {
  const roles = [{ id: 'read', name: 'read', version: '1', permissions: ['audit:read'] }];
  assert.deepEqual(effectivePermissions({ id: 'a', name: 'a', version: '1', roleIds: ['read', 'missing'] }, roles), ['audit:read']);
  assert.equal(hasAdminPermission(['*', 'audit:read'], 'access:manage'), false);
  assert.equal(hasAdminPermission(['audit:read'], 'audit:read'), true);
});
test('SQLite authorization, versions, atomic audit, last administrator, export and restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adminui-governance-'));
  const config = { permissions: ['access:manage', 'audit:read', 'audit:export'].map(id => ({ id, label: id, group: 'system' })), bootstrapActor: 'root' };
  let store = openGovernanceStore(join(dir, 'state.sqlite'), config);
  const query = { search: '', result: '', from: '', until: '', page: 1, pageSize: 100 };
  try {
    store.addMember('root', { id: 'reader', name: 'Reader' });
    assert.throws(() => store.saveRole('reader', { id: '', name: 'Escalation', permissions: ['access:manage'], version: '' }), /权限不足/);
    assert.throws(() => store.load('reader'), /权限不足/);
    store.saveRole('root', { id: '', name: 'Reader', permissions: ['audit:read'], version: '' });
    let data = store.load('root');
    const role = data.roles.find((r: any) => r.name === 'Reader');
    store.assignRoles('root', { ...data.members.find((m: any) => m.id === 'reader'), roleIds: [role.id] });
    assert.ok(store.list('reader', query).total >= 3);
    assert.throws(() => store.exportPage('reader', query), /权限不足/);
    assert.throws(() => store.deleteRole('root', role), /已分配/);
    assert.throws(() => store.assignRoles('root', { ...data.members[0], roleIds: [] }), /最后一个管理员/);
    assert.deepEqual(store.load('root').members[0].roleIds, ['admin']);
    store.saveRole('root', { ...role, name: 'Reader renamed' });
    assert.throws(() => store.saveRole('root', role), /版本冲突/);
    assert.throws(() => store.saveRole('root', { id: '', name: 'Unknown', version: '', permissions: ['*'] }), /未知/);
    assert.equal(store.load('root').roles.length, 2);
    const fault = new DatabaseSync(join(dir, 'state.sqlite'));
    try {
      fault.exec("CREATE TRIGGER reject_success BEFORE INSERT ON audit WHEN NEW.result='success' BEGIN SELECT RAISE(ABORT, 'audit storage unavailable'); END");
      assert.throws(() => store.saveRole('root', { id: '', name: 'Must rollback', version: '', permissions: [] }), /audit storage unavailable/);
      assert.equal(store.load('root').roles.length, 2, 'audit failure must roll back the role mutation');
      fault.exec('DROP TRIGGER reject_success');
    } finally { fault.close(); }
    const failures = store.list('root', { ...query, result: 'denied' });
    assert.equal(failures.total, 2);
    assert.ok(failures.rows.every((r: any) => r.actor === 'reader' && r.result === 'denied'));
    const page = store.list('root', { ...query, pageSize: 2 });
    const next = store.list('root', { ...query, pageSize: 2, page: 2 });
    assert.equal(page.rows.length, 2); assert.notEqual(page.rows[1].id, next.rows[0].id);
    assert.equal(store.list('root', { ...query, search: "' OR 1=1 --" }).total, 0);
    assert.throws(() => store.list('root', { ...query, pageSize: 101 }), /分页/);
    assert.throws(() => store.list('root', { ...query, from: '2026-02-30' }), /日期/);
    const exported = store.exportPage('root', { ...query, pageSize: 2 });
    assert.equal(exported.length, 2);
    const before = store.list('root', query);
    assert.equal(before.rows[0].action, 'audit:export');
    store.close(); store = openGovernanceStore(join(dir, 'state.sqlite'), config);
    assert.deepEqual(store.list('root', query), before);
    assert.equal(store.load('root').roles.find((r: any) => r.id === role.id).name, 'Reader renamed');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
