// 视图标签 · 手机「视图」面板里的仪表盘（starter「视图」页，390）：仪表盘组收进「视图」面板，点一个仪表盘面板关上
// （和点视图一样），仪表盘成为当前；点回视图标签恢复。DashboardTabs 经 ViewTabsContext.closeManager 关面板。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/views');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: /菜单|导航/ }).first().click().catch(() => undefined);
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '视图', exact: true }).click();
    const area = page.locator('#aui-page-views');
    await area.locator('.aui-vtabs[data-phone]').waitFor();
    assert.equal(await area.locator('.aui-vtabs-trailing').count(), 0, '手机：仪表盘组不占标签行');
    const manage = area.getByRole('button', { name: '视图管理' });
    const sheet = page.getByRole('dialog', { name: '视图管理' });
    const dashboards = sheet.getByRole('navigation', { name: '仪表盘' });
    const currentView = await area.locator('.aui-vtab[aria-current=page] .aui-vtab-name').innerText();
    // 点视图管理 → 底部弹层里有仪表盘组
    await manage.click();
    await sheet.waitFor();
    assert.equal(await sheet.getAttribute('data-sheet'), 'true');
    await page.screenshot({ path: resolve(output, `views-390-dashboards-sheet-${scheme}.png`) });
    // 点一个仪表盘 → 面板关上，按钮 aria-expanded=false
    await dashboards.getByRole('button', { name: /经营看板/ }).click();
    await sheet.waitFor({ state: 'hidden', timeout: 3000 });
    assert.equal(await manage.getAttribute('aria-expanded'), 'false', '选了仪表盘，「视图」面板关上');
    assert.equal(await area.locator('.aui-vtab[aria-current=page]').count(), 0, '仪表盘是当前时没有当前视图');
    // 再打开：经营看板是当前；换一个仪表盘同样关
    await manage.click();
    await sheet.waitFor();
    assert.equal(await dashboards.getByRole('button', { name: /经营看板/ }).getAttribute('aria-current'), 'page');
    await dashboards.getByRole('button', { name: /我的今天/ }).click();
    await sheet.waitFor({ state: 'hidden', timeout: 3000 });
    // 点回视图标签
    await area.locator('.aui-vtab', { hasText: currentView }).first().click();
    assert.equal(await area.locator('.aui-vtab[aria-current=page] .aui-vtab-name').innerText(), currentView, '点回视图');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS views-phone: 390 「视图」面板里点仪表盘就关上（浅 / 深色）');
} finally {
  await browser.close();
  await server.close();
}
