// bt/datepicker 浏览器验收：starter「日期选择」页。
// 直接输入（2026/10/5、10/5、越界退回）、键盘（↓ 打开、方向键 / PageUp / PageDown / Home / End、Enter 选、Esc 关并归还焦点）、
// min / max / 不可选日、休 / 班标记、日期时间（分钟步长）、时间框 ↑ ↓、日期范围（快捷范围、两次点击自动排序）、
// 「+ 添加」日历按钮、弹框里的日历（挂在弹框里、Esc 只关日历）、1440 浅 / 深色、390 手机（格子 ≥ 44px、不溢出）。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/date-picker');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '日期选择', exact: true }).click();
  const area = page.locator('#aui-page-dates');
  const install = area.getByLabel('安装日期', { exact: true });
  await install.waitFor();
  const facts = area.locator('.aui-desc');

  // ---- 直接输入：多种写法、Enter / 失焦提交、越界和不可选的退回
  assert.equal(await install.inputValue(), '2026-10-12');
  await install.fill('2026/10/20');
  await install.press('Enter');
  assert.equal(await install.inputValue(), '2026-10-20', '2026/10/20 → 规范格式');
  await install.fill('10/21');
  await install.press('Tab');
  assert.equal(await install.inputValue(), '2026-10-21', '10/21 → 今年');
  assert.match(await facts.innerText(), /安装日期\s*2026-10-21/);
  await install.fill('2026-10-04');
  assert.equal(await install.getAttribute('aria-invalid'), 'true', '早于 min 标红');
  await install.press('Tab');
  assert.equal(await install.inputValue(), '2026-10-21', '越界的输入失焦后退回原值');
  await install.fill('2026-10-25');
  assert.equal(await install.getAttribute('aria-invalid'), 'true', '周日不可选');
  await install.fill('2026-10-24');
  assert.match(await facts.innerText(), /安装日期\s*2026-10-24/, '完整日期边输边生效');
  await install.press('Tab');

  // ---- 键盘：↓ 打开并进入方格，方向键 / PageUp / PageDown / Home / End，Enter 选中，Esc 关闭归还焦点
  await install.focus();
  await page.keyboard.press('ArrowDown');
  const pop = page.getByRole('dialog', { name: '选择日期' });
  await pop.waitFor();
  assert.equal(await install.getAttribute('aria-expanded'), 'true');
  assert.match(await focused(), /2026 年 10 月 24 日 星期六/);
  assert.equal(await pop.getByRole('grid').first().getAttribute('aria-label'), '2026 年 10 月');
  assert.equal(await pop.locator('[aria-current=date]').getAttribute('aria-label'), '2026 年 10 月 5 日 星期一，休', '今天 aria-current=date，带休');
  assert.equal(await pop.locator('[data-day="2026-10-24"]').getAttribute('aria-selected'), 'true');
  assert.match(await pop.locator('[data-day="2026-10-10"]').innerText(), /班/);
  assert.equal(await pop.locator('[data-day="2026-10-04"]').getAttribute('aria-disabled'), 'true', 'min 之前不能选');
  await page.keyboard.press('ArrowRight');
  assert.match(await focused(), /10 月 25 日 星期日/);
  await page.keyboard.press('ArrowDown');
  assert.match(await focused(), /11 月 1 日/);
  assert.equal(await pop.getByRole('grid').first().getAttribute('aria-label'), '2026 年 11 月', '跨月自动翻页');
  await page.keyboard.press('PageDown');
  assert.match(await focused(), /12 月 1 日/);
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  assert.match(await focused(), /10 月 5 日/, '翻页夹在 min 上（10-01 早于 min）');
  await page.keyboard.press('ArrowUp');
  assert.match(await focused(), /10 月 5 日/, '方向键夹在 min 上');
  await page.keyboard.press('End');
  assert.match(await focused(), /10 月 11 日 星期日/, 'End = 周末（周一开头）');
  await page.keyboard.press('Enter');
  assert.ok(await pop.isVisible(), '不可选的日子 Enter 不关闭');
  await page.keyboard.press('Home');
  assert.match(await focused(), /10 月 5 日 星期一/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await pop.waitFor({ state: 'detached' });
  assert.equal(await install.inputValue(), '2026-10-06');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'dp-install');
  // Esc 关闭归还焦点；点输入框只显示日历、不抢焦点，可以接着打字
  await install.click();
  await pop.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'dp-install', '点输入框不抢焦点');
  await page.keyboard.press('ArrowDown');
  assert.match(await focused(), /10 月 6 日/);
  await shot('date-picker-1440');
  await page.keyboard.press('Escape');
  await pop.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'dp-install', 'Esc 焦点回输入框');
  // 年月跳转
  await area.getByRole('button', { name: '选择日期' }).first().click();
  await pop.waitFor();
  await pop.getByRole('button', { name: /2026 年 10 月，切换年月/ }).click();
  await pop.getByRole('gridcell', { name: '12 月' }).click();
  assert.equal(await pop.getByRole('grid').first().getAttribute('aria-label'), '2026 年 12 月');
  await pop.getByRole('gridcell', { name: /12 月 16 日/ }).click();
  await pop.waitFor({ state: 'detached' });
  assert.equal(await install.inputValue(), '2026-12-16');

  // ---- 日期时间：分钟步长、min 带时间、今天按钮
  const visit = area.getByLabel('预约上门时间', { exact: true });
  await visit.fill('2026-10-12 9:07');
  await visit.press('Enter');
  assert.equal(await visit.inputValue(), '2026-10-12 09:00', '15 分钟一档');
  assert.match(await facts.innerText(), /预约上门时间\s*2026-10-12T09:00/, '值的格式和 datetime-local 一样');
  await visit.fill('2026-10-05 08:30');
  assert.equal(await visit.getAttribute('aria-invalid'), 'true', 'min 带时间');
  await visit.press('Escape');
  await visit.press('Tab');
  assert.equal(await visit.inputValue(), '2026-10-12 09:00');
  await area.getByRole('button', { name: '选择日期和时间' }).first().click();
  const dtPop = page.getByRole('dialog', { name: '选择日期和时间' });
  await dtPop.waitFor();
  await dtPop.getByRole('gridcell', { name: /10 月 14 日/ }).click();
  assert.equal(await visit.inputValue(), '2026-10-14 09:00', '换天保留时间，日历不关');
  const time = dtPop.getByLabel('时间', { exact: true });
  await time.fill('16:45');
  assert.equal(await visit.inputValue(), '2026-10-14 16:45');
  await dtPop.getByRole('button', { name: '确定' }).click();
  await dtPop.waitFor({ state: 'detached' });

  // ---- 时间框：↑ ↓ 按步长
  const remind = area.getByLabel('每日提醒时间', { exact: true });
  await remind.focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await remind.inputValue(), '09:05');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  assert.equal(await remind.inputValue(), '08:55');

  // ---- 日期范围：快捷范围、两次点击（倒着点自动排序）、max
  const range = area.getByRole('group', { name: '报表区间' });
  await range.getByRole('button', { name: '选择日期范围' }).click();
  const rPop = page.getByRole('dialog', { name: '选择日期范围' });
  await rPop.waitFor();
  assert.equal(await rPop.getByRole('grid').count(), 2, '桌面两个月并排');
  assert.equal(await rPop.getByRole('button', { name: '近 7 天' }).getAttribute('aria-pressed'), 'true', '当前范围对应的快捷项按下');
  await rPop.getByRole('button', { name: '本月' }).click();
  await rPop.waitFor({ state: 'detached' });
  assert.equal(await range.getByLabel('开始日期').inputValue(), '2026-10-01');
  assert.equal(await range.getByLabel('结束日期').inputValue(), '2026-10-31');
  await range.getByRole('button', { name: '选择日期范围' }).click();
  await rPop.waitFor();
  await rPop.getByRole('button', { name: '上个月' }).click();
  assert.deepEqual(await rPop.getByRole('grid').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label'))), ['2026 年 9 月', '2026 年 10 月']);
  await rPop.getByRole('gridcell', { name: /10 月 3 日/ }).click();
  assert.match(await rPop.locator('.aui-daterange-status').innerText(), /已选 2026-10-03/);
  await rPop.getByRole('gridcell', { name: /9 月 21 日/ }).click();
  await rPop.waitFor({ state: 'detached' });
  assert.equal(await range.getByLabel('开始日期').inputValue(), '2026-09-21', '倒着点也排好顺序');
  assert.equal(await range.getByLabel('结束日期').inputValue(), '2026-10-03');
  await range.getByLabel('结束日期').fill('2026-10-08');
  assert.equal(await range.getByLabel('结束日期').getAttribute('aria-invalid'), 'true', '超过 max');
  await range.getByLabel('结束日期').fill('2026-10-04');
  assert.match(await facts.innerText(), /报表区间\s*2026-09-21 → 2026-10-04/);
  await range.getByLabel('结束日期').press('Tab');

  // ---- 「+ 添加」日历按钮
  await area.getByRole('button', { name: '添加补班日' }).click();
  const addPop = page.getByRole('dialog', { name: '添加补班日' });
  await addPop.waitFor();
  assert.equal(await addPop.locator('[data-day="2026-10-10"]').getAttribute('aria-disabled'), 'true', '已加的不能再加');
  await addPop.getByRole('gridcell', { name: /10 月 17 日/ }).click();
  await addPop.waitFor({ state: 'detached' });
  assert.equal(await area.getByRole('list', { name: '已添加的补班日' }).getByRole('listitem').count(), 2);

  // ---- 深色
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await install.click();
  await pop.waitFor();
  await shot('date-picker-1440-dark');
  await page.keyboard.press('Escape');
  await range.getByRole('button', { name: '选择日期范围' }).click();
  await rPop.waitFor();
  await shot('date-range-1440-dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  await range.getByRole('button', { name: '选择日期范围' }).click();
  await rPop.waitFor();
  await shot('date-range-1440');
  await page.keyboard.press('Escape');

  // ---- 弹框里：日历挂在弹框里、不出弹框，Esc 先关日历再关弹框
  await area.getByRole('button', { name: '改约上门' }).click();
  const dlg = page.getByRole('dialog', { name: '改约上门' });
  await dlg.waitFor();
  const move = dlg.getByLabel('新的上门时间', { exact: true });
  await move.click();
  await page.keyboard.press('ArrowDown');
  await dtPop.waitFor();
  assert.equal(await dtPop.evaluate((el) => Boolean(el.closest('.aui-dialog'))), true, '日历渲染在弹框里');
  const inDlg = await box(dtPop);
  const dlgBox = await box(dlg);
  assert.ok(inDlg.top >= dlgBox.top - 0.5 && inDlg.bottom <= dlgBox.bottom + 0.5 && inDlg.left >= dlgBox.left - 0.5 && inDlg.right <= dlgBox.right + 0.5, `日历不被弹框裁掉 ${JSON.stringify(inDlg)} / ${JSON.stringify(dlgBox)}`);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.equal(await move.inputValue(), '2026-10-10 14:30');
  await shot('date-picker-dialog');
  await page.keyboard.press('Escape');
  await dtPop.waitFor({ state: 'detached' });
  assert.ok(await dlg.isVisible(), 'Esc 只关日历');
  await dlg.getByRole('button', { name: '确认改约' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.equal(await visit.inputValue(), '2026-10-10 14:30');

  // ---- 手机 390：不溢出、格子 ≥ 44px、日历在屏内
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `390px 横向溢出 ${overflow}px`);
  await install.scrollIntoViewIfNeeded();
  await area.getByRole('button', { name: '选择日期' }).first().click();
  await pop.waitFor();
  const phone = await box(pop);
  const cell = await box(pop.locator('[data-day="2026-12-16"]'));
  assert.ok(phone.left >= 0 && phone.right <= 390, `手机日历在屏内 ${JSON.stringify(phone)}`);
  assert.ok(cell.width >= 44 && cell.height >= 44, `手机日期格 ≥ 44px ${JSON.stringify(cell)}`);
  await shot('date-picker-390');
  await page.keyboard.press('Escape');
  await range.scrollIntoViewIfNeeded();
  await range.getByRole('button', { name: '选择日期范围' }).click();
  await rPop.waitFor();
  assert.equal(await rPop.getByRole('grid').count(), 1, '手机一个月');
  const rPhone = await box(rPop);
  assert.ok(rPhone.left >= 0 && rPhone.right <= 390, `手机范围日历在屏内 ${JSON.stringify(rPhone)}`);
  await shot('date-range-390');
  await page.keyboard.press('Escape');
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS date-picker (${output}): typing (2026/10/20, 10/21, min / disabled revert), keyboard grid (arrows, PageUp/Down, Home/End, Enter, Esc + focus return), month jump, holidays 休/班, datetime step + time box, TimeInput ↑↓, range presets + reversed clicks + max, CalendarButton, inside Dialog (Esc closes only the calendar), 1440 light/dark, 390 (44px cells, no overflow)`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
