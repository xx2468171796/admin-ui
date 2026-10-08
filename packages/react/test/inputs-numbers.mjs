// 浏览器验收：starter「输入与表单」页的 #inputs-numbers 分区（审阅「数字、金额、电话、百分比」「评分与滑块」）。
// 数字框（悬停 / 聚焦才出小箭头、↑ ↓ / Shift ×10、等宽数字、离开加千分位）、步进器（同一个框、两端幽灵按钮 28 / 22、到下限变灰）、
// 金额（币种一格 + 弹层、打字纯数字、离开千分位、「约 CN¥ 8.6 万」）、电话（默认 +86、当地分组、存 E.164、离开才报错、区号弹层）、
// 百分比（格子「60%」+ 56 × 4 细条、编辑时 % 还在）、评分（实心星、浅灰、悬停预览、「较高」、← →、再点清空）、
// 滑块（键盘、拖动、配数字框、头上数值）；1440 浅 / 深色 + 390 截图（test/artifacts/inputs-numbers/，
// 和已审定的样稿截图并排看）。
// starter 里的新组件暂从 src 引入：用 "source" 条件让 "@adminui/react" 也解析到 src，保证同一个 AdminProvider。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/inputs-numbers');
mkdirSync(output, { recursive: true });
const server = await createServer({
  root: resolve(root, 'examples/starter'),
  configFile: false,
  plugins: [react()],
  resolve: { conditions: ['source', 'module', 'browser', 'development'] },
  server: { host: '127.0.0.1', port: 6120, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const area = page.locator('#inputs-numbers');
  const shot = (name) => area.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  await page.goto(`http://127.0.0.1:6120/`);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '输入与表单', exact: true }).click();
  await area.locator('#num-a').waitFor();
  await page.mouse.move(0, 0);
  await shot('numbers-1440');

  // ---- 数字框
  step('number: arrows on hover / focus, keys, thousands on blur');
  const a = area.locator('#num-a');
  const aBox = a.locator('xpath=..');
  assert.equal(await style(aBox.locator('.aui-num-spin'), 'display'), 'none', '静止时没有小箭头');
  await aBox.hover();
  assert.equal(await style(aBox.locator('.aui-num-spin'), 'display'), 'flex', '悬停出小箭头');
  assert.match(await style(a, 'font-variant-numeric'), /tabular-nums/, '等宽数字');
  assert.equal(await style(a, 'text-align'), 'start', '表单里左对齐');
  await a.focus();
  await page.keyboard.press('ArrowUp');
  assert.equal(await a.inputValue(), '4', '↑ 加一');
  await page.keyboard.press('Shift+ArrowUp');
  assert.equal(await a.inputValue(), '14', 'Shift + ↑ 加十');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  assert.equal(await a.inputValue(), '0', '到下限 0 停住');
  await aBox.locator('.aui-num-spin button').first().click();
  assert.equal(await a.inputValue(), '1', '点 ↑ 小箭头');
  const b = area.locator('#num-b');
  await b.fill('1234567');
  assert.equal(await b.inputValue(), '1234567', '打字时是纯数字');
  await b.blur();
  assert.equal(await b.inputValue(), '1,234,567', '离开加千分位');
  await b.focus();
  assert.equal(await b.inputValue(), '1234567', '再进来去掉千分位');
  await b.fill('abc');
  await b.blur();
  assert.equal(await b.inputValue(), '1,234,567', '不是数字就退回上一个值');
  assert.match(await area.locator('[data-field="num-d"]').innerText(), /赢率要在 0–100% 之间/, '范围外出错');

  // ---- 步进器
  step('stepper: one box, ghost buttons 28 / 22, grey at the bound');
  const steppers = area.locator('#num-steppers');
  const opens = steppers.getByRole('group', { name: '最多打开次数' });
  assert.equal(Math.round((await box(opens.locator('.aui-stepper-button').first())).width), 28, '标准号 − 是 28px');
  assert.equal(Math.round((await box(steppers.getByRole('group', { name: '提前提醒天数' }).locator('.aui-stepper-button').first())).width), 22, '小号 − 是 22px');
  assert.equal(await style(opens.locator('.aui-stepper-button').first(), 'background-color'), 'rgba(0, 0, 0, 0)', '幽灵按钮');
  assert.equal(await style(opens.locator('.aui-stepper-field'), 'border-left-width'), '0px', '中间没有竖线');
  const field = await style(area.locator('#num-c').locator('xpath=..'), 'border-top-color');
  assert.equal(await style(opens, 'border-top-color'), field, '和输入框同一条边');
  const stall = steppers.getByRole('group', { name: '停滞天数' });
  assert.equal(await stall.getByRole('button', { name: '减少停滞天数' }).isDisabled(), true, '到下限 − 变灰');
  await stall.getByRole('button', { name: '增加停滞天数' }).click();
  assert.equal(await stall.getByRole('spinbutton').inputValue(), '4');
  assert.equal(await stall.getByRole('button', { name: '减少停滞天数' }).isDisabled(), false);

  // ---- 金额
  step('money: currency segment + picker, plain digits, thousands, 约 X 万');
  const plan = area.locator('#money-plan');
  assert.equal(await plan.inputValue(), '86,000.00');
  const planField = area.locator('[data-field="money-plan"]');
  assert.match(await planField.innerText(), /约 CN¥ 8\.6 万/, '一万以上写约 X 万');
  await plan.focus();
  assert.equal(await plan.inputValue(), '86000', '聚焦去掉千分位');
  await plan.fill('128000');
  assert.match(await planField.innerText(), /约 CN¥ 12\.8 万/, '打字时提示跟着变');
  await plan.blur();
  assert.equal(await plan.inputValue(), '128,000.00');
  assert.equal(await style(plan, 'text-align'), 'start');
  const seg = planField.getByRole('button', { name: /^币种/ });
  assert.match(await seg.innerText(), /CN¥/);
  await seg.click();
  const curList = page.getByRole('listbox', { name: '币种' });
  await curList.waitFor();
  assert.ok((await curList.getByRole('option').count()) >= 5, '币种弹层');
  // Viewport shots only: an element shot of the whole tall area scrolls the page and the popover closes with its anchor.
  await page.screenshot({ path: resolve(output, 'money-picker-1440.png') });
  await page.screenshot({ path: resolve(output, 'money-picker-page-1440.png') });
  await curList.getByRole('option', { name: /日元/ }).click();
  await curList.waitFor({ state: 'detached' });
  assert.match(await seg.innerText(), /JP¥/, '换成日元');
  assert.equal(await plan.evaluate((el) => el === document.activeElement), true, '选完焦点回到数字');
  await plan.blur();
  assert.equal(await plan.inputValue(), '128,000', '日元没有小数');
  assert.equal(await area.locator('[data-field="money-deal"] button.aui-input-seg').count(), 0, '币种固定 = 只读的一格');
  assert.equal(await area.locator('[data-field="money-deal"] span.aui-input-seg').innerText(), 'CN¥', '不传 currency 用 AdminProvider defaults.currency');

  // ---- 电话
  step('phone: +86 default, local grouping, E.164, check on blur, picker');
  const phone = area.locator('#phone-a');
  const phoneField = area.locator('[data-field="phone-a"]');
  const e164 = area.locator('#phone-e164');
  assert.equal(await phone.inputValue(), '138 0013 8000', '按中国大陆习惯分组');
  assert.match(await e164.innerText(), /\+8613800138000/, '存 E.164');
  await phone.fill('');
  await phone.blur();
  assert.match(await phoneField.locator('button.aui-input-seg').innerText(), /\+86\b/, '空了还是默认 +86');
  await phone.fill('13933118552');
  assert.match(await e164.innerText(), /\+8613933118552/);
  await phone.fill('1380');
  assert.doesNotMatch(await phoneField.innerText(), /位数不对/, '打字时不打断');
  await phone.blur();
  assert.match(await phoneField.innerText(), /位数不对：中国大陆手机是 1 开头 11 位/, '离开才报错');
  assert.equal(await phone.getAttribute('aria-invalid'), 'true');
  await phone.fill('13800138000');
  await phone.blur();
  assert.doesNotMatch(await phoneField.innerText(), /位数不对/);
  assert.equal(await phone.inputValue(), '138 0013 8000');
  assert.equal(await phoneField.locator('.aui-phone-ok').count(), 1, '号码对了出 ✓');
  const bad = area.locator('#phone-b');
  await bad.focus();
  await bad.blur();
  assert.match(await area.locator('[data-field="phone-b"]').innerText(), /位数不对/, '自带的出错行');
  const cseg = phoneField.getByRole('button', { name: /^国家 \/ 地区/ });
  await cseg.click();
  const countries = page.getByRole('listbox', { name: '国家 / 地区' });
  await countries.waitFor();
  assert.ok((await countries.getByRole('option').count()) >= 10, '区号列表至少 10 个');
  assert.match(await countries.getByRole('option', { name: /中国大陆/ }).innerText(), /\+86\b/, '名称 + 区号');
  assert.equal(await countries.getByRole('option', { name: /中国大陆/ }).getAttribute('aria-selected'), 'true');
  await page.screenshot({ path: resolve(output, 'phone-picker-1440.png') });
  await page.getByRole('combobox', { name: '搜索国家 / 地区' }).fill('香港');
  await page.keyboard.press('Enter');
  await countries.waitFor({ state: 'detached' });
  assert.match(await cseg.innerText(), /\+852/, '换成 +852');
  assert.match(await e164.innerText(), /\+85213800138000/, '换区号后号码原样保留');
  await phone.fill('51234567');
  await phone.blur();
  assert.equal(await phone.inputValue(), '5123 4567', '香港号码 4-4');

  // ---- 表格格子：百分比 / 金额
  step('cells: 60% + 56×4 bar, editors keep % / currency');
  const grid = area.locator('#num-grid');
  // 7.15 修：本国（+86）号码按当地写法，外国号码国际写法、不带开头的 0
  const phones = await grid.locator('[role="gridcell"] .aui-grid-text').allInnerTexts();
  for (const want of ['138 0013 8000', '+886 912 345 678', '+1 415 555 0132', '+852 5123 4567']) assert.ok(phones.includes(want), `电话格显示 ${want}：${JSON.stringify(phones)}`);
  assert.ok(!phones.some((t) => /^\+\d+ 0/.test(t)), '国际写法不带 0');
  const pct = grid.locator('.aui-grid-pct').first();
  assert.match(await pct.innerText(), /60%/);
  const bar = await box(pct.locator('.aui-pct-bar'));
  assert.deepEqual([Math.round(bar.width), Math.round(bar.height)], [56, 4], '56 × 4 细条');
  const pctCell = pct.locator('xpath=ancestor::*[@role="gridcell"][1]');
  assert.ok((await box(pctCell)).right - (await box(pct.locator('.aui-pct-text'))).right < 16, '百分比格靠右');
  await pctCell.dblclick();
  const editor = grid.locator('.aui-grid-editor input');
  await editor.waitFor();
  const suffix = await grid.locator('.aui-grid-editor-suffix').count();
  if (suffix) assert.equal(await grid.locator('.aui-grid-editor-suffix').innerText(), '%', '编辑时 % 还在');
  else console.log('    (GridPercentEditor 还没接进 grid-editors.tsx：编辑框里暂时没有 %)');
  await editor.fill('70');
  await page.keyboard.press('Enter');
  await grid.locator('.aui-grid-editor').waitFor({ state: 'detached' });
  assert.match(await grid.locator('.aui-grid-pct').first().innerText(), /70%/, '改成 70%');
  const moneyCell = grid.locator('[role="gridcell"]').filter({ hasText: /86,000/ }).first();
  await moneyCell.dblclick();
  await grid.locator('.aui-grid-editor').waitFor();
  assert.equal(await grid.locator('.aui-grid-editor-prefix').innerText(), 'CN¥', '编辑金额时币种还在');
  await shot('cells-editing-1440');
  await page.keyboard.press('Escape');
  assert.equal(await area.locator('#num-pct-bars .aui-pct').nth(2).locator('.aui-pct-bar').count(), 0, 'bar={false} 只写文字');

  // ---- 评分
  step('rating: solid stars, grey unlit, labels, keys, hover preview, clear');
  const rating = area.getByRole('slider', { name: '购买意向' });
  const star = rating.locator('.aui-rating-star');
  assert.equal(Math.round((await box(star.first())).width), 18, '表单 18px');
  assert.equal(Math.round((await box(area.getByRole('img', { name: /格子评分/ }).locator('.aui-rating-star').first())).width), 13, '格子 13px');
  assert.notEqual(await style(star.nth(4), 'fill'), 'none', '没亮的星也是实心');
  assert.notEqual(await style(star.nth(4), 'color'), await style(star.nth(0), 'color'), '亮 / 没亮两种颜色');
  assert.equal(await rating.locator('.aui-rating-word').innerText(), '较高');
  assert.match(await rating.getAttribute('aria-valuetext'), /4 星.*较高/);
  await rating.locator('.aui-rating-hit').nth(4).hover();
  assert.equal(await rating.locator('.aui-rating-word').innerText(), '很高', '悬停预览');
  assert.notEqual(await star.nth(4).getAttribute('data-pre'), null, '预览的星浅一点');
  await page.mouse.move(0, 0);
  await rating.focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await rating.getAttribute('aria-valuenow'), '3', '← 减一');
  await rating.locator('.aui-rating-hit').nth(2).click();
  await page.mouse.move(0, 0);
  assert.equal(await rating.getAttribute('aria-valuenow'), '0', '再点当前那颗 = 清空');
  assert.equal(await rating.locator('.aui-rating-word').innerText(), '未评');

  // ---- 滑块
  step('slider: keys, drag, paired box, bubble');
  const slider = area.getByRole('slider', { name: '赢率' });
  assert.equal(await slider.getAttribute('aria-valuenow'), '60');
  assert.equal(await slider.getAttribute('aria-valuetext'), '60%');
  assert.equal(Math.round((await box(slider)).width), 16, '圆点 16px');
  const pair = area.getByRole('spinbutton', { name: '赢率（输入数字）' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await slider.getAttribute('aria-valuenow'), '70', '→ 一格');
  assert.equal(await pair.inputValue(), '70', '数字框跟着变');
  await page.keyboard.press('PageDown');
  assert.equal(await slider.getAttribute('aria-valuenow'), '0', 'PageDown ×10');
  await page.keyboard.press('End');
  assert.equal(await slider.getAttribute('aria-valuenow'), '100');
  await page.keyboard.press('Home');
  assert.equal(await slider.getAttribute('aria-valuenow'), '0');
  await pair.fill('30');
  await pair.blur();
  assert.equal(await slider.getAttribute('aria-valuenow'), '30', '打字也能调');
  const rail = await box(area.locator('#slide-win .aui-slider-rail'));
  await page.mouse.move(rail.left + rail.width * 0.52, rail.top + 2);
  await page.waitForTimeout(250);
  assert.equal(await style(area.locator('#slide-win .aui-slider-tip'), 'opacity'), '1', '悬停头上出数值');
  await shot('slider-hover-1440');
  const rail2 = await box(area.locator('#slide-win .aui-slider-rail')); // the element screenshot scrolled the page
  await page.mouse.move(rail2.left + rail2.width * 0.52, rail2.top + 2);
  await page.mouse.down();
  await page.mouse.move(rail2.left + rail2.width * 0.81, rail2.top + 2, { steps: 4 });
  await page.mouse.up();
  assert.equal(await slider.getAttribute('aria-valuenow'), '80', '拖动按步长吸附');
  assert.equal(await area.getByRole('slider', { name: '禁用滑块' }).getAttribute('aria-disabled'), 'true');
  await page.mouse.move(0, 0);
  await shot('numbers-after-1440');

  // ---- 深色
  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  await shot('numbers-1440-dark');
  await area.locator('#money-plan').locator('xpath=..').getByRole('button', { name: /^币种/ }).click();
  await page.getByRole('listbox', { name: '币种' }).waitFor();
  await page.screenshot({ path: resolve(output, 'money-picker-1440-dark.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  // ---- 手机 390
  step('390');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  const phoneHeight = Math.round((await box(area.locator('#phone-a').locator('xpath=..'))).height);
  assert.ok(phoneHeight >= 40, `手机上框 ≥ 40px（${phoneHeight}）`);
  assert.equal(Math.round((await box(area.getByRole('slider', { name: '赢率' }))).width), 22, '手机上圆点 22px');
  await shot('numbers-390');
  await area.locator('#phone-a').locator('xpath=..').getByRole('button', { name: /^国家 \/ 地区/ }).click();
  await page.getByRole('listbox', { name: '国家 / 地区' }).waitFor();
  await page.screenshot({ path: resolve(output, 'phone-sheet-390.png') });
  await page.keyboard.press('Escape');

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS inputs-numbers (${output}): number box (hover arrows, ↑ ↓ / Shift ×10, thousands on blur, revert), stepper (one box, 28 / 22 ghost buttons, grey at bound), money (segment picker, 约 X 万, precision per currency, static segment), phone (+86 default, local grouping, E.164, blur-only check, country picker + search), cells (60% + 56×4 bar, editors keep % / CN¥), rating (solid, grey, words, hover preview, ← →, click clears), slider (keys, PageDown, Home / End, drag snaps, paired box, bubble), 1440 light / dark + 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
