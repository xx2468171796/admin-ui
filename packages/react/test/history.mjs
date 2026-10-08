// 版本回退浏览器验收：starter「系统 → 版本回退」（样稿 D23 操作记录、D24 表时光机）。
// 操作记录：类型筛选带数量、影响、状态胶囊、超过 3 天一组变灰且撤回灰掉（悬停 / 聚焦说原因）、展开看改动明细、
// 「这批之后」冲突逐格 保留 / 退回 + 整批规则（方向键）、撤回整批后状态变「已撤回 / 部分撤回」。
// 表时光机：快捷时间、日期 / 时间框、时间轴操作点（方向键、提示、点一下退到它之前）、滑块（方向键）、四张预览卡、
// 冲突表、确认回滚关窗；1440 浅 / 深色、390 手机不横向溢出，截图在 test/artifacts/history/。
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const executablePath = () => { const cached = '/home/admin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'; return process.env.CHROMIUM_PATH || (existsSync(cached) ? cached : chromium.executablePath()); };
const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/history');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: executablePath(), args: ['--no-sandbox'] });
const minContrast = (page, selectors) => page.evaluate((sels) => {
  const rgb = (s) => { const n = (s.match(/[\d.]+/g) || []).map(Number); return s.startsWith('color(srgb') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bg = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return [255, 255, 255]; };
  const ratio = (el) => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const out = {};
  for (const sel of sels) { const els = [...document.querySelectorAll(sel)].filter((el) => el.getBoundingClientRect().width > 2 && el.textContent.trim()).slice(0, 8); out[sel] = els.length ? Math.min(...els.map(ratio)) : null; }
  return out;
}, selectors);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '版本回退', exact: true }).click();
  const area = page.locator('#aui-page-history');
  const log = area.locator('.aui-oplog');
  await log.waitFor();
  const rows = () => log.locator('.aui-oplog-item');

  // ---- kind chips with counts
  const kinds = area.getByRole('group', { name: '按类型看' });
  assert.deepEqual(await kinds.getByRole('button').allInnerTexts(), ['全部 10', '数据 7', '字段结构 2', '视图 1']);
  await kinds.getByRole('button', { name: '字段结构 2' }).click();
  assert.equal(await rows().count(), 2, '只看字段结构');
  await kinds.getByRole('button', { name: '全部 10' }).click();
  assert.equal(await rows().count(), 10);

  // ---- 「做了什么」不截断（审阅 07）：最多两行写全，再长才省略；纯文字的全文在 title
  const cut = await log.locator('.aui-oplog-text').evaluateAll((els) => els.filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent));
  assert.deepEqual(cut, [], `做了什么被截断：${cut}`);
  assert.equal(await rows().first().locator('.aui-oplog-what').getAttribute('data-tip'), '粘贴 48 格 · 预计金额、下次跟进 两列');

  // ---- 记录修改历史（inlineDiff）：一处改动在行里写「旧 → 新」，打码的照样打码；多处改动展开看表
  const recordLog = area.getByRole('list', { name: '李承恩的修改历史' });
  const edits = recordLog.locator('.aui-log-item');
  assert.equal(await edits.count(), 3);
  assert.equal(await edits.nth(0).locator('.aui-log-inline s').innerText(), '跟进中', '旧值删除线');
  assert.equal(await edits.nth(0).locator('.aui-log-inline b').innerText(), '已成交', '新值加粗');
  assert.equal(await edits.nth(0).locator('.aui-log-toggle').count(), 0, '一处改动写在行里，不用再展开');
  assert.equal(await edits.nth(1).locator('.aui-log-inline').innerText().then((t) => t.replace(/\s+/g, '')), '***改成***', '打码字段照样打码');
  assert.equal(await edits.nth(2).locator('.aui-log-inline').count(), 0, '多处改动不挤在一行');
  await edits.nth(2).getByRole('button', { name: '展开详情' }).click();
  assert.equal(await edits.nth(2).locator('.aui-log-diff tbody tr').count(), 2);

  // ---- groups, impact, status pills, dimmed old group
  const days = await log.locator('.aui-log-day-label').allTextContents();
  assert.deepEqual(days, ['今天 10-05', '昨天 10-04', '10-03', '超过 3 天10-02 15:40 之前 · 只能逐条恢复（修改历史保留 180 天）']);
  const first = rows().first();
  assert.match(await first.innerText(), /OP-20261005-0149[\s\S]*14:20[\s\S]*小王[\s\S]*粘贴 48 格[\s\S]*24 条/);
  assert.match(await log.innerText(), /数据还在/);
  assert.match(await log.innerText(), /已被 OP-…0094 退回/);
  const old = log.locator('.aui-log-day[data-old] .aui-oplog-item');
  assert.equal(await old.count(), 1);
  assert.equal(await old.getAttribute('data-dim'), 'true');
  assert.match(await old.locator('.aui-log-time').innerText(), /^10-02 11:20$/);
  const oldUndo = old.getByRole('button', { name: '撤回整批' });
  assert.equal(await oldUndo.getAttribute('aria-disabled'), 'true', '超过 3 天的撤回灰掉');
  await oldUndo.hover();
  const tip = old.getByRole('tooltip');
  assert.ok(await tip.isVisible(), '悬停说原因');
  assert.equal((await tip.innerText()).trim(), '超过 3 天，只能逐条恢复');
  await oldUndo.click({ force: true });
  assert.equal(await old.locator('.aui-log-status').count(), 0, '灰掉的点了没反应');
  // Undo kinds: field restore, undo a rollback.
  assert.equal(await log.getByRole('button', { name: '恢复字段（连数据）' }).count(), 1);
  assert.equal(await log.getByRole('button', { name: '撤销撤回' }).count(), 1);

  // ---- the opened diff: record · field · before → after · later edits, conflict choices
  const open = first.locator('.aui-oplog-open');
  assert.ok(await open.isVisible(), '默认展开 OP-0149');
  assert.match(await open.innerText(), /改动明细 · 48 格 = 24 条记录/);
  assert.equal(await open.locator('tbody tr[data-later]').count(), 2, '两格之后被改过');
  assert.match(await open.innerText(), /没人再改过/);
  assert.match(await open.innerText(), /这批之后有 2 条被 小李 又改过。撤回整批时：/);
  const modes = open.getByRole('radiogroup', { name: '冲突怎么处理' });
  const keep = modes.getByRole('radio', { name: '保留小李后来的修改' });
  assert.equal(await keep.getAttribute('aria-checked'), 'true', '默认保留别人后来的修改');
  await keep.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await modes.getByRole('radio', { name: '一起退回' }).getAttribute('aria-checked'), 'true', '方向键换规则');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await keep.getAttribute('aria-checked'), 'true');
  // per-cell exception
  const cell = open.getByRole('group', { name: '黄淑芬：保留还是退回' });
  await cell.getByRole('button', { name: '退回' }).click();
  assert.equal(await cell.getByRole('button', { name: '退回' }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: resolve(output, 'operations-1440.png'), fullPage: true, animations: 'disabled' });
  // keyboard: collapse / expand with the 「查看改动」 button
  const toggle = first.getByRole('button', { name: '收起改动' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  assert.equal(await first.locator('.aui-oplog-open').count(), 0, 'Enter 收起');
  await first.getByRole('button', { name: '查看改动' }).press('Enter');
  assert.equal(await first.locator('.aui-oplog-open').count(), 1, 'Enter 展开');
  // undo with an exception → 部分撤回
  await first.getByRole('button', { name: '撤回整批' }).click();
  await first.locator('.aui-log-status').waitFor();
  assert.match(await first.locator('.aui-log-status').innerText(), /已撤回/, '有一格选了退回 → 整批撤回');
  await rows().nth(1).getByRole('button', { name: '撤回整批' }).click();
  await rows().nth(1).locator('.aui-log-status').waitFor();
  assert.equal(await rows().nth(1).getAttribute('data-dim'), 'true', '撤回的行变灰');

  // ---- time machine
  await area.getByRole('button', { name: '表时光机' }).click();
  const dlg = page.getByRole('dialog', { name: '表时光机' });
  await dlg.waitFor();
  const pin = dlg.getByRole('slider', { name: '退回到的时间' });
  assert.equal(await pin.getAttribute('aria-valuetext'), '昨天 09:00');
  await dlg.locator('.aui-tm-card:not([data-loading])').first().waitFor();
  const cards = () => dlg.locator('.aui-tm-card').allInnerTexts();
  assert.equal((await cards()).length, 4, '四张预览卡');
  assert.match((await cards())[3], /5 条有冲突/);
  assert.equal(await dlg.locator('.aui-conflict-table tbody tr').count(), 5);
  assert.match(await dlg.locator('.aui-conflict').innerText(), /其中 5 条在 昨天 09:00 之后被别人改过/);
  assert.match(await dlg.locator('.aui-tm-sel').innerText(), /这一刻之后 8 次操作会被退回/);
  assert.equal(await dlg.locator('.aui-tm-day').count(), 3, '三个零点刻度');
  assert.equal(await dlg.getByRole('button', { name: '昨天 09:00' }).getAttribute('aria-pressed'), 'true', '快捷时间跟着选中');
  assert.equal(await dlg.getByLabel('日期', { exact: true }).inputValue(), '2026-10-04');
  assert.equal(await dlg.getByLabel('时间', { exact: true }).inputValue(), '09:00');
  // operation dots: arrow keys move, tooltip shows, Enter jumps just before it
  const dots = dlg.locator('.aui-tm-dot');
  assert.equal(await dots.count(), 12);
  await dots.first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  assert.match(await dlg.getByRole('tooltip').innerText(), /OP-20261003-0064[\s\S]*小李 改「阶段看板」分组 · 点一下退到它之前/);
  await page.screenshot({ path: resolve(output, 'time-machine-1440.png'), animations: 'disabled' });
  await page.keyboard.press('Enter');
  assert.equal(await pin.getAttribute('aria-valuetext'), '10-03 15:39', '退到这次操作之前一分钟');
  // slider keys
  await pin.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await pin.getAttribute('aria-valuetext'), '10-03 16:39', '→ 加一小时');
  await page.keyboard.press('End');
  assert.equal(await pin.getAttribute('aria-valuetext'), '今天 15:40');
  await dlg.getByText('这个时间点之后没有可回退的修改').waitFor();
  assert.equal(await dlg.locator('.aui-tm-card').count(), 0, '退到现在：没有改动就不摆四张卡');
  assert.equal(await dlg.getByRole('button', { name: '确认回滚' }).getAttribute('aria-disabled'), 'true', '没有改动不给确认');
  await dlg.getByRole('button', { name: '确认回滚' }).click({ force: true });
  assert.equal(await dlg.isVisible(), true, '点了也不回滚、不关弹窗');
  await page.screenshot({ path: resolve(output, 'time-machine-nothing-1440.png'), animations: 'disabled' });
  await dlg.getByRole('button', { name: '1 小时前' }).click();
  assert.equal(await pin.getAttribute('aria-valuetext'), '今天 14:40');
  // date / time boxes
  await dlg.getByLabel('时间', { exact: true }).fill('09:00');
  await dlg.getByLabel('日期', { exact: true }).fill('2026-10-04');
  assert.equal(await pin.getAttribute('aria-valuetext'), '昨天 09:00');
  await dlg.locator('.aui-conflict').waitFor();
  // 8.0.2: 「字段」 cells line up with the rest of the row (the class no longer collides with SaveConflictDialog's fieldset)
  const fieldCell = await dlg.locator('.aui-conflict-table tbody tr').first().evaluate((tr) => {
    const mid = (n) => { const r = n.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
    const cell = tr.querySelector('.aui-conflict-fieldname');
    return { display: getComputedStyle(cell).display, off: Math.abs(mid(cell.firstChild ? (() => { const r = document.createRange(); r.selectNodeContents(cell); return r; })() : cell) - mid(tr.querySelector('.aui-conflict-record'))) };
  });
  assert.ok(fieldCell.display === 'table-cell' && fieldCell.off < 2, `「字段」列和记录同一行居中：${JSON.stringify(fieldCell)}`);
  // conflict per row + rule
  const row = dlg.getByRole('group', { name: '吴宗翰：保留还是退回' });
  await row.getByRole('button', { name: '退回' }).click();
  assert.equal(await dlg.locator('.aui-conflict-table tr[data-choice=revert]').count(), 1);
  await dlg.getByRole('radio', { name: '一起退回' }).click();
  assert.equal(await dlg.locator('.aui-conflict-table tr[data-choice=revert]').count(), 5, '一起退回 = 每格都退回');
  await dlg.getByRole('radio', { name: /保留别人后来的修改/ }).click();
  assert.ok((await overflow(page)) <= 0, '弹窗不撑宽页面');
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click({ force: true }).catch(() => undefined);

  // dark: close dialog first (the theme toggle sits behind the overlay), then screenshot both
  await dlg.getByRole('button', { name: '取消' }).click();
  await dlg.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(300);
  for (const [sel, v] of Object.entries(await minContrast(page, ['.aui-log-kind', '.aui-log-status', '.aui-oplog-code', '.aui-oplog-detail', '.aui-log-day-label', '.aui-oplog-later-text', '.aui-conflict-mode']))) assert.ok(v === null || v >= 4.5, `深色 ${sel} 对比度 ${v?.toFixed(2)}`);
  await page.screenshot({ path: resolve(output, 'operations-1440-dark.png'), fullPage: true, animations: 'disabled' });
  await area.getByRole('button', { name: '表时光机' }).click();
  await dlg.locator('.aui-conflict').waitFor();
  await page.screenshot({ path: resolve(output, 'time-machine-1440-dark.png'), animations: 'disabled' });
  // confirm closes and notifies
  await dlg.getByRole('button', { name: '确认回滚' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.match(await page.locator('.aui-notice').allInnerTexts().then((t) => t.join(' ')), /已回滚/);
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();

  // ---- phone
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok((await overflow(page)) <= 0, `390 页面横向溢出 ${await overflow(page)}px`);
  // 操作记录本身也不横着滚：列头收起，每条拆成几行；展开的改动明细每格一张小卡
  if (!(await log.locator('.aui-oplog-open').count())) await rows().first().getByRole('button', { name: '查看改动' }).click();
  const phone = await log.evaluate((el) => {
    const over = (n) => n.scrollWidth - n.clientWidth;
    const right = Math.max(...[...el.querySelectorAll('.aui-oplog-row > *, .aui-oplog-open *')].map((n) => n.getBoundingClientRect().right));
    return { log: over(el), diffs: [...el.querySelectorAll('.aui-oplog-diff-scroll')].map(over), head: getComputedStyle(el.querySelector('.aui-oplog-head')).display, right, rowH: el.querySelector('.aui-oplog-row').getBoundingClientRect().height, width: el.getBoundingClientRect().right };
  });
  assert.ok(phone.log <= 0, `390 操作记录横着滚 ${phone.log}px`);
  assert.ok(phone.diffs.length > 0 && phone.diffs.every((d) => d <= 0), `390 改动明细横着滚 ${phone.diffs}`);
  assert.equal(phone.head, 'none', '390 列头收起');
  assert.ok(phone.right <= phone.width + 0.5, `390 行里的内容超出操作记录右边（${phone.right} > ${phone.width}）`);
  assert.ok(phone.rowH > 60, `390 每条拆成多行（行高 ${phone.rowH}）`);
  assert.equal(await log.locator('.aui-oplog-diff-table thead th').first().textContent(), '记录', '390 明细列头还留给读屏');
  await page.screenshot({ path: resolve(output, 'operations-390.png'), fullPage: true, animations: 'disabled' });
  await area.getByRole('button', { name: '表时光机' }).click();
  await dlg.locator('.aui-conflict').waitFor();
  assert.ok((await overflow(page)) <= 0, '390 弹窗不撑宽页面');
  const box = await dlg.boundingBox();
  assert.ok(box && box.width <= 390, `弹窗宽 ${box?.width}`);
  // 8.0.2: the conflict table becomes one card per cell on phones — no sideways scroll, nothing past the right edge
  const cf = await dlg.locator('.aui-conflict').evaluate((el) => {
    const scroll = el.querySelector('.aui-conflict-scroll');
    const row = el.querySelector('.aui-conflict-table tbody tr');
    const right = Math.max(...[...row.querySelectorAll('th, td, td *')].map((n) => n.getBoundingClientRect().right));
    const toggle = row.querySelector('.aui-segmented')?.getBoundingClientRect();
    return { over: scroll.scrollWidth - scroll.clientWidth, right, edge: el.getBoundingClientRect().right, rowH: row.getBoundingClientRect().height, toggleH: toggle?.height ?? 0, then: getComputedStyle(row.querySelector('.aui-conflict-then'), '::before').content };
  });
  assert.ok(cf.over <= 0 && cf.right <= cf.edge + 0.5, `390 冲突表不横着滚、不超出：${JSON.stringify(cf)}`);
  assert.ok(cf.rowH > 80 && cf.toggleH >= 32, `390 冲突每格一张卡、切换 32 高：${JSON.stringify(cf)}`);
  assert.match(cf.then, /昨天 09:00 时/, '390 卡片里「改前」带列名');
  assert.equal(await dlg.locator('.aui-conflict-table thead th').nth(1).textContent(), '字段', '390 冲突表列头留给读屏');
  await page.screenshot({ path: resolve(output, 'time-machine-390.png'), animations: 'disabled' });
  await dlg.getByRole('button', { name: '取消' }).click();

  assert.deepEqual(errors, [], errors.join('; '));
  console.log(`PASS history: operation log (kind chips, groups, impact, status pills, dimmed > 3 days with reason, diff + later edits, keep / revert rule + per cell, undo), time machine (quick picks, date / time, dots keys + tooltip, slider keys, 4 cards, conflicts, confirm), 1440 light / dark, 390 (${output})`);
} finally {
  await browser.close();
  await server.close();
}
