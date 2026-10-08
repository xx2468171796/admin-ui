// bt/grid-a 浏览器验收：多维表格视图 v2（starter「系统 → 多维表格」）。
// 字段配置（搜索、全部隐藏 / 显示、编组眼睛、受限字段锁、键盘拖动）· 筛选（条件组 + 任一满足 + 「我」+ 数字，结果逐行核对）·
// 三级分组（组头层级 / 统计 / 显示空分组 / 全部收起展开 / 拖动层级）· 排序（首先 / 然后、方向文字、自动排序）·
// 填色（整行 / 单元格）· 个人设置条（恢复）· 服务端 10 万条三级分组（组头 + 分块行一致）· 1440 浅 / 深色、390 不溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/grid-panels');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(() => { localStorage.removeItem('starter:demo:bitable-contracts:view'); localStorage.removeItem('starter:demo:bitable-server:view'); });
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '多维表格', exact: true }).click();
  const grid = page.getByRole('grid', { name: '合同台账' });
  await grid.locator('[data-row-key]').first().waitFor();
  const area = page.locator('#aui-page-bitable');
  const toolbar = area.getByRole('toolbar', { name: '视图工具栏' });
  const tool = (name) => toolbar.getByRole('button', { name: new RegExp(`^${name}`) });
  const panel = (name) => page.getByRole('dialog', { name, exact: true });
  const pick = async (scope, buttonName, listName, optionName) => {
    await scope.getByRole('button', { name: buttonName }).click();
    await page.getByRole('listbox', { name: listName }).getByRole('option', { name: optionName, exact: true }).click();
  };
  const noOverflow = async (label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}：整页不横向溢出`);
  const inViewport = async (locator, label) => {
    const r = await locator.boundingBox();
    const vw = page.viewportSize().width;
    assert.ok(r && r.x >= 0 && r.x + r.width <= vw + 1, `${label} 在窗口内 ${JSON.stringify(r)}`);
  };
  const colOf = async (title) => Number(await grid.getByRole('columnheader', { name: new RegExp(`^${title}`) }).first().getAttribute('aria-colindex'));
  const dataRows = () => grid.locator('[role=row][data-row-key]');

  // ---- 字段配置（D05）
  await tool('字段').click();
  const fieldsPanel = panel('字段配置');
  await fieldsPanel.waitFor();
  // 8.3: panel bodies are lazy chunks (a skeleton first) — wait for the body before reading it
  await fieldsPanel.locator('.aui-grid-fields-panel').waitFor();
  assert.match(await fieldsPanel.innerText(), /显示 14 \/ 14/);
  assert.equal(await fieldsPanel.getByRole('img', { name: /邮箱只有客户成功能看全/ }).count(), 1, '受限字段带锁');
  assert.equal(await fieldsPanel.getByText('联系方式', { exact: true }).count(), 1, '字段编组');
  assert.match(await fieldsPanel.innerText(), /2 个字段/);
  await fieldsPanel.getByRole('button', { name: '隐藏「联系方式」' }).click();
  assert.equal(await grid.getByRole('columnheader', { name: /^联系邮箱/ }).count(), 0, '编组眼睛一次隐藏两列');
  assert.equal(await grid.getByRole('columnheader', { name: /^客户档案/ }).count(), 0);
  assert.match(await fieldsPanel.innerText(), /显示 12 \/ 14/);
  await fieldsPanel.getByRole('searchbox', { name: '搜索字段' }).fill('金额');
  assert.equal(await fieldsPanel.getByRole('button', { name: /^隐藏「/ }).count(), 1, '搜索只剩「合同金额」');
  await fieldsPanel.getByRole('searchbox', { name: '搜索字段' }).fill('');
  await fieldsPanel.getByRole('button', { name: '全部隐藏' }).click();
  assert.equal(await grid.locator('[role=columnheader][data-field-key]').count(), 1, '全部隐藏后只剩主字段');
  await fieldsPanel.getByRole('button', { name: '全部显示' }).click();
  assert.equal(await grid.locator('[role=columnheader][data-field-key]').count(), 14);
  // Keyboard: Alt+↓ on 「阶段」 moves it after 「标签」.
  await fieldsPanel.getByRole('button', { name: '移动「阶段」' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  const order = await grid.locator('[role=columnheader][data-field-key]').evaluateAll((cells) => cells.map((c) => c.dataset.fieldKey));
  assert.deepEqual(order.slice(0, 3), ['name', 'tags', 'stage'], `键盘拖动改列顺序 ${order}`);
  assert.equal(await fieldsPanel.getByRole('img', { name: /客户名称」主字段固定在第一列/ }).count(), 1, '主字段锁定');
  await shot('fields-1440-light');
  await page.keyboard.press('Escape');

  // ---- 筛选（D04）：阶段 是 赢单 / 方案报价 且（负责人 是 我 或 席位数 ≥ 400）
  await tool('筛选').click();
  const filterPanel = panel('筛选条件');
  await filterPanel.waitFor();
  await filterPanel.locator('.aui-grid-filter-panel').waitFor();
  // Anchoring (审阅 03): the 640px panel hangs from the button's left edge; when the right side has no room it
  // slides left only as far as it must (still over the button), never flips across the page's left side.
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const b = await tool('筛选').boundingBox();
    const f = await filterPanel.boundingBox();
    const expected = Math.max(8, Math.min(b.x, width - 8 - f.width));
    assert.ok(Math.abs(f.x - expected) <= 1 && f.x <= b.x + 1 && f.x + f.width >= b.x + b.width - 1, `${width}：筛选面板贴着按钮 ${JSON.stringify({ button: b, panel: f, expected })}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await filterPanel.getByRole('button', { name: '添加条件', exact: true }).click();
  const first = filterPanel.getByRole('group', { name: '条件 1', exact: true }).first();
  await pick(first, /^筛选字段/, '筛选字段', '阶段');
  await first.getByRole('combobox', { name: /^筛选值/ }).click();
  await page.getByRole('listbox', { name: '筛选值' }).getByRole('option', { name: '赢单' }).click();
  await page.getByRole('listbox', { name: '筛选值' }).getByRole('option', { name: '方案报价' }).click();
  await page.keyboard.press('Escape');
  await filterPanel.getByRole('button', { name: '添加条件组' }).click();
  const box = filterPanel.getByRole('group', { name: '条件组（任一满足）', exact: true });
  await box.waitFor();
  const inner1 = box.getByRole('group', { name: '条件 1', exact: true });
  await pick(inner1, /^筛选字段/, '筛选字段', '负责人');
  await inner1.getByRole('combobox', { name: /^筛选值/ }).click();
  await page.getByRole('listbox', { name: '筛选值' }).getByRole('option', { name: /^我.*当前登录/ }).click();
  await page.keyboard.press('Escape');
  await box.getByRole('button', { name: '添加条件', exact: true }).click();
  const inner2 = box.getByRole('group', { name: '条件 2', exact: true });
  await pick(inner2, /^筛选字段/, '筛选字段', '席位数');
  await inner2.getByRole('combobox', { name: '条件' }).click();
  await page.getByRole('option', { name: '≥', exact: true }).click();
  await inner2.getByRole('textbox', { name: '筛选值' }).fill('400');
  await page.waitForTimeout(150);
  assert.match(await filterPanel.innerText(), /符合 \d+ \/ \d+ 条 · 1 个条件组/, '标题行写现在符合多少条');
  assert.equal(await box.getByRole('button', { name: '任一满足' }).getAttribute('aria-pressed'), 'true', '新条件组默认任一满足');
  assert.equal(await filterPanel.getByRole('button', { name: '添加条件组' }).isDisabled(), false);
  await shot('filter-1440-light');
  await page.keyboard.press('Escape');
  assert.match(await tool('筛选').innerText(), /筛选\s*3/);
  const [stageCol, ownerCol, seatsCol] = [await colOf('阶段'), await colOf('负责人'), await colOf('席位数')];
  const checked = await dataRows().evaluateAll((rows, cols) => rows.map((row) => {
    const cell = (c) => row.querySelector(`[aria-colindex="${c}"]`)?.textContent ?? '';
    return { stage: row.querySelector(`[aria-colindex="${cols[0]}"] .aui-chip-label`)?.textContent ?? '', owner: cell(cols[1]), seats: Number(cell(cols[2]).replace(/[^\d.]/g, '')) };
  }), [stageCol, ownerCol, seatsCol]);
  assert.ok(checked.length > 5, `筛出了记录 ${checked.length}`);
  for (const row of checked) assert.ok(['赢单', '方案报价'].includes(row.stage) && (row.owner.includes('陈晓') || row.seats >= 400), `每行都符合嵌套条件 ${JSON.stringify(row)}`);
  // 个人设置条（D01）
  const bar = area.locator('.aui-view-override');
  assert.match(await bar.innerText(), /筛选 3 条（含 1 个条件组）.*只对你生效/);

  // ---- 三级分组（D17）
  await tool('分组').click();
  const groupPanel = panel('分组');
  await groupPanel.locator('.aui-grid-group-panel').waitFor();
  assert.match(await groupPanel.innerText(), /最多 3 级/);
  assert.equal(await groupPanel.locator('.aui-grid-level-row').count(), 1);
  await groupPanel.getByRole('button', { name: '添加分组' }).click();
  await pick(groupPanel, /^第 2 级分组字段/, '第 2 级分组字段', '负责人');
  await groupPanel.getByRole('button', { name: '添加分组' }).click();
  await pick(groupPanel, /^第 3 级分组字段/, '第 3 级分组字段', '地区');
  assert.equal(await groupPanel.locator('.aui-grid-level-row').count(), 3);
  assert.equal(await groupPanel.getByRole('button', { name: '添加分组' }).isDisabled(), true, '满 3 级不能再加');
  await page.waitForTimeout(150);
  for (const level of ['1', '2', '3']) assert.ok(await grid.locator(`[role=row].aui-grid-group[aria-level="${level}"]`).count() > 0, `有第 ${level} 级组头`);
  const indent = await grid.locator('[role=row].aui-grid-group').evaluateAll((rows) => Object.fromEntries(rows.map((r) => [r.getAttribute('aria-level'), parseFloat(r.querySelector('.aui-grid-group-inner').style.paddingInlineStart)])));
  assert.ok(indent['1'] < indent['2'] && indent['2'] < indent['3'], `组头逐级缩进 ${JSON.stringify(indent)}`);
  assert.ok(await grid.locator('[role=row].aui-grid-group[aria-level="1"] .aui-grid-group-sum[data-tip^="求和"]').count() > 0, '组头显示本组的求和');
  await shot('group-1440-light');
  const rowcount = async () => Number(await grid.getAttribute('aria-rowcount'));
  const before = await rowcount();
  await groupPanel.getByRole('switch', { name: '显示空分组' }).click();
  await page.waitForTimeout(100);
  assert.ok(await rowcount() > before, '显示空分组后多出空组');
  await groupPanel.getByRole('button', { name: '全部收起' }).click();
  await page.waitForTimeout(100);
  assert.equal(await rowcount(), 5 + 2, '全部收起：只剩 5 个一级组头（显示空分组：没记录的阶段也在）+ 表头 + 统计行');
  await groupPanel.getByRole('button', { name: '全部展开' }).click();
  await groupPanel.getByRole('switch', { name: '显示空分组' }).click();
  // Keyboard drag: level 1 moves below level 2.
  await groupPanel.getByRole('button', { name: '移动「第 1 级 阶段」' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(100);
  assert.equal((await grid.locator('[role=row].aui-grid-group[aria-level="1"] .aui-grid-group-field').first().innerText()).trim(), '负责人', '拖动层级后一级组按负责人');
  await page.keyboard.press('Escape');

  // ---- 排序（D17b）
  await tool('排序').click();
  const sortPanel = panel('排序');
  await sortPanel.locator('.aui-grid-sort-panel').waitFor();
  await sortPanel.getByRole('button', { name: '添加排序' }).click();
  await pick(sortPanel, /^首先按哪个字段排序/, '首先按哪个字段排序', '合同金额');
  await sortPanel.getByRole('combobox', { name: '合同金额的排序方向' }).click();
  await page.getByRole('option', { name: '从大到小 9 → 0' }).click();
  await sortPanel.getByRole('button', { name: '添加排序' }).click();
  await pick(sortPanel, /^然后按哪个字段排序/, '然后按哪个字段排序', '签约日期');
  assert.match(await sortPanel.innerText(), /首先[\s\S]*然后/);
  assert.match(await sortPanel.innerText(), /分组时在组内排序：先按 负责人 → 阶段 → 地区 分组，组里再排/);
  assert.match(await sortPanel.innerText(), /空值永远排在最后/);
  assert.equal(await sortPanel.getByRole('switch', { name: '自动排序' }).getAttribute('aria-checked'), 'true');
  await shot('sort-1440-light');
  await sortPanel.getByRole('switch', { name: '自动排序' }).click();
  await page.keyboard.press('Escape');
  assert.match(await tool('排序').innerText(), /排序\s*2/);
  assert.equal(await grid.getByRole('columnheader', { name: /^合同金额/ }).getAttribute('aria-sort'), 'descending');

  // ---- 恢复共享设置
  await bar.getByRole('button', { name: '恢复', exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(await bar.count(), 0, '和共享视图一样时不显示个人设置条');
  assert.match(await tool('分组').innerText(), /分组: 阶段/);

  // ---- 填色（整行 / 单元格）
  await tool('填色').click();
  const colorPanel = panel('填色');
  await colorPanel.locator('.aui-grid-color-panel').waitFor();
  await colorPanel.getByRole('button', { name: '添加填色规则' }).click();
  const rule = colorPanel.getByRole('group', { name: '规则 1', exact: true });
  await pick(rule, /^筛选字段/, '筛选字段', '阶段');
  await rule.getByRole('combobox', { name: /^筛选值/ }).click();
  await page.getByRole('listbox', { name: '筛选值' }).getByRole('option', { name: '线索' }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const firstGroupRows = await dataRows().evaluateAll((rows) => rows.slice(0, 5).map((r) => r.dataset.fill ?? ''));
  assert.deepEqual(firstGroupRows, ['yellow', 'yellow', 'yellow', 'yellow', 'yellow'], '线索组的行整行填注意色');
  await rule.getByRole('button', { name: '单元格' }).click();
  await pick(rule, /^规则 1 填哪一列/, '规则 1 填哪一列', '合同金额');
  await page.waitForTimeout(100);
  assert.equal(await dataRows().first().getAttribute('data-fill'), null);
  assert.equal(await dataRows().first().locator('[data-type=money]').getAttribute('data-fill'), 'yellow', '只填「合同金额」这一格');
  await shot('color-1440-light');
  await page.keyboard.press('Escape');
  assert.match(await tool('填色').innerText(), /填色\s*1/);

  // ---- 深色 + 手机
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.mouse.move(0, 0);
  await tool('筛选').click();
  await filterPanel.getByRole('button', { name: '添加条件组' }).click();
  await page.waitForTimeout(150);
  await shot('filter-1440-dark');
  await page.keyboard.press('Escape');
  await shot('grid-1440-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await noOverflow('390');
  await tool('筛选').click();
  await page.waitForTimeout(150);
  await inViewport(filterPanel, '390 筛选面板');
  await noOverflow('390 筛选面板');
  await shot('filter-390-dark');
  await page.keyboard.press('Escape');
  await tool('分组').click();
  await inViewport(groupPanel, '390 分组面板');
  await shot('group-390-dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.waitForTimeout(150);
  await shot('grid-390-light');
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- 服务端 10 万条：三级分组（组头来自 loadGroups，行来自分块 load，顺序一致）
  await area.getByRole('group', { name: '数据来源' }).getByRole('button', { name: /^服务端/ }).click();
  const sgrid = page.getByRole('grid', { name: '合同台账（服务端）' });
  await sgrid.locator('[data-row-key]').first().waitFor();
  await tool('分组').click();
  await groupPanel.getByRole('button', { name: '添加分组' }).click();
  await pick(groupPanel, /^第 1 级分组字段/, '第 1 级分组字段', '阶段');
  await groupPanel.getByRole('button', { name: '添加分组' }).click();
  await pick(groupPanel, /^第 2 级分组字段/, '第 2 级分组字段', '负责人');
  await groupPanel.getByRole('button', { name: '添加分组' }).click();
  await pick(groupPanel, /^第 3 级分组字段/, '第 3 级分组字段', '地区');
  await page.keyboard.press('Escape');
  await sgrid.locator('[role=row].aui-grid-group[aria-level="3"]').first().waitFor();
  await sgrid.locator('[role=row][data-row-key]').first().waitFor();
  const level1 = await sgrid.locator('[role=row].aui-grid-group[aria-level="1"]').first().innerText();
  assert.match(level1, /阶段\s*线索\s*\d+ 条/, `一级组头 ${level1}`);
  const regionCol = await sgrid.getByRole('columnheader', { name: /^地区/ }).getAttribute('aria-colindex');
  const consistent = async () => sgrid.evaluate((el, col) => {
    const out = [];
    let region = null;
    for (const row of [...el.querySelectorAll('[role=row][data-row-index]')].sort((a, b) => a.dataset.rowIndex - b.dataset.rowIndex)) {
      if (row.classList.contains('aui-grid-group')) { region = row.getAttribute('aria-level') === '3' ? row.querySelector('.aui-grid-group-label').textContent.trim() : null; continue; }
      if (!row.dataset.rowKey || region === null) continue;
      out.push([region, row.querySelector(`[aria-colindex="${col}"] .aui-chip-label`)?.textContent.trim()]);
    }
    return out;
  }, regionCol);
  let pairs = await consistent();
  assert.ok(pairs.length > 5 && pairs.every(([a, b]) => a === b), `服务端分块的行在对的组头下面 ${JSON.stringify(pairs.slice(0, 6))}`);
  // Collapse the first two stages: the third stage's rows come from blocks deep in the server's list (offset ~40 000).
  const total = Number(await sgrid.getAttribute('aria-rowcount'));
  await sgrid.locator('[role=row].aui-grid-group[aria-level="1"] .aui-grid-group-cell').first().click();
  await page.waitForTimeout(300);
  assert.ok(Number(await sgrid.getAttribute('aria-rowcount')) < total - 1000, '收起一级组，它下面的行（服务端）都不再占位');
  await sgrid.locator('[role=row].aui-grid-group[aria-level="1"][aria-expanded="true"] .aui-grid-group-cell').first().click();
  await page.waitForTimeout(1200);
  await sgrid.locator('[role=row][data-row-key]').first().waitFor();
  const offsetRow = Number(await sgrid.locator('[role=row][data-row-key]').first().locator('.aui-grid-rownum').innerText());
  assert.ok(offsetRow > 30000, `第三个阶段的第一行在服务端列表很后面（第 ${offsetRow} 条）`);
  pairs = await consistent();
  assert.ok(pairs.length > 5 && pairs.every(([a, b]) => a === b), `收起后取到的后面分块仍在对的组头下 ${JSON.stringify(pairs.slice(0, 6))}`);
  assert.equal(await sgrid.locator('.aui-grid-load-error').count(), 0);
  await shot('server-group-1440-light');
  await page.evaluate(() => localStorage.removeItem('starter:demo:bitable-server:view'));

  assert.deepEqual(errors, []);
  console.log(`PASS grid-panels: fields panel (search / hide all / group eye / lock / keyboard drag), nested filter with 「我」 checked row by row, 3-level grouping (levels, summaries, empty groups, collapse all, drag), sort panel, 填色 row / cell, personal bar reset, server 100k 3-level grouping consistent with blocks, dark + 390 (${output})`);
} finally {
  await browser.close();
  await server.close();
}
