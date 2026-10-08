// 浏览器验收（第 1、5 项）：starter「输入与表单」页的文本框 / 搜索 / 提交出错 / 设置页保存条。
// 一种框（和下拉同一根边、聚焦光圈、出错红边 + 下方一行图标 + 原因）、清空 ×、字数、多行自动长高 3–10 行且无拖拽角、
// 搜索边打边筛（0.3 秒、命中几条、高亮、/ 聚焦、Esc 清空）+ 慢列表回车才搜、提交出错顶部汇总可跳 + 焦点到第一个错 + 底栏「N 项要改」、
// 吸底保存条「改了 N 处」+ 「已改」+ 放弃 / 保存、手机 40 / 贴底保存条。1440 浅 / 深 + 390 截图（test/artifacts/inputs/）。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/inputs');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 6112, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled', fullPage: full });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '输入与表单', exact: true }).click();
  const area = page.locator('#aui-page-inputs');
  await area.locator('#inputs-text').waitFor();
  await shot('inputs-1440', true);

  step('one box: same border as the select, focus ring, error line with icon, clear ×, count');
  const text = area.locator('#inputs-text');
  const nameBox = text.locator('.aui-input-box').first();
  const select = area.locator('#inputs-settings .aui-select').first();
  assert.equal(await style(nameBox, 'border-top-color'), await style(select, 'border-top-color'), '输入框和下拉同一根边');
  await text.locator('#it-name').focus();
  await page.waitForTimeout(250);
  assert.match(await style(nameBox, 'box-shadow'), /3px/, '聚焦光圈');
  const clear = nameBox.getByRole('button', { name: '清空' });
  assert.equal(await clear.isVisible(), true, '有值且聚焦时出现 ×');
  assert.match(await text.locator('.aui-field').first().locator('.aui-input-count').innerText(), /6\/30/);
  await clear.click();
  assert.equal(await text.locator('#it-name').inputValue(), '', '× 清空');
  const errorField = text.locator('.aui-field').filter({ has: page.locator('#it-line') });
  assert.equal(await errorField.locator('.aui-input-box').getAttribute('data-invalid'), 'true', '出错红边');
  assert.equal(await errorField.locator('.aui-field-msg[data-error] svg').count(), 1, '错误行有图标');
  assert.equal(Math.round((await box(text.locator('#it-sm'))).height), 28, '小号 28');
  assert.equal(Math.round((await box(nameBox)).height), 36, '标准 36');

  step('textarea grows 3–10 rows, no resize handle, count in the bottom row');
  const ta = text.locator('#it-note');
  assert.equal(await style(ta, 'resize'), 'none', '没有拖拽角');
  const h0 = (await box(ta)).height;
  await ta.fill(Array.from({ length: 6 }, (_, i) => `第 ${i + 1} 行`).join('\n'));
  const h1 = (await box(ta)).height;
  assert.ok(h1 > h0 + 20, `自动长高 ${h0} → ${h1}`);
  await ta.fill(Array.from({ length: 20 }, (_, i) => `第 ${i + 1} 行`).join('\n'));
  const h2 = (await box(ta)).height;
  assert.ok(h2 < h1 * 2.2 && (await style(ta, 'overflow-y')) === 'auto', `最多 10 行后滚动 ${h2}`);
  assert.match(await text.locator('.aui-textarea-foot').first().innerText(), /\/70/);

  step('search filters as you type (debounced), hits + highlight, / focuses, Esc clears; slow list on Enter');
  const search = area.locator('#inputs-search');
  assert.equal(await search.getByRole('button', { name: '查询' }).count(), 0, '没有「查询」按钮');
  assert.equal(await search.getByRole('button', { name: '重置' }).count(), 0, '没有「重置」按钮');
  await page.locator('body').click({ position: { x: 700, y: 5 } });
  await page.keyboard.press('/');
  const q = search.getByRole('textbox', { name: '搜索关键词' }).first();
  assert.equal(await q.evaluate((el) => el === document.activeElement), true, '/ 聚焦');
  await page.keyboard.type('门锁');
  await search.locator('li').filter({ hasText: '影音' }).first().waitFor({ state: 'detached' });
  assert.equal(await search.locator('li').count(), 2, '打字就筛');
  assert.equal(await search.locator('mark.aui-hl').count(), 2, '命中字高亮');
  assert.match(await search.locator('.aui-search-hits').first().innerText(), /命中 2 条/);
  await page.keyboard.press('Escape');
  await search.locator('li').nth(5).waitFor();
  assert.equal(await q.inputValue(), '', 'Esc 清空');
  const slow = search.getByRole('textbox', { name: '搜索关键词' }).nth(1);
  await slow.fill('张');
  await page.waitForTimeout(500);
  assert.match(await area.locator('#inputs-slow-result').innerText(), /还没搜/, '慢列表打字不搜');
  assert.match(await search.locator('.aui-search-enter').innerText(), /回车搜索/);
  await slow.press('Enter');
  assert.match(await area.locator('#inputs-slow-result').innerText(), /张/);

  step('submit errors: summary on top with links, red fields, focus on the first, footer 「3 项要改」');
  await area.getByRole('button', { name: '新建客户' }).click();
  const dialog = page.getByRole('dialog', { name: '新建客户' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '新建' }).click();
  const summary = dialog.locator('.aui-form-summary');
  await summary.waitFor();
  assert.match(await summary.innerText(), /有 3 项要改[\s\S]*客户名称：请填客户名称[\s\S]*手机：手机号要 11 位/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'fe-name', '焦点到第一个错');
  assert.equal(await dialog.locator('#fe-name').getAttribute('aria-invalid'), 'true');
  assert.match(await dialog.locator('.aui-form-errors-jump').innerText(), /3 项要改/);
  await shot('form-errors');
  await summary.getByRole('link', { name: /手机/ }).click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'fe-phone', '汇总可点跳过去');
  await dialog.locator('#fe-name').fill('上海智能家居');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('button', { name: '放弃修改' });
  if (await discard.count()) await discard.click();
  await dialog.waitFor({ state: 'detached' });

  step('settings: one sticky save bar 「改了 N 处」, 已改 marks, switches excluded');
  const settings = area.locator('#inputs-settings');
  assert.equal(await settings.locator('.aui-savebar').count(), 0, '没改不出现');
  await settings.getByRole('switch', { name: '跟进到期提醒' }).click();
  assert.equal(await settings.locator('.aui-savebar').count(), 0, '即时开关不算');
  await settings.locator('#st-company').fill('Acme 华南分公司');
  await settings.locator('#st-reminder').fill('每天 8:30');
  const bar = settings.locator('.aui-savebar');
  await bar.waitFor();
  assert.match(await bar.innerText(), /改了 2 处/);
  assert.equal(await settings.locator('.aui-field-changed').count(), 2, '改过的字段标「已改」');
  assert.equal(await style(bar, 'position'), 'sticky');
  await bar.scrollIntoViewIfNeeded();
  await shot('savebar');
  await bar.getByRole('button', { name: '保存' }).click();
  await bar.waitFor({ state: 'detached' });
  assert.equal(await settings.locator('.aui-field-changed').count(), 0);

  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  await settings.locator('#st-company').fill('改一下');
  await area.locator('#inputs-text').scrollIntoViewIfNeeded();
  await shot('inputs-1440-dark', true);
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  step('390: 40px boxes, save bar pinned to the bottom, no overflow');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  assert.equal(Math.round((await box(text.locator('.aui-input-box').first())).height), 40, '手机 40');
  const barBox = await box(settings.locator('.aui-savebar'));
  assert.ok(Math.abs(barBox.bottom - 844) <= 1 && barBox.left <= 0.5, '手机保存条贴底铺满');
  await shot('inputs-390');
  await shot('inputs-390-full', true);

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS inputs (${output}): one box look + error line + clear + count, sizes 28/36/40, textarea autogrow 3–10 no handle, live search (debounce, hits, highlight, /, Esc) + enter-only slow list, submit summary + focus first + jump links + footer count, sticky save bar 「改了 N 处」 + 已改 + switches excluded, dark, 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
