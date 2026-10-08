// 记录详情三档浏览器验收：starter「系统 → 多维表格」合同记录。
// 量的是：第 2 档大弹框的尺寸（宽 ≥ 50% 屏幕、居中、固定高度）、上一条 / 下一条（按钮、Alt+↓、J/K）与地址栏
// ?contract= 同步（切换只替换、返回键关闭）、缩小到第 1 档简要弹框（≈560px、标签在左）、「在新页面打开」进第 3 档整页
// （KPI 卡、图表、标签页）、手机全屏、深色；每档截图存 test/artifacts/record-detail/ 供人工检查。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { checkFlatRecord, checkHoverActions } from './record-list-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/record-detail');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const shot = (page, name) => page.screenshot({ path: resolve(output, `${name}.png`) });
try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await page.evaluate(() => localStorage.removeItem('starter:demo:bitable-contracts:view'));
    if (scheme === 'dark') await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '多维表格', exact: true }).click();
    const grid = page.getByRole('grid', { name: '合同台账' });
    await grid.locator('[data-row-key]').first().waitFor();
    // 打开第一条（Enter 在主字段格上）
    const firstRow = grid.locator('[role=row][data-row-key]').first();
    const firstKey = await firstRow.getAttribute('data-row-key');
    await firstRow.locator('[data-primary]').click(); await page.keyboard.press('Space');
    const dialog = page.getByRole('dialog').filter({ has: page.locator('.aui-record-expanded') });
    await dialog.waitFor();
    const box = await dialog.boundingBox();
    assert.ok(box.width >= 1440 * 0.5 && box.width <= 1280, `第 2 档宽 ${box.width}`);
    assert.ok(Math.abs(box.x + box.width / 2 - 720) < 2, '水平居中');
    assert.ok(box.height >= 900 * 0.8 && box.height <= 900 * 0.9, `第 2 档高 ${box.height}`);
    assert.ok(page.url().includes(`contract=${firstKey}`), `地址栏带记录 ${page.url()}`);
    await page.waitForTimeout(250);
    await shot(page, `expanded-${scheme}`);
    // 飞书式列表：平的（没有卡片套卡片）、字段名在左值在右、按钮只在悬停时出现、头部白底一条线
    await checkFlatRecord(dialog, `第 2 档 ${scheme}`);
    const nameRow = dialog.locator('.aui-rfield').filter({ has: page.locator('.aui-rfield-label', { hasText: /^合同编号$/ }) });
    const lb = await nameRow.locator('.aui-rfield-label').boundingBox();
    const vb = await nameRow.locator('.aui-rfield-value').boundingBox();
    assert.ok(vb.x > lb.x + lb.width - 1 && Math.abs(vb.y - lb.y) < 4, '字段名在左、值在右');
    assert.equal(await nameRow.locator('.aui-rfield-value').evaluate((el) => getComputedStyle(el).fontWeight), '400', '值是正常字重');
    await checkHoverActions(page, nameRow, '合同编号');
    assert.equal(await dialog.locator('.aui-rhead').getAttribute('data-variant'), 'flat');
    // 标签页：活动
    await dialog.getByRole('tab', { name: /活动/ }).click();
    await page.waitForTimeout(100);
    await shot(page, `expanded-activity-${scheme}`);
    await dialog.getByRole('tab', { name: '详情' }).click();
    assert.equal(await dialog.getByRole('tab', { name: /回款计划/ }).count(), 0, '只在整页的标签页不进弹框');
    // 下一条：按钮 / Alt+↓ / J，地址栏只替换不新增历史
    const title = () => dialog.locator('.aui-rhead-title h2').innerText();
    const t0 = await title();
    const historyLength = await page.evaluate(() => history.length);
    await dialog.getByRole('button', { name: /^下一条/ }).click();
    const t1 = await title();
    assert.notEqual(t1, t0, '下一条换了记录');
    await page.keyboard.press('Alt+ArrowDown');
    const t2 = await title();
    assert.notEqual(t2, t1, 'Alt+↓ 换记录');
    await page.keyboard.press('k');
    assert.equal(await title(), t1, 'K 回到上一条');
    assert.equal(await page.evaluate(() => history.length), historyLength, '切换记录不新增历史');
    assert.match(await dialog.locator('.aui-rhead-nav > span').innerText(), /^第 2 条，共 2000 条$/);
    // 缩小到简要
    await dialog.getByRole('button', { name: '缩小为简要视图' }).click();
    const peek = page.getByRole('dialog').filter({ has: page.locator('.aui-record-peek') });
    await peek.waitFor();
    const peekBox = await peek.boundingBox();
    assert.ok(peekBox.width > 500 && peekBox.width <= 560, `第 1 档宽 ${peekBox.width}`);
    assert.ok(page.url().includes('contractView=peek'));
    await page.waitForTimeout(200);
    await shot(page, `peek-${scheme}`);
    // 返回键关闭
    await page.goBack();
    await peek.waitFor({ state: 'detached' });
    assert.ok(!page.url().includes('contract='), '返回键关闭记录并清掉参数');
    // 第 3 档整页
    await firstRow.locator('[data-primary]').click(); await page.keyboard.press('Space');
    await page.getByRole('dialog').filter({ has: page.locator('.aui-record-peek') }).getByRole('button', { name: '查看完整详情' }).click().catch(() => undefined);
    const anyDialog = page.getByRole('dialog').filter({ has: page.locator('.aui-record-dialog') });
    await anyDialog.getByRole('link', { name: '在新页面打开' }).click();
    await page.locator('.aui-record-page').waitFor();
    await page.locator('.aui-record-page canvas').first().waitFor({ timeout: 10000 });
    assert.ok(await page.locator('.aui-record-page .aui-fact').count() >= 4, '关键信息块');
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(output, `page-${scheme}.png`), fullPage: true });
    await page.getByRole('tab', { name: '回款计划' }).click();
    await page.waitForTimeout(600);
    await shot(page, `page-payments-${scheme}`);
    assert.deepEqual(errors, [], `页面错误：${errors.join('; ')}`);
    await page.close();
  }
  // 手机：第 2 档全屏
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(server.resolvedUrls.local[0]);
  await phone.evaluate(() => localStorage.removeItem('starter:demo:bitable-contracts:view'));
  const nav = phone.getByRole('button', { name: /菜单|导航/ }).first();
  if (await nav.count()) await nav.click().catch(() => undefined);
  await phone.getByRole('button', { name: '多维表格', exact: true }).first().click();
  const pgrid = phone.getByRole('grid', { name: '合同台账' });
  await pgrid.locator('[data-row-key]').first().waitFor();
  await pgrid.locator('[role=row][data-row-key]').first().locator('.aui-grid-expand').click({ force: true });
  const pdialog = phone.getByRole('dialog').filter({ has: phone.locator('.aui-record-dialog') });
  await pdialog.waitFor();
  await phone.waitForTimeout(300);
  const pbox = await pdialog.boundingBox();
  assert.ok(pbox.width >= 389 && pbox.height >= 843, `手机全屏 ${pbox.width}×${pbox.height}`);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '手机不横向溢出');
  await checkFlatRecord(pdialog, '手机第 2 档');
  await shot(phone, 'expanded-phone');
  console.log('record-detail ok');
} finally {
  await browser.close();
  await server.close();
}
