import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/business-tables');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '客户与订单', exact: true }).click();
  const area = page.locator('#aui-page-business');
  const table = area.locator('table');
  const scroll = area.getByRole('region', { name: '客户订单，宽表可横向滚动' });
  const row = id => table.locator(`tr[data-row-key="${id}"]`);
  const click = name => area.getByRole('button', { name, exact: true }).click();
  const bodyHeights = target => target.locator('tbody tr[data-row-key]').evaluateAll(rows => rows.map(row => Math.round(row.getBoundingClientRect().height * 10) / 10));
  const sameHeight = (heights, expected, label) => assert.ok(heights.length > 0 && heights.every(h => Math.abs(h - expected) <= 1), `${label}: 每行应为 ${expected}px，实测 ${JSON.stringify(heights)}`);
  const choose = async (label, value) => { await page.getByLabel(label, { exact: true }).click(); await page.getByRole('option', { name: value, exact: true }).click(); };
  const setRowHeight = async label => {
    await area.getByRole('button', { name: '表格设置', exact: true }).click();
    const settings = page.getByRole('dialog', { name: '表格设置' });
    await settings.getByLabel('行高', { exact: true }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await settings.getByRole('button', { name: '关闭弹窗' }).click();
    await settings.waitFor({ state: 'detached' });
  };
  const grow = async on => { const box = area.getByRole('checkbox', { name: '随内容撑高', exact: true }); if ((await box.isChecked()) !== on) await box.click(); };
  await row('SO-0001').waitFor();
  assert.equal(await row('SO-0001').getByRole('checkbox').isDisabled(), true);
  assert.equal(await row('SO-0002').locator('[data-wrap=true]').evaluate(el => getComputedStyle(el).whiteSpace), 'normal');
  assert.equal(await row('SO-0002').locator('[data-numeric=true]').evaluate(el => getComputedStyle(el).textAlign), 'right');
  await row('SO-0002').getByRole('button', { name: '详情', exact: true }).click();
  const record = page.getByRole('dialog', { name: 'SO-0002 · 远山精密制造与工业自动化有限公司' });
  await record.getByText(/交付前请/).first().waitFor();
  await page.keyboard.press('Escape');
  await record.waitFor({ state: 'detached' });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '详情', '关闭详情，焦点回到打开它的按钮');
  assert.equal(await row('SO-0002').getByRole('checkbox').isChecked(), false, '打开详情不应选中');
  // 批量操作 = 底部浮条，不推动表格；表头半选「−」；选中后操作列照常可点；分页脚「已选 N / 共 M 条」
  const tableTop = async () => Math.round((await scroll.boundingBox()).y);
  const topBefore = await tableTop();
  await row('SO-0002').getByRole('checkbox').click();
  assert.equal(await area.getByRole('checkbox', { name: '选择当前页', exact: true }).getAttribute('aria-checked'), 'mixed', '部分勾选时表头半选');
  const bulk = area.getByRole('toolbar', { name: '批量操作' });
  await bulk.waitFor();
  assert.match(await bulk.innerText(), /已选\s*1\s*条/);
  assert.equal(await tableTop(), topBefore, '批量浮条不推动表格');
  assert.match(await area.locator('.aui-pagination-count').innerText(), /^已选 1 \/ 共 36 条$/);
  await area.getByRole('checkbox', { name: '选择当前页', exact: true }).click();
  assert.match(await bulk.innerText(), /已选\s*8\s*条/);
  assert.equal(await row('SO-0001').getByRole('checkbox').isChecked(), false, '全选排除归档记录');
  assert.equal(await area.getByRole('button', { name: '表格设置', exact: true }).count(), 1, '工具栏不被批量条替换');
  assert.equal(await row('SO-0002').locator('.aui-table-row-actions').getAttribute('inert'), null, '选中后行内操作照常可用');
  assert.equal(await row('SO-0002').getByRole('button', { name: '修改负责人', exact: true }).isEnabled(), true, '选中行的操作列不变灰');
  const geometry0 = await page.evaluate(() => { const bar = document.querySelector('#aui-page-business .aui-bulkbar').getBoundingClientRect(); const panel = document.querySelector('#aui-page-business .aui-table-panel').getBoundingClientRect(); return { center: bar.left + bar.width / 2, panelCenter: panel.left + panel.width / 2, bottom: bar.bottom, viewport: innerHeight, radius: getComputedStyle(document.querySelector('#aui-page-business .aui-bulkbar')).borderRadius }; });
  assert.ok(Math.abs(geometry0.center - geometry0.panelCenter) <= 2 && geometry0.bottom <= geometry0.viewport, `浮条在表格底部居中、在视口里 ${JSON.stringify(geometry0)}`);
  assert.equal(geometry0.radius, '12px');
  await page.screenshot({ path: resolve(output, 'orders-bulk-1440.png'), animations: 'disabled' });
  await bulk.getByRole('button', { name: '标记跟进', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '标记 8 条', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await bulk.waitFor({ state: 'detached' });
  assert.equal(await row('SO-0002').getByRole('checkbox').isChecked(), false, '执行后清空选择');
  await row('SO-0002').getByRole('checkbox').click();
  await bulk.waitFor();
  await bulk.getByRole('button', { name: '清除选择', exact: true }).click();
  await bulk.waitFor({ state: 'detached' });
  await row('SO-0002').getByRole('button', { name: '修改负责人', exact: true }).click();
  await dialog.getByRole('textbox', { name: /负责人/ }).fill('新负责人');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await row('SO-0002').getByText('新负责人', { exact: true }).waitFor();
  // True horizontal/vertical movement: sticky cells must not overlap the utility columns.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(100); // ResizeObserver updates offsets after the table reallocates column widths.
  await scroll.evaluate(el => { el.scrollLeft = 420; el.scrollTop = 170; });
  const geometry = await scroll.evaluate(el => {
    const r = node => { const b = node.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, width: b.width }; };
    return { scroll: r(el), cells: [...el.querySelectorAll('thead th')].slice(0, 3).map(r) };
  });
  assert.ok(Math.abs(geometry.cells[0].y - geometry.scroll.y) < 3, JSON.stringify(geometry));
  for (let i = 1; i < 3; i++) assert.ok(geometry.cells[i].x >= geometry.cells[i - 1].right - 1, `冻结列不能覆盖选择框 ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.cells[2].x - geometry.scroll.x - geometry.cells[0].width - geometry.cells[1].width) < 3, JSON.stringify(geometry));
  // 放不下时末尾的操作列固定在右边：没滚到最右也能看到、能点。1100 宽时表比可视区宽 200px 以上
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.waitForTimeout(150);
  await scroll.evaluate(el => { el.scrollLeft = 0; });
  assert.equal(await scroll.getAttribute('data-overflow'), 'true', '宽表应标记为溢出');
  const pinEnd = await scroll.evaluate(el => {
    const box = el.getBoundingClientRect();
    const cell = el.querySelector('tbody td[data-pin-end=true]').getBoundingClientRect();
    return { overflow: el.scrollWidth - el.clientWidth, clientRight: box.x + el.clientWidth, outerRight: box.right, cell: cell.right };
  });
  // 无头 Chromium 是浮动滚动条但仍保留 scrollbar-gutter，贴边位置落在「可视区右边 ~ 外框右边」之间都算对
  assert.ok(pinEnd.overflow > 100 && pinEnd.cell >= pinEnd.clientRight - 1 && pinEnd.cell <= pinEnd.outerRight + 1, `操作列应贴住可视区右边 ${JSON.stringify(pinEnd)}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(150);
  // 3.0 固定行高：每行一样高；wrap 列在行的行数内截断（省略号 + 悬停全文），不再撑高行
  sameHeight(await bodyHeights(table), 48, '默认（表格偏好 comfortable）');
  const clamped = await table.locator('tbody tr[data-row-key] td[data-wrap=true] > .aui-cell[data-clamp=true]').evaluateAll(cells => cells.map(el => ({ title: el.getAttribute('data-tip'), clipped: el.scrollHeight > el.clientHeight + 1, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) })));
  assert.ok(clamped.some(c => c.clipped && c.title === '远山精密制造与工业自动化有限公司') && clamped.every(c => c.lines <= 1), `wrap 列应截成一行并带全文 ${JSON.stringify(clamped.slice(0, 4))}`);
  await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  await click('订单金额（元）');
  await click('状态');
  assert.equal(await table.locator('.aui-sort-priority').count(), 2);
  assert.equal(await table.locator('th').filter({ hasText: '订单金额' }).getAttribute('aria-sort'), 'ascending');
  assert.equal(await table.locator('th').filter({ hasText: '订单金额' }).locator('svg').count(), 1, '多排序不能同时显示矛盾箭头');
  await table.locator('th').filter({ hasText: '订单金额' }).getByRole('button').click();
  assert.equal(await table.locator('th').filter({ hasText: '订单金额' }).getAttribute('aria-sort'), 'descending');
  // 表头 40px、12px / 600、次要色（和多维表格共用 --aui-table-head-*）
  const headSpec = await table.locator('thead th').nth(3).evaluate(el => { const s = getComputedStyle(el); const scale = parseFloat(getComputedStyle(el.closest('.adminui')).getPropertyValue('--aui-font-scale')) || 1; return { h: Math.round(el.getBoundingClientRect().height), size: Math.round(parseFloat(s.fontSize) / scale * 10) / 10, weight: s.fontWeight, spacing: s.letterSpacing }; });
  assert.deepEqual(headSpec, { h: 40, size: 12, weight: '600', spacing: 'normal' }, '表头规格（12px × 字号倍数）');
  const chipsOf = id => row(id).locator('.aui-cell-chips').first();
  for (const [label, height, lines] of [['矮 · 1 行', 40, 1], ['中 · 2 行', 56, 2], ['高 · 3 行', 88, 3], ['超高 · 5 行', 120, 5]]) {
    await setRowHeight(label);
    // 行高是固定值：长客户名、标签、徽标、操作按钮都不撑高任何一行
    sameHeight(await bodyHeights(table), height, label);
    assert.equal(await area.locator('.aui-table-panel').getAttribute('style').then(v => /--aui-row-lines:\s*(\d+)/.exec(v ?? '')?.[1]), String(lines), `${label} 行数`);
    const overflow = await table.locator('tbody tr[data-row-key] > td').evaluateAll(cells => cells.filter(td => { const c = td.firstElementChild; return c && c.getBoundingClientRect().height > td.getBoundingClientRect().height + 1; }).length);
    assert.equal(overflow, 0, `${label}: 有格子比行还高`);
    const tagLines = Math.max(...await table.locator('tbody tr[data-row-key] .aui-cell-chips').evaluateAll(els => els.map(el => new Set([...el.querySelectorAll(':scope > .aui-chip')].map(chip => Math.round(chip.getBoundingClientRect().top))).size)));
    assert.ok(tagLines <= lines, `${label}: 标签占 ${tagLines} 行，超过 ${lines} 行`);
    await page.screenshot({ path: resolve(output, `orders-row-${height}.png`), fullPage: true, animations: 'disabled' });
  }
  // 紧凑 40（和宽松 48）：CellText 只显示主文字，说明进悬停提示；第二行只在两行 56 出现
  await setRowHeight('矮 · 1 行');
  const firstRow = table.locator('tbody tr[data-row-key]').first();
  assert.equal(await firstRow.locator('.aui-cell-secondary').count(), 0);
  assert.match(await firstRow.locator('.aui-cell-text .aui-cell-line').first().getAttribute('data-tip'), /^(王经理|李工|赵总|孙会计)\n(采购部|设备科|运营|财务)$/);
  // 56px = 两行：wrap 列最多两行，文字离行线至少 4px
  await setRowHeight('中 · 2 行');
  const gaps = await table.locator('tbody tr[data-row-key] td[data-wrap=true]').evaluateAll(cells => cells.map(td => { const c = td.querySelector('.aui-cell').getBoundingClientRect(), r = td.getBoundingClientRect(); return [Math.round(c.top - r.top), Math.round(r.bottom - c.bottom), Math.round(c.height)]; }));
  assert.ok(gaps.every(([top, bottom, h]) => top >= 4 && bottom >= 4 && h <= 41), `两行档文字不贴行线且不超过两行 ${JSON.stringify(gaps)}`);
  // 逃生口 rowHeight="auto"：行高是最小值，长内容撑高那一行，多行格子上下留白（用户选的行高优先，先回到默认）
  await setRowHeight('默认');
  await grow(true);
  const grown = await bodyHeights(table);
  assert.ok(Math.max(...grown) > Math.min(...grown) + 4, `rowHeight=auto 时长内容应撑高行 ${JSON.stringify(grown)}`);
  const wrapped = await table.locator('tbody td[data-wrap=true]').evaluateAll(cells => cells.filter(el => el.getBoundingClientRect().height > 50).map(el => { const s = getComputedStyle(el); return [parseFloat(s.paddingTop), parseFloat(s.paddingBottom)]; }));
  assert.ok(wrapped.length > 0 && wrapped.every(([top, bottom]) => top >= 4 && bottom >= 4), `多行格子要有上下留白 ${JSON.stringify(wrapped)}`);
  await grow(false);
  const cards = area.locator('.aui-table-card');
  for (const width of [1920, 1440, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 整页溢出`);
    const phone = width < 760;
    if (phone) {
      // 手机默认卡片列表，不横滚；名字 + 状态一行，负责人 / 金额 / 日期一行，勾选和 ⋯ 在卡片上
      assert.equal(await area.locator('table').count(), 0, '手机不出横滑表格');
      assert.equal(await cards.count(), 10);
      const card = cards.filter({ has: page.locator('.aui-table-card-check button:not([disabled])') }).first();
      const cardKey = await card.getAttribute('data-row-key');
      assert.match(await card.locator('.aui-table-card-title').innerText(), /Acme|远山精密|星河|青禾/);
      assert.match(await card.locator('.aui-table-card-status').innerText(), /^(待跟进|跟进中)$/);
      assert.equal(await card.locator('.aui-table-card-field').count(), 3, '灰字行 3 项');
      assert.equal(await card.getByRole('button', { name: `${cardKey}的更多操作`, exact: true }).count(), 1, '⋯ 在卡片上');
      assert.equal(await card.getByRole('button', { name: '详情', exact: true }).count(), 0, '卡片上不摆文字按钮');
      assert.equal(await card.getByRole('checkbox').count(), 1);
      assert.ok(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth), '卡片不横向溢出');
    } else await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
    await page.screenshot({ path: resolve(output, `orders-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
    await page.mouse.move(0, 0);
    if (!phone) {
      const backgrounds = await table.locator('tbody tr[data-row-key]').evaluateAll(rows => rows.slice(0, 2).map(row => getComputedStyle(row).backgroundColor));
      assert.notEqual(backgrounds[0], backgrounds[1], '深色斑马纹应可区分');
    }
    await page.screenshot({ path: resolve(output, `orders-dark-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
    if (phone) {
      // 手机上批量条贴屏幕底，动作超过 2 个进 ⋯
      await cards.filter({ has: page.locator('.aui-table-card-check button:not([disabled])') }).first().getByRole('checkbox').click();
      const bar = area.getByRole('toolbar', { name: '批量操作' });
      await bar.waitFor();
      await page.waitForTimeout(250);
      const box = await bar.boundingBox();
      assert.ok(box.y + box.height >= 1000 - 16 && box.y + box.height <= 1000 && box.x >= 0 && box.x + box.width <= width, `手机批量条贴屏幕底 ${JSON.stringify(box)}`);
      assert.equal(await bar.getByRole('button', { name: '更多批量操作', exact: true }).count(), 1, '手机上第 3 个动作进 ⋯');
      await page.screenshot({ path: resolve(output, `orders-bulk-${width}.png`), animations: 'disabled' });
      await bar.getByRole('button', { name: '清除选择', exact: true }).click();
      await bar.waitFor({ state: 'detached' });
    }
  }
  // 2.1.0 单行截断：省略号、只占一行、悬停有全文
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(150);
  await scroll.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  const clip = await table.locator('tbody tr[data-row-key] td[data-truncate=true] .aui-cell-clip').first().evaluate(el => ({ title: el.getAttribute('data-tip'), clipped: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow, height: el.getBoundingClientRect().height }));
  assert.ok(clip.clipped && clip.ellipsis === 'ellipsis' && clip.height < 30 && /完整业务备注/.test(clip.title ?? ''), `长备注应单行截断且悬停有全文 ${JSON.stringify(clip)}`);
  // 2.1.0 分组：整行宽的分组标题（th scope=rowgroup），按组排、组内按列排序，不穿插；可折叠
  await choose('分组', '按区域');
  const groupKeys = () => table.locator('tbody[data-group-key]').evaluateAll(els => els.map(el => el.getAttribute('data-group-key')));
  assert.deepEqual(await groupKeys(), ['华东'], '第一页只有第一组（12 条 > 每页 10 条），组不穿插');
  const head = table.locator('tbody[data-group-key="华东"] tr.aui-table-group > th');
  assert.equal(await head.getAttribute('scope'), 'rowgroup');
  assert.equal(Number(await head.getAttribute('colspan')), await table.locator('thead th').count(), '分组标题占满整行');
  assert.match(await head.innerText(), /华东[\s\S]*共 12 条/);
  const regionIndex = await table.locator('thead th').evaluateAll(ths => ths.findIndex(th => th.textContent === '区域'));
  const regions = await table.locator('tbody[data-group-key] tr[data-row-key]').evaluateAll((rows, i) => rows.map(row => row.children[i]?.textContent), regionIndex);
  assert.ok(regions.length === 10 && regions.every(r => r === '华东'), `组内只有本组的行 ${JSON.stringify(regions)}`);
  await area.getByRole('button', { name: '第 2 页', exact: true }).click();
  assert.deepEqual(await groupKeys(), ['华东', '华南'], '翻页后接着上一组，再到下一组');
  await area.getByRole('button', { name: '第 1 页', exact: true }).click();
  const fold = area.getByRole('button', { name: '收起分组 华东', exact: true });
  assert.equal(await fold.getAttribute('aria-expanded'), 'true');
  await fold.click();
  assert.equal(await table.locator('tbody[data-group-key="华东"] tr[data-row-key]').count(), 0, '收起后组内的行不渲染');
  await area.getByRole('button', { name: '展开分组 华东', exact: true }).click();
  assert.equal(await table.locator('tbody[data-group-key="华东"] tr[data-row-key]').count(), 10);
  await page.screenshot({ path: resolve(output, 'orders-grouped.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.screenshot({ path: resolve(output, 'orders-grouped-dark.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await choose('分组', '不分组');
  assert.equal(await table.locator('tbody[data-group-key]').count(), 0);
  // A long label in a cell button (hosts render titles as link buttons) that wraps: in fixed rows (3.0) it
  // neither grows the row nor spills into the next one (the cell clips it); with rowHeight="auto" it grows the row.
  // (Phones show cards; the narrow table is checked at 800px.)
  await page.setViewportSize({ width: 800, height: 1000 });
  const inject = () => table.locator('tbody tr[data-row-key]').first().evaluate(row => {
    const before = row.getBoundingClientRect().height;
    const cell = row.querySelector('td:last-child');
    const holder = cell.firstElementChild ?? cell;
    const b = document.createElement('button');
    b.className = 'aui-button aui-button-link';
    b.style.whiteSpace = 'normal';
    b.style.width = '96px';
    b.textContent = '一个很长很长的标题会在窄屏上折成好几行显示';
    holder.append(b);
    const r = b.getBoundingClientRect(), rr = row.getBoundingClientRect(), box = holder.getBoundingClientRect();
    const out = { before, after: rr.height, bottom: r.bottom - rr.bottom, boxBottom: box.bottom - rr.bottom, height: r.height, clip: getComputedStyle(holder).overflowY };
    b.remove();
    return out;
  });
  const fixedSpill = await inject();
  assert.ok(fixedSpill.height > 48 && Math.abs(fixedSpill.after - fixedSpill.before) <= 1 && fixedSpill.boxBottom <= 1 && fixedSpill.clip === 'clip', `固定行高下折行按钮不撑高行、裁在格子里，实测 ${JSON.stringify(fixedSpill)}`);
  await grow(true);
  const spill = await inject();
  assert.ok(spill.height > 48 && spill.bottom <= 1, `rowHeight=auto 时折行按钮应撑高行而不是溢出到下一行，实测 ${JSON.stringify(spill)}`);
  await grow(false);

  // ---- 标签 +N、展开记录、深色对比度（同一张订单表）----
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Fresh page state (no sort, default page) so SO-0001… are on page 1 in order.
  await page.reload();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '客户与订单', exact: true }).click();
  await row('SO-0003').waitFor();
  sameHeight(await bodyHeights(table), 48, '默认行高');
  // +N：数量与隐藏项一致；悬停文字和弹出层列出其余的标签；Esc 关闭并回到 +N
  const more = chipsOf('SO-0003').locator('button.aui-chip-more');
  await more.waitFor();
  const shown = await chipsOf('SO-0003').locator(':scope > .aui-chip:not(.aui-chip-more)').allInnerTexts();
  const hiddenCount = Number((await more.innerText()).replace('+', ''));
  assert.equal(shown.length + hiddenCount, 7, `可见 ${shown.length} + 隐藏 ${hiddenCount} 应等于 7 个标签`);
  const allTags = ['重点客户', '华东一区', '年框合同', '需开专票', '账期 60 天', '逾期风险', '已签保密协议'];
  const rest = allTags.slice(shown.length);
  assert.equal(await more.getAttribute('data-tip'), rest.join('、'));
  await more.click();
  const popover = page.getByRole('dialog', { name: `另外 ${hiddenCount} 项` });
  await popover.waitFor();
  assert.deepEqual(await popover.locator('.aui-chip-label').allInnerTexts(), rest, '弹出层列出其余的标签');
  await page.keyboard.press('Escape');
  await popover.waitFor({ state: 'detached' });
  assert.equal(await more.evaluate(el => el === document.activeElement), true, 'Esc 后焦点回到 +N');
  // 展开记录：字段多 → 居中大弹框，列出全部字段（不截断）；上一条 / 下一条、Alt+↑/↓、Esc 与焦点归还
  const opener = row('SO-0002').getByRole('button', { name: '展开记录 SO-0002', exact: true });
  await opener.click();
  const expanded = page.getByRole('dialog', { name: 'SO-0002 · 远山精密制造与工业自动化有限公司' });
  await expanded.waitFor();
  await page.waitForTimeout(400); // 等弹框动画结束再量位置
  for (const label of ['联系人', '协作人', '合同', '更新时间']) await expanded.getByText(label, { exact: true }).first().waitFor();
  const box = await expanded.boundingBox();
  assert.ok(Math.abs(box.x + box.width / 2 - 720) <= 1, `桌面详情弹框居中 ${JSON.stringify(box)}`);
  await page.screenshot({ path: resolve(output, 'orders-record-1440.png'), animations: 'disabled' });
  await expanded.getByRole('button', { name: /^下一条/ }).click();
  const next = page.getByRole('dialog', { name: 'SO-0003 · 星河供应链' });
  await next.waitFor();
  assert.deepEqual(await next.locator('.aui-chip-label').evaluateAll(els => els.map(el => el.textContent).filter(t => t !== '陈晓' && t !== '林宁' && t !== '周敏')), allTags, '展开记录里标签全部显示');
  assert.equal(await next.locator('.aui-chip-more').count(), 0);
  await page.keyboard.press('Alt+ArrowDown');
  await page.getByRole('dialog', { name: 'SO-0004 · 青禾商贸' }).waitFor();
  await page.keyboard.press('Alt+ArrowUp');
  await page.keyboard.press('Alt+ArrowUp');
  await page.getByRole('dialog', { name: 'SO-0002 · 远山精密制造与工业自动化有限公司' }).waitFor();
  await page.keyboard.press('Alt+ArrowUp');
  await page.getByRole('dialog', { name: 'SO-0001 · Acme 科技' }).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: /^上一条/ }).getAttribute('aria-disabled'), 'true', '第一条时「上一条」不可用');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '展开记录 SO-0001', '切换后关闭，焦点到当前记录的展开按钮');
  // 360 / 390 / 1440：整页不横向溢出；手机抽屉全屏；深色下标签、+N、链接对比度
  const contrast = (fg, bg) => {
    // color-mix() 的结果是 color(srgb 0–1 …)，rgb() 是 0–255
    const channels = c => c.startsWith('color(') ? c.match(/[\d.]+/g).slice(0, 3).map(Number) : c.match(/[\d.]+/g).slice(0, 3).map(v => Number(v) / 255);
    const lum = c => channels(c).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const [low, high] = [lum(fg), lum(bg)].sort((a, b) => a - b);
    return (high + .05) / (low + .05);
  };
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `订单表 ${width}px 整页溢出`);
    await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300); // 颜色过渡结束
    const colors = await table.locator('tbody tr[data-row-key] :is(.aui-chip, .aui-cell-link)').evaluateAll(els => els.filter(el => !el.closest('.aui-chip-measure')).slice(0, 40).map(el => {
      let node = el, bg = 'rgba(0, 0, 0, 0)';
      while (node && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { bg = getComputedStyle(node).backgroundColor; node = node.parentElement; }
      return { text: el.textContent, fg: getComputedStyle(el.querySelector('.aui-chip-label, .aui-cell-link-text') ?? el).color, bg };
    }));
    const weak = colors.map(c => ({ ...c, ratio: contrast(c.fg, c.bg) })).filter(c => c.ratio < 4.5);
    assert.deepEqual(weak, [], `深色模式对比度不足 ${width}px`);
    await page.screenshot({ path: resolve(output, `orders-cells-dark-${width}.png`), fullPage: true, animations: 'disabled' });
    if (width < 760) {
      await area.locator('.aui-table-card[data-row-key="SO-0002"]').getByRole('button', { name: '展开记录 SO-0002', exact: true }).click();
      const phone = page.getByRole('dialog', { name: 'SO-0002 · 远山精密制造与工业自动化有限公司' });
      await phone.waitFor();
      await page.waitForTimeout(250);
      const r = await phone.boundingBox();
      assert.ok(r.width <= width + 1, `手机详情弹框不超出屏幕 ${JSON.stringify(r)}`);
      assert.ok(await phone.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && [...el.querySelectorAll('.aui-dialog-body')].every(b => b.scrollWidth <= b.clientWidth + 1)), '手机详情内容不横向溢出');
      await page.screenshot({ path: resolve(output, `orders-record-dark-${width}.png`), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await phone.waitFor({ state: 'detached' });
    }
    await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS business tables: fixed row heights (short/medium/tall/extraTall from 表格设置 keep every row the same height, wrap clamps with full-text title, rowHeight="auto" escape hatch grows rows), CellTags +N fit/title/popover/Esc, CellText compact rows, expandRecord dialog (row 详情 + leading icon, all fields, prev/next, Alt+↑/↓, Esc focus return, phone), dark contrast and 360/390/1440 without page overflow; single-line truncation, row grouping (rowgroup headers, no interleaving across pages, collapse), wrapping cell buttons clipped in fixed rows / grow the row with rowHeight="auto", selection eligibility, batch isolation, editing, frozen geometry, multi-sort, responsive/dark (${output})`);
} finally { await browser.close(); await server.close(); }
