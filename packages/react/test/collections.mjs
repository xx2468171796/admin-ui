// 轻量集合浏览器验收：starter「系统 → 轻量集合」。紧凑表格（无工具栏 / 行号、固定行高、排序、显示更多、
// 单个操作直接成按钮、点行打开记录详情）、时间线（最新在上、按天分组、相对时间 + 悬停精确时间、点开详情）、
// 状态清单（汇总行、图标 + 文字状态、操作按钮）；1440 / 390 / 深色截图，整页不横向溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/collections');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '轻量集合', exact: true }).click();
  const table = page.getByRole('table', { name: '工具排行' });
  await table.waitFor();
  // 紧凑表格
  assert.deepEqual(await table.locator('thead th').allInnerTexts(), ['工具', '调用次数', '出错率 %', '耗时（秒）', '操作']);
  assert.deepEqual(await table.locator('tbody th').allInnerTexts(), ['run_command', 'db_query', 'read_file', 'knowledge_search'], '按调用次数降序，先显示 4 条');
  const heights = await table.locator('tbody tr').evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().height)));
  assert.ok(heights.every((h) => h === heights[0] && h <= 34), `固定行高 ${heights}`);
  assert.equal(await page.getByRole('toolbar').count(), 0, '没有工具栏');
  assert.equal(await table.getByRole('button', { name: '复制' }).count(), 4, '只有一个操作时直接是按钮');
  await page.locator('.aui-compact').getByRole('button', { name: /显示更多（还有 1 条）/ }).click();
  assert.equal(await table.locator('tbody tr').count(), 5);
  await table.locator('tbody tr').nth(2).locator('td').first().click();
  const dialog = page.getByRole('dialog').filter({ has: page.locator('.aui-record-dialog') });
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /大文件读一半会截断/, '详情里有表格里没显示的字段');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  // 时间线
  const feed = page.getByRole('list', { name: '最近动态' });
  assert.match(await feed.locator('.aui-feed-day-label').first().innerText(), /^今天\s*\d+月\d+日 周[一二三四五六日]$/, '日期标题「今天 10月7日 周三」');
  const first = feed.locator('.aui-feed-item').first();
  assert.match(await first.innerText(), /备份成功：订单主库/);
  assert.match(await first.locator('time').innerText(), /^(刚刚|\d+ 分钟前)$/);
  assert.match(await first.locator('time').getAttribute('data-tip'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(await feed.locator('.aui-feed-item').count(), 5, '先显示 5 条');
  assert.equal(await feed.locator('.aui-feed-item').first().locator('.aui-tl-marker').getAttribute('data-result'), 'success', '成功 = 带 ✓ 的结果圆');
  assert.match(await page.getByRole('button', { name: /显示更早的 \d+ 条/ }).first().innerText(), /显示更早的 1 条/);
  // 所有标记（头像 / 圆点 / 结果圆）圆心压在 1px 竖线的中线上；时间用正文数字字体（不是等宽字体）
  const centred = await page.locator('.aui-tl-item').evaluateAll((items) => items.map((li) => {
    const line = getComputedStyle(li, '::before');
    const box = li.getBoundingClientRect();
    const lineCentre = box.left + parseFloat(line.left) + parseFloat(line.width) / 2;
    const m = li.querySelector('.aui-tl-marker').getBoundingClientRect();
    return Math.abs(m.left + m.width / 2 - lineCentre);
  }));
  assert.ok(centred.length >= 10 && centred.every((d) => d <= 0.6), `标记要居中在线上 ${JSON.stringify(centred)}`);
  const font = await page.locator('.aui-tl-time').first().evaluate((el) => [getComputedStyle(el).fontFamily, getComputedStyle(el.closest('.adminui')).fontFamily]);
  assert.equal(font[0], font[1], '时间用正文字体');
  const follow = page.getByRole('list', { name: '赵静怡的跟进记录' });
  assert.equal(await follow.locator('.aui-tl-marker[data-kind=person] .aui-avatar').first().innerText(), '小');
  assert.equal(await follow.locator('.aui-tl-marker[data-kind=system] > i').count(), 2);
  assert.equal(await follow.locator('.aui-tl-attachment').count(), 2);
  // SelectList：未读 = 加粗 + 主色数量徽标；选中 = 浅底 + 加粗；图标不套圆底；加载骨架
  const chats = page.getByRole('list', { name: 'LINE 会话' });
  const lin = chats.locator('.aui-slist-item').first();
  assert.equal(await lin.locator('.aui-slist-badge').innerText(), '3');
  assert.equal(await lin.locator('.aui-slist-badge').getAttribute('aria-label'), '3 条未读');
  assert.equal(await chats.locator('.aui-slist-item').nth(2).locator('.aui-slist-text b').evaluate((el) => getComputedStyle(el).fontWeight), '400', '已读的名字不加粗');
  assert.equal(await lin.locator('.aui-slist-text b').evaluate((el) => getComputedStyle(el).fontWeight), '600');
  const roles = page.getByRole('list', { name: '角色' });
  const roleRow = await roles.locator('.aui-slist-item').first().evaluate((el) => ({ h: Math.round(el.getBoundingClientRect().height), icon: el.querySelector('.aui-slist-icon svg')?.getBoundingClientRect().width, block: el.querySelector('.aui-icon-block') !== null }));
  assert.deepEqual(roleRow, { h: 36, icon: 16, block: false }, '行 36、16px 小图标、不套圆底');
  const two = await chats.locator('.aui-slist-item').first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
  assert.equal(two, 52, '两行 52');
  assert.equal(await page.locator('.aui-slist-skel').count(), 4, '加载骨架行');
  await page.getByRole('searchbox', { name: '角色搜索' }).fill('采购');
  await page.getByRole('button', { name: '新建这个角色' }).click();
  await page.getByRole('searchbox', { name: '角色搜索' }).fill('');
  await first.getByRole('button').click();
  await page.getByRole('dialog').filter({ has: page.locator('.aui-record-peek') }).waitFor();
  await page.keyboard.press('Escape');
  // 状态清单
  const checklist = page.getByRole('list', { name: '连接自检' });
  assert.equal(await page.locator('.aui-checklist-summary').innerText(), '1 项异常 · 1 项注意 · 1 项进行中 · 1 项正常');
  assert.deepEqual(await checklist.locator('.aui-checkitem-status').allInnerTexts(), ['正常', '注意', '异常', '进行中']);
  assert.equal(await checklist.getByRole('button', { name: '去安装' }).count(), 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(output, 'collections-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390 不横向溢出');
  await page.screenshot({ path: resolve(output, 'collections-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'collections-dark.png'), fullPage: true });
  assert.deepEqual(errors, [], errors.join('; '));
  console.log('PASS collections: CompactTable (no toolbar, fixed rows, sort, show more, single inline action, row → record detail), ActivityFeed (day groups, relative + exact time, open), StatusChecklist (summary, icon + word, action), 1440 / 390 / dark');
} finally {
  await browser.close();
  await server.close();
}
