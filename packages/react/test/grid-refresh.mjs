// 8.9 多维表格行级刷新浏览器验收（starter「系统 → 多维表格」服务端 10 万条）：
// 刷新 / 底栏「+」新增后，原来屏幕上的每一行还是同一个 DOM 节点、滚动位置不动、不出骨架行和整块加载面板；
// 改筛选时旧行一直留到新数据到、只有顶部细进度条；handleRef 的 insertRow / removeRows / patchRows / revealRow / refresh
// 在不分组和分组（服务端组头）两种视图下都原地生效。截图在 test/artifacts/grid-refresh/。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/grid-refresh');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const VIEW_KEY = 'starter:demo:bitable-server:view';
const GRID = '[role=grid][aria-label="合同台账（服务端）"]';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate((key) => localStorage.removeItem(key), VIEW_KEY);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '多维表格', exact: true }).click();
  const area = page.locator('#aui-page-bitable');
  const modes = area.getByRole('group', { name: '数据来源' });
  await modes.getByRole('button', { name: /^服务端/ }).click();
  const grid = page.locator(GRID);
  await grid.locator('[data-row-key]').first().waitFor();
  const toolbar = area.getByRole('toolbar', { name: '视图工具栏' });
  const rowCount = async () => Number(await grid.getAttribute('aria-rowcount'));
  const scrollTo = async (top) => { await grid.evaluate((g, t) => { g.scrollTop = t === 'end' ? g.scrollHeight : t; }, top); await page.waitForTimeout(200); };
  const settled = () => page.waitForFunction((sel) => {
    const g = document.querySelector(sel);
    return g && !g.querySelector('.aui-grid-loading-row, [data-stale]') && !g.closest('[aria-busy=true]');
  }, GRID, { timeout: 15000 }).catch(async (e) => { console.log(await page.evaluate((sel) => { const g = document.querySelector(sel); return { loading: g.querySelectorAll(".aui-grid-loading-row").length, stale: [...g.querySelectorAll("[data-stale]")].map((r) => r.dataset.rowIndex).slice(0, 5), busy: g.closest(".aui-grid-panel").getAttribute("aria-busy"), rows: [...g.querySelectorAll("[role=row][data-row-index]")].map((r) => r.dataset.rowIndex + ":" + (r.dataset.rowKey ?? r.className)).slice(-6) }; }, GRID)); throw e; });

  // Watch the whole run: a skeleton row or the loading panel showing up at any time is a failure.
  const watch = () => page.evaluate((sel) => {
    const g = document.querySelector(sel);
    const panel = g.closest('.aui-grid-panel');
    window.__auiSeen = { skeleton: 0, overlay: 0, emptyBody: 0 };
    window.__auiSkel = [];
    window.__auiStale = 0;
    window.__auiWatch?.disconnect();
    window.__auiWatch = new MutationObserver(() => {
      // On screen only: the active row stays rendered (for focus) even when it is far away.
      const box = g.getBoundingClientRect();
      const onScreen = [...g.querySelectorAll('.aui-grid-loading-row')].filter((r) => { const b = r.getBoundingClientRect(); return b.bottom > box.top && b.top < box.bottom; });
      if (onScreen.length) { window.__auiSeen.skeleton++; (window.__auiSkel ??= []).push(onScreen.map((r) => r.dataset.rowIndex).join(',') + (panel.querySelector('.aui-grid-loadbar') ? ' bar' : '') + ' n=' + g.getAttribute('aria-rowcount') + ' top=' + g.scrollTop); }
      if (g.querySelector('[data-stale]')) window.__auiStale++;
      if (panel.querySelector('.aui-grid-overlay')) window.__auiSeen.overlay++;
      if (g.querySelector('.aui-grid-body')?.style.height === '0px') window.__auiSeen.emptyBody++;
    });
    window.__auiWatch.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-stale'] });
  }, GRID);
  const seen = async () => { const out = await page.evaluate(() => window.__auiSeen); if (out.skeleton) console.log(await page.evaluate(() => window.__auiSkel)); return out; };
  // Tag every rendered row element; later: which of the still-rendered keys got a new node.
  const tag = () => grid.evaluate((g) => {
    const keys = [];
    for (const row of g.querySelectorAll('[role=row][data-row-key]')) { row.__auiTag = row.dataset.rowKey; keys.push(row.dataset.rowKey); }
    for (const row of g.querySelectorAll('[role=row].aui-grid-group')) row.__auiTag = row.textContent;
    return { keys, scrollTop: g.scrollTop };
  });
  const recreated = () => grid.evaluate((g) => {
    const out = [];
    for (const row of g.querySelectorAll('[role=row][data-row-key]')) if (row.__auiTag !== undefined && row.__auiTag !== row.dataset.rowKey) out.push(row.dataset.rowKey);
    return out;
  });
  const untagged = (keys) => grid.evaluate((g, list) => list.filter((key) => { const row = g.querySelector(`[role=row][data-row-key="${key}"]`); return row && row.__auiTag !== key; }), keys);

  // ---- A. toolbar 刷新: same nodes, same scroll, no skeleton / panel; stale rows marked while refetching
  await scrollTo(3000);
  await settled();
  await watch();
  const before = await tag();
  assert.ok(before.keys.length > 15, `屏幕上有 ${before.keys.length} 行`);
  await toolbar.getByRole('button', { name: '刷新', exact: true }).click();
  await settled();
  assert.ok(await page.evaluate(() => window.__auiStale) > 0, '刷新中：屏幕上的行标 data-stale（旧数据还在）');
  assert.deepEqual(await untagged(before.keys), [], '刷新后每一行还是原来的 DOM 节点');
  assert.equal(await grid.evaluate((g) => g.scrollTop), before.scrollTop, '刷新后滚动位置不动');
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, '刷新时不出骨架行、加载面板、空表');

  // ---- A. footer 「+」 (useAddRow's own refresh) at the end of the list
  await scrollTo('end');
  await settled();
  await watch();
  const atEnd = await tag();
  const total = await rowCount();
  await grid.getByRole('button', { name: '新增记录', exact: true }).click();
  const editor = grid.locator('.aui-grid-editor');
  await editor.waitFor({ timeout: 15000 });
  assert.equal(await rowCount(), total + 1, '多了一条');
  assert.deepEqual(await untagged(atEnd.keys), [], '新增后原来的行都还是原来的 DOM 节点');
  const rowH = await grid.locator('[role=row][data-row-key]').first().evaluate((r) => r.getBoundingClientRect().height);
  const moved = Math.abs(await grid.evaluate((g) => g.scrollTop) - atEnd.scrollTop);
  assert.ok(moved <= rowH + 2, `只为露出新行滚了 ${moved}px（≤ 一行）`);
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, '新增时不出骨架行、加载面板、空表');
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  await settled();

  // ---- B. query change: the old rows stay (no busy panel, body keeps its height) + a thin progress bar, then swap
  await scrollTo(0);
  await settled();
  await watch();
  const top = await tag();
  await page.evaluate(() => { window.__auiServerDelay = 1500; });
  await area.getByRole('searchbox', { name: '搜索记录' }).fill('远山精密');
  const bar = area.locator('.aui-grid-loadbar[role=progressbar]');
  await bar.waitFor({ timeout: 5000 });
  assert.equal(await area.locator('.aui-grid-panel').getAttribute('aria-busy'), 'true', '加载中面板 aria-busy');
  assert.deepEqual(await untagged(top.keys), [], '新数据到之前旧行原样留着');
  assert.ok(await grid.locator('[role=row][data-row-key]').count() >= top.keys.length - 1, '旧行没被清空');
  await shot('query-change-progress-1440');
  await bar.waitFor({ state: 'detached', timeout: 15000 });
  await page.evaluate(() => { window.__auiServerDelay = 250; });
  await settled();
  const found = await rowCount() - 3;
  assert.ok(found > 0 && found < 100000, `搜索后 ${found} 条`);
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, '改查询时不出骨架行、加载面板、空表');
  await area.getByRole('searchbox', { name: '搜索记录' }).fill('');
  await bar.waitFor({ state: 'detached', timeout: 15000 });
  await settled();

  // ---- C. handle (ungrouped)
  const handle = (fn, arg) => page.evaluate(([body, a]) => new Function('grid', 'rows', 'arg', body)(window.__auiServerGrid.current, window.__auiServerRows, a), [fn, arg]);
  await watch();
  const visible = await tag();
  const anchor = visible.keys[3];
  const anchorIndex = Number(await grid.locator(`[data-row-key="${anchor}"]`).getAttribute('data-row-index'));
  const count0 = await rowCount();
  const created = await handle('const row = rows.insert("below", arg); grid.insertRow(row, { after: arg }); return row.id;', anchor);
  await grid.locator(`[data-row-key="${created}"]`).waitFor();
  assert.equal(Number(await grid.locator(`[data-row-key="${created}"]`).getAttribute('data-row-index')), anchorIndex + 1, 'insertRow：紧跟在锚点后面');
  assert.equal(await rowCount(), count0 + 1, 'insertRow：总数 +1');
  assert.deepEqual(await untagged(visible.keys), [], 'insertRow：其余行不重建');
  assert.equal(await handle('return grid.revealRow(arg, { edit: true });', created), true, 'revealRow 找到新行');
  await grid.locator(`[data-row-key="${created}"] .aui-grid-editor input`).waitFor();
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  await handle('const row = { ...rows.find(arg), name: "原地改过的名字" }; grid.patchRows([row]);', created);
  await grid.locator(`[data-row-key="${created}"]`).getByText('原地改过的名字').waitFor();
  // (the last row slid out of the window when the new one came in: tag again)
  const withNew = (await tag()).keys.filter((key) => key !== created);
  await handle('rows.remove([arg]); grid.removeRows([arg]);', created);
  await grid.locator(`[data-row-key="${created}"]`).waitFor({ state: 'detached' });
  assert.equal(await rowCount(), count0, 'removeRows：总数 −1');
  assert.deepEqual(await untagged(withNew), [], 'removeRows：其余行不重建');
  // revealRow: a loaded row below the window → scrolled to and focused; an unknown id → false
  const far = 'HT-00061';
  assert.equal(await handle('return grid.revealRow(arg);', far), true, 'revealRow 已加载但不在屏幕上的行');
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[role=row]')?.dataset.rowKey), far, 'revealRow 后焦点在那一行');
  assert.equal(await handle('return grid.revealRow(arg);', 'HT-NOPE'), false, 'revealRow 找不到的行回答 false');
  await scrollTo(0);
  await settled();
  const again = await tag();
  await handle('grid.refresh();');
  await settled();
  assert.deepEqual(await untagged(again.keys), [], 'handle.refresh 同样不重建行');
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, 'handle 操作全程不出骨架行、加载面板、空表');
  await shot('handle-ungrouped-1440');

  // ---- 8.9.1 a refresh that moves rows across a block boundary lands at once: duplicate a row just above
  // row 100, answer block 1 long before block 0, and no frame shows a skeleton or the same row twice
  await scrollTo(85 * rowH);
  await settled();
  await watch();
  await page.evaluate(() => {
    window.__auiDupRows = 0;
    const g = document.querySelector('[role=grid][aria-label="合同台账（服务端）"]');
    window.__auiDupWatch = new MutationObserver(() => {
      const keys = [...g.querySelectorAll('[role=row][data-row-key]')].map((r) => r.dataset.rowKey);
      if (new Set(keys).size !== keys.length) window.__auiDupRows++;
    });
    window.__auiDupWatch.observe(g, { childList: true, subtree: true, attributes: true });
    window.__auiServerDelay = (offset) => (offset === 0 ? 1500 : 100);
  });
  const boundary = await tag();
  assert.ok(boundary.keys.includes('HT-00100') && boundary.keys.includes('HT-00101'), `块边界两边（第 99 / 100 位）都在屏幕上 ${boundary.keys.slice(0, 3)}…`);
  const dup = await handle('const row = rows.insert("below", "HT-00095"); grid.refresh(); return row.id;');
  await page.waitForTimeout(600); // block 1 answered, block 0 still on its way
  assert.equal(await grid.locator(`[data-row-key="${dup}"]`).count(), 0, '第 1 块先到：还不换（整次刷新一起落）');
  await grid.locator(`[data-row-key="${dup}"]`).waitFor({ timeout: 5000 });
  await settled();
  assert.equal(Number(await grid.locator('[data-row-key="HT-00100"]').getAttribute('data-row-index')), 100, '跨块边界的那一行挪到第 100 行');
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, '跨块刷新：任何一帧都没有骨架行');
  assert.equal(await page.evaluate(() => window.__auiDupRows), 0, '任何一帧都没有同一行出现两次');
  await page.evaluate(() => { window.__auiDupWatch.disconnect(); window.__auiServerDelay = 250; });
  await handle('rows.remove([arg]); grid.removeRows([arg]);', dup);
  await settled();

  // ---- C. handle (grouped by 阶段, server group headers)
  await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    stored.view = { ...stored.view, search: '', groupBy: [{ field: 'stage', order: 'asc' }], collapsed: [] };
    localStorage.setItem(key, JSON.stringify(stored));
  }, VIEW_KEY);
  await modes.getByRole('button', { name: /^前端/ }).click();
  await modes.getByRole('button', { name: /^服务端/ }).click();
  await grid.locator('[role=row].aui-grid-group').first().waitFor();
  await grid.locator('[role=row][data-row-key]').first().waitFor();
  await settled();
  await watch();
  const grouped = await tag();
  const groupCount = () => grid.locator('[role=row].aui-grid-group').first().locator('.aui-grid-group-count').innerText();
  const firstCount = await groupCount();
  const gAnchor = grouped.keys[1];
  const gTotal = await rowCount();
  const gCreated = await handle('const row = rows.insert("below", arg); grid.insertRow(row, { after: arg }); return row.id;', gAnchor);
  await grid.locator(`[data-row-key="${gCreated}"]`).waitFor();
  const gIndex = Number(await grid.locator(`[data-row-key="${gAnchor}"]`).getAttribute('data-row-index'));
  assert.equal(Number(await grid.locator(`[data-row-key="${gCreated}"]`).getAttribute('data-row-index')), gIndex + 1, '分组：insertRow 紧跟锚点');
  assert.equal(await rowCount(), gTotal + 1);
  assert.notEqual(await groupCount(), firstCount, '分组：组头条数 +1');
  assert.deepEqual(await untagged(grouped.keys), [], '分组：insertRow 其余行不重建');
  assert.equal(await handle('return grid.revealRow(arg);', gCreated), true, '分组：revealRow');
  await handle('rows.remove([arg]); grid.removeRows([arg]);', gCreated);
  await grid.locator(`[data-row-key="${gCreated}"]`).waitFor({ state: 'detached' });
  await settled();
  assert.equal(await groupCount(), firstCount, '分组：removeRows 后组头条数回来');
  assert.equal(await rowCount(), gTotal);
  const groupedNow = await tag();
  await handle('grid.refresh();');
  await settled();
  assert.deepEqual(await untagged(groupedNow.keys), [], '分组：refresh 不重建行');
  assert.equal(await grid.evaluate((g) => [...g.querySelectorAll('[role=row].aui-grid-group')].filter((r) => r.__auiTag === undefined).length), 0, '分组：refresh 组头也不重建');
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, '分组：全程不出骨架行、加载面板、空表');
  // B for groups: switching the level keeps the old headers until the new ones and rows arrive
  await watch();
  await toolbar.getByRole('button', { name: /^分组/ }).click();
  const groupPanel = page.getByRole('dialog', { name: '分组', exact: true });
  await groupPanel.waitFor();
  await page.evaluate(() => { window.__auiServerDelay = 1500; });
  await groupPanel.getByRole('button', { name: '删除第 1 级分组' }).click();
  await bar.waitFor({ timeout: 5000 });
  assert.ok(await grid.locator('[role=row].aui-grid-group').count() > 0, '取消分组：新数据到之前旧组头还在');
  await bar.waitFor({ state: 'detached', timeout: 15000 });
  await page.evaluate(() => { window.__auiServerDelay = 250; });
  await page.keyboard.press('Escape');
  await settled();
  assert.equal(await grid.locator('[role=row].aui-grid-group').count(), 0, '新数据到了才换成不分组');
  assert.deepEqual(await seen(), { skeleton: 0, overlay: 0, emptyBody: 0 }, '改分组时不出骨架行、加载面板、空表');
  await shot('handle-grouped-1440');
  assert.deepEqual(await recreated(), []);

  assert.deepEqual(errors, []);
  console.log(`PASS grid-refresh: refresh / footer add keep every row node and the scroll position (no skeleton, no panel), query change keeps old rows + progress bar, handle insertRow / removeRows / patchRows / revealRow / refresh ungrouped + grouped (${output})`);
} finally {
  await browser.close();
  await server.close();
}
