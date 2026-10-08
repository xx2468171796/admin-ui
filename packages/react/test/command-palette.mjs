// 浏览器验收：starter「系统 → 反馈与弹层」的命令面板样板（#ov-command）。
// Ctrl K 打开、640 宽在 14vh、遮罩不模糊；空框「最近」+「常用」；打「林」按提供者分组 + 命中字加粗下划线；
// 范围标签 + Tab；↑↓ 与 aria-activedescendant；回车打开（onSelect）；慢的组 ~1 秒内显示「较慢，回车看全部」而别的组已出；
// 「漠河」搜不到给退路；命令失败行内报错；Esc 一下就关（框里有字也关）、焦点回触发器；390 整屏 +「取消」；深色。
// 截图在 test/artifacts/command-palette/，和已审定的样稿截图并排看。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/command-palette');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 6152, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  await page.goto(server.resolvedUrls.local[0]);
  step('globalShortcut: Ctrl+K on a freshly opened page (focus on <body>) opens the topbar palette');
  await page.locator('.aui-shell').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement === document.body), true, '刚打开的页面焦点在 body 上');
  await page.keyboard.press('Control+k');
  await page.locator('.aui-cmdk').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.aui-cmdk').waitFor({ state: 'detached' });
  const navButton = page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '反馈与弹层', exact: true });
  await navButton.click();
  const area = page.locator('#aui-page-overlays #ov-command');
  await area.waitFor();
  const trigger = area.locator('.aui-cmdk-trigger');
  const result = area.locator('[data-cmdk-result]');
  const panel = page.locator('.aui-cmdk');
  const input = panel.getByRole('combobox', { name: '搜索与命令' });
  const group = (label) => panel.getByRole('group', { name: label, exact: true });
  const options = (label) => group(label).locator('[role=option]');
  const activeRow = panel.locator('.aui-cmdk-row[data-active]');

  step('topbar trigger: search-box look, 240 wide, Mod+K keycaps');
  assert.equal(Math.round((await box(trigger)).width), 240, '触发器 240 宽');
  assert.equal(await trigger.locator('.aui-kbd').count(), 2, 'Ctrl K 两个键帽');
  assert.equal(await page.locator('.aui-cmdk-trigger').count(), 2, '顶栏全局面板 + 本页样板各一个触发器');

  step('Ctrl+K opens this page’s palette (the shell palette yields): 640 wide at 14vh, no blur');
  await navButton.focus();
  await page.keyboard.press('Control+k');
  await panel.waitFor();
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  assert.equal(await page.locator('.aui-cmdk').count(), 1, '只开一个面板');
  const geo = await box(panel);
  assert.equal(Math.round(geo.width), 640, `面板 640 宽，实测 ${geo.width}`);
  assert.ok(Math.abs(geo.top - 900 * 0.14) <= 2, `顶部在 14vh，实测 ${geo.top}`);
  assert.equal(Math.round(geo.left + geo.width / 2), 720, '水平居中');
  assert.equal(await style(panel, 'border-top-left-radius'), '12px');
  assert.notEqual(await style(panel, 'box-shadow'), 'none');
  assert.equal(await style(page.locator('.aui-cmdk-overlay'), 'backdrop-filter'), 'none', '遮罩不模糊');
  assert.equal(await input.evaluate((el) => document.activeElement === el), true, '打开后焦点在输入框');
  assert.equal(Math.round((await box(panel.locator('.aui-cmdk-head'))).height), 52, '输入头部 52 高');
  const scale = Number(await page.evaluate(() => getComputedStyle(document.querySelector('.adminui')).getPropertyValue('--aui-font-scale').trim() || '1'));
  const fontPx = async (locator) => parseFloat(await style(locator, 'font-size')) / scale;
  assert.equal(Math.round(await fontPx(input) * 10) / 10, 15, '15 号字（× 字号缩放）');
  assert.ok(await panel.locator('.aui-cmdk-esc').isVisible(), '右边 Esc 键帽');

  step('empty box: 最近 + 常用 with single-key shortcuts');
  await group('最近').waitFor();
  assert.deepEqual(await group('最近').locator('.aui-cmdk-title').allInnerTexts(), ['赵静怡', '智能家居客户', '经营看板']);
  assert.deepEqual(await group('常用').locator('.aui-cmdk-title').allInnerTexts(), ['新建客户', '写跟进', '外观']);
  assert.equal(await group('常用').locator('.aui-cmdk-row').first().locator('.aui-kbd').first().innerText(), 'N');
  assert.equal(Math.round((await box(panel.locator('.aui-cmdk-foot'))).height), 38, '底部提示 38 高');
  assert.match(await panel.locator('.aui-cmdk-foot').innerText(), /选择[\s\S]*打开[\s\S]*关闭/);
  await shot('cmd-desktop');

  step('typing 林: groups per provider, hits bold + underlined; slow group within ~1s while others are in');
  const typedAt = Date.now();
  await input.fill('林');
  await group('记录').locator('.aui-cmdk-row[data-skeleton]').waitFor({ timeout: 500 });
  await options('客户').first().waitFor();
  const customersAt = Date.now() - typedAt;
  const slowRow = panel.locator('.aui-cmdk-row[data-type=slow]');
  await slowRow.waitFor({ timeout: 2000 });
  const slowAt = Date.now() - typedAt;
  assert.ok(customersAt < slowAt, `客户组先出（${customersAt}ms），较慢行后出（${slowAt}ms）`);
  assert.ok(slowAt < 1400, `较慢行在 ~1 秒内出现，实测 ${slowAt}ms（120ms 防抖 + 800ms 限时）`);
  assert.match(await slowRow.innerText(), /记录较慢，回车看全部/);
  await options('文档').first().waitFor();
  assert.deepEqual(await group('客户').locator('.aui-cmdk-title').allInnerTexts(), ['林冠宇', '林志豪', '郭依林'], '标题开头命中排前面');
  const hit = group('客户').locator('.aui-cmdk-hit').first();
  assert.equal(await hit.innerText(), '林');
  assert.equal(await style(hit, 'font-weight'), '600');
  assert.match(await style(hit, 'text-decoration-line'), /underline/);
  assert.equal(await style(hit, 'background-color'), 'rgba(0, 0, 0, 0)', '命中字不加底色');
  assert.equal(await group('客户').locator('.aui-cmdk-sub').first().innerText(), '报价 · 杭州 西湖 · 李佳蓉');
  const rowBox = await box(options('客户').first());
  assert.equal(Math.round(rowBox.height), 40, '行高 40');
  assert.equal(Math.round((await box(group('客户').locator('.aui-cmdk-tile').first())).width), 26, '图标块 26');
  assert.equal(await style(panel.locator('.aui-cmdk-group').first(), 'font-weight'), '600');
  await shot('cmd-open');

  step('scope chips + Tab / Shift+Tab');
  const chips = panel.getByRole('toolbar', { name: '搜索范围' }).getByRole('button');
  assert.deepEqual(await chips.allInnerTexts(), ['全部 5', '客户 3', '文档 2'], '只列有结果的范围（较慢的记录组还没有条数）');
  assert.equal(await chips.first().getAttribute('aria-pressed'), 'true');
  await input.press('Tab');
  assert.equal(await chips.nth(1).getAttribute('aria-pressed'), 'true', 'Tab 切到下一个范围');
  assert.equal(await panel.locator('[role=group]').count(), 1, '只显示这一组');
  assert.equal(await input.evaluate((el) => document.activeElement === el), true, 'Tab 不把焦点带走');
  await input.press('Shift+Tab');
  assert.equal(await chips.first().getAttribute('aria-pressed'), 'true', 'Shift+Tab 回到全部');

  step('arrow keys move across groups with aria-activedescendant, wrapping');
  const activeId = () => input.getAttribute('aria-activedescendant');
  assert.equal(await activeId(), await activeRow.getAttribute('id'));
  assert.equal(await activeRow.locator('.aui-cmdk-title').innerText(), '林冠宇');
  assert.ok(await activeRow.locator('.aui-cmdk-enter').isVisible(), '选中行显示 ↵');
  await input.press('ArrowDown');
  assert.equal(await activeRow.locator('.aui-cmdk-title').innerText(), '林志豪');
  assert.equal(await activeId(), await activeRow.getAttribute('id'));
  await input.press('ArrowUp');
  await input.press('ArrowUp');
  const last = panel.locator('.aui-cmdk-row[role=option]').last();
  assert.equal(await last.getAttribute('data-active'), 'true', '从第一行往上绕到最后一行');
  assert.equal(await panel.getByRole('listbox').count(), 1);
  await input.press('ArrowDown');

  step('Enter opens the active result through onSelect, closes, adds to recent');
  await input.press('Enter');
  await panel.waitFor({ state: 'detached' });
  assert.match(await result.innerText(), /打开：林冠宇（客户）→ \/crm\/customers\/c2/);
  assert.equal(await navButton.evaluate((el) => document.activeElement === el), true, '焦点回到打开前的位置');

  step('slow row: Enter → onSearchAll(q, providerId)');
  await trigger.click();
  await input.fill('桂林');
  await slowRow.waitFor({ timeout: 2000 });
  await slowRow.hover();
  await input.press('Enter');
  await panel.waitFor({ state: 'detached' });
  assert.match(await result.innerText(), /全部搜索页：「桂林」，只看记录/);

  step('no match 「漠河」: says so + fallbacks; a failing command reports inline');
  await trigger.click();
  await input.fill('漠河');
  await panel.locator('.aui-cmdk-empty').getByText('没找到「漠河」').waitFor({ timeout: 4000 });
  assert.deepEqual(await panel.locator('.aui-cmdk-row .aui-cmdk-title').allInnerTexts(), ['在全部内容里搜「漠河」', '新建客户「漠河」', '写一条备忘「漠河」']);
  assert.equal(await panel.locator('.aui-cmdk-hit').count(), 0, '退路行不标命中');
  await shot('cmd-empty');
  await input.press('ArrowDown');
  await input.press('Enter');
  await panel.waitFor({ state: 'detached' });
  assert.equal(await result.innerText(), '结果：执行：新建客户「漠河」');
  await trigger.click();
  await input.fill('导出');
  await activeRow.filter({ hasText: '导出当前视图' }).waitFor();
  await input.press('Enter');
  await panel.getByRole('alert').filter({ hasText: '演示：导出失败' }).waitFor();
  assert.ok(await panel.isVisible(), '命令失败不关面板');

  step('Esc closes at once (even with a query typed); focus returns to the trigger');
  assert.notEqual(await input.inputValue(), '', '框里还有字');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached' });
  assert.equal(await trigger.evaluate((el) => document.activeElement === el), true, '焦点回到触发器');

  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  await trigger.click();
  await input.fill('林');
  await options('文档').first().waitFor();
  const darkBg = await style(panel, 'background-color');
  assert.notEqual(darkBg, 'rgb(255, 255, 255)', '深色面板底色');
  await shot('cmd-dark');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  step('390: magnifier trigger, full screen, 取消, no footer / keycaps, 48px rows');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const small = await box(trigger);
  assert.equal(Math.round(small.width), 36, '手机触发器 36px 放大镜');
  assert.equal(await trigger.locator('.aui-keys').isVisible(), false);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  await trigger.click();
  await input.fill('报价');
  await options('客户').first().waitFor();
  await options('文档').first().waitFor();
  const full = await box(panel);
  assert.deepEqual([full.left, full.top, Math.round(full.width), Math.round(full.height)], [0, 0, 390, 844], '整屏');
  assert.equal(Math.round((await box(panel.locator('.aui-cmdk-head'))).height), 56);
  assert.equal(Math.round(await fontPx(input) * 10) / 10, 16, '16 号字，iOS 不放大');
  assert.ok(await panel.getByRole('button', { name: '取消' }).isVisible());
  assert.equal(await panel.locator('.aui-cmdk-foot').isVisible(), false, '手机没有底部提示');
  assert.equal(await panel.locator('.aui-cmdk-esc').isVisible(), false, '手机没有 Esc 键帽');
  assert.equal(Math.round((await box(options('客户').first())).height), 48, '手机行高 48');
  await shot('cmd-mobile');
  await panel.getByRole('button', { name: '取消' }).click();
  await panel.waitFor({ state: 'detached' });

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS command-palette (${output}): trigger 240 + Mod+K, Ctrl+K page precedence, 640 @ 14vh, no blur, recent + common, provider groups + hits, slow group in <1.4s, scope chips + Tab, arrows + aria-activedescendant + wrap, Enter → onSelect, slow → onSearchAll, no-match fallbacks, inline command error, first Esc closes → focus back, dark, 390 full screen + 取消`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
