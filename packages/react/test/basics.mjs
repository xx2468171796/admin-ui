// 浏览器验收：starter「基础元素」页（审阅「组件库 01 基础元素」8 项）。
// 按钮（7 种样式 4 档尺寸、主按钮纯色无投影、幽灵灰字、小按钮圆角 6、禁用不降透明度、加载锁宽度、图标按钮气泡 + 快捷键）、
// 标签（圆角 6 软方块、表格里状态 = 圆点 + 字、未读 0 不显示）、头像（按人分色、+k 点开名单）、深色提示气泡 + 「?」说明卡（下方左对齐、带箭头）、
// 快捷键键帽 + 「?」快捷键表、复制（行悬停才出、已复制气泡、令牌打码 30 秒）、带字分隔线、加载（表头 + 骨架、计数「—」、刷新细进度条）、
// 字号 / 链接 / 图标线宽；页面上没有原生 title。1440 浅 / 深色 + 390 截图（test/artifacts/basics/，和已审定的样稿截图并排看）。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/basics');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 6110, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(server.resolvedUrls.local[0]).origin });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled', fullPage: full });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  const tip = page.locator('.aui-tip');
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '基础元素', exact: true }).click();
  const area = page.locator('#aui-page-basics');
  await area.locator('#basics-buttons').waitFor();
  await shot('basics-1440', true);

  step('buttons: solid primary, grey ghost, 4 sizes, radius 6 under 28, weight 500, disabled without opacity');
  const buttons = area.locator('#basics-buttons');
  const primary = buttons.locator('[data-variant-row=default] .aui-button').nth(1);
  assert.equal(await style(primary, 'background-image'), 'none', '主按钮没有渐变');
  assert.equal(await style(primary, 'box-shadow'), 'none', '主按钮没有投影');
  assert.equal(await style(primary, 'font-weight'), '500');
  const heights = await buttons.locator('[data-variant-row=outline] .aui-button').evaluateAll((els) => els.slice(0, 4).map((el) => Math.round(el.getBoundingClientRect().height)));
  assert.deepEqual(heights, [40, 36, 28, 24], '4 档尺寸');
  const radii = await buttons.locator('[data-variant-row=outline] .aui-button').evaluateAll((els) => els.slice(0, 4).map((el) => getComputedStyle(el).borderTopLeftRadius));
  assert.deepEqual(radii, ['8px', '8px', '6px', '6px'], '28 / 24 圆角 6');
  const ghost = buttons.locator('[data-variant-row=ghost] .aui-button').first();
  const text = buttons.locator('[data-variant-row=text] .aui-button').first();
  const colors = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.adminui')); return { secondary: s.getPropertyValue('--aui-secondary').trim(), primary: s.getPropertyValue('--aui-primary').trim() }; });
  assert.notEqual(await style(ghost, 'color'), await style(text, 'color'), '幽灵按钮和文字按钮不同色');
  const disabled = buttons.locator('[data-variant-row=default] .aui-button[disabled]');
  assert.equal(await style(disabled, 'opacity'), '1', '禁用不降透明度');
  assert.notEqual(await style(disabled, 'background-color'), await style(primary, 'background-color'), '禁用是浅灰底');
  void colors;

  step('loading keeps the width, spinner replaces the icon');
  const saveBtn = buttons.getByRole('button', { name: /保存跟进/ });
  const before = await box(saveBtn);
  await saveBtn.click();
  await buttons.locator('.aui-button[data-loading] .aui-spinner').first().waitFor();
  const during = await box(buttons.locator('.aui-button[data-loading]').first());
  assert.ok(during.width >= before.width - 0.5, `加载时宽度不缩 ${before.width} → ${during.width}`);
  assert.equal(await buttons.locator('.aui-button[data-loading]').first().getAttribute('aria-busy'), 'true');
  await buttons.locator('.aui-button[data-loading]').first().waitFor({ state: 'detached' }).catch(() => {});

  step('dark tooltip with shortcut keycaps, disabled reason, no native title');
  await buttons.getByRole('button', { name: '搜索' }).hover();
  await tip.waitFor();
  assert.match(await tip.innerText(), /搜索/);
  assert.equal(await tip.locator('.aui-kbd').count(), 2, '快捷键一个键一个键帽');
  assert.match(await tip.locator('.aui-kbd').first().innerText(), /Ctrl|⌘/);
  assert.equal(await style(tip, 'border-top-left-radius'), '6px');
  const tipBox = await box(tip);
  const searchBox = await box(buttons.getByRole('button', { name: '搜索' }));
  assert.ok(tipBox.bottom <= searchBox.top, '默认在上方');
  await page.mouse.move(0, 0);
  await tip.waitFor({ state: 'detached' });
  const reasonBtn = buttons.getByRole('button', { name: '有原因的禁用' }).first();
  assert.equal(await reasonBtn.getAttribute('aria-disabled'), 'true');
  await reasonBtn.hover();
  await tip.waitFor();
  assert.match(await tip.innerText(), /没有修改权限/, '禁用按钮说原因');
  await page.mouse.move(0, 0);
  const titles = await page.locator('.adminui [title]:not(iframe):not(svg):not(abbr)').count();
  assert.equal(titles, 0, '页面上没有原生 title');

  step('tags: radius 6 soft squares; table status = dot + text; unread 0 hidden');
  const tags = area.locator('#basics-tags');
  assert.equal(await style(tags.locator('.aui-tag').first(), 'border-top-left-radius'), '6px');
  assert.equal(await style(tags.locator('.aui-tag').first(), 'border-top-width'), '0px', '标签不加描边');
  assert.equal(await style(tags.locator('.aui-badge').first(), 'border-top-left-radius'), '6px');
  assert.equal(await style(tags.locator('.aui-badge[data-variant=dot]').first(), 'background-color'), 'rgba(0, 0, 0, 0)', '表格里的状态不加底');
  assert.equal(await tags.locator('.aui-count[data-tone=primary]').count(), 1, '未读 0 不显示');
  assert.match(await tags.locator('.aui-count[data-tone=danger]').innerText(), /99\+/);

  step('avatars: per-person colour, +k opens the rest');
  const avatars = area.locator('#basics-avatars');
  const tones = await avatars.locator('.aui-avatar[data-tone]').evaluateAll((els) => els.map((el) => el.getAttribute('data-tone')));
  assert.ok(new Set(tones).size >= 5, `按人分色：${[...new Set(tones)].join(',')}`);
  const sizes = await avatars.locator('div').first().locator('.aui-avatar').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
  assert.deepEqual(sizes, [20, 24, 32, 40, 64]);
  await avatars.getByRole('button', { name: /还有 4 人/ }).click();
  const list = page.locator('.aui-avatar-list');
  await list.waitFor();
  assert.equal(await list.locator('li').count(), 4);
  await shot('avatar-stack-open');
  await page.keyboard.press('Escape');

  step('HelpTip card opens below, left-aligned with an arrow, title + link');
  const tips = area.locator('#basics-tips');
  const help = tips.getByRole('button', { name: '客户质量说明' });
  await help.click();
  const card = page.locator('.aui-help-bubble');
  await card.waitFor();
  const cardBox = await box(card);
  const helpBox = await box(help);
  assert.ok(cardBox.top >= helpBox.bottom, '在「?」下方');
  assert.ok(Math.abs(cardBox.left - helpBox.left) <= 12, `左对齐 ${cardBox.left} / ${helpBox.left}`);
  assert.equal(await card.getAttribute('data-side'), 'bottom');
  assert.match(await card.innerText(), /客户质量怎么算[\s\S]*了解更多/);
  assert.equal(await style(help.locator('svg'), 'width'), '16px');
  await shot('helptip-open');
  await page.keyboard.press('Escape');
  await card.waitFor({ state: 'detached' });

  step('shortcut sheet opens with ?');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+?');
  const sheetDialog = page.getByRole('dialog', { name: '快捷键' });
  await sheetDialog.waitFor();
  assert.ok((await sheetDialog.locator('.aui-kbd').count()) >= 8);
  await shot('shortcut-sheet');
  await page.keyboard.press('Escape');
  await sheetDialog.waitFor({ state: 'detached' });

  step('copy: icon only on row hover, 「已复制」 bubble; secret token masked, 显示 for 30 s');
  const copyArea = area.locator('#basics-copy');
  const firstCopy = copyArea.locator('.aui-copy-inline').first();
  await firstCopy.scrollIntoViewIfNeeded();
  const icon = firstCopy.getByRole('button', { name: /复制客户名称/ });
  await page.mouse.move(0, 0);
  assert.equal(await style(icon, 'opacity'), '0', '平时不显示');
  await firstCopy.hover();
  await page.waitForTimeout(200);
  assert.equal(await style(icon, 'opacity'), '1', '悬停整行才出现');
  assert.equal(Math.round((await box(icon)).height), 24, '24px 幽灵图标');
  await icon.click();
  await page.locator('.aui-tip', { hasText: '已复制' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '上海智能家居');
  await shot('copy-done');
  const token = copyArea.getByRole('group', { name: 'API 令牌' });
  assert.match(await token.locator('code').innerText(), /^•+e5f1$/, '令牌默认打码');
  await token.getByRole('button', { name: '显示' }).click();
  assert.equal(await token.locator('code').innerText(), 'aos_live_9f2c41e7b8d3a6c0e5f1');
  assert.match(await token.getByRole('button', { name: /隐藏/ }).innerText(), /秒/);
  assert.equal(await copyArea.locator('.aui-divider-label').count() >= 1, true, '带字的分隔线');

  step('loading: own header + skeleton rows, count 「—」, refresh keeps rows + top bar');
  const loading = area.locator('#basics-loading');
  const table = loading.locator('.aui-table-panel');
  assert.deepEqual(await table.locator('thead th').allInnerTexts(), ['客户名称', '负责人', '状态', '预计金额'], '骨架用这张表自己的表头');
  assert.ok((await table.locator('tbody.aui-table-skeleton tr').count()) >= 3);
  assert.match(await table.locator('.aui-pagination').innerText(), /共 — 条/, '数量先显示「—」');
  assert.equal(await loading.locator('.aui-state-loading').count(), 0, '不在中间转圈');
  // 8.0.2: ContentSkeleton's avatar is a circle (it used to be stretched by the text column's flex:1)
  const circles = await loading.locator('.aui-content-skeleton .aui-skel[data-shape=circle]').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  assert.ok(circles.length === 2 && circles.every(([w, h]) => w === 32 && h === 32), `骨架头像是 32px 圆：${JSON.stringify(circles)}`);
  await loading.locator('.aui-table-panel').scrollIntoViewIfNeeded();
  await shot('loading-skeleton');
  await area.getByRole('button', { name: '显示数据' }).click();
  await table.locator('tbody tr').filter({ hasText: '上海智能家居' }).waitFor();
  await area.getByRole('button', { name: '刷新' }).last().click();
  await table.locator('.aui-top-progress').waitFor();
  assert.ok((await table.locator('tbody tr').count()) >= 3, '刷新时旧数据留着');
  await shot('loading-refresh');

  step('type scale and stroke widths');
  const display = area.locator('#basics-type .aui-text-display');
  assert.equal(await style(display, 'font-weight'), '600');
  const heavy = await page.locator('#aui-page-basics *').evaluateAll((els) => els.filter((el) => !['400', '500', '600'].includes(getComputedStyle(el).fontWeight)).slice(0, 5).map((el) => `${el.tagName}.${el.className} ${getComputedStyle(el).fontWeight}`));
  assert.deepEqual(heavy, [], '只用 400 / 500 / 600');
  const stroke = await area.locator('#basics-icons svg').first().evaluate((el) => getComputedStyle(el).strokeWidth);
  assert.equal(stroke, '1.75px', '16px 图标线宽 1.75');

  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  await shot('basics-1440-dark', true);
  await buttons.getByRole('button', { name: '搜索' }).hover();
  await tip.waitFor();
  await shot('tooltip-dark');
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  step('390');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  assert.equal(await style(page.locator('#basics-tips .aui-keys').first(), 'display'), 'none', '手机上不显示键帽');
  await shot('basics-390', true);
  const phoneCircle = await area.locator('#basics-loading .aui-content-skeleton .aui-skel[data-shape=circle]').first().evaluate((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  assert.deepEqual(phoneCircle, [32, 32], '390 骨架头像还是圆');

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS basics (${output}): buttons (solid primary, grey ghost, 4 sizes, radius 6, weight 500, disabled colours, loading width lock), tooltip + shortcut + disabled reason, no native title, tags / status dot / counts, avatars per person + stack list, HelpTip card below-left with arrow, shortcut sheet, copy row hover + 已复制 + clipboard + masked token reveal, labelled divider, table skeleton + 「—」 + refresh bar, weights 400/500/600, stroke 1.75, dark + 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
