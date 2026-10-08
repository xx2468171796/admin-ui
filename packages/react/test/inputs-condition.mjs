// 浏览器验收：starter「输入与表单」→ #inputs-condition（审阅 02「条件编辑器」「字段配置」）。
// 条件编辑器：28px 三个下拉、值按字段换（标签多选 / 「我」/ 相对日期 / 带币种金额）、× 删除、且 / 或 可点切换、条件组 wash 底、
// 顶上一句话、工具栏「筛选 3」、没条件的常用按钮、没填完「先不生效」、出错标红。
// 字段配置：类型分组 + 搜索 + 「还有 N 种在做」收起、说明卡、选项行（色点 / 已用条数 / 重名 / 删前先问）、手机紧凑类型格子。
// 截图 1440 浅 / 深色 + 390：test/artifacts/inputs-condition/（和 docs/review/components-02-inputs/shots/new/ 并排看）。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/inputs-condition');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 6140, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
const SENTENCE = '阶段 是 报价、谈判 且 负责人 是 我 且（下次跟进 在未来 7 天 或 预计金额 ≥ CN¥ 50,000）';
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled', fullPage: full });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '输入与表单', exact: true }).click();
  const section = page.locator('#inputs-condition');
  await section.locator('#cond-filter').waitFor();
  await section.scrollIntoViewIfNeeded();

  // ---- 表格筛选面板
  step('filter: 「筛选 3」, sentence, value editors by kind, × remove, 28px dropdowns');
  const filterCard = section.locator('#cond-filter');
  const filterButton = filterCard.getByRole('button', { name: /^筛选/ });
  assert.match(await filterButton.innerText(), /筛选\s*4/, '工具栏写「筛选 N」（N = 生效的条件数，组里的也算）');
  assert.equal(await section.locator('.aui-cond-sum').first().getAttribute('aria-label'), `当前条件：${SENTENCE}`, '面板外的一句话（ConditionSentence）');
  await filterButton.click();
  const panel = page.getByRole('dialog', { name: '筛选条件' });
  await panel.waitFor();
  assert.equal(await panel.locator('.aui-cond-sum').getAttribute('aria-label'), `当前条件：${SENTENCE}`, '面板顶上一句话');
  assert.match(await panel.locator('.aui-cond-sum').innerText(), /且（下次跟进 在未来 7 天/);
  const row1 = panel.getByRole('group', { name: '条件 1', exact: true }).first();
  const stageValue = row1.getByRole('combobox', { name: /^筛选值/ });
  assert.match(await stageValue.getAttribute('class'), /aui-multiselect/, '选项字段的值 = MultiChoice');
  assert.deepEqual(await stageValue.locator('.aui-multiselect-chips > .aui-chip-removable .aui-chip-label').allInnerTexts(), ['报价', '谈判'], '值是带颜色的标签');
  assert.equal(await stageValue.locator('.aui-multiselect-chips > .aui-chip-removable').first().getAttribute('data-tone'), 'yellow');
  for (const control of await row1.locator('.aui-select').all()) assert.equal(Math.round((await box(control)).height), 28, '字段 / 条件 / 值都是 28px');
  const row2 = panel.getByRole('group', { name: '条件 2', exact: true }).first();
  assert.match(await row2.getByRole('combobox', { name: /^筛选值/ }).innerText(), /^我$/m, '负责人 = 我');
  await row2.getByRole('combobox', { name: /^筛选值/ }).click();
  const people = page.getByRole('listbox', { name: '筛选值' });
  await people.waitFor();
  assert.match(await people.getByRole('option').first().innerText(), /我/, '「我」在第一行');
  await page.keyboard.press('Escape');
  const group = panel.getByRole('group', { name: '条件组（任一满足）', exact: true });
  const wash = await group.evaluate((el) => { const probe = document.createElement('div'); probe.style.background = 'var(--aui-wash)'; el.append(probe); const out = getComputedStyle(probe).backgroundColor; probe.remove(); return out; });
  assert.equal(await style(group, 'background-color'), wash, '条件组 wash 浅底');
  assert.match(await group.getByRole('combobox', { name: '日期范围' }).innerText(), /未来 7 天/, '日期 = 相对日期');
  const money = group.getByRole('textbox', { name: '筛选值' });
  assert.equal(await money.inputValue(), '50,000', '金额带千分位');
  assert.equal(await group.locator('.aui-input-seg').innerText(), 'CN¥', '金额带币种');
  assert.equal(await panel.locator('svg.lucide-trash-2, svg.lucide-trash').count(), 0, '没有垃圾桶');
  const remove = row1.getByRole('button', { name: '删除条件 1' });
  assert.equal(await remove.getAttribute('data-tip'), '删除条件 1', '× 有气泡');
  assert.equal(await remove.getAttribute('title'), null, '不用原生 title');
  await shot('condition-1440');

  step('filter: 且 / 或 joiner toggles, group conjunction, remove');
  const joiner = panel.getByRole('button', { name: /^条件关系「且」/ }).first();
  await joiner.click();
  assert.match(await panel.locator('.aui-cond-sum').getAttribute('aria-label'), /报价、谈判 或 负责人 是 我 或（/, '点「且」改成「或」');
  assert.equal(await panel.getByRole('group', { name: '条件关系' }).getByRole('button', { name: '任一满足' }).getAttribute('aria-pressed'), 'true');
  await panel.getByRole('button', { name: /^条件关系「或」/ }).first().click();
  assert.equal(await panel.locator('.aui-cond-sum').getAttribute('aria-label'), `当前条件：${SENTENCE}`);
  await group.getByRole('button', { name: '删除条件 2' }).click();
  assert.match(await filterButton.innerText(), /筛选\s*3/, '删一条，计数跟着变');
  assert.match(await panel.locator('.aui-cond-sum').getAttribute('aria-label'), /且 下次跟进 在未来 7 天$/, '组里只剩一条就不加括号');
  await page.keyboard.press('Escape');

  // ---- 没条件 / 没填完
  step('empty: quick-add buttons; unfinished grey, invalid red');
  const emptyCard = section.locator('#cond-empty');
  await emptyCard.getByRole('button', { name: '筛选', exact: true }).click();
  const emptyPanel = page.getByRole('dialog', { name: '筛选条件' });
  await emptyPanel.waitFor();
  assert.deepEqual(await emptyPanel.locator('.aui-cond-quick').allInnerTexts(), ['阶段', '负责人 = 我', '下次跟进'], '常用字段按钮');
  await shot('condition-empty-1440');
  await emptyPanel.getByRole('button', { name: '负责人 = 我' }).click();
  await emptyPanel.locator('.aui-cond-sum').waitFor();
  assert.equal(await emptyPanel.locator('.aui-cond-sum').getAttribute('aria-label'), '当前条件：负责人 是 我');
  await emptyCard.getByRole('button', { name: /^筛选/ }).click();
  await emptyPanel.waitFor({ state: 'detached' });
  assert.match(await emptyCard.getByRole('button', { name: /^筛选/ }).innerText(), /筛选\s*1/);
  const unfinished = section.locator('#cond-unfinished');
  await unfinished.getByText('还没填值，这条先不生效').waitFor();
  assert.equal(await unfinished.locator('[data-pending]').count(), 1, '没填值的一条灰着');
  const bad = unfinished.locator('[data-invalid]');
  assert.equal(await bad.count(), 1);
  assert.match(await bad.getByRole('alert').innerText(), /这里要填数字/);
  assert.equal(await style(bad.getByRole('textbox', { name: '筛选值' }).locator('xpath=ancestor-or-self::*[contains(@class,"aui-input")][1]'), 'border-top-color'), await style(bad.getByRole('alert'), 'color'), '不合法的框标红');

  // ---- 字段配置
  step('field types: groups, search, 「还有 6 种在做」, explanation card');
  const fieldCard = section.locator('#field-config');
  await fieldCard.scrollIntoViewIfNeeded();
  const types = fieldCard.getByRole('radiogroup', { name: '字段类型' });
  assert.deepEqual(await fieldCard.locator('.aui-ftype-group').allInnerTexts(), ['基础', '选择', '人与联系', '关联与计算', '系统自动'], '五组');
  assert.deepEqual(await types.getByRole('group').filter({ hasText: '百分比' }).locator('.aui-ftype-group').allInnerTexts(), ['基础'], '百分比在基础');
  assert.equal(await types.getByRole('radio').count(), 26, '还没做的收起来');
  const more = fieldCard.getByRole('button', { name: '还有 6 种在做' });
  assert.equal(await more.getAttribute('aria-expanded'), 'false');
  assert.match(await fieldCard.locator('.aui-ftype-desc').innerText(), /单选[\s\S]*从几个选项里选一个[\s\S]*表格里：[\s\S]*报价/, '说明卡：存什么 + 表格里长什么样');
  await shot('field-1440');
  await more.click();
  assert.equal(await types.getByRole('radio').count(), 32);
  const formula = types.getByRole('radio', { name: /^公式/ });
  assert.equal(await formula.getAttribute('aria-disabled'), 'true', '在做的不能选');
  assert.match(await formula.getAttribute('data-tip'), /接计算引擎之后/);
  await more.click();
  await types.getByRole('radio', { name: '单选', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await types.getByRole('radio', { name: '人员', exact: true }).getAttribute('aria-checked'), 'true', '↓ 跨组到下面一行');
  await page.keyboard.press('ArrowUp');
  assert.equal(await types.getByRole('radio', { name: '单选', exact: true }).getAttribute('aria-checked'), 'true');
  await types.getByRole('radio', { name: '货币', exact: true }).click();
  assert.match(await fieldCard.locator('.aui-ftype-desc').innerText(), /带币种的金额[\s\S]*US\$ 86,000/);
  await fieldCard.getByRole('searchbox', { name: '搜索字段类型' }).fill('签名');
  assert.equal(await types.getByRole('radio').count(), 1, '搜索也找得到在做的');
  await fieldCard.getByRole('searchbox', { name: '搜索字段类型' }).fill('');

  step('options: colour dot, used count, duplicates, delete asks first');
  const levels = fieldCard.getByRole('list', { name: '客户等级选项顺序' });
  assert.deepEqual(await levels.locator('.aui-opts-used').allInnerTexts(), ['61 条', '24 条', '9 条', '4 条']);
  assert.equal(await levels.locator('.aui-opts-preview').count(), 0, '行里不再放预览');
  assert.match(await fieldCard.locator('.aui-opts-preview').first().innerText(), /表格里：[\s\S]*普通[\s\S]*老客户转介绍/, '预览统一在下面一行');
  const dot = fieldCard.getByRole('button', { name: /^选项「普通」的颜色/ });
  assert.equal(Math.round((await box(dot)).width), 24, '色点按钮 24px');
  await dot.click();
  const tones = page.getByRole('dialog', { name: '选项颜色' });
  await tones.waitFor();
  assert.equal(await tones.getByRole('radio').count(), 10, '10 色');
  await page.keyboard.press('Escape');
  const stages = fieldCard.getByRole('list', { name: '阶段选项顺序' });
  assert.deepEqual(await stages.locator('.aui-opts-used').allInnerTexts(), ['32 条', '18 条', '重名'], '重名写在右边');
  await fieldCard.getByRole('alert').filter({ hasText: '「报价」出现了两次' }).waitFor();
  await stages.getByRole('button', { name: '删除选项「首通」' }).click({ force: true });
  const ask = page.getByRole('dialog', { name: '删除「首通」？' });
  await ask.waitFor();
  assert.match(await ask.innerText(), /32 条客户正在用。删掉后这些客户的「阶段」变成空/);
  assert.equal(await ask.getByRole('button', { name: '删除并清空 32 条' }).count(), 1);
  await shot('field-delete-ask-1440');
  await ask.getByRole('button', { name: '取消' }).click();
  await ask.waitFor({ state: 'detached' });
  assert.equal(await stages.locator('input').count(), 3, '取消就不删');

  // ---- 深色
  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  await filterButton.scrollIntoViewIfNeeded();
  await filterButton.click();
  await panel.waitFor();
  await shot('condition-1440-dark');
  await page.keyboard.press('Escape');
  await fieldCard.scrollIntoViewIfNeeded();
  await shot('field-1440-dark');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  // ---- 手机 390
  step('390: filter sheet rows wrap, compact type tiles in the field dialog');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  await filterButton.scrollIntoViewIfNeeded();
  await filterButton.click();
  const sheet = page.getByRole('dialog', { name: '筛选条件' });
  await sheet.waitFor();
  await page.waitForTimeout(250);
  const r1 = sheet.getByRole('group', { name: '条件 1', exact: true }).first();
  const fieldBox = await box(r1.locator('.aui-grid-fpick'));
  const valueBox = await box(r1.getByRole('combobox', { name: /^筛选值/ }));
  assert.ok(valueBox.top > fieldBox.bottom - 1, '手机：值换到第二行');
  assert.ok((await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)) <= 1, '面板不横向溢出');
  await shot('condition-390');
  await page.keyboard.press('Escape');
  await section.getByRole('button', { name: '新建字段' }).click();
  const dlg = page.getByRole('dialog', { name: '新建字段' });
  await dlg.waitFor();
  const tile = await box(dlg.getByRole('radio', { name: '文本', exact: true }));
  assert.ok(tile.height >= 39, `手机类型格子 ≥ 40（触屏）：${tile.height}`);
  const perLine = await dlg.locator('.aui-ftype-grid').first().evaluate((el) => { const tops = [...el.children].map((c) => Math.round(c.getBoundingClientRect().top)); return tops.filter((t) => t === tops[0]).length; });
  assert.ok(perLine >= 4, `手机一行放得下 4 个以上类型：${perLine}`);
  const groupsBox = await box(dlg.locator('.aui-ftype-groups'));
  assert.ok(groupsBox.height < 560, `类型区不占满一屏：${groupsBox.height}`);
  await shot('field-dialog-390');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: resolve(output, 'section-1440.png'), animations: 'disabled' });

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS inputs-condition (${output}): filter 「筛选 3」 + sentence, MultiChoice tags / 「我」 first / relative dates / CN¥ money, × remove with tips, 且 / 或 toggle, wash groups, quick-add, 先不生效 + red errors; field types grouped + search + 「还有 6 种在做」 + card + cross-group arrows; options dot / used / 重名 / delete asks; 1440 light / dark + 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
