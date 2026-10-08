// 多维表格 BitableGrid（@adminui/react/grid）浏览器验收：starter「系统 → 多维表格」2000 条记录。
// 量的是真实几何与焦点：每行实际高度、渲染出来的行数、横滚后冻结列位置、拖动后的列宽与持久化、
// 分组折叠、统计值、键盘导航 + Enter 展开记录 + 焦点归还、360/390/1440 整页不横向溢出、深色对比度。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/grid');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const VIEW_KEY = 'starter:demo:bitable-contracts:view';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const open = async () => {
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '多维表格', exact: true }).click();
    await page.locator('[role=grid][aria-label=合同台账] [data-row-key]').first().waitFor();
  };
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(key => localStorage.removeItem(key), VIEW_KEY);
  await open();
  const grid = page.getByRole('grid', { name: '合同台账' });
  const area = page.locator('#aui-page-bitable');
  const toolbar = area.getByRole('toolbar', { name: '视图工具栏' });
  const tool = name => toolbar.getByRole('button', { name: new RegExp(`^${name}`) });
  const popover = name => page.getByRole('dialog', { name, exact: true });
  const menu = name => page.getByRole('menu', { name, exact: true });
  const dataRows = () => grid.locator('[role=row][data-row-key]');
  const rowHeights = () => dataRows().evaluateAll(rows => rows.map(row => Math.round(row.getBoundingClientRect().height * 10) / 10));
  const header = title => grid.getByRole('columnheader', { name: new RegExp(`^${title}`) });

  // ---- ARIA grid semantics
  assert.equal(await grid.getAttribute('aria-rowcount'), String(2000 + 5 + 2), '2000 条 + 5 个分组标题 + 表头 + 统计行');
  assert.equal(await grid.getAttribute('aria-multiselectable'), 'true');
  assert.ok(Number(await grid.getAttribute('aria-colcount')) >= 14);
  assert.equal(await grid.locator('[role=row][aria-rowindex="1"] [role=columnheader]').count(), Number(await grid.getAttribute('aria-colcount')));
  const tabStops = await grid.evaluate(el => [...el.querySelectorAll('a[href], button, input, [tabindex]')].filter(n => n.tabIndex >= 0).map(n => n.outerHTML.slice(0, 160)));
  assert.equal(tabStops.length, 1, '网格只有一个 Tab 停靠点（roving tabindex；格子里的链接、+N、勾选框不进 Tab 顺序）');

  // ---- Virtualization: 2000 rows, only a window is in the DOM
  const rendered = await dataRows().count();
  assert.ok(rendered > 10 && rendered < 60, `只渲染可视窗口的行，实际 ${rendered}`);
  const scroll = grid; // role=grid is the scroll box
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight / 2; });
  await page.waitForTimeout(150);
  const middle = await dataRows().evaluateAll(rows => rows.map(r => Number(r.getAttribute('aria-rowindex'))));
  assert.ok(middle.length < 60 && Math.min(...middle) > 600, `滚到中间渲染中间那一段 ${middle.slice(0, 3)}…（${middle.length} 行）`);
  await scroll.evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(100);

  // ---- Fixed row heights at each preset (and no cell taller than its row)
  for (const [label, height] of [['矮', 32], ['中', 56], ['高', 88], ['超高', 120]]) {
    await tool('行高').click();
    await popover('行高').getByRole('button', { name: label, exact: true }).click();
    await page.keyboard.press('Escape');
    // Wait until every rendered row has the new height (a busy machine may need more than one frame)
    let heights = await rowHeights();
    for (let i = 0; i < 40 && !heights.every(h => Math.abs(h - height) <= 0.5); i++) {
      await page.waitForTimeout(50);
      heights = await rowHeights();
    }
    assert.ok(heights.length > 3 && heights.every(h => Math.abs(h - height) <= 0.5), `${label}: 每行 ${height}px，实测 ${JSON.stringify(heights)}`);
    const overflow = await dataRows().evaluateAll((rows, h) => rows.flatMap(row => [...row.children].filter(cell => Math.abs(cell.getBoundingClientRect().height - h) > 0.5 || cell.scrollHeight > cell.clientHeight + 1).map(cell => cell.getAttribute('aria-colindex'))), height);
    assert.deepEqual(overflow, [], `${label}: 没有格子比行高或内容溢出格子`);
    const lines = await grid.locator('[data-type=longText] .aui-cell-long').first().evaluate(el => getComputedStyle(el).webkitLineClamp);
    assert.equal(lines, String({ 32: 1, 56: 2, 88: 3, 120: 5 }[height]), `${label}: 长文本截到 ${lines} 行`);
    await page.screenshot({ path: resolve(output, `row-height-${height}.png`), animations: 'disabled' });
  }
  await tool('行高').click();
  await popover('行高').getByRole('button', { name: '矮', exact: true }).click();
  await page.keyboard.press('Escape');

  // ---- Frozen column stays on horizontal scroll
  const frozenAt = () => grid.evaluate(el => {
    const box = el.getBoundingClientRect();
    const row = el.querySelector('[role=row][data-row-key]');
    const [num, primary, third] = [...row.children].map(c => c.getBoundingClientRect());
    const head = el.querySelector('[role=columnheader][data-field-key=name]').getBoundingClientRect();
    return { box: box.x, num: num.x, primary: primary.x, primaryRight: primary.right, third: third.x, head: head.x, scrollLeft: el.scrollLeft };
  });
  const before = await frozenAt();
  await scroll.evaluate(el => { el.scrollLeft = 700; });
  await page.waitForTimeout(80);
  const after = await frozenAt();
  assert.ok(after.scrollLeft > 600, '确实横向滚动了');
  assert.ok(Math.abs(after.num - before.num) < 1 && Math.abs(after.primary - before.primary) < 1 && Math.abs(after.head - before.head) < 1, `行号列和主字段列冻结 ${JSON.stringify({ before, after })}`);
  assert.ok(after.third < before.third - 600, '其余列滚走了');
  await scroll.evaluate(el => { el.scrollLeft = 0; });

  // ---- Column resize by drag persists in the view (and survives a reload)
  const stageHeader = header('阶段');
  const startWidth = (await stageHeader.boundingBox()).width;
  const handle = stageHeader.locator('.aui-grid-resizer');
  const h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 40, h.y + h.height / 2, { steps: 4 });
  await page.mouse.move(h.x + h.width / 2 + 90, h.y + h.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const resized = (await stageHeader.boundingBox()).width;
  assert.ok(Math.abs(resized - startWidth - 90) <= 3, `拖动 90px 后列宽 ${startWidth} → ${resized}`);
  const cellWidth = (await grid.locator('[role=row][data-row-key] > [aria-colindex="3"]').first().boundingBox()).width;
  assert.ok(Math.abs(cellWidth - resized) <= 1, '格子跟着表头一起变宽');
  const stored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), VIEW_KEY));
  assert.ok(Math.abs(stored.view.widths.stage - resized) <= 1, `列宽写进视图 ${JSON.stringify(stored.view.widths)}`);
  // Keyboard resize on the header: Alt + →
  await stageHeader.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForTimeout(50);
  assert.ok(Math.abs((await stageHeader.boundingBox()).width - resized - 16) <= 1, 'Alt + → 加宽 16px');

  // ---- Column reorder by drag: 标签 before 阶段
  const tagsHeader = header('标签');
  const from = await tagsHeader.boundingBox();
  const to = await stageHeader.boundingBox();
  await page.mouse.move(from.x + 30, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 6 });
  assert.equal(await grid.locator('.aui-grid-drop').count(), 1, '拖动时显示插入位置');
  await page.mouse.up();
  await page.waitForTimeout(100);
  const order = await grid.locator('[role=columnheader][data-field-key]').evaluateAll(cells => cells.map(c => c.dataset.fieldKey));
  assert.deepEqual(order.slice(0, 3), ['name', 'tags', 'stage'], `拖动后顺序 ${order}`);
  assert.equal(await menu('标签字段菜单').count(), 0, '拖动结束不打开字段菜单');

  // Reload: widths and order come back from localStorage.
  await page.reload();
  await open();
  const reloadedOrder = await grid.locator('[role=columnheader][data-field-key]').evaluateAll(cells => cells.map(c => c.dataset.fieldKey));
  assert.deepEqual(reloadedOrder.slice(0, 3), ['name', 'tags', 'stage'], '刷新后列顺序保留');
  assert.ok(Math.abs((await header('阶段').boundingBox()).width - resized - 16) <= 1, '刷新后列宽保留');

  // ---- Groups: collapse with counts
  const groupRow = name => grid.locator('[role=row].aui-grid-group').filter({ has: page.locator('.aui-grid-group-label', { hasText: new RegExp(`^${name}$`) }) });
  const leadGroup = groupRow('线索');
  const leadCount = Number((await leadGroup.locator('.aui-grid-group-count').textContent()).replace(/\D/g, ''));
  assert.ok(leadCount > 100, `分组标题显示条数 ${leadCount}`);
  assert.equal(await leadGroup.getAttribute('aria-expanded'), 'true');
  await leadGroup.locator('.aui-grid-group-cell').click();
  assert.equal(await leadGroup.getAttribute('aria-expanded'), 'false');
  const groupIndexes = await grid.locator('[role=row].aui-grid-group').evaluateAll(rows => rows.map(r => Number(r.getAttribute('aria-rowindex'))));
  assert.equal(groupIndexes[1] - groupIndexes[0], 1, '收起的组只剩标题，下一组紧跟着');
  assert.equal(await grid.getAttribute('aria-rowcount'), String(2000 - leadCount + 5 + 2));
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').view?.collapsed?.[0] === 'lead', VIEW_KEY, { timeout: 2000 }); // 折叠状态在视图里（防抖 150ms 写入）
  await leadGroup.locator('.aui-grid-group-cell').focus();
  await page.keyboard.press('Enter');
  assert.equal(await leadGroup.getAttribute('aria-expanded'), 'true', '键盘回车展开分组');

  // ---- Summary bar values
  const summaryCell = key => grid.locator(`.aui-grid-summary-row [data-field-key=${key}]`);
  const paidText = await area.getByText(/已回款 \d+ 条/).textContent();
  const paid = paidText.match(/已回款 (\d+) 条/)[1];
  assert.equal((await summaryCell('paid').textContent()).replace(/\s/g, ''), `已勾选${paid}`, '勾选字段统计 = 页面独立算出的已回款数');
  assert.match(await grid.locator('.aui-grid-summary-total').textContent(), /^2000 条(记录)?$/);
  await toolbar.getByRole('searchbox', { name: '搜索记录' }).fill('HT-00002');
  await page.waitForTimeout(100);
  assert.equal(await dataRows().count(), 1, '搜索编号只剩一条');
  const only = dataRows().first();
  const amountText = (await only.locator('[data-type=money]').textContent()).trim();
  assert.equal((await summaryCell('amount').locator('.aui-grid-summary-value').textContent()).trim(), amountText, '求和 = 唯一那条的金额');
  const seats = (await only.locator('[data-type=number]').textContent()).trim();
  assert.equal((await summaryCell('seats').locator('.aui-grid-summary-value').textContent()).trim(), seats === '—' ? '—' : seats, '平均值 = 唯一那条的席位数');
  assert.match(await toolbar.textContent(), /筛选出 1 \/ 2000 条/);
  // Pick another statistic from the summary bar.
  await summaryCell('amount').click();
  await popover('合同金额的统计方式').getByRole('button', { name: /^最大值/ }).click();
  assert.equal((await summaryCell('amount').locator('.aui-grid-summary-label').textContent()).trim(), '最大值');
  assert.equal((await summaryCell('amount').locator('.aui-grid-summary-value').textContent()).trim(), amountText);
  // No results: the empty state offers clearing search and filters.
  await toolbar.getByRole('searchbox', { name: '搜索记录' }).fill('不存在的客户 xyz');
  await area.getByText('没有符合筛选条件的记录').waitFor();
  await area.getByRole('button', { name: '清除筛选和搜索' }).click();
  await dataRows().first().waitFor();
  assert.equal(await toolbar.getByRole('searchbox', { name: '搜索记录' }).inputValue(), '');

  // ---- Filter panel (v2): 阶段 是 赢单 through the searchable field picker and the value picker
  await tool('筛选').click();
  const filterPop = popover('筛选条件');
  await filterPop.getByRole('button', { name: '添加条件', exact: true }).click();
  await filterPop.getByRole('button', { name: /^筛选字段/ }).click();
  await page.getByRole('listbox', { name: '筛选字段' }).getByRole('option', { name: '阶段', exact: true }).click();
  await filterPop.getByRole('combobox', { name: /^筛选值/ }).click();
  await page.getByRole('listbox', { name: '筛选值' }).getByRole('option', { name: '赢单' }).click();
  await page.waitForTimeout(80);
  assert.equal(await filterPop.isVisible(), true, '在弹层里选字段 / 值不会关掉筛选面板');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  assert.equal(await grid.locator('[role=row].aui-grid-group').count(), 1, '只剩「赢单」一组');
  assert.match(await tool('筛选').textContent(), /筛选\s*1/);
  await tool('筛选').click();
  await filterPop.getByRole('button', { name: '清空' }).click();
  await page.mouse.click(5, 5); // outside click closes
  assert.equal(await filterPop.count(), 0);

  // ---- Column menu: sort and hide
  await header('合同金额').click();
  await menu('合同金额字段菜单').getByRole('menuitemcheckbox', { name: /^降序/ }).click();
  assert.equal(await header('合同金额').getAttribute('aria-sort'), 'descending');
  const amounts = await grid.locator('[role=row].aui-grid-group').first().evaluate(group => {
    const out = []; let node = group.nextElementSibling;
    while (node && !node.classList.contains('aui-grid-group') && out.length < 8) { out.push(node.querySelector('[data-type=money]').textContent); node = node.nextElementSibling; }
    return out;
  });
  const asNumber = text => Number(text.replace(/[^\d.]/g, ''));
  assert.ok(amounts.length > 3 && amounts.every((a, i) => i === 0 || asNumber(amounts[i - 1]) >= asNumber(a)), `组内按金额降序 ${amounts}`);
  await header('联系邮箱').click();
  await menu('联系邮箱字段菜单').getByRole('menuitem', { name: '隐藏字段' }).click();
  assert.equal(await header('联系邮箱').count(), 0);
  assert.equal(await toolbar.getByRole('button', { name: /已隐藏 1 个字段/ }).count(), 1, '字段按钮显示隐藏数（徽标 + 读屏名）');

  // ---- Keyboard navigation, Space opens the record, Alt+↓ next record, Esc returns focus
  await grid.evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
  const firstKey = await dataRows().first().getAttribute('data-row-key');
  await grid.locator(`[role=row][data-row-key="${firstKey}"] [role=rowheader]`).click();
  const focused = () => page.evaluate(() => { const el = document.activeElement; const row = el.closest('[role=row]'); return { cell: el.dataset.cell, col: el.getAttribute('aria-colindex'), row: row?.getAttribute('aria-rowindex'), key: row?.dataset.rowKey ?? null, tab: el.tabIndex }; });
  const start = await focused();
  assert.equal(start.col, '2');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  const moved = await focused();
  assert.equal(Number(moved.row), Number(start.row) + 2, '↓↓ 移两行');
  assert.equal(moved.col, '3', '→ 移一列');
  assert.equal(moved.tab, 0, '当前格是唯一的 Tab 停靠点');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown');
  const far = await focused();
  assert.equal(Number(far.row), Number(start.row) + 42, '键盘移出可视区后虚拟滚动跟上，焦点仍在格子上');
  const farBox = await page.locator(':focus').boundingBox();
  const gridBox = await grid.boundingBox();
  assert.ok(farBox.y >= gridBox.y + 40 - 1 && farBox.y + farBox.height <= gridBox.y + gridBox.height - 36 + 1, '焦点格滚进可视区（不被表头 / 统计栏挡住）');
  await page.keyboard.press('Space');
  const drawer = page.getByRole('dialog').filter({ has: page.locator('.aui-record-dialog') });
  await drawer.waitFor();
  const openedKey = await drawer.locator('.aui-record-dialog').getAttribute('data-record-key');
  assert.equal(openedKey, far.key, '空格打开当前行的记录');
  assert.ok(await drawer.getByText('合同金额').count() >= 1 && await drawer.getByText('联系邮箱').count() >= 1, '详情列出字段（含表格里隐藏的字段）');
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(50);
  const nextKey = await drawer.locator('.aui-record-dialog').getAttribute('data-record-key');
  assert.notEqual(nextKey, openedKey, 'Alt + ↓ 下一条');
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  await page.waitForTimeout(120);
  const back = await focused();
  assert.equal(back.key, nextKey, '切换过再关闭，焦点到当前那条记录的行');
  // Space selects the row from the keyboard; the bottom floating bar counts it, the grid doesn't move.
  const frameTop = (await grid.boundingBox()).y;
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  assert.equal(await grid.locator(`[role=row][data-row-key="${nextKey}"]`).getAttribute('aria-selected'), 'true');
  const bulk = area.getByRole('toolbar', { name: '批量操作' });
  await bulk.waitFor();
  assert.match(await bulk.innerText(), /已选\s*1\s*条/);
  assert.equal(await toolbar.getByText(/已选择/).count(), 0, '工具栏不再写「已选择 N 条」');
  assert.equal((await grid.boundingBox()).y, frameTop, '浮条不把表格往下推');
  await page.screenshot({ path: resolve(output, 'grid-bulk-bar.png'), animations: 'disabled' });
  await bulk.getByRole('button', { name: '清除选择' }).click();
  await bulk.waitFor({ state: 'detached' });
  // Expand button in the row-number column (visible on hover) opens the drawer too; closing returns focus to it.
  await grid.evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(100);
  const row1 = dataRows().first();
  await row1.locator('[role=rowheader]').hover();
  const expand = row1.getByRole('button', { name: /^展开记录 / });
  await expand.click();
  await drawer.waitFor();
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), await expand.getAttribute('aria-label'), '没切换就关闭，焦点回到展开图标');

  // ---- 360 / 390 / 1440: no page-level horizontal overflow; frozen column holds at 390
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 整页横向溢出`);
    const heights = await rowHeights();
    assert.ok(heights.every(h2 => Math.abs(h2 - (width < 760 ? 44 : 32)) <= 0.5), `${width}px 行高 ${heights.slice(0, 4)}`);
    if (width < 760) {
      const pre = await frozenAt();
      assert.ok(pre.primaryRight - pre.box <= width * 0.62, `手机上冻结块不超过 60% 宽 ${JSON.stringify(pre)}`);
      await scroll.evaluate(el => { el.scrollLeft = 400; });
      await page.waitForTimeout(80);
      const post = await frozenAt();
      assert.ok(post.scrollLeft > 300 && Math.abs(post.primary - pre.primary) < 1, `${width}px 冻结列横滚不动`);
      await scroll.evaluate(el => { el.scrollLeft = 0; });
    }
    await page.screenshot({ path: resolve(output, `grid-${width}-light.png`), animations: 'disabled' });
  }

  // ---- Dark mode: contrast of header, cells, group titles, summary, toolbar
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const contrast = await page.evaluate(() => {
    const rgb = s => { const n = (s.match(/[\d.]+/g) || []).map(Number); return s.startsWith('color(srgb') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; }; // color-mix() computes to color(srgb …)
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bg = el => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return [255, 255, 255]; };
    const ratio = el => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const pick = sel => [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().width > 2 && el.textContent.trim()).slice(0, 6);
    const out = {};
    for (const sel of ['.aui-grid-htitle', '.aui-grid-cell[data-type=text] .aui-grid-text', '.aui-grid-cell[data-type=money] .aui-cell', '.aui-grid-rownum', '.aui-grid-group-label', '.aui-grid-group-count', '.aui-grid-group-field', '.aui-grid-summary-value', '.aui-grid-summary-label', '.aui-grid-summary-total', '.aui-grid-count', '.aui-grid-tool-label', '.aui-chip-label'])
      out[sel] = Math.min(...pick(sel).map(ratio));
    return out;
  });
  for (const [sel, value] of Object.entries(contrast)) assert.ok(value >= 4.5, `深色 ${sel} 对比度 ${value.toFixed(2)}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(output, 'grid-390-dark.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(output, 'grid-1440-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: resolve(output, 'grid-1440-light.png'), animations: 'disabled' });

  assert.deepEqual(errors, []);
  console.log(`PASS grid: ARIA grid + roving focus, virtualization (${rendered}/2000 rows in DOM), fixed heights 32/56/88/120, frozen column, resize + reorder persisted, group collapse, summaries, keyboard + expand record, 360/390/1440, dark contrast (${output})`);
} finally {
  await browser.close();
  await server.close();
}
