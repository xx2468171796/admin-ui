import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { assertCrumbs } from './narrow-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/cloudscape');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  const users = page.locator('#aui-page-users');
  await users.locator('tbody tr[data-row-key]').first().waitFor();
  const click = name => page.getByRole('button', { name, exact: true }).click();
  assert.equal(await page.getByRole('region', { name: '用户列表 (32)', exact: true }).count(), 1);
  await users.getByRole('checkbox', { name: '选择 U1001', exact: true }).click();
  await users.getByRole('status').filter({ hasText: '已选择 1 项' }).waitFor();
  const backgrounds = () => users.locator('tbody tr, .aui-table-card').evaluateAll(rows => rows.slice(0, 2).map(row => getComputedStyle(row).backgroundColor));
  assert.notEqual(...await backgrounds(), '选中态不能与普通行混淆');
  await click('取消选择');
  assert.equal(await users.locator('tr[data-selected]').count(), 0);
  await users.getByLabel('搜索关键词').fill('no-such-user');
  await users.getByLabel('搜索关键词').press('Enter');
  await users.getByText('没有符合筛选条件的记录', { exact: true }).waitFor();
  assert.equal(await page.getByRole('region', { name: '用户列表 (0)', exact: true }).count(), 1, '已知 0 不等于未知总数');
  await click('清空筛选');
  await users.locator('tbody tr[data-row-key]').first().waitFor();
  assert.equal(await users.getByLabel('搜索关键词').inputValue(), '');
  assert.equal(await users.locator('tbody tr[data-row-key]').count(), 10);
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(300); // Let the mobile drawer's existing resize transition settle.
    if (width < 760) assert.ok(await page.locator('.aui-sidebar').evaluate(el => el.getBoundingClientRect().right <= 0), '关闭的手机菜单不得遮住页面');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 页面溢出`);
    await page.screenshot({ path: resolve(output, `users-${width}.png`), fullPage: true, animations: 'disabled' });
    await click('切换到深色模式');
    await users.getByRole('checkbox', { name: '选择 U1001', exact: true }).click();
    await page.mouse.move(0, 0);
    assert.notEqual(...await backgrounds(), '深色选中态须清晰');
    const colors = await users.locator('tbody tr[data-selected], .aui-table-card[data-selected]').first().evaluate(row => ({ fg: getComputedStyle(row).color, bg: getComputedStyle(row).backgroundColor }));
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const [low, high] = [luminance(colors.fg), luminance(colors.bg)].sort((a, b) => a - b);
    assert.ok((high + .05) / (low + .05) >= 4.5, '深色选中行文本对比度');
    await page.screenshot({ path: resolve(output, `users-dark-${width}.png`), fullPage: true, animations: 'disabled' });
    await click('取消选择');
    await click('切换到浅色模式');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const nav = name => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();
  await nav('资金账本');
  const ledger = page.locator('#aui-page-ledger');
  await ledger.locator('tbody tr').first().waitFor();
  assert.equal(await ledger.locator('.aui-resource-count').count(), 0, '游标资源不应伪造总数');
  await nav('后台工作流');
  await page.locator('#aui-page-workflows tbody tr').first().waitFor();
  await assertCrumbs(page.locator('#aui-page-workflows nav[aria-label="面包屑"]'), '后台工作流面包屑');
  await page.screenshot({ path: resolve(output, 'workflows.png'), fullPage: true });
  await click('模拟刷新失败');
  await click('刷新');
  await page.getByRole('alert').filter({ hasText: '刷新失败，当前数据可能已过期' }).waitFor();
  assert.ok(await page.locator('#aui-page-workflows tbody tr').count() > 0, '刷新失败保留旧数据且提示过期');
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 工作流溢出`);
  }
  // 2.4.0: TabbedPage section with SegmentedControl / ChipGroup / date presets at phone widths and in dark mode.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav('系统设置');
  const settings = page.locator('#aui-page-settings');
  await settings.getByRole('tab', { name: '安全策略', exact: true }).click();
  const contrastOf = (el) => {
    // Computed color-mix() values come back as color(srgb …); let a canvas normalise them to 0–255 RGB.
    const ctx = document.createElement('canvas').getContext('2d');
    const parse = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = (rgb) => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const style = getComputedStyle(el);
    const [low, high] = [lum(parse(style.color)), lum(parse(style.backgroundColor))].sort((a, b) => a - b);
    return (high + .05) / (low + .05);
  };
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 合并页溢出`);
    await page.screenshot({ path: resolve(output, `tabbed-settings-${width}.png`), fullPage: true, animations: 'disabled' });
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') { await click('切换到深色模式'); await page.waitForTimeout(300); } // let 120ms colour transitions settle
      for (const selector of ['.aui-segmented-item[aria-pressed=true]', '.aui-chip[aria-pressed=true]']) {
        const ratio = await settings.locator(selector).first().evaluate(contrastOf);
        assert.ok(ratio >= 4.5, `${mode} ${selector} 文本对比度 ${ratio.toFixed(2)}`);
      }
      if (mode === 'dark') {
        await page.screenshot({ path: resolve(output, `tabbed-settings-dark-${width}.png`), fullPage: true, animations: 'disabled' });
        await click('切换到浅色模式');
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS design: resource totals, selection, zero-results recovery, refresh feedback, dark contrast, responsive screenshots, TabbedPage/SegmentedControl/ChipGroup at 360/390/1440 light+dark (${output})`);
} finally {
  await browser.close();
  await server.close();
}
