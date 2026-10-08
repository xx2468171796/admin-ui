// 权限治理页（@adminui/react/access 的 governance，大档 W4）浏览器验收：starter「系统 → 权限治理」（内存假服务端）。
// 量真实交互：共享规则 改条件 → 预览影响 → 改动后保存变灰 → 重新预览 → 保存；内置收窄规则只读；
// 申请 驳回必须写原因 / 批准进到下一级 / 审批链详情；紧急提权 原因少于 10 字和监督人校验 → 开始 → 倒计时在走 → 立即结束；
// 监督人复核看操作记录、标异常必须写意见；复核 保留 / 收回要原因；成员移出要原因；租户删除要输入编号；
// 普通成员视角只读；每个分区 360 / 390 / 1440 整页不横向溢出；深色对比度；桌面 / 手机 / 深色截图。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/access-governance');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const SECTIONS = ['租户成员', '权限申请', '紧急提权', '权限复核', '共享规则', '收窄规则', '职责分离', '审批流程', '安全体检', '租户', '套餐', '平台体检'];
// RowActionBar：放得下的操作直接露出，其余在「…的更多操作」菜单里——两处都找。
const rowAction = async (page, row, name) => {
  const inline = row.getByRole('button', { name, exact: true });
  if (await inline.count()) return inline.click();
  await row.getByRole('button', { name: /更多操作/ }).click();
  await page.getByRole('menuitem', { name }).click();
};
const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled', fullPage });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '权限治理', exact: true }).click();
  const area = page.locator('#aui-page-accessgov');
  const tab = name => area.getByRole('tab', { name, exact: true });
  const panel = () => area.locator('.aui-tabbed-panel:not([hidden])');
  const dialog = () => page.getByRole('dialog');
  await tab('租户成员').waitFor();
  assert.deepEqual(await area.getByRole('tab').allTextContents(), SECTIONS, '治理管理员能看到全部分区');

  // ---- 租户成员：配额、移出要原因
  await panel().getByRole('table', { name: '租户成员' }).waitFor();
  assert.match(await panel().textContent(), /成员数/);
  assert.match(await panel().textContent(), /有配额快用完了|有配额已用满/);
  await shot(page, '01-members-1440-light');
  const row = panel().locator('tbody tr', { hasText: '林宁' });
  // 邀请人显示姓名（服务端给的是用户编号 u8，页面用 users 换成名字）
  assert.match(await row.textContent(), /邀请人 郑凯/, '邀请人显示姓名');
  assert.doesNotMatch(await panel().locator('tbody').textContent(), /邀请人 u\d/, '邀请人不显示用户编号');
  await row.getByRole('button', { name: '林宁的更多操作' }).click();
  await page.getByRole('menuitem', { name: '移出租户' }).click();
  await dialog().getByRole('button', { name: '移出', exact: true }).click();
  assert.equal(await dialog().getByRole('textbox', { name: /移出原因/ }).getAttribute('aria-invalid'), 'true', '移出要填原因');
  await dialog().getByRole('textbox', { name: /移出原因/ }).fill('转岗到分公司');
  await dialog().getByRole('button', { name: '移出', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden])')?.textContent?.includes('已把 林宁 移出租户'));
  await panel().locator('tbody tr', { hasText: '林宁' }).waitFor({ state: 'detached' });
  // 添加成员：宿主给了 orgSource → 「成员」是组织选人（搜姓名带路径；现有成员灰着），不再手填用户编号
  await panel().getByRole('button', { name: '添加成员' }).click();
  await dialog().waitFor();
  assert.equal(await dialog().getByPlaceholder('用户编号').count(), 0, '不再让人手填用户编号');
  const who = dialog().getByRole('combobox', { name: '搜索姓名，或从组织架构里选' });
  await who.waitFor();
  await who.fill('许雅');
  await page.getByRole('option', { name: /许雅婷/ }).dispatchEvent('mousedown');
  await dialog().locator('.aui-orgp-chip', { hasText: '许雅婷' }).waitFor();
  await dialog().getByRole('button', { name: '添加', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await panel().locator('tbody tr', { hasText: '许雅婷' }).waitFor();

  // ---- 共享规则：编辑 → 预览 → 改动后保存不可用 → 重新预览 → 保存
  await tab('共享规则').click();
  await panel().getByRole('table', { name: '共享规则列表' }).waitFor();
  // 最后修改人显示姓名（服务端给的是用户编号 u1）
  const eastRule = await panel().locator('tbody tr', { hasText: '华东大客户共享给客户成功部' }).textContent();
  assert.match(eastRule, /陈晓/, '共享规则最后修改人显示姓名');
  assert.doesNotMatch(eastRule, /u1/, '共享规则最后修改人不显示用户编号');
  await panel().locator('tbody tr', { hasText: 'VIP 客户共享给 VIP 服务组' }).getByRole('button', { name: '编辑' }).click();
  await dialog().waitFor();
  const save = dialog().getByRole('button', { name: '保存', exact: true });
  assert.ok(await save.isDisabled(), '没预览不能保存');
  await dialog().getByRole('combobox', { name: /^条件 1 · 值/ }).click(); // bt/builders-a：有选项的字段用紧凑的选值框（D13）
  await page.getByRole('option', { name: '已冻结' }).click();
  assert.ok(await save.isDisabled(), '改了也要先预览');
  await dialog().getByRole('button', { name: '添加条件', exact: true }).click(); // bt/builders-a：多了「添加条件组」
  await dialog().getByRole('button', { name: '预览影响' }).click();
  assert.match(await dialog().textContent(), /请填写值/, '空值不能预览');
  await dialog().getByRole('combobox', { name: '条件 2 · 字段' }).click();
  await page.getByRole('option', { name: '年合同额（万元）' }).click();
  await dialog().getByRole('combobox', { name: '条件 2 · 运算' }).click();
  await page.getByRole('option', { name: '大于等于' }).click();
  await dialog().getByRole('textbox', { name: '条件 2 · 值', exact: true }).fill('100');
  await dialog().getByRole('button', { name: '预览影响' }).click();
  await dialog().locator('.aui-gov-impact').waitFor();
  assert.match(await dialog().locator('.aui-gov-impact').textContent(), /人会(多|少)看到 \d+ 条|没有人受影响/);
  assert.ok(await save.isEnabled(), '预览后可以保存');
  await shot(page, '02-share-preview-1440-light');
  await dialog().getByRole('textbox', { name: '条件 2 · 值', exact: true }).fill('200');
  assert.ok(await save.isDisabled(), '预览后又改动：保存变灰');
  assert.match(await dialog().textContent(), /条件已改动/);
  await dialog().getByRole('button', { name: '预览影响' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === '保存')?.disabled);
  await save.click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden])')?.textContent?.includes('已冻结 且 年合同额（万元） 大于等于 「200」'));
  // 关闭有改动的编辑器要确认
  await panel().getByRole('button', { name: '新建规则' }).click();
  await dialog().getByRole('textbox', { name: /规则名称/ }).fill('临时');
  await page.keyboard.press('Escape');
  assert.match(await dialog().textContent(), /放弃未保存的修改/);
  await dialog().getByRole('button', { name: '放弃修改' }).click();
  await dialog().waitFor({ state: 'hidden' });

  // ---- 收窄规则：内置只读
  await tab('收窄规则').click();
  const builtin = panel().locator('tbody tr', { hasText: '已冻结的客户不能改' });
  await builtin.waitFor();
  assert.match(await builtin.textContent(), /内置/);
  const exportRule = await panel().locator('tbody tr', { hasText: '不能导出别人负责的客户' }).textContent();
  assert.match(exportRule, /郑凯/, '收窄规则最后修改人显示姓名');
  assert.doesNotMatch(exportRule, /u8/, '收窄规则最后修改人不显示用户编号');
  await builtin.getByRole('button', { name: '查看' }).click();
  await dialog().waitFor();
  assert.match(await dialog().textContent(), /内置规则写在代码里/);
  assert.equal(await dialog().getByRole('button', { name: '预览影响' }).count(), 0, '内置规则不能改');
  await dialog().getByRole('button', { name: '关闭', exact: true }).click();

  // ---- 职责分离：违规名单
  await tab('职责分离').click();
  await panel().getByRole('table', { name: '当前违反职责分离的人' }).waitFor();
  assert.match(await panel().textContent(), /孙悦/);

  // ---- 权限申请：驳回要原因、批准进到下一级、详情看审批链
  await tab('权限申请').click();
  const todo = panel().getByRole('table', { name: '权限申请' });
  await todo.waitFor();
  const r2 = todo.locator('tbody tr', { hasText: '周敏' });
  await r2.getByRole('button', { name: '驳回' }).click();
  await dialog().getByRole('button', { name: '驳回', exact: true }).click();
  assert.equal(await dialog().getByRole('textbox', { name: /驳回原因/ }).getAttribute('aria-invalid'), 'true', '驳回要填原因');
  await dialog().getByRole('textbox', { name: /驳回原因/ }).fill('导出范围太大，请缩小到自己负责的客户');
  await dialog().getByRole('button', { name: '驳回', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden])')?.textContent?.includes('已驳回：周敏'));
  const r1 = todo.locator('tbody tr', { hasText: '林宁' });
  assert.match(await r1.textContent(), /第 1 \/ 2 级：部门负责人/);
  await r1.getByRole('button', { name: '批准' }).click();
  assert.ok(await dialog().locator('.aui-gov-chain').count(), '批准确认里带审批链');
  await dialog().getByRole('button', { name: '批准', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await area.getByRole('tab', { name: '全部', exact: true }).click();
  const all = panel().getByRole('table', { name: '权限申请' });
  await all.locator('tbody tr', { hasText: '林宁' }).waitFor();
  assert.match(await all.locator('tbody tr', { hasText: '林宁' }).textContent(), /第 2 \/ 2 级：财务总监（待 孙悦 审批）/, '多级审批进到下一级');
  await rowAction(page, all.locator('tbody tr', { hasText: '林宁' }), '查看详情');
  await dialog().waitFor();
  assert.deepEqual(await dialog().locator('.aui-gov-chain > li').evaluateAll(n => n.map(e => e.dataset.state)), ['approved', 'current']);
  await shot(page, '03-request-detail-1440-light');
  await dialog().getByRole('button', { name: '关闭', exact: true }).first().click();
  // 新申请：理由太短不提交
  await panel().getByRole('button', { name: '申请权限' }).click().catch(() => area.getByRole('button', { name: '申请权限' }).click());
  await dialog().waitFor();
  await dialog().getByRole('combobox', { name: '角色' }).click();
  await page.getByRole('option', { name: '数据库管理员' }).click();
  await dialog().getByRole('textbox', { name: /为什么需要/ }).fill('看看');
  await dialog().getByRole('button', { name: '提交申请' }).click();
  assert.match(await dialog().textContent(), /至少 5 个字/);
  await dialog().getByRole('textbox', { name: /为什么需要/ }).fill('排查慢查询需要只读看执行计划');
  await dialog().getByRole('button', { name: '7 天' }).click();
  await dialog().getByRole('button', { name: '提交申请' }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden])')?.textContent?.includes('申请已提交'));
  assert.equal(await area.getByRole('tab', { name: '我的申请', exact: true }).getAttribute('aria-selected'), 'true', '提交后跳到我的申请');

  // ---- 紧急提权：校验 → 开始 → 倒计时 → 立即结束；复核看操作记录
  await tab('紧急提权').click();
  await panel().getByRole('table', { name: '我的紧急提权' }).waitFor();
  await area.getByRole('button', { name: '发起紧急提权' }).click();
  await dialog().waitFor();
  await dialog().getByRole('combobox', { name: '临时拿到' }).click();
  await page.getByRole('option', { name: '角色：数据库管理员' }).click();
  await dialog().getByRole('textbox', { name: /原因/ }).fill('修数据');
  await dialog().getByRole('button', { name: '开始提权' }).click();
  assert.match(await dialog().textContent(), /至少 10 个字（现在 3 个）/);
  assert.match(await dialog().textContent(), /请选择监督人/);
  assert.equal(await dialog().getByRole('combobox', { name: '监督人' }).evaluate(el => el.textContent), '选择监督人');
  await dialog().getByRole('combobox', { name: '监督人' }).click();
  assert.equal(await page.getByRole('option', { name: /^郑凯/ }).count(), 0, '监督人候选里没有自己');
  await page.getByRole('option', { name: /^孙悦/ }).click();
  await dialog().getByRole('textbox', { name: /原因/ }).fill('支付回调积压，需要临时修复订单状态');
  await dialog().getByRole('button', { name: '30 分钟' }).click();
  await dialog().getByRole('button', { name: '开始提权' }).click();
  await dialog().waitFor({ state: 'hidden' });
  const timer = panel().getByRole('timer').first();
  await timer.waitFor();
  const t1 = await timer.textContent();
  await page.waitForTimeout(1300);
  const t2 = await timer.textContent();
  assert.match(t1, /^(29|30):\d\d/);
  assert.notEqual(t1, t2, '倒计时在走');
  assert.match(await panel().textContent(), /你正处于紧急提权中/);
  await shot(page, '04-emergency-1440-light');
  await panel().getByRole('button', { name: '立即结束' }).click();
  await dialog().getByRole('button', { name: '立即结束' }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden]) [role=timer]'));
  const reviewRow = panel().getByRole('table', { name: '待我复核的紧急提权' }).locator('tbody tr', { hasText: '赵一鸣' });
  await reviewRow.getByRole('button', { name: '复核' }).click();
  await dialog().getByRole('table', { name: '提权期间的操作' }).waitFor();
  assert.match(await dialog().textContent(), /db\.failover/);
  await dialog().getByRole('button', { name: '有异常' }).click();
  await dialog().getByRole('button', { name: '标记异常' }).click();
  assert.match(await dialog().textContent(), /标记异常时请写明哪里不对/);
  await shot(page, '05-emergency-review-1440-light');
  await dialog().getByRole('textbox', { name: /复核意见/ }).fill('提权期间重置了林宁的密码，和故障无关');
  await dialog().getByRole('button', { name: '标记异常' }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden])')?.textContent?.includes('已标记异常'));

  // ---- 权限复核：保留 / 收回要原因
  await tab('权限复核').click();
  await panel().locator('tbody tr', { hasText: '2026 Q4 财务权限复核' }).getByRole('button', { name: '处理' }).click();
  const review = panel().locator('.aui-access-review');
  await review.waitFor();
  assert.match(await review.textContent(), /已处理 1 \/ 4/);
  await review.locator('tbody tr', { hasText: '孙悦' }).getByRole('button', { name: '保留' }).click();
  await page.waitForFunction(() => document.querySelector('.aui-access-review')?.textContent?.includes('已处理 2 / 4'));
  await review.locator('tbody tr', { hasText: '吴桐' }).getByRole('button', { name: '收回' }).click();
  await dialog().getByRole('button', { name: '收回', exact: true }).click();
  assert.equal(await dialog().getByRole('textbox', { name: /收回原因/ }).getAttribute('aria-invalid'), 'true', '收回要原因');
  await dialog().getByRole('textbox', { name: /收回原因/ }).fill('从未使用');
  await dialog().getByRole('button', { name: '收回', exact: true }).click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('.aui-access-review')?.textContent?.includes('已处理 3 / 4'));
  assert.match(await review.textContent(), /从未使用/);
  await shot(page, '06-review-items-1440-light', true);
  await panel().getByRole('button', { name: '返回复核列表' }).click();

  // ---- 安全体检
  await tab('安全体检').click();
  await panel().getByText('发现 1 项严重问题、2 项警告').waitFor();
  assert.match(await panel().textContent(), /行级安全有问题/);
  await shot(page, '07-health-1440-light', true);

  // ---- 租户：删除要输入编号
  await tab('租户').click();
  const tenantRow = panel().locator('tbody tr', { hasText: '华东贸易有限公司' });
  await tenantRow.waitFor();
  await tenantRow.getByRole('button', { name: /更多操作/ }).click();
  await page.getByRole('menuitem', { name: '删除租户' }).click();
  await dialog().waitFor();
  const confirmDelete = dialog().getByRole('button', { name: '永久删除' });
  await dialog().getByRole('textbox', { name: /删除原因/ }).fill('客户确认不续费');
  assert.ok(await confirmDelete.isDisabled(), '没输入编号不能删');
  await dialog().getByRole('textbox', { name: /huadong/ }).fill('huadong');
  await confirmDelete.click();
  await dialog().waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !document.querySelector('#aui-page-accessgov .aui-tabbed-panel:not([hidden]) tbody')?.textContent?.includes('华东贸易'));
  await shot(page, '08-tenants-1440-light');

  // ---- 普通成员视角：只读、看不到平台分区
  await area.getByRole('button', { name: '普通成员（只读）' }).click();
  await tab('租户成员').waitFor();
  const memberTabs = await area.getByRole('tab').allTextContents();
  assert.deepEqual(memberTabs, ['租户成员', '权限申请', '紧急提权', '权限复核', '共享规则', '收窄规则', '职责分离', '安全体检']);
  assert.match(await panel().textContent(), /只读/);
  assert.equal(await panel().getByRole('button', { name: '添加成员' }).count(), 0);
  await tab('共享规则').click();
  await panel().getByRole('table', { name: '共享规则列表' }).waitFor();
  assert.equal(await panel().getByRole('button', { name: '编辑' }).count(), 0, '只读没有编辑');
  await area.getByRole('button', { name: '治理管理员' }).click();
  await tab('租户成员').waitFor();

  // ---- 每个分区 390 / 360 / 1440 整页不横向溢出；手机截图
  for (const width of [390, 360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of SECTIONS) {
      await tab(name).click();
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 0, `${width}px「${name}」整页横向溢出 ${overflow}px`);
      if (width === 390 && ['租户成员', '权限申请', '紧急提权', '共享规则', '安全体检', '租户'].includes(name)) await shot(page, `m-${SECTIONS.indexOf(name) + 1}-${name}-390-light`, true);
    }
  }
  // 手机上的规则编辑器（条件构造器一列）
  await page.setViewportSize({ width: 390, height: 844 });
  await tab('共享规则').click();
  // 手机上 DataTable 是卡片列表，每行一张卡
  await rowAction(page, panel().locator('.aui-table-card').first(), '编辑');
  await dialog().waitFor();
  await dialog().getByRole('button', { name: '预览影响' }).click();
  await dialog().locator('.aui-gov-impact').waitFor();
  const dialogOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(dialogOverflow <= 0, `手机规则编辑器横向溢出 ${dialogOverflow}px`);
  await shot(page, 'm-rule-editor-390-light');
  await dialog().getByRole('button', { name: '关闭弹窗' }).click();
  if (await dialog().count()) await dialog().getByRole('button', { name: '放弃修改' }).click().catch(() => undefined);

  // ---- 深色：对比度 + 截图
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.mouse.move(0, 0);
  const contrastOf = selectors => page.evaluate(sels => {
    const rgb = s => { const n = (s.match(/[\d.]+/g) || []).map(Number); return s.startsWith('color(srgb') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bg = el => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return [255, 255, 255]; };
    const ratio = el => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const out = {};
    for (const sel of sels) {
      const els = [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().width > 2 && el.textContent.trim() && !el.closest('[hidden]')).slice(0, 10);
      out[sel] = els.length ? Math.min(...els.map(ratio)) : null;
    }
    return out;
  }, selectors);
  const checks = {
    租户成员: ['.aui-quota-label', '.aui-quota-value', '.aui-desc dt', '.aui-desc dd'],
    权限申请: ['.aui-table td', '.aui-badge'],
    紧急提权: ['.aui-table td', '.aui-gov-countdown strong'],
    共享规则: ['.aui-table td', '.aui-badge'],
    安全体检: ['.aui-metric-value', '.aui-gov-samples li', '.aui-table td'],
  };
  for (const [name, sels] of Object.entries(checks)) {
    await tab(name).click();
    await page.waitForTimeout(400);
    const values = await contrastOf(sels);
    for (const [sel, value] of Object.entries(values)) assert.ok(value === null || value >= 4.5, `深色「${name}」${sel} 对比度 ${value?.toFixed(2)}`);
    await shot(page, `d-${SECTIONS.indexOf(name) + 1}-${name}-1440-dark`, true);
  }
  // 深色下的规则编辑器（条件行底色、影响预览）
  await tab('共享规则').click();
  await panel().locator('tbody tr').first().getByRole('button', { name: '编辑' }).click();
  await dialog().getByRole('button', { name: '预览影响' }).click();
  await dialog().locator('.aui-gov-impact').waitFor();
  const editorContrast = await contrastOf(['[role=dialog] .aui-gov-cond-join', '[role=dialog] .aui-field > label', '[role=dialog] .aui-gov-impact td', '[role=dialog] .aui-gov-subtitle']);
  for (const [sel, value] of Object.entries(editorContrast)) assert.ok(value === null || value >= 4.5, `深色编辑器 ${sel} 对比度 ${value?.toFixed(2)}`);
  await shot(page, 'd-rule-editor-1440-dark');
  await dialog().getByRole('button', { name: '关闭弹窗' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await tab('紧急提权').click();
  await page.waitForTimeout(300);
  await shot(page, 'd-m-emergency-390-dark', true);
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click().catch(() => undefined);

  assert.deepEqual(errors, []);
  console.log(`PASS access-governance: members quota/remove reason, share rule preview→stale→re-preview→save, discard prompt, builtin read-only, SoD violations, request reject note/approve next step/chain detail/new request, emergency validation/start/countdown/end/post review with log, review keep/revoke reason, health + RLS, tenant typed delete, read-only perspective, 12 sections × 360/390/1440, dark contrast (${output})`);
} finally {
  await browser.close();
  await server.close();
}
