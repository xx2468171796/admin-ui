// bt/grid-b 浏览器验收：starter「系统 → 多维表格 · 客户」（样稿 D01 / D02 / D03 / D19）。
// 表头图标与「+」列、表头菜单（鼠标 / 键盘 / 子菜单 / 冻结至此列 / 按此字段筛选）、可拖动冻结线、单元格 / 选区 / 分组右键菜单
// （鼠标与 Shift+F10）、填充柄（复制、数列、只读跳过、撤销）与 Ctrl+D、行拖动与 Alt+Shift+↑↓、每组新增一行、角标与按行着色、
// 新字段类型（评分、掩码电话 + 查看、附件 + 预览、录音迷你播放器、进度、关联、查找引用、公式、系统字段）、Ctrl+E、
// 1440 浅 / 深色与 390 手机截图、不溢出。截图在 test/artifacts/grid-tools/，和已审定的样稿截图并排看。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/grid-tools');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const VIEW_KEY = 'starter:demo:grid-customers:view';
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate((key) => localStorage.removeItem(key), VIEW_KEY);
  const open = async () => {
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '多维表格 · 客户', exact: true }).click();
    await page.getByRole('grid', { name: '客户' }).locator('[data-row-key]').first().waitFor();
  };
  await open();
  const grid = page.getByRole('grid', { name: '客户' });
  const area = page.locator('#aui-page-gridpro');
  const status = area.locator('.aui-grid-status');
  const toast = (text) => page.getByText(text, { exact: false }).last();
  const menu = (name) => page.getByRole('menu', { name, exact: true });
  const anyMenu = () => page.getByRole('menu');
  const header = (title) => grid.getByRole('columnheader', { name: new RegExp(`^${title}`) });
  const colOf = async (title) => Number(await header(title).getAttribute('aria-colindex')) - 1;
  const rowIndex = async (id) => Number(await grid.locator(`[role=row][data-row-key="${id}"]`).getAttribute('data-row-index'));
  const cell = async (id, title) => grid.locator(`[data-cell="${await rowIndex(id)}:${await colOf(title)}"]`);
  const text = async (id, title) => (await (await cell(id, title)).innerText()).trim();
  const stored = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').view ?? {}, VIEW_KEY);
  const firstKeys = () => grid.locator('[role=row][data-row-key]').evaluateAll((rows) => rows.map((r) => r.dataset.rowKey));
  const focusedCell = () => page.evaluate(() => document.activeElement?.dataset.cell ?? document.activeElement?.textContent?.trim().slice(0, 12));
  const menuItems = (m) => m.locator('[role^=menuitem]').evaluateAll((items) => items.map((i) => i.querySelector('.aui-cmenu-text')?.textContent));
  await page.waitForTimeout(200);

  // ---- G7 header adornments + 「+」 column
  assert.equal(await header('成交价').locator('.aui-grid-hbadge[data-kind=lock]').count(), 1, '成交价表头有锁');
  assert.equal(await header('成交价').locator('.aui-grid-hbadge').getAttribute('data-tip'), '字段有查看权限：技术、客服看不到');
  assert.match(await header('成交价').getAttribute('aria-label'), /有权限限制/);
  assert.equal(await header('跟进').getAttribute('aria-description'), '来自子表「跟进记录」的条数', 'ⓘ 说明给读屏');
  assert.equal(await header('跟进').locator('.aui-grid-hbadge[data-kind=info]').getAttribute('data-tip'), '来自子表「跟进记录」的条数');
  const titleGap = await header('手机').evaluate((h) => h.querySelector('.aui-grid-hbadge').getBoundingClientRect().left - h.querySelector('.aui-grid-htitle').getBoundingClientRect().right);
  assert.ok(titleGap < 10, `ⓘ 紧跟在字段名后面（${titleGap}px）`);
  const addField = grid.getByRole('button', { name: '添加字段' });
  await grid.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await addField.click();
  await toast('打开「新建字段」弹框').waitFor();
  await grid.evaluate((el) => { el.scrollLeft = 0; });

  // ---- G7 header menu: D03 order, hints, mouse
  await header('预计金额').click();
  const amountMenu = menu('预计金额字段菜单');
  await amountMenu.waitFor();
  assert.deepEqual(await menuItems(amountMenu), ['修改字段', '编辑字段说明', '向左插入字段', '向右插入字段', '复制字段', '隐藏字段', '冻结至此列', '移动字段', '升序', '降序', '按此字段筛选', '按此字段分组', '字段权限', '加入字段编组', '删除字段'], '表头菜单项与顺序同样稿 D03');
  assert.match(await amountMenu.getByRole('menuitemcheckbox', { name: /^升序/ }).textContent(), /0 → 9/);
  assert.equal(await header('预计金额').getAttribute('data-menu-open'), 'true', '菜单打开时表头高亮');
  await amountMenu.getByRole('menuitem', { name: /^字段权限/ }).hover();
  await page.waitForTimeout(150);
  await shot('header-menu-1440-light');
  // Submenu 加入字段编组 → 跟进
  await amountMenu.getByRole('menuitem', { name: '加入字段编组' }).hover();
  const groupSub = menu('加入字段编组');
  await groupSub.waitFor();
  await groupSub.getByRole('menuitem', { name: '跟进' }).click();
  await toast('加入编组「跟进」').waitFor();
  assert.equal(await anyMenu().count(), 0, '选完子菜单项整个菜单关闭');
  // 冻结至此列 → view.frozen, survives horizontal scroll
  await header('预计金额').click();
  await amountMenu.getByRole('menuitem', { name: '冻结至此列' }).click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{}').view?.frozen === 6, VIEW_KEY);
  assert.equal(await header('预计金额').getAttribute('data-pin-edge'), 'start', '冻结线在预计金额右边');
  const amountX = (await header('预计金额').boundingBox()).x;
  await grid.evaluate((el) => { el.scrollLeft = 600; });
  await page.waitForTimeout(80);
  assert.ok(Math.abs((await header('预计金额').boundingBox()).x - amountX) < 1, '冻结的列横滚不动');
  await grid.evaluate((el) => { el.scrollLeft = 0; });
  await header('预计金额').click();
  assert.ok(await amountMenu.getByRole('menuitem', { name: '取消冻结' }).count(), '已冻结到这一列时显示「取消冻结」');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-field-key')), 'amount', 'Esc 关菜单，焦点回到表头');

  // ---- G9 freeze line drag: grip on the last frozen header → drop on 客户名称's right edge
  await header('意向').hover();
  const grip = grid.locator('.aui-grid-freeze-grip');
  assert.equal(await grip.count(), 1);
  assert.equal(await grip.evaluate((g) => g.closest('[data-field-key]')?.dataset.fieldKey), 'amount');
  const g = await grip.boundingBox();
  const nameRight = (await header('客户名称').boundingBox());
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x - 200, g.y + g.height / 2, { steps: 4 });
  await page.mouse.move(nameRight.x + nameRight.width + 3, g.y + g.height / 2, { steps: 4 });
  assert.equal(await grid.locator('.aui-grid-freeze-preview').count(), 1, '拖动时显示整列高的预览线');
  await shot('freeze-drag-1440-light');
  await page.mouse.up();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{}').view?.frozen === 1, VIEW_KEY);
  assert.equal(await header('客户名称').getAttribute('data-pin-edge'), 'start', '拖回后只冻结主字段');
  assert.equal(await header('预计金额').getAttribute('data-pin'), null);

  // ---- G7 keyboard: Enter on a header opens the menu on its first item; type-ahead-free arrows; Shift+F10 too
  await header('手机').focus();
  await page.keyboard.press('Enter');
  await menu('手机字段菜单').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.querySelector('.aui-cmenu-text')?.textContent), '修改字段', '键盘打开时焦点在第一项');
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.querySelector('.aui-cmenu-text')?.textContent), '按此字段筛选', '↓ 逐项移动（跳过分隔）');
  await page.keyboard.press('Enter');
  await status.getByText('已添加「手机」的筛选条件').waitFor();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || '{}').view?.filter?.items?.[0]?.field === 'phone', VIEW_KEY);
  await header('手机').focus();
  await page.keyboard.press('Shift+F10');
  await menu('手机字段菜单').waitFor();
  await page.keyboard.press('Escape');
  // Double click a header = 修改字段 (host)
  await header('客户名称').dblclick();
  await toast('修改字段「客户名称」').waitFor();
  assert.equal(await anyMenu().count(), 0, '双击表头不留下菜单');

  // ---- G8 cell / range menu (mouse): 预计金额 of the first three 报价 rows (D02)
  const quote = ['KH-0004', 'KH-0005', 'KH-0006'];
  const c0 = await cell(quote[0], '预计金额');
  const c2 = await cell(quote[2], '预计金额');
  await c0.click();
  await c2.click({ modifiers: ['Shift'] });
  const edges = await grid.locator('[data-edge]').evaluateAll((cells) => cells.map((c) => c.dataset.edge));
  assert.deepEqual(edges, ['t l r', 'l r', 'b l r'], `选区外框 ${edges}`);
  const middle = await cell(quote[1], '预计金额');
  await middle.click({ button: 'right' });
  const rowMenu = page.getByRole('menu').first();
  await rowMenu.waitFor();
  assert.deepEqual(await menuItems(rowMenu), ['复制', '粘贴', '向上插入记录', '向下插入记录', '复制 3 条记录', '展开记录', '分享记录', '复制记录链接', '查看修改历史', '添加子记录', '添加评论', '删除所选 3 条记录'], '单元格菜单同样稿 D02，数量来自选区');
  assert.equal(await rowMenu.getByRole('menuitem', { name: /^展开记录/ }).getAttribute('aria-keyshortcuts'), 'Ctrl+E');
  await rowMenu.getByRole('menuitem', { name: /^展开记录/ }).hover();
  await shot('cell-menu-1440-light');
  await rowMenu.getByRole('menuitem', { name: '复制', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied.split(/\r?\n/).length, 3, `菜单复制整块 ${JSON.stringify(copied)}`);
  // 删除所选 3 条 → host confirm → cancel
  await middle.click({ button: 'right' });
  await page.getByRole('menuitem', { name: '删除所选 3 条记录' }).click();
  const confirm = page.getByRole('dialog', { name: '删除 3 条记录' });
  await confirm.waitFor();
  await confirm.getByRole('button', { name: '取消' }).click();
  // 向下插入记录 adds a row in the same group
  const before = Number(await grid.getAttribute('aria-rowcount'));
  await (await cell(quote[0], '客户名称')).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^向下插入记录/ }).click();
  await page.waitForFunction((n) => Number(document.querySelector('[role=grid][aria-label=客户]').getAttribute('aria-rowcount')) === n + 1, before);
  // Keyboard: Shift+F10 on a cell opens the menu on 复制; Esc returns focus to the cell
  const nameCell = await cell(quote[1], '客户名称');
  await nameCell.click();
  const here = await focusedCell();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menu').first().waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.querySelector('.aui-cmenu-text')?.textContent), '复制');
  await page.keyboard.press('Escape');
  assert.equal(await focusedCell(), here, 'Esc 后焦点回到格子');
  // Group header menu
  await grid.locator('[role=row].aui-grid-group').first().locator('.aui-grid-group-cell').click({ button: 'right' });
  await menu('分组菜单').getByRole('menuitem', { name: '收起本组' }).click();
  assert.equal(await grid.locator('[role=row].aui-grid-group').first().getAttribute('aria-expanded'), 'false');
  await grid.locator('[role=row].aui-grid-group').first().locator('.aui-grid-group-cell').click();

  // ---- Ctrl+E opens the record (Space still does)
  await (await cell(quote[1], '阶段')).click();
  await page.keyboard.press('Control+e');
  const record = page.getByRole('dialog').filter({ has: page.locator('.aui-record-dialog') });
  await record.waitFor();
  assert.equal(await record.locator('.aui-record-dialog').getAttribute('data-record-key'), quote[1]);
  await page.keyboard.press('Escape');
  await record.waitFor({ state: 'hidden' });

  // ---- G10 fill handle: series from two cells, copy from one, read-only skipped, undo
  const first = ['KH-0001', 'KH-0002', 'KH-0003'];
  const money = (t) => Number(t.replace(/[^\d.-]/g, ''));
  const a0 = money(await text(first[0], '预计金额'));
  const a1 = money(await text(first[1], '预计金额'));
  await (await cell(first[0], '预计金额')).click();
  await (await cell(first[1], '预计金额')).click({ modifiers: ['Shift'] });
  const handle = grid.locator('.aui-grid-fill-handle');
  assert.equal(await handle.count(), 1, '选区右下角有填充柄');
  const hb = await handle.boundingBox();
  const target = await (await cell(first[2], '预计金额')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 2, target.y + target.height / 2, { steps: 5 });
  assert.equal(await grid.locator('[data-fill-preview]').count(), 1, '拖动时虚线框预览要填的格子');
  await shot('fill-drag-1440-light');
  await page.mouse.up();
  await status.getByText('已填充 1 格').waitFor();
  assert.equal(money(await text(first[2], '预计金额')), a1 + (a1 - a0), `两格定步长续写数列：${a0}, ${a1} → ${a1 + (a1 - a0)}`);
  await page.keyboard.press('Control+z');
  await status.getByText('已撤销 1 格').waitFor();
  // One cell copies; Ctrl+D fills down
  const area0 = await text(first[0], '地区');
  await (await cell(first[0], '地区')).click();
  await (await cell(first[2], '地区')).click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+d');
  await status.getByText('已填充').waitFor();
  assert.equal(await text(first[1], '地区'), area0);
  assert.equal(await text(first[2], '地区'), area0, 'Ctrl + D 把第一行复制到下面');
  // Read-only column: skipped with a reason
  await (await cell(first[0], '跟进')).click();
  await (await cell(first[2], '跟进')).click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+d');
  await status.getByText(/不能编辑/).waitFor();

  // ---- G11 rows: hover grip + inline expand, drag to reorder, Alt+Shift+↑↓, add row per group, badge, tone
  const row1 = grid.locator(`[role=row][data-row-key="${first[2]}"]`);
  await row1.locator('[role=rowheader]').hover();
  assert.ok(await row1.locator('.aui-grid-row-grip').isVisible(), '悬停显示拖动手柄');
  assert.ok(await row1.getByRole('button', { name: /^展开记录/ }).isVisible(), '悬停在主字段右端显示展开图标');
  await shot('row-hover-1440-light');
  const gripBox = await row1.locator('.aui-grid-row-grip').boundingBox();
  const topBox = await grid.locator(`[role=row][data-row-key="${first[0]}"]`).boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 4, topBox.y + 6, { steps: 6 });
  assert.equal(await grid.locator('.aui-grid-row-drop').count(), 1, '拖动时显示插入线');
  await page.mouse.up();
  await page.waitForFunction((id) => document.querySelector('[role=grid][aria-label=客户] [role=row][data-row-key]')?.dataset.rowKey === id, first[2]);
  await (await cell(first[2], '阶段')).click();
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await page.waitForFunction((id) => document.querySelectorAll('[role=grid][aria-label=客户] [role=row][data-row-key]')[1]?.dataset.rowKey === id, first[2]);
  // 新增一行 under every expanded group
  // (virtualised: the last rendered group may end below the window, so check every expanded group that is followed by
  // another rendered group — its 「新增一行」 must come before that next group)
  const missingAdd = await grid.evaluate((el) => {
    const rows = [...el.querySelectorAll('[role=row]')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const out = [];
    rows.forEach((row, i) => {
      if (!row.matches('.aui-grid-group[aria-expanded=true]')) return;
      const next = rows.findIndex((r, j) => j > i && r.matches('.aui-grid-group'));
      if (next < 0) return;
      if (!rows.slice(i + 1, next).some((r) => r.matches('.aui-grid-add-row'))) out.push(row.textContent.trim().slice(0, 20));
    });
    return out;
  });
  assert.deepEqual(missingAdd, [], '每个展开的组底下一行「新增一行」');
  const addRows = grid.locator('[role=row].aui-grid-add-row');
  assert.ok(await addRows.count() >= 1, '至少有一行「新增一行」');
  const quoteCount = () => grid.locator('[role=row].aui-grid-group').nth(1).locator('.aui-grid-group-count').textContent();
  const quoteBefore = await quoteCount();
  await addRows.nth(1).click();
  await page.waitForFunction(([b]) => document.querySelectorAll('[role=grid][aria-label=客户] [role=row].aui-grid-group')[1]?.querySelector('.aui-grid-group-count')?.textContent !== b, [quoteBefore]);
  // 8.7 新增记录: the new row's first editable cell opens for typing (onAddRow answered the id)
  const editor = grid.locator('.aui-grid-editor');
  await editor.waitFor();
  assert.equal(await editor.locator('input, textarea').first().evaluate((el) => el === document.activeElement), true, '新行第一个能改的格子进入编辑、光标在里面');
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  // Footer 「+」 at the bottom-left, visible without scrolling; click → a blank record at the end, its first cell editing
  const footerAdd = grid.getByRole('button', { name: '新增记录', exact: true });
  const [addBox, gridBox] = [await footerAdd.boundingBox(), await grid.boundingBox()];
  assert.ok(addBox && gridBox && addBox.y + addBox.height <= gridBox.y + gridBox.height + 1 && addBox.x - gridBox.x < 48, `页脚「+」在表格左下角、不用滚动就看得见 ${JSON.stringify([addBox, gridBox])}`);
  const footerRow = grid.locator('.aui-grid-summary-row');
  assert.match(await footerRow.textContent(), /条记录/, '「+」旁边是「N 条记录」');
  await footerAdd.click();
  await editor.waitFor();
  await page.keyboard.type('页脚新增的客户');
  await page.keyboard.press('Enter');
  await editor.waitFor({ state: 'detached' });
  await grid.getByText('页脚新增的客户').first().waitFor();
  // Keyboard: Tab-focusable, Enter adds another one
  await footerAdd.focus();
  await page.keyboard.press('Enter');
  await editor.waitFor();
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  await shot('add-record-footer-1440');
  await grid.evaluate((el) => { el.scrollTop = 0; });
  await grid.locator('[role=row][data-row-key="KH-0001"]').waitFor();
  // Badge and tone
  const badgeCell = await cell('KH-0006', '跟进');
  assert.equal(await badgeCell.locator('.aui-grid-badge').count(), 1, '有评论的格子右上角有角标');
  assert.match(await badgeCell.textContent(), /2 条评论/, '角标给读屏的文字');
  const overdue = await grid.locator('[data-tone=danger] > .aui-cell').first().evaluate((el) => ({ color: getComputedStyle(el).color, danger: getComputedStyle(el).getPropertyValue('--aui-danger') }));
  assert.ok(overdue.color && overdue.color !== 'rgb(0, 0, 0)', `逾期日期标红 ${JSON.stringify(overdue)}`);

  // ---- G12 types
  const ratingCell = await cell(first[0], '意向');
  const ratingLabel = async () => (await (await cell(first[0], '意向')).locator('[role=img]').getAttribute('aria-label'));
  const current = Number((await ratingLabel()).match(/^意向：(\d) 星（满分 5）$/)[1]);
  const pickStar = current === 5 ? 3 : 5;
  await ratingCell.locator('.aui-rating-star').nth(pickStar - 1).click();
  await page.waitForFunction(() => !document.querySelector('[role=grid][aria-label=客户] [data-saving]'));
  assert.equal(await ratingLabel(), `意向：${pickStar} 星（满分 5）`, '点第 N 颗星直接打 N 分');
  await ratingCell.focus();
  await page.keyboard.press('Enter');
  await grid.getByRole('slider', { name: '编辑「意向」' }).waitFor();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await grid.getByRole('slider', { name: '编辑「意向」' }).waitFor({ state: 'detached' });
  await page.waitForFunction(() => !document.querySelector('[role=grid][aria-label=客户] [data-saving]'));
  assert.equal(await ratingLabel(), `意向：${pickStar - 1} 星（满分 5）`, '键盘编辑评分（← 减一颗，Enter 保存）');
  await (await cell(first[0], '意向')).locator('.aui-rating-star').nth(pickStar - 2).click();
  await page.waitForFunction(() => !document.querySelector('[role=grid][aria-label=客户] [data-saving]'));
  assert.equal(await (await cell(first[0], '意向')).locator('[role=img]').count(), 0, '再点当前分数清空');
  // Masked phone + reveal
  const phoneCell = await cell(first[0], '手机');
  assert.match(await phoneCell.innerText(), /^1\d\d-\*\*\*\*-\d{4}$/);
  await phoneCell.hover();
  await phoneCell.getByRole('button', { name: '查看完整手机' }).click();
  await toast('查看了「').waitFor();
  assert.match(await phoneCell.innerText(), /^1\d\d-\d{4}-\d{4}$/, '查看后显示完整号码');
  // Attachments: thumbnails open the lightbox; audio cells show the mini player with +N
  await grid.evaluate((el) => { el.scrollLeft = 900; });
  await page.waitForTimeout(100);
  const thumb = grid.locator('.aui-grid-attachment').first();
  await thumb.click();
  const lightbox = page.locator('.aui-lightbox');
  await lightbox.waitFor();
  await shot('attachment-lightbox-1440-light');
  await page.keyboard.press('Escape');
  await lightbox.waitFor({ state: 'hidden' });
  assert.ok(await grid.locator('.aui-audio[data-variant=mini]').count() > 3, '通话录音格子是迷你播放器');
  assert.ok(await grid.locator('.aui-audio[data-variant=mini] .aui-audio-extra').filter({ hasText: /^\+\d$/ }).count() > 0, '多条录音显示 +N');
  const miniHeight = await grid.locator('.aui-audio[data-variant=mini]').first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(miniHeight <= 24.5, `迷你播放器放进 32px 行 ${miniHeight}`);
  await shot('types-1440-light');
  // Progress / link / lookup / formula / autoNumber / system fields render and copy as text
  await grid.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.waitForTimeout(100);
  const wonRow = await grid.locator('[role=row][data-row-key]').evaluateAll((rows) => rows.map((r) => r.dataset.rowKey));
  assert.ok(await grid.locator('.aui-grid-progress-text').filter({ hasText: /^\d+%$/ }).count() > 0, '进度显示百分比');
  assert.match(await text(wonRow[0], '编号'), /^\d+$/);
  assert.match(await text(wonRow[0], '预计佣金'), /^CN¥[\d,]+$/, '公式按结果类型（金额）显示');
  assert.match(await text(wonRow[0], '创建时间'), /^2026-09-\d\d \d\d:\d\d$/);
  const link = grid.locator('.aui-grid-ref').first();
  await link.click();
  await toast('打开商机「').waitFor();
  const linkCell = await cell(wonRow[0], '关联商机');
  await linkCell.focus();
  await page.keyboard.press('Enter');
  await toast('选择关联商机').waitFor();
  assert.equal(await (await cell(wonRow[0], '编号')).getAttribute('aria-readonly'), 'true', '自动编号只读');

  // ---- 1440 dark, 390 light / dark: no page overflow, menus fit
  await grid.evaluate((el) => { el.scrollLeft = 0; el.scrollTop = 0; });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  await shot('overview-1440-dark');
  await header('预计金额').click();
  await menu('预计金额字段菜单').waitFor();
  await shot('header-menu-1440-dark');
  await page.keyboard.press('Escape');
  const contrast = await page.evaluate(() => {
    const rgb = (s) => { const n = (s.match(/[\d.]+/g) || []).map(Number); return s.startsWith('color(srgb') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bg = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return [0, 0, 0]; };
    const ratio = (el) => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const out = {};
    for (const sel of ['.aui-grid-masked-text', '.aui-grid-add-row-inner', '[data-tone=danger] > .aui-cell', '.aui-grid-htitle']) {
      const els = [...document.querySelectorAll(sel)].filter((el) => el.getBoundingClientRect().width > 2 && el.textContent.trim()).slice(0, 4);
      if (els.length) out[sel] = Math.min(...els.map(ratio));
    }
    return out;
  });
  for (const [sel, value] of Object.entries(contrast)) assert.ok(value >= 4.5, `深色 ${sel} 对比度 ${value.toFixed(2)}`);
  for (const [mode, width] of [['dark', 390], ['light', 390]]) {
    if (mode === 'light') await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${mode} 整页不横向溢出`);
    await shot(`overview-${width}-${mode}`);
  }
  // Cell menu on a phone fits the screen.
  const phoneCell2 = await cell(quote[1], '客户名称');
  await phoneCell2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150); // let the scroll settle: a scroll closes a pointer-opened menu
  const pb = await phoneCell2.boundingBox();
  await page.mouse.click(pb.x + 20, pb.y + 10, { button: 'right' });
  const phoneMenu = await page.getByRole('menu').first().boundingBox();
  assert.ok(phoneMenu.x >= 0 && phoneMenu.x + phoneMenu.width <= 390 + 0.5, `手机上菜单不出屏 ${JSON.stringify(phoneMenu)}`);
  await shot('cell-menu-390-light');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });

  assert.deepEqual(errors, []);
  console.log(`PASS grid-tools: header adornments + 「+」 column, header menu (mouse / keyboard / submenu / freeze / filter-by), freeze-line drag, cell / range / group menus (mouse + Shift+F10), fill handle (series / copy / read-only skip / undo) + Ctrl+D, row drag + Alt+Shift+↑↓, add row per group, badge + tone, rating / masked phone / attachments / mini audio / progress / link / lookup / formula / system fields, Ctrl+E, 1440 light/dark + 390 (${output})`);
} finally {
  await browser.close();
  await server.close();
}
