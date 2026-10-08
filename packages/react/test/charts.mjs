// 图表与仪表盘浏览器验收：starter「看板 → 图表与仪表盘」（组件库审阅 06）。
// 色板跟色卡（类别 = 选项标签色、换色卡跟着变）；6 种图表画出来；7 种状态和图一样高；数字卡 3 档字号；变化值标签同形；
// 仪表盘标签带范围图标（楼 / 人）+ ⋯ + 「+」；筛选行不套卡、一行、改过才出「重置」；报表工具条没有「查询」、选了就查；
// 1440 浅 / 深、390（筛选收成「筛选 · n」底部弹层）不溢出；截图 test/artifacts/charts/。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/charts');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 6200 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const noOverflow = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));

try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '图表与仪表盘', exact: true }).click();
  const main = page.locator('#aui-page-charts06');
  await main.locator('.aui-chart canvas').nth(5).waitFor();
  assert.equal(await main.locator('.aui-chart canvas').count() >= 7, true, '6 种图 + 状态区的图都画出来');

  // ---- 色板：类别 = 选项标签色（蓝 橙 青 粉 橄榄 紫 黄 红），跟色卡变
  const swatches = () => main.locator('[aria-label="类别色"] [data-swatch]').evaluateAll((els) => els.map((e) => e.dataset.swatch));
  const options = await main.evaluate((el) => ['blue', 'orange', 'teal', 'pink', 'olive', 'violet', 'yellow', 'red'].map((h) => getComputedStyle(el).getPropertyValue(`--aui-option-${h}`).trim().toLowerCase()));
  const first = await swatches();
  assert.deepEqual(first.slice(0, 8).map((c) => c.toLowerCase()), options, '类别色 = 选项标签 10 色里的 8 个');
  assert.equal(new Set(first).size, 10);

  // ---- 仪表盘标签：范围图标、当前标签、⋯、「+」
  const tabs = main.getByRole('navigation', { name: '仪表盘' });
  assert.equal(await tabs.locator('.aui-vtab[data-scope=company]').count(), 2, '团队默认 = 楼');
  assert.equal(await tabs.locator('.aui-vtab[data-scope=personal]').count(), 1, '我的 = 人');
  assert.equal(await tabs.locator('.aui-vtab[data-scope=company] svg.lucide-building2, .aui-vtab[data-scope=company] svg.lucide-building-2').count(), 2);
  assert.equal(await tabs.getByRole('button', { name: /^经营看板/ }).getAttribute('aria-current'), 'page');
  await tabs.getByRole('button', { name: '新建仪表盘' }).click();
  await page.getByRole('menuitem', { name: '复制当前为我的' }).waitFor();
  await page.keyboard.press('Escape');
  await tabs.getByRole('button', { name: /^我的周报/ }).click();
  assert.equal(await tabs.getByRole('button', { name: /^我的周报/ }).getAttribute('aria-current'), 'page');
  await main.getByRole('button', { name: /^全部客户/ }).click();
  assert.equal(await tabs.locator('[aria-current=page]').count(), 0, '点视图就没有仪表盘高亮');

  // ---- 筛选行：不套卡、一行、改过才出「重置」
  const bar = main.getByRole('group', { name: '看板筛选' });
  assert.equal(await bar.evaluate((el) => getComputedStyle(el).borderTopWidth), '0px');
  const row = await bar.locator('.aui-dfilter-row').boundingBox();
  assert.ok(row.height <= 40, `一行（${row.height}px）`);
  assert.equal(await bar.getByRole('button', { name: '重置' }).count(), 0);
  await bar.getByRole('combobox', { name: /^负责人：/ }).click();
  await page.getByRole('option', { name: '小王' }).click();
  assert.equal(await bar.getByRole('button', { name: '重置' }).isVisible(), true);
  await bar.getByRole('button', { name: '重置' }).click();
  assert.equal(await bar.getByRole('button', { name: '重置' }).count(), 0);

  // ---- 报表工具条：没有「查询」，选了就查；改过才出重置
  const report = main.getByRole('group', { name: '报表筛选' });
  assert.equal(await report.getByRole('button', { name: '查询' }).count(), 0, '去掉「查询」');
  assert.equal(await report.getByRole('button', { name: '重置' }).count(), 0);
  await report.getByRole('button', { name: '上月', exact: true }).click();
  await page.getByText('已按 2026-09-01 ~ 2026-09-30 重新统计').first().waitFor();
  assert.equal(await report.getByRole('button', { name: '重置' }).isVisible(), true);
  await report.getByRole('button', { name: '重置' }).click();

  // ---- 数字卡 3 档、变化值标签同形
  const sizes = await main.locator('.aui-kpi .aui-kpi-value strong').evaluateAll((els) => els.slice(0, 3).map((e) => parseFloat(getComputedStyle(e).fontSize)));
  assert.deepEqual(sizes.map((n) => Math.round((n / sizes[1]) * 24)), [28, 24, 20], `大 / 标准 / 紧凑 ${sizes}`);
  const delta = await main.locator('.aui-delta').first().evaluate((el) => ({ radius: getComputedStyle(el).borderTopLeftRadius, border: getComputedStyle(el).borderTopWidth }));
  assert.deepEqual(delta, { radius: '6px', border: '0px' }, '变化值 = 圆角 6、无边框');
  assert.equal(await main.locator('.aui-kpi[data-size=sm] .aui-sparkline').count(), 0, '紧凑档不画趋势');

  // ---- 7 种状态都和图一样高
  const states = main.getByRole('group', { name: '图表状态' });
  const statePanel = main.locator('.aui-panel', { hasText: '跟进中 · 位' });
  const heights = {};
  for (const label of ['有数据', '加载中', '没有数据', '筛选无结果', '加载失败', '刷新失败（旧数据）', '无权限']) {
    await states.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(250);
    heights[label] = Math.round((await statePanel.boundingBox()).height);
    if (label === '筛选无结果') assert.equal(await statePanel.getByRole('button', { name: '清空筛选' }).count(), 1);
    if (label === '加载失败') assert.equal(await statePanel.getByRole('button', { name: '重试' }).count(), 1);
    if (label === '无权限') assert.match(await statePanel.innerText(), /无权限/);
    if (label === '刷新失败（旧数据）') assert.match(await statePanel.innerText(), /显示的是 14:05 的数据/);
  }
  const hs = Object.values(heights);
  assert.ok(Math.max(...hs) - Math.min(...hs) <= 2, `状态等高：${JSON.stringify(heights)}`);
  await states.getByRole('button', { name: '有数据', exact: true }).click();

  await noOverflow(page, 'charts 1440');
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(output, 'charts-1440.png'), fullPage: true });

  // ---- 换色卡：类别色、主色一起变
  const pick = async (name) => {
    // 色卡在顶栏「外观」小弹层里，点色块就换
    await page.getByRole('button', { name: '外观', exact: true }).click();
    await page.locator('.aui-appearance-pop').getByRole('button', { name, exact: true }).click();
    await page.keyboard.press('Escape');
    await page.locator('.aui-appearance-pop').waitFor({ state: 'detached' });
    await page.waitForTimeout(400);
  };
  await pick('深海蓝');
  assert.notDeepEqual(await swatches(), first, '换色卡后类别色跟着变');
  await main.locator('.aui-chart canvas').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, 'charts-ocean.png') });
  await pick('森林绿');
  assert.deepEqual(await swatches(), first);

  // ---- 深色
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(700);
  const darkSwatches = await swatches();
  assert.notDeepEqual(darkSwatches, first, '深色有自己的一套');
  await noOverflow(page, 'charts dark');
  await page.screenshot({ path: resolve(output, 'charts-dark.png'), fullPage: true });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();

  // ---- 390：筛选收成「时间」胶囊 +「筛选 · n」底部弹层
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await bar.getByRole('button', { name: /^筛选/ }).click();
  const sheet = page.getByRole('dialog', { name: '筛选' });
  await sheet.waitFor();
  await sheet.getByRole('button', { name: '小李' }).click();
  await sheet.getByRole('button', { name: '看结果' }).click();
  assert.match(await bar.getByRole('button', { name: /^筛选/ }).innerText(), /筛选 · 1/, '改了一项（负责人）');
  await bar.getByRole('button', { name: '重置' }).click();
  await noOverflow(page, 'charts 390');
  await page.screenshot({ path: resolve(output, 'charts-390.png'), fullPage: true });

  assert.deepEqual(errors, [], errors.join('; '));
  console.log(`PASS charts: palette = option hues (follows ThemePicker + dark), 6 chart kinds, 7 equal-height states, KPI 3 sizes, delta tag shape, dashboard tabs with scope icons, unboxed one-line filter row + reset only when changed, report toolbar applies on change (no 查询), 390 filter sheet → ${output}`);
} finally {
  await browser.close();
  await server.close();
}
