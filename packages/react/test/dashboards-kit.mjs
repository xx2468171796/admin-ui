// Browser acceptance for the dashboard widgets (bt/dashboards): KpiCard target / tag / placeholder,
// BulletBar, DeltaBadge in table cells, DashboardFilterBar (pills, comparison explanation, reset,
// page buttons slotted into the bar), StepFunnel, CohortTable 「未到期」, targetBarOption, RollupCard,
// ProgressRing; 1440 / 390 / 360 light + dark without overflow. Screenshots → test/artifacts/dashboards/.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/dashboards');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });

/** No horizontal page overflow and nothing spilling out of the widget boxes. */
async function noOverflow(page, scope, label) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth ? [] : [...document.querySelectorAll('body *')]
    .filter(el => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('[style*="overflow"], .aui-table-scroll, .aui-cohort'))
    .slice(0, 8).map(el => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`));
  assert.deepEqual(wide, [], `${label}: 页面横向溢出`);
  const spill = await scope.locator('.aui-kpi-grid > .aui-panel, .aui-rollup, .aui-funnel-step, .aui-dfilter, .aui-bullet, .aui-ring').evaluateAll(els => els
    .filter(el => el.getClientRects().length)
    .filter(el => el.scrollWidth > el.clientWidth + 1)
    .map(el => `${el.className} ${el.textContent.slice(0, 30)} ${el.scrollWidth}>${el.clientWidth}`));
  assert.deepEqual(spill, [], `${label}: 部件内容溢出`);
}

async function sweep(page, scope, name) {
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(400);
    await noOverflow(page, scope, `${name} ${width}px`);
    await page.screenshot({ path: resolve(output, `${name}-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '切换到深色模式' }).click();
    await page.waitForTimeout(500);
    await noOverflow(page, scope, `${name} 深色 ${width}px`);
    await page.screenshot({ path: resolve(output, `${name}-dark-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '切换到浅色模式' }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  await page.goto(server.resolvedUrls.local[0]);
  const nav = page.getByRole('navigation', { name: '主导航' });

  // ---- D29 团队今日
  await nav.getByRole('button', { name: '团队今日示例', exact: true }).click();
  const team = page.locator('#aui-page-teamtoday');
  const north = team.locator('.aui-kpi').filter({ hasText: '按时有效跟进率' }).first();
  await north.waitFor();
  assert.equal(await north.locator('.aui-kpi-tag', { hasText: '北极星' }).count(), 1);
  const bullet = north.getByRole('meter', { name: '按时有效跟进率' });
  assert.match(await bullet.getAttribute('aria-valuetext'), /65%.*目标 80%/);
  assert.equal(await bullet.locator('.aui-bullet-target').count(), 1);
  assert.ok(await team.locator('td .aui-delta[data-size=sm]').count() >= 20, '表格格子里有小号变化值');
  assert.equal(await team.locator('.aui-kpi-value[data-tone=bad]').count(), 1, '逾期客户数值标红');
  assert.ok(await team.locator('.aui-kpi .aui-sparkline[data-inline]').count() >= 4, '行内趋势线');
  // The page's own buttons sit at the end of the filter row, not in a row of their own.
  const bar = team.locator('.aui-dfilter');
  await bar.getByRole('button', { name: '复制为我的看板' }).waitFor();
  assert.equal(await team.locator('.aui-page-header-embedded').count(), 0, '页面按钮不单独占一行');
  // 审阅 06：筛选行不套卡、一行；有值的胶囊浅主色底 + ×；「重置」改过才出现；对比每项带一句说明。
  assert.equal(await bar.evaluate((el) => getComputedStyle(el).borderTopWidth), '0px', '筛选行不套卡');
  assert.equal(await bar.locator('.aui-dfilter-row').evaluate((el) => getComputedStyle(el).flexWrap), 'nowrap', '一行');
  const reset = bar.getByRole('button', { name: '重置' });
  assert.equal(await reset.count(), 0, '标准筛选时没有「重置」');
  await bar.getByRole('combobox', { name: /^来源：/ }).click();
  await page.getByRole('option', { name: 'LINE' }).click();
  assert.equal(await bar.getByRole('combobox', { name: '来源：LINE' }).getAttribute('data-on'), '');
  assert.equal(await reset.isVisible(), true, '改过才出「重置」');
  await bar.getByRole('button', { name: '清除来源筛选' }).click();
  assert.equal(await bar.getByRole('combobox', { name: '来源：全部' }).count(), 1, '× 清掉这一项');
  await bar.getByRole('combobox', { name: /^来源：/ }).click();
  await page.getByRole('option', { name: 'LINE' }).click();
  await bar.getByRole('combobox', { name: /^对比：/ }).click();
  await page.getByRole('option', { name: /昨天同时段/ }).getByText('昨天同样截至 15:42 的数').waitFor();
  await page.keyboard.press('Escape');
  await reset.click();
  assert.equal(await bar.getByRole('combobox', { name: '来源：全部' }).count(), 1, '重置回标准筛选');
  assert.equal(await reset.count(), 0);
  await bar.getByRole('group', { name: '时间范围' }).getByRole('button', { name: '昨天' }).click();
  assert.equal(await reset.isVisible(), true);
  await reset.click();
  // Expanded row: 阿杰's feed with its own filter.
  await team.getByText('阿杰今天的跟进').first().waitFor();
  await team.locator('.aui-chart:has(canvas)').first().waitFor({ timeout: 15_000 });
  await sweep(page, team, 'team-today');

  // ---- D30 / D31 / D29m 部件
  await nav.getByRole('button', { name: '看板部件', exact: true }).click();
  const kit = page.locator('#aui-page-dashkit');
  const funnel = kit.getByRole('list', { name: '8 月进线客户卡在哪一步' });
  await funnel.waitFor();
  assert.equal(await funnel.locator('li').count(), 5);
  assert.match(await funnel.locator('li[data-drop]').textContent(), /需求确认.*流失最多/);
  assert.match(await funnel.locator('li').nth(1).getAttribute('aria-label'), /上一步转化 85\.9%（268 \/ 312）/);
  assert.match(await kit.locator('.aui-funnel-foot').textContent(), /整体转化 9\.9%（31 \/ 312）/);
  const cohort = kit.locator('.aui-cohort table');
  assert.equal(await cohort.locator('td[data-due=no]').count(), 7, '没到天龄的格子写「未到期」');
  assert.equal(await cohort.locator('td', { hasText: /^0(\.0)?%$/ }).count(), 0, '未到期不能画成 0');
  const sales = kit.locator('.aui-kpi').filter({ hasText: '成交额' }).first();
  assert.equal(await sales.locator('.aui-kpi-tag[data-tone=info]', { hasText: '进行中' }).count(), 1);
  assert.equal(await sales.locator('.aui-bullet-expected').count(), 1, '时间进度标记');
  assert.match(await sales.getByRole('meter').getAttribute('aria-valuetext'), /按时间进度应达/);
  const ar = kit.locator('.aui-kpi[data-placeholder]').filter({ hasText: '应收逾期' });
  assert.equal(await ar.locator('.aui-kpi-value strong').textContent(), '—');
  await ar.getByText('财务模块上线后显示').waitFor();
  assert.equal(await ar.locator('.aui-delta').count(), 0, '占位指标不显示变化值');
  assert.equal(await kit.locator('.aui-rollup').count(), 4);
  assert.equal(await kit.locator('.aui-rollup-anomaly').count(), 2);
  await kit.locator('.aui-rollup').filter({ hasText: '旅游' }).getByRole('button', { name: '进入业务线经营' }).click();
  await page.getByText('进入「旅游 · 业务线经营」，带着当前筛选（carryFilterContext）').waitFor();
  const ring = kit.getByRole('meter', { name: '已按时有效跟进' });
  assert.equal(await ring.getAttribute('aria-valuenow'), '7');
  assert.equal(await ring.locator('.aui-ring-target').count(), 1, '进度环带目标刻度');
  await kit.locator('.aui-chart:has(canvas)').first().waitFor({ timeout: 15_000 });
  await sweep(page, kit, 'dashboard-kit');

  assert.deepEqual(errors, []);
  console.log(`PASS dashboards-kit: KPI target/tag/placeholder, bullet + time progress, filter bar (pills, compare note, reset, slotted page buttons), delta chips in cells, funnel, cohort 未到期, target bars, rollups, ring; 1440/390/360 light+dark → ${output}`);
} finally {
  await browser.close();
  await server.close();
}
