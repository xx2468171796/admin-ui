// 浏览器验收：starter「表单控件」页（审阅五组：日期 / 下拉 / 单选标签 / 多选 / 勾选类）。
// 一种下拉外观（行高 32、整行悬停、单选勾在右、多选勾选框在左、悬停 × 清空、不再有「（清空）」假选项、搜不到就地新建）、
// 多选（可删标签、+N、「已选 N 项 · 清空」靠右、点外面就保存）、日期（快捷一行、今天 = 主色字 + 圆点、「周四 · 明天」、
// 到期变色、时间列 + 细滚动条）、10 色标签对比度（浅 / 深色）、勾选类尺寸、手机底部弹层（行高 ≥ 44、贴底、铺满）、
// 1440 浅 / 深色 + 390 截图（test/artifacts/form-controls/，和 docs/review/form-controls-style/shots/new/ 并排看）。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/form-controls');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
// 不隐藏滚动条：要量、要看时间列 / 列表的细滚动条（无头 Chromium 默认 --hide-scrollbars）
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), ignoreDefaultArgs: ['--hide-scrollbars'] });
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
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '表单控件', exact: true }).click();
  const area = page.locator('#aui-page-controls');
  await area.getByRole('combobox', { name: '阶段' }).first().waitFor();
  await shot('controls-1440', true);

  // ---- 下拉：一种外观
  step('select: one look, tick right, groups, reasons, hover clear');
  const stage = area.locator('#fc-stage');
  assert.match(await stage.innerText(), /需求确认/);
  assert.equal(await stage.locator('.aui-chip').getAttribute('data-tone'), 'teal', '值显示成它的颜色标签');
  await stage.click();
  const stageList = page.getByRole('listbox', { name: '阶段' });
  await stageList.waitFor();
  assert.equal(await stageList.getByRole('option').count(), 8, '没有「（清空）」这种假选项');
  assert.equal(await page.getByRole('option', { name: /清空/ }).count(), 0);
  assert.deepEqual(await stageList.locator('.aui-optgroup').allInnerTexts(), ['进行中', '已结束'], '分组小标题');
  const chosen = stageList.getByRole('option', { name: /需求确认/ });
  assert.equal(await chosen.getAttribute('aria-selected'), 'true');
  const tick = await box(chosen.locator('.aui-opt-tick'));
  const row = await box(chosen);
  assert.ok(row.right - tick.right < 16 && tick.left > row.left + row.width / 2, '单选的勾在右边');
  const listBox = await box(stageList);
  assert.ok(Math.abs(row.width - listBox.width) < 2, `整行悬停：选项和列表一样宽 ${row.width} / ${listBox.width}`);
  assert.equal(Math.round(row.height), 32, '行高 32');
  const lost = stageList.getByRole('option', { name: /丢单/ });
  assert.equal(await lost.getAttribute('aria-disabled'), 'true');
  assert.match(await lost.innerText(), /要先填丢单原因/, '灰掉的选项写原因');
  await chosen.hover();
  assert.notEqual(await style(chosen, 'background-color'), 'rgba(0, 0, 0, 0)', '悬停有底色');
  await shot('select-open-1440');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await stageList.waitFor({ state: 'detached' });
  assert.match(await stage.innerText(), /报价/, '键盘 ↓ Enter 选下一个');
  await stage.hover();
  assert.equal(await style(stage.locator('.aui-select-clear'), 'display'), 'grid', '悬停出清空 ×');
  await stage.focus();
  await page.keyboard.press('Delete');
  assert.match(await stage.innerText(), /选择阶段/, 'Delete 清空');

  step('select: search + create');
  const region = area.locator('#fc-region');
  await region.click();
  const search = page.getByRole('combobox', { name: '搜索区域' });
  await search.waitFor();
  await search.fill('漠河');
  await page.getByText('没有匹配「漠河」的选项').waitFor();
  await shot('select-create-1440');
  await page.keyboard.press('Enter');
  await search.waitFor({ state: 'detached' });
  assert.match(await region.innerText(), /漠河/, '回车就地新建并选上');

  step('select: people with avatars, small filter trio');
  await area.locator('#fc-owner').click();
  const people = page.getByRole('listbox', { name: '负责人' });
  await people.waitFor();
  assert.equal(await people.locator('.aui-opt-avatar').count(), 4, '选人有头像');
  assert.match(await people.getByRole('option').first().innerText(), /销售一组/, '选人有部门');
  await page.keyboard.press('Escape');
  await people.waitFor({ state: 'detached' });
  const filter = area.getByRole('group', { name: '筛选条示例' });
  for (const name of ['筛选字段', '条件']) assert.equal(Math.round((await box(filter.getByRole('combobox', { name }))).height), 28, `${name} 是 28px 小号`);
  assert.equal(Math.round((await box(filter.locator('.aui-multiselect'))).height), 28, '筛选值也是 28px');

  // ---- 多选
  step('multi: removable chips, checkbox left, footer right, click outside keeps');
  const products = area.locator('#fc-products');
  assert.equal(await products.locator('.aui-chip-removable').count(), 3);
  await products.click();
  const plist = page.getByRole('listbox', { name: '感兴趣产品' });
  await plist.waitFor();
  const first = plist.getByRole('option').first();
  const check = await box(first.locator('.aui-opt-box'));
  assert.ok(check.left - (await box(first)).left < 16, '多选的勾选框在左边');
  const foot = page.locator('.aui-select-foot');
  assert.match(await foot.innerText(), /已选 3 项/);
  const footBox = await box(foot);
  const clearBox = await box(foot.getByRole('button', { name: '清空' }));
  assert.ok(footBox.right - clearBox.right < 16, '「清空」靠右');
  assert.equal(await page.getByRole('button', { name: '完成' }).count(), 0, '桌面上没有「完成」按钮');
  await plist.getByRole('option', { name: '窗帘' }).click();
  assert.match(await foot.innerText(), /已选 4 项/, '点一下就生效');
  await shot('multi-open-1440');
  await page.mouse.click(5, 880);
  await plist.waitFor({ state: 'detached' });
  assert.equal(await products.locator('.aui-chip-removable').count(), 4, '点外面就保存');
  await products.locator('.aui-chip-removable').first().hover();
  await products.getByRole('button', { name: '移除「智能门锁」' }).click();
  assert.equal(await products.locator('.aui-chip-removable').count(), 3, '× 删掉一个');
  const small = area.locator('#fc-small');
  await small.locator('.aui-multiselect-chips .aui-chip-more').waitFor();
  assert.match(await small.locator('.aui-multiselect-chips .aui-chip-more').innerText(), /^\+\d$/, '小号一行，放不下收成 +N');
  assert.equal(Math.round((await box(small)).height), 28);

  // 8.0.2: 「周四 · 明天」 sits right after the value, never on top of it — the hidden copy that pushes it is
  // measured in the input's own font (13px desktop, 16px phones, sm / touch sizes).
  const relGap = (sel) => area.locator(`.aui-datefield:has(${sel})`).evaluate((wrap) => {
    const input = wrap.querySelector('input');
    const cs = getComputedStyle(input);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const textRight = input.getBoundingClientRect().left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft) + ctx.measureText(input.value).width;
    const mirror = wrap.querySelector('.aui-datefield-mirror');
    const note = wrap.querySelector('.aui-datefield-reltext').getBoundingClientRect();
    return { inputFs: cs.fontSize, mirrorFs: getComputedStyle(mirror).fontSize, gap: note.left - textRight, noteRight: note.right, inputRight: input.getBoundingClientRect().right };
  });
  // ---- 日期
  step('date: quick row, today dot, relative note, due colours, time column + thin scrollbar');
  const next = area.locator('#fc-next');
  const nextNote = area.locator('.aui-datefield:has(#fc-next) .aui-datefield-reltext');
  assert.equal(await nextNote.innerText(), '周四 · 明天');
  assert.equal(await nextNote.getAttribute('data-due'), 'soon', '明天到期 = 注意色');
  const lastNote = area.locator('.aui-datefield:has(#fc-last) .aui-datefield-reltext');
  assert.match(await lastNote.innerText(), /4 天前（已过期）/);
  assert.equal(await lastNote.getAttribute('data-due'), 'overdue');
  assert.equal(await area.locator('#fc-empty').getAttribute('placeholder'), '选择日期', '空的框不放示例日期');
  for (const sel of ['#fc-next', '#fc-last']) {
    const g = await relGap(sel);
    assert.ok(g.inputFs === g.mirrorFs && g.gap >= 2 && g.noteRight <= g.inputRight, `1440 ${sel} 相对日期紧跟在值后面、不压字：${JSON.stringify(g)}`);
  }
  await next.click();
  const pop = page.getByRole('dialog', { name: '选择日期' });
  await pop.waitFor();
  const quick = pop.getByRole('group', { name: '快捷日期' });
  assert.deepEqual(await quick.getByRole('button').allInnerTexts(), ['今天', '明天', '下周一', '一周后', '清空']);
  assert.equal(await quick.getByRole('button', { name: '明天' }).getAttribute('aria-pressed'), 'true');
  const today = pop.locator('[aria-current=date]');
  assert.equal(await style(today, 'box-shadow'), 'none', '今天不再是方框');
  assert.equal(await today.evaluate((el) => getComputedStyle(el, '::after').width), '4px', '今天 = 小圆点');
  await shot('date-open-1440');
  await quick.getByRole('button', { name: '下周一' }).click();
  await pop.waitFor({ state: 'detached' });
  assert.equal(await next.inputValue(), '2026-10-12');
  assert.equal(await nextNote.innerText(), '周一 · 5 天后');
  await area.locator('#fc-visit').click();
  const dt = page.getByRole('dialog', { name: '选择日期和时间' });
  await dt.waitFor();
  const col = dt.getByRole('listbox', { name: '时间列表' });
  await col.waitFor();
  const bar = await col.evaluate((el) => el.offsetWidth - el.clientWidth - parseFloat(getComputedStyle(el).borderLeftWidth));
  assert.ok(bar > 0 && bar <= 8, `时间列的滚动条是细的（${bar}px）`);
  assert.equal(await style(col, 'scrollbar-width'), 'auto', '没有 scrollbar-width 覆盖全站那一套');
  assert.equal((await style(col, '--aui-scrollbar-size')).trim(), '8px');
  assert.equal(await col.getByRole('option', { name: '14:30' }).getAttribute('aria-selected'), 'true');
  await shot('datetime-open-1440');
  await col.getByRole('option', { name: '16:00' }).click();
  assert.equal(await area.locator('#fc-visit').inputValue(), '2026-10-09 16:00', '点时间列换时间');
  await dt.getByRole('button', { name: '确定' }).click();
  await dt.waitFor({ state: 'detached' });

  // ---- 单选标签：10 色可读
  step('tags: 10 hues readable (soft + solid), legacy names, ChoiceTags');
  const contrastOf = () => page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = (c) => rgb(c).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    return [...document.querySelectorAll('#aui-page-controls [aria-label="10 色色板"] .aui-chip')].map((chip) => {
      const st = getComputedStyle(chip);
      const a = lum(st.color);
      const b = lum(st.backgroundColor);
      return { tone: chip.dataset.tone, radius: st.borderTopLeftRadius, border: st.borderTopWidth, ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10 };
    });
  });
  const light = await contrastOf();
  assert.equal(light.length, 20);
  for (const c of light) {
    assert.ok(c.ratio >= 4.5, `浅色 ${c.tone} 对比度 ${c.ratio}`);
    assert.equal(c.radius, '6px', `${c.tone} 圆角 6`);
    assert.equal(c.border, '0px', `${c.tone} 无边框`);
  }
  assert.equal(new Set(light.map((c) => c.tone)).size, 20);
  const legacy = await area.getByRole('list', { name: '旧色名' }).locator('.aui-chip').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  const hues = await area.locator('[aria-label="10 色色板"] .aui-chip').evaluateAll((els) => Object.fromEntries(els.map((el) => [el.dataset.tone, getComputedStyle(el).backgroundColor])));
  assert.deepEqual(legacy, [hues.green, hues.teal, hues.blue, hues.yellow, hues.red, hues.gray, hues.greenSolid], '旧 7 色名一一对上新色');
  const status = area.getByRole('radiogroup', { name: '状态' });
  assert.equal(await status.getByRole('radio').count(), 4);
  assert.equal(await status.getByRole('radio', { name: '跟进中' }).getAttribute('aria-checked'), 'true');
  await status.getByRole('radio', { name: '已成交' }).click();
  assert.equal(await status.getByRole('radio', { name: '已成交' }).getAttribute('aria-checked'), 'true');
  assert.equal(await status.locator('[aria-checked=true] .aui-chip').getAttribute('data-tone'), 'green', '表单里的单选保留选项颜色');
  await area.getByRole('button', { name: /^选项「转介绍」的颜色/ }).click();
  const swatches = page.getByRole('dialog', { name: '选项颜色' });
  await swatches.waitFor();
  assert.equal(await swatches.getByRole('radio').count(), 10, '10 个色块');
  await swatches.getByRole('switch').click();
  await swatches.getByRole('radio', { name: '粉' }).click();
  await swatches.waitFor({ state: 'detached' });
  assert.match(await area.getByRole('button', { name: /^选项「转介绍」的颜色/ }).getAttribute('aria-label'), /粉 · 实心/);

  // ---- 勾选类
  step('checks: 16px boxes radius 4, radio dots, switch 32 × 18, segmented groove');
  const cb = area.getByRole('group', { name: '勾选框的状态' }).getByRole('checkbox', { name: '选中' });
  const cbBox = await box(cb);
  assert.equal(Math.round(cbBox.width), 16);
  assert.equal(await style(cb, 'border-top-left-radius'), '4px');
  const half = area.getByRole('group', { name: '勾选框的状态' }).getByRole('checkbox', { name: '半选' });
  assert.equal(await half.getAttribute('data-state'), 'indeterminate');
  assert.equal(await half.locator('svg.lucide-minus').count(), 1, '半选显示「−」');
  assert.equal(await cb.locator('svg.lucide-check').count(), 1, '选中显示勾');
  const radio = area.getByRole('radiogroup', { name: '分配方式' }).locator('.aui-radio').first();
  assert.equal(Math.round((await box(radio)).width), 16);
  assert.equal(await style(radio, 'border-top-width'), '5px', '选中的圆点 = 5px 主色环');
  const sw = area.getByRole('switch', { name: '到期前一天提醒' });
  const swBox = await box(sw);
  assert.deepEqual([Math.round(swBox.width), Math.round(swBox.height)], [32, 18]);
  const swSm = await box(area.getByRole('switch', { name: '小号开关' }));
  assert.deepEqual([Math.round(swSm.width), Math.round(swSm.height)], [26, 14]);
  const seg = area.getByRole('group', { name: '条件关系' });
  const on = seg.getByRole('button', { name: '全部满足' });
  assert.equal(await style(on, 'background-color'), await page.evaluate(() => getComputedStyle(document.querySelector('.adminui')).getPropertyValue('--aui-surface').trim()).then((hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  }), '分段选中块 = 白色凸起（面板色），不是主色');

  // ---- 深色
  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  for (const c of await contrastOf()) assert.ok(c.ratio >= 4.5, `深色 ${c.tone} 对比度 ${c.ratio}`);
  await shot('controls-1440-dark', true);
  await area.locator('#fc-stage').click();
  await page.getByRole('listbox', { name: '阶段' }).waitFor();
  await page.getByRole('listbox', { name: '阶段' }).getByRole('option', { name: /首通/ }).hover();
  await shot('select-open-1440-dark');
  await page.keyboard.press('Escape');
  await area.locator('#fc-products').click();
  await page.getByRole('listbox', { name: '感兴趣产品' }).waitFor();
  await shot('multi-open-1440-dark');
  await page.keyboard.press('Escape');
  await area.locator('#fc-visit').click();
  await page.getByRole('dialog', { name: '选择日期和时间' }).waitFor();
  await shot('datetime-open-1440-dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  // ---- 手机 390：底部弹层
  step('390: bottom sheets');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  await shot('controls-390', true);
  for (const sel of ['#fc-next', '#fc-last']) {
    const g = await relGap(sel);
    assert.ok(g.inputFs === '16px' && g.mirrorFs === '16px' && g.gap >= 2, `390 ${sel} 输入框 16px，相对日期不压在日期上：${JSON.stringify(g)}`);
  }
  await area.locator('#fc-owner').scrollIntoViewIfNeeded();
  await area.locator('#fc-stage').scrollIntoViewIfNeeded();
  await area.locator('#fc-stage').click();
  const sheet = page.locator('[data-aui-layer][data-sheet]');
  await sheet.waitFor();
  await page.waitForTimeout(400); // 进场动画
  const sb = await box(sheet);
  const vp = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: innerHeight }));
  assert.ok(Math.abs(sb.bottom - vp.h) < 1 && sb.left <= 0.5 && Math.abs(sb.right - vp.w) < 1, `底部弹层贴底铺满 ${JSON.stringify(sb)} / ${JSON.stringify(vp)}`);
  assert.equal(await sheet.locator('.aui-sheet-title').innerText(), '阶段');
  const opt = await box(sheet.getByRole('option').first());
  assert.ok(opt.height >= 44, `手机行高 ≥ 44（${opt.height}）`);
  assert.equal(await page.locator('.aui-sheet-scrim').count(), 1, '有遮罩');
  await shot('select-sheet-390');
  await sheet.getByRole('button', { name: '取消' }).click();
  await sheet.waitFor({ state: 'detached' });
  await area.locator('#fc-products').scrollIntoViewIfNeeded();
  await area.locator('#fc-products').click();
  await sheet.waitFor();
  await shot('multi-sheet-390');
  await sheet.getByRole('button', { name: '完成' }).click();
  await sheet.waitFor({ state: 'detached' });
  await area.locator('#fc-visit').scrollIntoViewIfNeeded();
  await area.locator('#fc-visit').click();
  await sheet.waitFor();
  const day = await box(sheet.locator('[data-day="2026-10-16"]'));
  assert.ok(day.height >= 44, `手机日子格 ≥ 44（${day.height}）`);
  assert.equal(await sheet.getByRole('listbox', { name: '时间列表' }).isVisible(), false, '手机上时间列收起，用时间框');
  await shot('date-sheet-390');
  await sheet.getByRole('button', { name: '确定' }).first().click();
  await sheet.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await area.locator('#fc-stage').scrollIntoViewIfNeeded();
  await area.locator('#fc-stage').click();
  await sheet.waitFor();
  await shot('select-sheet-390-dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS form-controls (${output}): one select look (tick right, groups, reasons, hover × clear, Delete, search + create, people, 28px filter trio), multi (removable chips, checkbox left, footer clear right, outside click keeps, +N), date (quick row, today dot, 周四 · 明天, due colours, time column + thin scrollbar), 10 hues readable light / dark + legacy names 1:1, ChoiceTags, swatch picker 10 + solid, checkbox / radio / switch / segmented geometry, 390 bottom sheets (44px rows), screenshots 1440 light / dark + 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
