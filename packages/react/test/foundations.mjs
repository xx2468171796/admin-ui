// bt/foundations 浏览器验收：starter「基础部件」页。
// Menu / ContextMenu（指针处打开、翻转夹住、键盘、子菜单、焦点归还）、MenuButton、SplitButton、PopoverPanel、
// SortableList（键盘 Alt+方向键 / 空格拿起、指针拖进编组、锁定项）、OptionSwatchPicker、Rating、NumberStepper、
// CodeInput、Countdown、Watermark、SideSheet / BottomSheet、金额 precision 0、细滚动条；1440 浅 / 深色、390 手机不溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/foundations');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  await page.goto(server.resolvedUrls.local[0]);
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('button', { name: '基础部件', exact: true }).click();
  const area = page.locator('#aui-page-foundations');
  await area.locator('tbody tr').first().waitFor();
  const focused = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.getAttribute('aria-label') || (el.querySelector('.aui-cmenu-text') ?? el).textContent || '').trim() : '';
  });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });

  // ---- G1：金额 precision 0
  assert.ok((await area.locator('tbody').innerText()).includes('CN¥2,379,000'), '金额 precision 0 显示到元');
  assert.ok(!(await area.locator('tbody').innerText()).includes('CN¥2,379,000.00'));

  // ---- ContextMenu：在指针处打开、分组、快捷键、带数量的危险项、禁用原因
  const cell = area.locator('tbody tr').nth(1).locator('td').nth(1);
  const cellBox = await box(cell);
  await page.mouse.click(cellBox.left + 20, cellBox.top + 10, { button: 'right' });
  const cmenu = page.getByRole('menu', { name: '单元格菜单' });
  await cmenu.waitFor();
  const at = await box(cmenu);
  assert.ok(Math.abs(at.left - (cellBox.left + 20)) <= 1 && Math.abs(at.top - (cellBox.top + 10)) <= 1, `菜单左上角在指针处 ${JSON.stringify(at)}`);
  assert.equal(await cmenu.getByRole('menuitem').count(), 12);
  assert.equal(await cmenu.getByRole('separator').count(), 3);
  assert.ok(await cmenu.getByRole('menuitem', { name: '删除所选 3 条记录' }).isVisible(), '{count} 填进文字');
  assert.deepEqual(await cmenu.getByRole('menuitem', { name: '复制', exact: true }).locator('.aui-kbd').allInnerTexts(), ['Ctrl', 'C'], '快捷键一个键一个键帽');
  assert.equal(await cmenu.getByRole('menuitem', { name: '复制', exact: true }).getAttribute('aria-keyshortcuts'), 'Ctrl+C');
  const child = cmenu.getByRole('menuitem', { name: '添加子记录' });
  assert.equal(await child.getAttribute('aria-disabled'), 'true');
  assert.match(await child.innerText(), /这张表没有开启子记录/);
  await shot('context-menu');
  // 键盘：指针打开时焦点在菜单上；↓ 到第一项，End 到危险项，Esc 关闭
  await page.keyboard.press('ArrowDown');
  assert.equal(await focused(), '复制');
  await page.keyboard.press('End');
  assert.equal(await focused(), '删除所选 3 条记录');
  await page.keyboard.press('Escape');
  await cmenu.waitFor({ state: 'detached' });
  // 视口右下角：翻到指针左上，整个在视口内
  const lastRow = await box(area.locator('tbody tr').last().locator('td').last());
  await page.setViewportSize({ width: 1440, height: Math.round(lastRow.bottom + 40) });
  await page.waitForTimeout(250);
  await page.mouse.click(lastRow.right - 4, lastRow.bottom - 4, { button: 'right' });
  await cmenu.waitFor();
  const flipped = await box(cmenu);
  const vh = Math.round(lastRow.bottom + 40);
  assert.ok(flipped.right <= 1440 - 8 + 0.5 && flipped.bottom <= vh - 8 + 0.5 && flipped.top >= 8 - 0.5, `贴边翻转 / 夹在视口里 ${JSON.stringify(flipped)}`);
  await page.mouse.click(5, 5);
  await cmenu.waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- MenuButton：锚在按钮下、键盘、子菜单 → / ←、Esc 焦点回按钮、选中后提示
  const headerButton = area.getByRole('button', { name: '预计金额', exact: true });
  await headerButton.click();
  const hmenu = page.getByRole('menu', { name: '预计金额' });
  await hmenu.waitFor();
  const hb = await box(headerButton);
  const hm = await box(hmenu);
  assert.ok(Math.abs(hm.left - hb.left) <= 1 && hm.top >= hb.bottom && hm.top - hb.bottom <= 6, '左对齐挂在按钮下');
  assert.equal(await focused(), '预计金额', '鼠标点开：焦点在菜单本身，不高亮任何一项');
  assert.equal(await hmenu.locator('[data-active]').count(), 0);
  await page.keyboard.press('ArrowDown');
  assert.equal(await focused(), '修改字段', '↓ 进第一项');
  assert.equal(await hmenu.getByRole('menuitem', { name: /升序/ }).locator('.aui-cmenu-hint').innerText(), '0 → 9');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focused(), '加入字段编组');
  await page.keyboard.press('ArrowRight');
  const sub = page.getByRole('menu', { name: '加入字段编组' });
  await sub.waitFor();
  const parentBox = await box(hmenu.getByRole('menuitem', { name: '加入字段编组' }));
  const subBox = await box(sub);
  assert.ok(subBox.left >= parentBox.right - 1 || subBox.right <= parentBox.left + 1, '子菜单在父项旁边');
  assert.equal(await focused(), '联系方式', '→ 打开子菜单并聚焦第一项');
  assert.equal(await sub.getByRole('menuitemcheckbox', { name: '金额' }).getAttribute('aria-checked'), 'true');
  await shot('header-menu-submenu');
  await page.keyboard.press('ArrowLeft');
  await sub.waitFor({ state: 'detached' });
  assert.equal(await focused(), '加入字段编组', '← 关子菜单，焦点回父项');
  await page.keyboard.press('Escape');
  await hmenu.waitFor({ state: 'detached' });
  assert.equal(await focused(), '预计金额', 'Esc 后焦点回到按钮');
  await headerButton.press('ArrowDown');
  await hmenu.waitFor();
  await hmenu.getByRole('menuitem', { name: /升序/ }).click();
  await hmenu.waitFor({ state: 'detached' });
  await page.getByText('点了「升序」').waitFor();
  assert.equal(await focused(), '预计金额', '选中后焦点回到按钮');
  // 悬停打开子菜单（看板列 ⋯ → 列颜色）
  await area.getByRole('button', { name: '「报价」列操作' }).click();
  const colMenu = page.getByRole('menu', { name: '「报价」列操作' });
  await colMenu.waitFor();
  await colMenu.getByRole('menuitem', { name: '列颜色' }).hover();
  await page.getByRole('menu', { name: '列颜色' }).waitFor();
  assert.equal(await page.getByRole('menu', { name: '列颜色' }).getByRole('menuitemcheckbox').count(), 10);
  await page.mouse.click(5, 5);
  await colMenu.waitFor({ state: 'detached' });

  // ---- SplitButton：主操作 + ▾，菜单挂在整个控件下
  const split = area.getByRole('group', { name: '添加记录' });
  await split.getByRole('button', { name: '更多添加记录方式' }).click();
  const smenu = page.getByRole('menu', { name: '更多添加记录方式' });
  await smenu.waitFor();
  const sb = await box(split);
  const sm = await box(smenu);
  assert.ok(Math.abs(sm.left - sb.left) <= 1 || sm.right <= 1440 - 7, '和主按钮左对齐（或被视口夹住）');
  await page.keyboard.press('Escape');
  await smenu.waitFor({ state: 'detached' });
  assert.equal(await focused(), '更多添加记录方式');

  // ---- PopoverPanel + SortableList（字段配置）
  const fieldsButton = area.getByRole('button', { name: '字段配置' });
  await fieldsButton.click();
  const panel = page.getByRole('dialog', { name: '字段配置' });
  await panel.waitFor();
  assert.match(await panel.locator('.aui-popover-header').innerText(), /显示 10 \/ 12/);
  assert.equal(await panel.locator('.aui-popover-footer button').count(), 2);
  const fieldOrder = () => panel.locator('[data-sortable-row] .aui-sortable-content').evaluateAll((els) => els.map((el) => el.textContent.replace(/\d+ 个字段|主字段/g, '').trim()));
  assert.equal((await fieldOrder())[0], '客户名称');
  assert.equal(await panel.getByRole('button', { name: '移动「客户名称」' }).count(), 0, '锁定的主字段没有把手');
  assert.ok(await panel.getByRole('img', { name: /客户名称.*主字段固定在第一列/ }).isVisible());
  // Alt+↑ 在「阶段」上：上面是锁定项，不能动，读屏说明
  const stageGrip = panel.getByRole('button', { name: '移动「阶段」' });
  await stageGrip.focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal((await fieldOrder())[1], '阶段', '不能越过锁定的主字段');
  assert.match(await panel.locator('[aria-live]').innerText(), /不能再往上/);
  await page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual((await fieldOrder()).slice(0, 3), ['客户名称', '负责人', '阶段']);
  assert.equal(await focused(), '移动「阶段」', '移动后焦点还在把手上');
  assert.match(await panel.locator('[aria-live]').innerText(), /已把「阶段」，第 3 项/);
  // 指针：把「最后跟进」拖到「联系方式」组头下半 → 进组第一个
  const grip = panel.getByRole('button', { name: '移动「最后跟进」' });
  const g = await box(grip);
  const head = await box(panel.locator('.aui-sortable-group').first().locator('[data-sortable-row]').first());
  await page.mouse.move(g.left + g.width / 2, g.top + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.left + g.width / 2, g.top - 20, { steps: 4 });
  await page.mouse.move(g.left + g.width / 2, head.bottom - 4, { steps: 8 });
  assert.ok(await panel.locator('.aui-sortable-indicator').isVisible(), '拖动时有落点线');
  await shot('popover-sortable-drag');
  await page.mouse.up();
  const groupItems = await panel.locator('.aui-sortable-group').first().locator('.aui-sortable-children .aui-sortable-content').evaluateAll((els) => els.map((el) => el.textContent.trim()));
  assert.equal(groupItems[0], '最后跟进', `拖进编组的第一个，实际 ${groupItems}`);
  // 折叠编组
  await panel.getByRole('button', { name: '收起「金额」' }).click();
  assert.equal(await panel.getByRole('button', { name: '展开「金额」' }).getAttribute('aria-expanded'), 'false');
  await shot('popover-fields');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached' });
  assert.equal(await focused(), '字段配置', 'Esc 关面板，焦点回按钮');

  // ---- 选项编辑：空格拿起 → ↓ → 空格放下；Esc 放回
  const optionNames = () => area.getByRole('list', { name: '选项顺序' }).locator('input[aria-label="选项名"]').evaluateAll((els) => els.map((el) => el.value));
  assert.deepEqual(await optionNames(), ['高', '中', '低']);
  await area.getByRole('button', { name: '移动「高」' }).focus();
  await page.keyboard.press('Space');
  assert.match(await area.locator('.aui-sortable [aria-live]').first().innerText(), /已拿起「高」/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  assert.deepEqual(await optionNames(), ['中', '高', '低']);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  assert.deepEqual(await optionNames(), ['中', '低', '高']);
  await page.keyboard.press('Escape');
  assert.deepEqual(await optionNames(), ['中', '高', '低'], 'Esc 放回原处');

  // ---- OptionSwatchPicker：小方块弹出 10 色（旧 brand 显示成绿），方向键换色，点选关闭并回到方块
  const swatch = area.getByRole('button', { name: /^选项「高」的颜色/ });
  await swatch.click();
  const tones = page.getByRole('dialog', { name: '选项颜色' });
  await tones.waitFor();
  assert.equal(await tones.getByRole('radio').count(), 10);
  assert.equal(await focused(), '绿', '焦点在当前颜色上（旧 brand = 绿）');
  await page.keyboard.press('ArrowRight');
  assert.equal(await tones.getByRole('radio', { name: '青' }).getAttribute('aria-checked'), 'true');
  await page.keyboard.press('ArrowDown');
  assert.equal(await tones.getByRole('radio', { name: '橙' }).getAttribute('aria-checked'), 'true', '↓ 下一行（5 列）');
  await shot('swatch-picker');
  await tones.getByRole('radio', { name: '红' }).click();
  await tones.waitFor({ state: 'detached' });
  assert.equal(await focused(), '选项「高」的颜色：红');
  const optionRow = area.getByRole('list', { name: '选项顺序' }).locator('.aui-sortable-row').nth(1);
  assert.equal(await optionRow.locator('.aui-chip-list .aui-chip').first().getAttribute('data-tone'), 'red');

  // ---- 10 色在深浅色下都可读（文字和底色对比度）
  const contrastOf = () => page.evaluate(() => {
    // color-mix() computes to color(srgb r g b) with 0–1 channels; rgb() has 0–255.
    const parse = (c) => { const m = c.replace(/^color\(srgb/, '').match(/[\d.]+/g).map(Number).slice(0, 3); return c.startsWith('color(') ? m.map((v) => v * 255) : m; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    return [...document.querySelectorAll('#aui-page-foundations [aria-label="10 种颜色"] .aui-chip')].map((chip) => {
      const s = getComputedStyle(chip);
      const a = lum(parse(s.color));
      const b = lum(parse(s.backgroundColor));
      return { tone: chip.dataset.tone, ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10 };
    });
  });
  for (const { tone, ratio } of await contrastOf()) assert.ok(ratio >= 4.5, `浅色 ${tone} 对比度 ${ratio}`);

  // ---- Rating / NumberStepper / CodeInput / Countdown
  const rating = area.getByRole('slider', { name: '意向' });
  await rating.focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await rating.getAttribute('aria-valuenow'), '3');
  assert.equal(await rating.getAttribute('aria-valuetext'), '3 星（满分 5）');
  const starColor = await rating.locator('.aui-rating-star').first().evaluate((el) => getComputedStyle(el).color);
  const warning = await page.locator('.adminui').first().evaluate((el) => { const p = document.createElement('span'); p.style.color = 'var(--aui-warning)'; el.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
  assert.equal(starColor, warning, '评分星用注意色');
  const stepper = area.getByRole('group', { name: '最多打开次数' });
  await stepper.getByRole('button', { name: '增加最多打开次数' }).click();
  assert.equal(await stepper.getByRole('spinbutton').inputValue(), '21');
  await stepper.getByRole('spinbutton').fill('500');
  await stepper.getByRole('spinbutton').press('Tab');
  assert.equal(await stepper.getByRole('spinbutton').inputValue(), '100', '超出上限夹到 100');
  assert.equal(await stepper.getByRole('button', { name: '增加最多打开次数' }).isDisabled(), true, '到上限 + 变灰');
  const code = area.getByRole('group', { name: '密码', exact: true });
  await code.getByRole('textbox').nth(1).click();
  assert.equal(await focused(), '密码第 2 位，共 4 位');
  await code.getByRole('textbox').nth(3).click();
  assert.equal(await focused(), '密码第 4 位，共 4 位', '点空格子跳到第一个空的');
  await page.keyboard.type('x');
  await area.getByText('密码不对，还能试 4 次').waitFor();
  assert.equal(await code.getAttribute('data-invalid'), 'true');
  await shot('atoms-error');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  assert.equal(await code.getByRole('textbox').nth(2).inputValue(), '', '退格清掉并回上一格');
  await code.getByRole('textbox').first().focus();
  await page.keyboard.insertText('7k2q');
  assert.deepEqual(await code.getByRole('textbox').evaluateAll((els) => els.map((el) => el.value)), ['7', 'K', '2', 'Q'], '一次输入 / 粘贴填满并转大写');
  assert.equal(await area.getByText('密码不对，还能试 4 次').count(), 0);
  assert.match(await area.getByRole('timer', { name: /领取时限/ }).innerText(), /^\d:\d\d$/);
  assert.match(await area.getByRole('timer', { name: /自动隐藏/ }).getAttribute('aria-label'), /还剩 \d+ 秒/);

  // ---- AvatarStack / Watermark
  assert.equal(await area.locator('.aui-avatar-stack > .aui-avatar').count(), 4, '3 个头像 + +2');
  assert.equal(await area.locator('.aui-avatar-stack-more').innerText(), '+2');
  const wm = area.locator('.aui-watermark');
  assert.ok(await wm.locator('.aui-watermark-mark').count() >= 6);
  assert.equal(await wm.evaluate((el) => getComputedStyle(el).pointerEvents), 'none');
  assert.equal(await wm.getAttribute('aria-hidden'), 'true');

  // ---- 细滚动条：webkit 滑块 10px、平时很淡
  const thin = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.cssText = 'width:100px;height:60px;overflow:auto';
    el.innerHTML = '<div style="height:400px"></div>';
    document.querySelector('#aui-page-foundations').append(el);
    const width = el.offsetWidth - el.clientWidth;
    el.remove();
    return width;
  });
  assert.ok(thin <= 10, `滚动条细（${thin}px）`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await area.evaluate((el) => el.closest('.aui-content, main')?.scrollTo?.(0, 0));
  await shot('foundations-light');
  await shot('foundations-light-full', true);

  // ---- SideSheet：贴右边、整高、Esc 关闭焦点回按钮；BottomSheet 贴底
  const sideButton = area.getByRole('button', { name: '规则试运行' });
  await sideButton.click();
  const side = page.getByRole('dialog', { name: '规则试运行' });
  await side.waitFor();
  await page.waitForTimeout(300);
  const sideBox = await box(side);
  assert.ok(Math.abs(sideBox.right - 1440) <= 1 && sideBox.top <= 1 && Math.abs(sideBox.bottom - 900) <= 1 && Math.abs(sideBox.width - 640) <= 1, `侧边弹层贴右、整高、lg 640 ${JSON.stringify(sideBox)}`);
  await shot('side-sheet');
  // 侧边弹层没有 transform：里面的下拉要在触发按钮正下方，不能被减掉弹层的 left（7.13.1）
  const fallbackTrigger = side.getByRole('combobox', { name: '兜底分给' });
  await fallbackTrigger.click();
  const fallbackList = page.getByRole('listbox').last();
  await fallbackList.waitFor();
  const trig = await box(fallbackTrigger);
  const list = await box(fallbackList);
  assert.ok(Math.abs(list.left - trig.left) <= 8 && list.top >= trig.bottom - 1 && list.top - trig.bottom <= 12, `侧边弹层里的下拉贴着按钮 ${JSON.stringify({ trig, list })}`);
  await page.keyboard.press('Escape');
  await fallbackList.waitFor({ state: 'detached' }).catch(() => undefined);
  await page.keyboard.press('Escape');
  await side.waitFor({ state: 'detached' });
  await page.waitForTimeout(100);
  assert.equal(await focused(), '规则试运行');
  await area.getByRole('button', { name: '写跟进' }).click();
  const bottom = page.getByRole('dialog', { name: '写跟进' });
  await bottom.waitFor();
  await page.waitForTimeout(300);
  const bottomBox = await box(bottom);
  assert.ok(Math.abs(bottomBox.bottom - 900) <= 1 && Math.abs((bottomBox.left + bottomBox.right) / 2 - 720) <= 1, `底部弹层贴底居中 ${JSON.stringify(bottomBox)}`);
  await page.keyboard.press('Escape');
  await bottom.waitFor({ state: 'detached' });

  // ---- useNotify（审阅 03）：成功 5 秒消失；失败不自动消失，点 × 才关；同一条不叠
  const notices = page.locator('.aui-notices');
  await area.getByRole('button', { name: '成功提示' }).click();
  await area.getByRole('button', { name: '失败提示' }).click();
  await area.getByRole('button', { name: '失败提示' }).click();
  assert.equal(await notices.locator('.aui-notice-error').count(), 1, '同一条失败提示只留一条');
  await page.waitForTimeout(5600);
  assert.equal(await notices.locator('.aui-notice-success').count(), 0, '成功提示 5 秒后消失');
  assert.equal(await notices.getByRole('alert').count(), 1, '失败提示还在');
  await notices.locator('.aui-notice-error').getByRole('button', { name: '关闭通知' }).click();
  assert.equal(await notices.locator('.aui-notice-error').count(), 0, '点 × 关掉失败提示');

  // ---- 菜单在弹框里：Esc 只关菜单，不关弹框
  await sideButton.click();
  await side.waitFor();
  await side.getByRole('button', { name: '试运行操作' }).click();
  const inner = page.getByRole('menu', { name: '试运行操作' });
  await inner.waitFor();
  assert.ok(await side.locator('.aui-cmenu').count() === 1, '弹框里的菜单挂进弹框（焦点锁定里能用键盘）');
  await page.keyboard.press('Escape');
  await inner.waitFor({ state: 'detached' });
  assert.ok(await side.isVisible(), 'Esc 只关菜单，弹框还在');
  assert.equal(await focused(), '试运行操作');
  await page.keyboard.press('Escape');
  await side.waitFor({ state: 'detached' });

  // ---- 深色
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(200);
  for (const { tone, ratio } of await contrastOf()) assert.ok(ratio >= 4.5, `深色 ${tone} 对比度 ${ratio}`);
  await shot('foundations-dark');
  await page.mouse.click((await box(cell)).left + 20, (await box(cell)).top + 10, { button: 'right' });
  await cmenu.waitFor();
  await shot('context-menu-dark');
  await page.keyboard.press('Escape');
  await fieldsButton.click();
  await panel.waitFor();
  await shot('popover-fields-dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  // ---- 手机 390：不横向溢出，菜单在屏内、触控 40px，侧边弹层全宽
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `390px 横向溢出 ${overflow}px`);
  await shot('foundations-390');
  await shot('foundations-390-full', true);
  await area.getByRole('button', { name: '预计金额', exact: true }).click();
  await hmenu.waitFor();
  const phoneMenu = await box(hmenu);
  const itemHeight = await hmenu.getByRole('menuitem').first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(phoneMenu.left >= 8 - 0.5 && phoneMenu.right <= 390 - 8 + 0.5 && itemHeight >= 40, `手机菜单在屏内、每项 ≥ 40px ${JSON.stringify(phoneMenu)} ${itemHeight}`);
  await shot('header-menu-390');
  await page.keyboard.press('Escape');
  await area.getByRole('button', { name: '规则试运行' }).click();
  await side.waitFor();
  await page.waitForTimeout(300);
  assert.ok(Math.abs((await box(side)).width - 390) <= 1, '手机上侧边弹层全宽');
  await page.keyboard.press('Escape');
  await area.getByRole('button', { name: '写跟进' }).click();
  await bottom.waitFor();
  await page.waitForTimeout(300);
  await shot('bottom-sheet-390');
  await page.keyboard.press('Escape');
  // 手机：提示条铺满宽度，抬到页面底栏（表格条数 / 状态栏）之上
  await bottom.waitFor({ state: 'detached' });
  await area.getByRole('button', { name: '失败提示' }).click();
  await page.waitForTimeout(400); // 入场动画（短位移）走完
  const phoneNotice = await box(notices.locator('.aui-notice').first());
  assert.ok(phoneNotice.left >= 12 - 0.5 && phoneNotice.right <= 390 - 12 + 0.5 && phoneNotice.width >= 390 - 24 - 1, `手机提示条铺满宽度 ${JSON.stringify(phoneNotice)}`);
  assert.ok(phoneNotice.bottom <= 844 - 12 - 48 + 0.5, `手机提示条在底栏之上 ${JSON.stringify(phoneNotice)}`);
  await shot('notice-390');
  await notices.locator('.aui-notice-error').getByRole('button', { name: '关闭通知' }).click();

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS foundations (${output}): ContextMenu at pointer + flip/clamp + keyboard, MenuButton submenu →/← and focus return, SplitButton, PopoverPanel + SortableList (lock, Alt+arrows, lift/drop/Esc, drag into group, collapse), OptionSwatchPicker (10 hues + solid), 10 tones contrast light/dark, Rating, NumberStepper clamp, CodeInput, Countdown, AvatarStack, Watermark, thin scrollbars, SideSheet / BottomSheet geometry, money precision 0, 390px no overflow`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
