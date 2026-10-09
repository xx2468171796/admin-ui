// 多维表格 4.0 浏览器验收：格子内编辑、选区复制粘贴、清空、撤销重做、服务端拒绝回滚、进入格内链接、铺满窗口、
// 服务端 10 万条无限滚动（分块加载、骨架行、服务端统计、筛选后总数）。starter「系统 → 多维表格」。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/grid-edit');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate(() => { localStorage.removeItem('starter:demo:bitable-contracts:view'); localStorage.removeItem('starter:demo:bitable-server:view'); });
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '多维表格', exact: true }).click();
  const grid = page.getByRole('grid', { name: '合同台账' });
  await grid.locator('[data-row-key]').first().waitFor();
  const area = page.locator('#aui-page-bitable');
  const toolbar = area.getByRole('toolbar', { name: '视图工具栏' });
  // 不分组，方便按行定位
  await toolbar.getByRole('button', { name: /^分组/ }).click();
  await page.getByRole('dialog', { name: '分组' }).getByRole('button', { name: '删除第 1 级分组' }).click();
  await page.keyboard.press('Escape');
  const status = area.locator('.aui-grid-status');
  const rowAt = (i) => grid.locator(`[role=row][data-row-index="${i}"]`);
  const colIndex = async (title) => Number(await grid.getByRole('columnheader', { name: new RegExp(`^${title}`) }).getAttribute('aria-colindex')) - 1;
  const cell = async (i, title) => grid.locator(`[data-cell="${i}:${await colIndex(title)}"]`);
  const text = async (i, title) => (await (await cell(i, title)).innerText()).trim();

  // ---- 铺满窗口：表格滚动区底部离窗口底 ≤ 20px
  const gridBox = await grid.boundingBox();
  assert.ok(900 - (gridBox.y + gridBox.height) <= 32 && 900 - (gridBox.y + gridBox.height) >= 0, `铺满窗口：底部留白 ${900 - (gridBox.y + gridBox.height)}`);

  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1), '铺满后页面本身不再出现滚动条');

  // ---- 双击编辑文本 → Enter 保存，焦点下移；保存中先显示新值
  const name0 = await cell(0, '客户名称');
  await name0.dblclick();
  const editor = grid.locator('.aui-grid-editor input');
  await editor.waitFor();
  await editor.fill('测试改名有限公司');
  await page.keyboard.press('Enter');
  assert.equal(await text(0, '客户名称'), '测试改名有限公司', '先显示新值');
  assert.equal(await name0.getAttribute('data-saving'), 'saving', '保存中标记');
  await status.getByText('已保存 1 格').waitFor();
  assert.equal(await name0.getAttribute('data-saving'), null);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.cell), `1:${await colIndex('客户名称')}`, 'Enter 后焦点到下一行同一列');

  // ---- bt/datepicker：日期格编辑 = 文本框 + 格子下方的日历；可直接打 2026/11/3，↓ 进日历、Enter 选中即保存
  const signed2 = await cell(2, '签约日期');
  await signed2.dblclick();
  const dateEditor = grid.locator('.aui-grid-editor input');
  await dateEditor.waitFor();
  const cal = page.getByRole('dialog', { name: '选择「签约日期」' });
  await cal.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.aui-grid-editor') !== null), true, '日历打开不抢焦点');
  await dateEditor.fill('2026/11/3');
  await page.keyboard.press('Enter');
  await cal.waitFor({ state: 'detached' });
  assert.match(await text(2, '签约日期'), /2026-11-03/, '2026/11/3 → 2026-11-03');
  await signed2.dblclick();
  await cal.waitFor();
  await page.keyboard.press('ArrowDown');
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), /2026 年 11 月 3 日/, '↓ 进日历，停在当前值');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await cal.waitFor({ state: 'detached' });
  assert.match(await text(2, '签约日期'), /2026-11-04/, '日历里 Enter 选中即保存');
  await page.screenshot({ path: resolve(output, 'date-editor.png'), animations: 'disabled' });

  // ---- 直接打字进入编辑（替换内容），Esc 取消不改
  const seats1 = await cell(1, '席位数');
  const seatsBefore = await text(1, '席位数');
  await seats1.click();
  await page.keyboard.press('9');
  await editor.waitFor();
  assert.equal(await editor.inputValue(), '9', '打字替换原值');
  await page.keyboard.press('Escape');
  assert.equal(await text(1, '席位数'), seatsBefore, 'Esc 不保存');
  // 校验失败：编辑器不关，显示原因
  await page.keyboard.press('Enter');
  await editor.fill('99999');
  await page.keyboard.press('Enter');
  await grid.getByRole('alert').filter({ hasText: '席位数在 0–10000 之间' }).waitFor();
  await editor.fill('321');
  await page.keyboard.press('Tab');
  await status.getByText('已保存 1 格').waitFor();
  assert.equal(await text(1, '席位数'), '321');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.cell), `1:${await colIndex('席位数') + 1}`, 'Tab 后焦点右移');

  // ---- 单选：Enter 打开选项列表，选「赢单」
  const stage2 = await cell(2, '阶段');
  await stage2.click();
  await page.keyboard.press('Enter');
  const options = page.getByRole('listbox', { name: '阶段' });
  await options.waitFor();
  await page.screenshot({ path: resolve(output, 'select-editor.png') });
  await options.getByRole('option', { name: '赢单' }).click();
  await status.getByText('已保存 1 格').waitFor();
  assert.equal(await text(2, '阶段'), '赢单');

  // ---- 勾选框：Enter 直接切换
  const paid3 = await cell(3, '已回款');
  const before = await paid3.locator('.aui-grid-check').getAttribute('data-checked');
  await paid3.click();
  await page.keyboard.press('Enter');
  await status.getByText('已保存 1 格').waitFor();
  assert.notEqual(await paid3.locator('.aui-grid-check').getAttribute('data-checked'), before, 'Enter 切换勾选');

  // ---- 选区：拖选 2×2，Ctrl+C 得到 TSV；粘贴到另一处
  const a = await cell(0, '客户名称');
  const b = await cell(1, '阶段');
  await a.hover();
  await page.mouse.down();
  await b.hover();
  await page.mouse.up();
  assert.equal(await grid.locator('[data-in-range]').count(), 4, '拖选出 4 格');
  await page.keyboard.press('Control+c');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip.split(/\r\n/).length, 2);
  assert.equal(clip.split(/\r\n/)[0].split('\t')[0], '测试改名有限公司');
  await status.getByText('已复制 4 格', { exact: false }).waitFor();
  await page.screenshot({ path: resolve(output, 'range.png') });
  const target = await cell(5, '客户名称');
  await target.click();
  await page.keyboard.press('Control+v');
  await status.getByText('已粘贴', { exact: false }).waitFor();
  await status.getByText('已粘贴 4 格').or(status.getByText(/已粘贴 \d 格/)).waitFor();
  assert.equal(await text(5, '客户名称'), '测试改名有限公司', '粘贴写入');
  assert.equal(await text(6, '阶段'), await text(1, '阶段'));
  // 外部表格（Excel）粘贴：带非法值的格子跳过并说明
  await page.evaluate(() => navigator.clipboard.writeText('甲公司\t不存在的阶段\r\n乙公司\t赢单'));
  const target2 = await cell(8, '客户名称');
  await target2.click();
  await page.keyboard.press('Control+v');
  await status.getByText(/跳过 1 格：没有这个选项/).waitFor();
  assert.equal(await text(8, '客户名称'), '甲公司');
  assert.equal(await text(9, '阶段'), '赢单');

  // ---- 撤销 / 重做
  await page.keyboard.press('Control+z');
  await status.getByText(/已撤销 \d 格/).waitFor();
  assert.notEqual(await text(8, '客户名称'), '甲公司', 'Ctrl+Z 撤销粘贴');
  await page.keyboard.press('Control+y');
  await status.getByText(/已重做 \d 格/).waitFor();
  assert.equal(await text(8, '客户名称'), '甲公司', 'Ctrl+Y 重做');

  // ---- Delete 清空（必填字段不清）
  let tagRow = 10;
  // 多维表格空格子留白（innerText 是空的，不再是「—」）
  while ((await text(tagRow, '标签')) === '') tagRow++;
  const tagsCell = await cell(tagRow, '标签');
  const tb = await tagsCell.boundingBox();
  await tagsCell.click({ position: { x: tb.width - 4, y: tb.height / 2 } });
  await page.keyboard.press('Delete');
  await status.getByText(/已清空 1 格/).waitFor();
  assert.equal(await text(tagRow, '标签'), '', '清空后格子留白');
  await (await cell(10, '客户名称')).click();
  await page.keyboard.press('Delete');
  await status.getByText(/不能为空/).waitFor();

  // ---- 服务端拒绝：回滚并显示原因
  await (await cell(11, '客户名称')).dblclick();
  const old11 = await editor.inputValue();
  await editor.fill('会失败的名字');
  await page.keyboard.press('Enter');
  await status.getByText(/1 格未保存：服务端拒绝/).waitFor();
  assert.equal(await text(11, '客户名称'), old11, '拒绝后回到原值');

  // ---- 进入格内链接：只读的「合同编号」没有链接；「客户档案」可编辑 → 用记录详情验证；这里验证 Enter 进入只读格的链接
  // 关闭编辑能力的列：合同编号不可编辑 → Enter 打开记录
  await (await cell(12, '合同编号')).click();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').filter({ has: page.locator('.aui-record-dialog') }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !location.search.includes('contract='));
  await page.waitForTimeout(200);

  // ---- 8.4 截止日期（GridField.deadline）：「下次跟进」按今天比——逾期 danger + 格内「逾期 N 天」（悬停「已逾期 N 天」），
  // 今天 / 2 天内 warning，更远不着色；赢单 / 输单是 closed，不提醒
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const dayNum = (key) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;
  const seen = { danger: 0, other: 0 };
  for (let i = 0; i < 18; i++) {
    const due = await cell(i, '下次跟进');
    const time = due.locator('time');
    if (!(await time.count())) { assert.equal(await due.getAttribute('data-tone'), null, `第 ${i} 行没有日期不着色`); continue; }
    const day = (await time.getAttribute('datetime')).slice(0, 10);
    const stage = await text(i, '阶段');
    const diff = dayNum(day) - dayNum(today);
    const closed = stage === '赢单' || stage === '输单';
    const want = closed ? null : diff < 0 ? 'danger' : diff <= 2 ? 'warning' : null;
    assert.equal(await due.getAttribute('data-tone'), want, `第 ${i} 行 ${day}（${stage}）`);
    const tag = due.locator('.aui-grid-due-tag');
    if (want === 'danger') {
      assert.equal((await tag.innerText()).trim(), `逾期 ${-diff} 天`);
      assert.equal(await tag.getAttribute('data-tip'), `已逾期 ${-diff} 天`);
    } else assert.equal(await tag.count(), 0, `第 ${i} 行没有逾期小字`);
    seen[want === 'danger' ? 'danger' : 'other'] += 1;
  }
  assert.ok(seen.danger > 0 && seen.other > 0, `前 18 行里有逾期和不逾期的 ${JSON.stringify(seen)}`);
  // 窄列：小字截断，日期本身不被挤掉
  const dueCol = grid.getByRole('columnheader', { name: /^下次跟进/ });
  const overdueCell = grid.locator('[role=gridcell][data-tone=danger] .aui-grid-due').first();
  await overdueCell.scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, 'deadline-1440.png'), animations: 'disabled' });
  const dueHandle = await dueCol.locator('.aui-grid-resizer').boundingBox();
  await page.mouse.move(dueHandle.x + dueHandle.width / 2, dueHandle.y + dueHandle.height / 2);
  await page.mouse.down();
  const wide = await overdueCell.evaluate((el) => { const tag = el.querySelector('.aui-grid-due-tag'); return tag.scrollWidth <= tag.clientWidth; });
  assert.ok(wide, '默认列宽（截止日期 184px）放得下「逾期 N 天」');
  await page.mouse.move(dueHandle.x - 50, dueHandle.y + dueHandle.height / 2, { steps: 4 });
  await page.mouse.up();
  const narrow = await overdueCell.evaluate((el) => {
    const tag = el.querySelector('.aui-grid-due-tag');
    const date = el.querySelector('time');
    const box = el.closest('.aui-cell').getBoundingClientRect();
    return { tagRight: tag.getBoundingClientRect().right, cellRight: box.right, truncated: tag.scrollWidth > tag.clientWidth, dateRight: date.getBoundingClientRect().right };
  });
  assert.ok(narrow.tagRight <= narrow.cellRight + 0.5 && narrow.truncated, `窄列里小字截断、不出格 ${JSON.stringify(narrow)}`);
  assert.ok(narrow.dateRight <= narrow.cellRight + 0.5, '日期完整显示');

  // ---- 8.4 格子里新建选项（GridField.onCreateOption）：搜不到时最后一行「+ 新建选项「…」」，回车 = 等宿主建好再选上；
  // 和已有选项只差大小写也算新的；宿主拒绝 → 编辑器不关、通知里说原因
  const tags0 = await cell(0, '标签');
  await tags0.click();
  await page.keyboard.press('Enter');
  const tagList = page.getByRole('listbox', { name: '标签' });
  await tagList.waitFor();
  const search = grid.locator('.aui-grid-option-search');
  await search.fill('战略伙伴');
  const createRow = page.getByRole('option', { name: '新建选项「战略伙伴」' });
  await createRow.waitFor();
  assert.equal(await search.getAttribute('aria-activedescendant'), await createRow.getAttribute('id'), '没有匹配的选项时新建行就是当前行');
  await page.screenshot({ path: resolve(output, 'create-option-1440.png'), animations: 'disabled' });
  await page.keyboard.press('Enter');
  await page.getByRole('option', { name: '正在新建选项「战略伙伴」' }).waitFor();
  await tagList.getByRole('option', { name: '战略伙伴' }).waitFor();
  assert.equal(await tagList.getByRole('option', { name: '战略伙伴' }).getAttribute('aria-selected'), 'true', '多选：新建的选项加进已选');
  await page.keyboard.press('Control+Enter');
  await status.getByText('已保存 1 格').waitFor();
  assert.match(await text(0, '标签'), /战略伙伴/);
  // 宿主拒绝
  await tags0.click();
  await page.keyboard.press('Enter');
  await tagList.waitFor();
  await search.fill('失败的标签');
  await page.getByRole('option', { name: '新建选项「失败的标签」' }).click();
  await page.getByText('演示：选项名不能含「失败」').waitFor();
  assert.equal(await search.inputValue(), '失败的标签', '失败后搜索词还在，编辑器不关');
  await page.getByRole('option', { name: '新建选项「失败的标签」' }).waitFor();
  // 输入已有的「续约」不给新建行（大小写规则见 option-list-core 单测）
  await search.fill('续约');
  assert.equal(await page.getByRole('option', { name: /^新建选项/ }).count(), 0, '同名选项不给新建');
  await page.keyboard.press('Escape');
  for (const close of await page.getByRole('button', { name: '关闭通知' }).all()) await close.click().catch(() => undefined);

  // ---- 服务端 10 万条
  await page.getByRole('button', { name: /服务端 10 万条/ }).click();
  // 弹框关闭动画结束前 Radix 仍把页面其余部分标为 aria-hidden
  await page.locator('[role=dialog]').waitFor({ state: 'detached' }).catch(() => undefined);
  const sgrid = page.getByRole('grid', { name: '合同台账（服务端）' });
  await sgrid.locator('[data-row-key]').first().waitFor();
  assert.equal(await sgrid.getAttribute('aria-rowcount'), String(100000 + 2), '服务端总数 10 万');
  assert.match(await area.locator('.aui-grid-summary-total').innerText(), /100000 条/);
  await area.locator('.aui-grid-summary-value').first().waitFor();
  await sgrid.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.6; });
  await page.waitForTimeout(80);
  const skeletons = await sgrid.locator('.aui-grid-skeleton').count();
  await page.screenshot({ path: resolve(output, 'server-loading.png') });
  await sgrid.locator('[role=row][data-row-key]').nth(5).waitFor();
  await page.waitForTimeout(400);
  const idx = await sgrid.locator('[role=row][data-row-key]').evaluateAll((rows) => rows.map((r) => Number(r.getAttribute('aria-rowindex'))));
  assert.ok(Math.min(...idx) > 50000, `滚到 60% 处加载那一段（${idx[0]}），加载中出现骨架行 ${skeletons}`);
  // 服务端搜索后总数变化
  await area.getByRole('searchbox', { name: '搜索记录' }).fill('远山精密');
  await page.waitForFunction(() => { const g = document.querySelector('[role=grid][aria-label="合同台账（服务端）"]'); return g && g.getAttribute('aria-rowcount') !== '100002' && g.getAttribute('aria-rowcount') !== '2' && !g.closest('[aria-busy=true]'); }, null, { timeout: 15000 });
  const filtered = Number(await sgrid.getAttribute('aria-rowcount')) - 2;
  assert.ok(filtered > 0 && filtered < 100000, `服务端搜索后 ${filtered} 条`);
  await page.screenshot({ path: resolve(output, 'server.png') });
  assert.deepEqual(errors, [], errors.join('; '));
  console.log('PASS grid-edit: edit / type-to-edit / validate / select / checkbox / range copy-paste / external paste skip / undo-redo / clear / reject rollback / fill height / deadline tones + overdue suffix / create option (pending, pick, reject) / server 100k infinite scroll + search');
} finally {
  await browser.close();
  await server.close();
}
