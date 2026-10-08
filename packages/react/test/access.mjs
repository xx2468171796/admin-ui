// 权限管理组件（@adminui/react/access）浏览器验收：starter「系统 → 权限组件」。
// 量真实交互：矩阵勾选 / 改动计数 / 撤销 / 字段行 / 只读；树的键盘、三态、联动开关、搜索、只看已选；
// 数据范围对话框校验；部门选择回显完整路径；按部门找人；有效权限筛选；解释面板（允许 / 未知因 NULL）；
// 协作成员转移负责人要原因；申请批准 / 驳回要原因；复核批量；审计差异隐藏密钥；
// 每个分区 360 / 390 / 1440 整页不横向溢出，深色对比度，桌面 / 手机 / 深色截图。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { checkFlushSection, edges } from './flush-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/access');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const SECTIONS = ['角色矩阵', '勾选树与范围', '部门与人员', '有效权限与解释', '协作成员', '申请与复核', '审计差异', '按人员'];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // React warnings (keys, controlled inputs, act) are console errors too; the starter has no favicon, so its 404 is ignored.
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '权限组件', exact: true }).click();
  const area = page.locator('#aui-page-accessui');
  const tab = name => area.getByRole('tab', { name, exact: true });
  const dialog = () => page.getByRole('dialog');
  await tab('角色矩阵').waitFor();

  // ---- PermissionMatrix
  const matrix = area.locator('.aui-access-matrix').first();
  await matrix.getByRole('table').waitFor();
  assert.match(await matrix.textContent(), /没有未保存的改动/);
  const exportCell = matrix.getByRole('checkbox', { name: '联系人 · 导出', exact: true });
  await exportCell.click();
  assert.match(await matrix.textContent(), /已修改 1 处，未保存/);
  assert.equal(await matrix.locator('td[data-changed]').count(), 1, '改动的格子高亮');
  // Granting a scoped cell adds a scope select with the narrowest tier.
  await matrix.getByRole('checkbox', { name: '商机 · 编辑', exact: true }).click();
  const dealScope = matrix.getByRole('combobox', { name: '商机 · 编辑 的数据范围' });
  assert.equal((await dealScope.textContent()).trim(), '仅本人');
  await dealScope.click();
  assert.equal(await page.getByRole('option', { name: '全部' }).getAttribute('aria-disabled'), 'true', '委派上限：全部不可选');
  await page.getByRole('option', { name: '本部门及以下' }).click();
  assert.equal((await dealScope.textContent()).trim(), '本部门及以下');
  // 指定部门… opens the scope dialog.
  await dealScope.click();
  await page.getByRole('option', { name: '指定部门…' }).click();
  await dialog().waitFor();
  await dialog().getByRole('button', { name: '确定', exact: true }).click();
  assert.match(await dialog().textContent(), /至少选择一个部门/, '指定部门不选不能保存');
  await dialog().getByRole('treeitem', { name: /华南区/ }).click();
  await dialog().getByRole('button', { name: '确定', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.match(await matrix.textContent(), /指定部门：华南区/);
  assert.match(await matrix.textContent(), /已修改 2 处/);
  // Row toggle (tri-state) and field rows.
  const fieldsToggle = matrix.getByRole('button', { name: /^字段（3）/ });
  await fieldsToggle.click();
  assert.equal(await fieldsToggle.getAttribute('aria-expanded'), 'true');
  const phoneWrite = matrix.getByRole('checkbox', { name: '客户 · 联系电话 · 写', exact: true });
  await phoneWrite.click();
  assert.equal(await phoneWrite.getAttribute('data-state'), 'checked');
  assert.equal(await matrix.getByRole('checkbox', { name: '客户 · 联系电话 · 读', exact: true }).getAttribute('data-state'), 'checked', '写依赖读');
  await matrix.getByRole('checkbox', { name: '客户 · 联系电话 · 读', exact: true }).click();
  assert.equal(await phoneWrite.getAttribute('data-state'), 'unchecked', '取消读清空写');
  assert.equal(await matrix.getByRole('checkbox', { name: '客户：全部动作' }).getAttribute('data-state'), 'indeterminate');
  // Group collapse.
  const groupBtn = matrix.getByRole('button', { name: '收起分组「财务」' });
  await groupBtn.click();
  assert.equal(await matrix.getByRole('rowheader', { name: /^发票/ }).count(), 0);
  await matrix.getByRole('button', { name: '展开分组「财务」' }).click();
  await page.screenshot({ path: resolve(output, 'matrix-1440-light.png'), animations: 'disabled' });
  // Save confirmation lists the changes.
  await area.getByRole('button', { name: '保存', exact: true }).click();
  await dialog().waitFor();
  assert.ok(await dialog().locator('.aui-change-list tbody tr').count() >= 2, '确认框列出改动清单');
  await page.screenshot({ path: resolve(output, 'matrix-save-confirm.png'), animations: 'disabled' });
  await dialog().getByRole('button', { name: '取消' }).click();
  await dialog().waitFor({ state: 'hidden' });
  await matrix.getByRole('button', { name: /撤销改动/ }).click();
  assert.match(await matrix.textContent(), /没有未保存的改动/);
  await area.getByRole('button', { name: '只读预览' }).click();
  assert.equal(await matrix.getByRole('checkbox').count(), 0, '只读不出勾选框');
  assert.match(await matrix.textContent(), /只读/);
  await area.getByRole('button', { name: '切回编辑' }).click();

  // ---- CheckableTree
  await tab('勾选树与范围').click();
  const tree = area.getByRole('tree', { name: '菜单权限' });
  await tree.waitFor();
  const item = name => tree.getByRole('treeitem', { name: new RegExp(`^${name}`) });
  assert.equal(await tree.locator('[role=treeitem][tabindex="0"]').count(), 1, '树只有一个 Tab 停靠点');
  assert.equal(await item('客户管理').getAttribute('aria-checked'), 'mixed');
  await item('客户管理').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 2)), '客户');
  await page.keyboard.press('ArrowLeft'); // 客户 is open: collapse it first
  assert.equal(await tree.getByRole('treeitem', { name: '客户', exact: true }).getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowLeft'); // then to the parent
  assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ''), /^客户管理/);
  await page.keyboard.press('ArrowLeft'); // collapse
  assert.equal(await item('客户管理').getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('ArrowRight');
  assert.equal(await item('客户管理').getAttribute('aria-expanded'), 'true');
  await tree.getByRole('treeitem', { name: '客户', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tree.getByRole('treeitem', { name: '客户', exact: true }).getAttribute('aria-expanded'), 'true');
  // Space on 财务: export is disabled → 财务 becomes half; Space again clears.
  await item('财务').focus();
  await page.keyboard.press(' ');
  assert.equal(await item('财务').getAttribute('aria-checked'), 'mixed', '禁用子节点不被联动勾上');
  assert.equal(await item('发票查看').getAttribute('aria-checked'), 'true');
  await page.keyboard.press(' ');
  assert.equal(await item('发票查看').getAttribute('aria-checked'), 'false');
  // Linkage off: parent alone.
  await area.getByRole('switch', { name: '父子联动' }).click();
  await item('系统设置').click();
  assert.equal(await item('系统设置').getAttribute('aria-checked'), 'true');
  assert.equal(await item('角色管理').getAttribute('aria-checked'), 'false', '不联动时子节点不动');
  await area.getByRole('switch', { name: '父子联动' }).click();
  // Search + only selected.
  await area.getByRole('searchbox', { name: '搜索菜单权限' }).fill('shangji');
  assert.deepEqual(await tree.getByRole('treeitem').evaluateAll(n => n.map(e => e.textContent.trim().split(' ')[0])), ['客户管理', '商机', '查看', '编辑'], '搜索命中父节点：祖先 + 命中 + 子节点');
  await area.getByRole('searchbox', { name: '搜索菜单权限' }).fill('');
  await area.getByRole('checkbox', { name: '只看已选' }).click();
  const shown = await tree.getByRole('treeitem').count();
  assert.ok(shown > 0 && shown < 12, `只看已选 ${shown}`);
  await area.getByRole('checkbox', { name: '只看已选' }).click();
  await page.screenshot({ path: resolve(output, 'tree-1440-light.png'), animations: 'disabled' });
  // DataScopeDialog
  await area.getByRole('button', { name: '设置范围' }).click();
  await dialog().waitFor();
  assert.ok(await dialog().getByRole('radio', { name: /^全部/ }).isDisabled(), '超出上限的档不可选');
  await dialog().getByRole('radio', { name: /^本人及下属/ }).check();
  await dialog().getByRole('checkbox', { name: '同时包含没有部门或负责人的记录' }).click();
  await page.screenshot({ path: resolve(output, 'scope-dialog-1440.png'), animations: 'disabled' });
  await dialog().getByRole('button', { name: '确定', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#aui-page-accessui')?.textContent?.includes('当前：本人及下属 + 无部门的记录'));

  // ---- OrgTreePicker / UserTransfer
  await tab('部门与人员').click();
  assert.match(await area.locator('.aui-access-picker').first().textContent(), /Acme 总部 \/ 销售中心 \/ 华东区 \/ 上海一组/, '单选回显完整路径');
  await area.getByRole('button', { name: '所属部门（单选） 更改部门' }).click();
  await dialog().waitFor();
  assert.equal(await dialog().getByRole('treeitem', { name: /^Acme 总部/ }).getAttribute('aria-disabled'), 'true', '根节点不可选');
  await dialog().getByRole('treeitem', { name: /^客户成功部/ }).click();
  await dialog().getByRole('button', { name: '确定', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.match(await area.locator('.aui-access-picker').first().textContent(), /Acme 总部 \/ 客户成功部/);
  await area.getByRole('button', { name: '移除 Acme 总部 / 客户成功部' }).click();
  const transfer = area.getByRole('group', { name: '选择成员' });
  await transfer.getByRole('treeitem', { name: /^华东区/ }).click();
  const names = await transfer.getByRole('region', { name: '候选成员' }).locator('.aui-access-person-text > span:first-child').allTextContents();
  assert.deepEqual(names, ['陈晓', '周敏', '吴桐'], `按部门（含下级）筛选 ${names}`);
  await transfer.getByRole('checkbox', { name: /^周敏/ }).click();
  assert.match(await transfer.getByRole('region', { name: '已选成员' }).textContent(), /周敏/);
  await page.screenshot({ path: resolve(output, 'org-1440-light.png'), animations: 'disabled' });

  // ---- EffectiveAccessTable / ExplainPanel
  await tab('有效权限与解释').click();
  const eff = area.locator('.aui-access-effective');
  await eff.getByRole('table').waitFor();
  await eff.getByRole('button', { name: /^拒绝/ }).click();
  const deniedRows = await eff.locator('tbody tr').count();
  assert.ok(deniedRows >= 4, `拒绝 ${deniedRows}`);
  await eff.getByRole('checkbox', { name: '只看被拦截的' }).click();
  assert.ok((await eff.locator('tbody tr').count()) < deniedRows, '只看被拦截的去掉「未授予」');
  await eff.getByRole('button', { name: /^全部/ }).click();
  await eff.getByRole('checkbox', { name: '只看被拦截的' }).click();
  await eff.getByRole('searchbox', { name: '搜索权限' }).fill('商机');
  await eff.getByRole('button', { name: /^展开 查看商机/ }).click();
  assert.match(await eff.textContent(), /商机 D-1024 的编辑者/);
  await eff.getByRole('searchbox', { name: '搜索权限' }).fill('');
  const explain = area.locator('.aui-access-explain');
  await explain.getByRole('button', { name: '评估' }).click();
  await explain.locator('.aui-access-explain-result').waitFor();
  assert.match(await explain.textContent(), /陈晓：允许/);
  await explain.getByPlaceholder('留空 = 列表级（看过滤条件）').fill('C-NULL');
  assert.match(await explain.textContent(), /条件已改动/, '改了条件提示结果过期');
  await explain.getByRole('button', { name: '评估' }).click();
  await page.waitForFunction(() => document.querySelector('.aui-access-explain')?.textContent?.includes('有字段为空'));
  assert.match(await explain.textContent(), /负责人（owner_id）/);
  assert.match(await explain.textContent(), /未知按拒绝处理/);
  await page.screenshot({ path: resolve(output, 'explain-1440-light.png'), animations: 'disabled', fullPage: true });

  // ---- RecordTeamPanel
  await tab('协作成员').click();
  const team = area.locator('.aui-access-team');
  await team.getByRole('table').waitFor();
  assert.match(await team.locator('tbody tr').first().textContent(), /陈晓.*负责人/);
  assert.match(await team.textContent(), /已到期/);
  await team.getByRole('button', { name: /转移负责人/ }).click();
  await dialog().waitFor();
  await dialog().getByRole('combobox', { name: '新负责人' }).click();
  await page.getByRole('option', { name: /^周敏/ }).click();
  await dialog().getByRole('button', { name: '确认转移' }).click();
  assert.match(await dialog().textContent(), /请填写转移原因/);
  await dialog().getByRole('textbox', { name: /原因/ }).fill('陈晓调岗');
  await dialog().getByRole('button', { name: '确认转移' }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.match(await team.locator('tbody tr').first().textContent(), /周敏.*负责人/);
  assert.match(await team.textContent(), /陈晓.*编辑者/);
  await page.screenshot({ path: resolve(output, 'team-1440-light.png'), animations: 'disabled' });

  // ---- AccessRequestList / ReviewList
  await tab('申请与复核').click();
  const reqs = area.locator('.aui-access-requests');
  const firstPending = reqs.locator('tbody tr', { hasText: '财务只读' });
  await firstPending.getByRole('button', { name: '驳回' }).click();
  await dialog().waitFor();
  await dialog().getByRole('button', { name: '驳回', exact: true }).click();
  assert.equal(await dialog().getByRole('textbox', { name: /驳回原因/ }).getAttribute('aria-invalid'), 'true', '驳回要填原因');
  assert.match(await reqs.locator('tbody tr', { hasText: '财务只读' }).textContent(), /待审批/, '没填原因不提交');
  await dialog().getByRole('button', { name: '取消' }).click();
  await firstPending.getByRole('button', { name: '批准' }).click();
  await dialog().waitFor();
  await dialog().getByRole('button', { name: '7 天' }).click();
  await dialog().getByRole('button', { name: '批准', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  assert.match(await firstPending.textContent(), /第 2 \/ 2 级/, '多级审批进到下一级');
  const review = area.locator('.aui-access-review');
  await review.getByRole('checkbox', { name: /选择全部|全选/ }).first().click().catch(() => undefined);
  const rv = review.locator('tbody tr', { hasText: '吴桐' });
  await rv.getByRole('button', { name: '保留' }).click();
  await page.waitForFunction(() => document.querySelector('.aui-access-review')?.textContent?.includes('已处理 3 / 5'));
  await page.screenshot({ path: resolve(output, 'requests-1440-light.png'), animations: 'disabled', fullPage: true });

  // ---- AuditDiff
  await tab('审计差异').click();
  const diff = area.locator('.aui-access-diff');
  await diff.getByRole('table').waitFor();
  const tokenRow = diff.locator('tbody tr', { hasText: 'webhookToken' });
  assert.equal(await tokenRow.locator('text=（已隐藏）').count(), 2, '密钥前后都隐藏');
  assert.ok(!(await diff.textContent()).includes('tok_live'), '密钥明文不出现');
  assert.match(await diff.textContent(), /成员\[id=u3\]\.level/);
  await diff.getByRole('button', { name: '前后对照' }).click();
  assert.ok(!(await diff.textContent()).includes('tok_live'), '前后对照里也隐藏');
  await page.screenshot({ path: resolve(output, 'audit-1440-light.png'), animations: 'disabled' });
  await diff.getByRole('button', { name: /^改动清单/ }).click();

  // ---- P4 按人员（D15）: profile stat strip, categories / new source kinds / expiry / row actions, targeted override form
  await tab('按人员').click();
  const person = area.locator('.aui-access-effective:visible');
  await person.getByRole('table').waitFor();
  const stats = area.getByRole('list', { name: '小王的权限构成' });
  assert.deepEqual(await stats.locator('li').allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, ' '))), ['1 角色', '1 单独加', '1 单独减', '1 共享记录']);
  assert.match(await person.locator('thead').first().innerText(), /类别[\s\S]*到期[\s\S]*操作/);
  assert.match(await person.innerText(), /共享记录：阿杰共享的/);
  assert.match(await person.innerText(), /字段默认：字段默认不可见/);
  assert.match(await person.innerText(), /跟随上级记录：跟随父记录「客户」/);
  assert.equal(await person.locator('tbody tr:not(.aui-table-expanded)').count(), 9);
  await stats.getByRole('button', { name: '单独减 1' }).click();
  assert.equal(await person.locator('tbody tr:not(.aui-table-expanded)').count(), 2, '点单独加减只看那两行');
  assert.equal(await person.getByRole('checkbox', { name: '只看单独加减' }).getAttribute('aria-checked'), 'true');
  assert.equal(await person.getByRole('button', { name: '撤销' }).count(), 1);
  assert.equal(await person.getByRole('button', { name: '收回' }).count(), 1);
  await stats.getByRole('button', { name: '单独减 1' }).click();
  assert.equal(await person.locator('tbody tr:not(.aui-table-expanded)').count(), 9);
  await area.getByRole('button', { name: '单独加权限' }).click();
  await dialog().waitFor();
  const what = dialog().getByRole('group', { name: '加什么' });
  assert.deepEqual(await what.getByRole('button').allInnerTexts(), ['操作', '数据范围', '字段', '指定记录']);
  assert.equal(await what.getByRole('button', { name: '字段' }).getAttribute('aria-pressed'), 'true');
  await what.getByRole('button', { name: '字段' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.equal(await what.getByRole('button', { name: '指定记录' }).getAttribute('aria-pressed'), 'true', '方向键 + 回车换目标');
  await dialog().getByRole('combobox', { name: '表' }).click();
  await page.getByRole('option', { name: '客户' }).click();
  await dialog().getByRole('searchbox', { name: '记录' }).fill('张家');
  await dialog().getByRole('combobox', { name: '选中的记录' }).click();
  await page.getByRole('option', { name: /张家豪/ }).click();
  await dialog().getByRole('button', { name: '加上' }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.getByText('已加：指定记录 · 张家豪（徐汇区别墅） · 可读（演示）').waitFor();

  // ---- Every section: 1440 / 390 / 360 no page-level horizontal overflow; mobile screenshots
  for (const width of [390, 360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of SECTIONS) {
      await tab(name).click();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 0, `${width}px「${name}」整页横向溢出 ${overflow}px`);
      if (width === 390) await page.screenshot({ path: resolve(output, `${SECTIONS.indexOf(name) + 1}-${name}-390-light.png`), animations: 'disabled', fullPage: true });
    }
  }

  // ---- Dark mode: contrast + screenshots
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.mouse.move(0, 0);
  const contrastOf = selectors => page.evaluate(sels => {
    const rgb = s => { const n = (s.match(/[\d.]+/g) || []).map(Number); return s.startsWith('color(srgb') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bg = el => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return [255, 255, 255]; };
    const ratio = el => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const out = {};
    for (const sel of sels) {
      const els = [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().width > 2 && el.textContent.trim()).slice(0, 8);
      out[sel] = els.length ? Math.min(...els.map(ratio)) : null;
    }
    return out;
  }, selectors);
  const checks = {
    角色矩阵: ['.aui-access-resource-name', '.aui-access-matrix-table thead th', '.aui-access-group-name', '.aui-access-scope-extra', '.aui-access-col-hint'],
    勾选树与范围: ['.aui-access-tree-label', '.aui-access-hint', '.aui-access-tree-count'],
    部门与人员: ['.aui-access-chip-text', '.aui-access-person-text span', '.aui-access-transfer-head strong'],
    有效权限与解释: ['.aui-access-step-text > span', '.aui-access-explain-label'],
    审计差异: ['.aui-access-diff-table th[scope=row]', '.aui-access-diff-table code'],
    按人员: ['.aui-access-profile-stat span', '.aui-access-profile-meta', '.aui-access-category', '.aui-access-profile-tag'],
  };
  for (const [name, sels] of Object.entries(checks)) {
    await tab(name).click();
    await page.waitForTimeout(150);
    if (name === '有效权限与解释') await area.locator('.aui-access-explain').getByRole('button', { name: '评估' }).click();
    await page.waitForTimeout(400);
    const values = await contrastOf(sels);
    for (const [sel, value] of Object.entries(values)) assert.ok(value === null || value >= 4.5, `深色「${name}」${sel} 对比度 ${value?.toFixed(2)}`);
    await page.screenshot({ path: resolve(output, `${SECTIONS.indexOf(name) + 1}-${name}-1440-dark.png`), animations: 'disabled', fullPage: true });
  }
  // Selected tier card + tree highlight in dark.
  await tab('勾选树与范围').click();
  await area.getByRole('button', { name: '设置范围' }).click();
  await dialog().waitFor();
  const tierContrast = await contrastOf(['.aui-access-tier[data-checked] strong', '.aui-access-tier .aui-note']);
  for (const [sel, value] of Object.entries(tierContrast)) assert.ok(value === null || value >= 4.5, `深色 ${sel} 对比度 ${value?.toFixed(2)}`);
  await page.screenshot({ path: resolve(output, 'scope-dialog-1440-dark.png'), animations: 'disabled' });
  await dialog().getByRole('button', { name: '关闭弹窗' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await tab('角色矩阵').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(output, '1-角色矩阵-390-dark.png'), animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click().catch(() => undefined);

  // bt/flush: AccessProfileHeader + EffectiveAccessTable straight in a workspace Pane: no frame, inner padding 16px (12 on
  // phones) on the profile and the filter row, the table flat against the pane edges.
  await checkFlushSection(browser, server.resolvedUrls.local[0], '有效权限', output, 'effective', async (p, area, { width, label }) => {
    const pane = area.locator('.aui-tabbed-panel:not([hidden]) .aui-pane[aria-label="有效权限"]');
    const box = await edges(pane);
    const inset = width > 760 ? 16 : 12;
    const profile = await edges(pane.locator('.aui-access-profile'));
    assert.ok(profile.x === box.ix && profile.right === box.iright && profile.radius === 0 && profile.bl === 0, `${label}：人员权限构成条贴边、没有外框（${JSON.stringify(profile)}）`);
    assert.equal(profile.pl, inset, `${label}：构成条内边距 ${inset}px`);
    assert.equal((await edges(pane.locator('.aui-access-profile > .aui-avatar'))).x - box.ix, inset, `${label}：头像离栏边 ${inset}px`);
    const filters = await edges(pane.locator('.aui-access-effective > .aui-access-filters'));
    assert.ok(filters.pl === inset && filters.bb === 1, `${label}：筛选行留 ${inset}px、下面一条线`);
    const table = await edges(pane.locator('.aui-access-effective > .aui-table-panel'));
    assert.ok(table.x === box.ix && table.right === box.iright && table.radius === 0 && table.bl === 0, `${label}：有效权限表贴着栏边`);
  });

  assert.deepEqual(errors, []);
  console.log(`PASS access: matrix diff/undo/scope/fields/read-only, tree keyboard/tri-state/linkage/search, scope dialog validation, org full path, user transfer by dept, effective filters, explain unknown-NULL, team transfer, request approve/reject, review, audit secrets hidden, 360/390/1440, dark contrast, profile + effective table flush in a workspace Pane (${output})`);
} finally {
  await browser.close();
  await server.close();
}
