// bt/builders-a 浏览器验收：starter「系统 → 表单」（V9 FormBuilder，样稿 D08）和公开页 #form-public=fill（V10 PublicForm + FormSuccess，样稿 D18 / D18m / D18s），
// 以及嵌套条件编辑器（P1）在表单显示条件里的用法。
// 搭建器：字段列表拖进「已添加」= 加题、拖出 = 移除、题目键盘 Alt+↑/↓ 排序、锁住的题、「+」加题 / 从表单移除、搜索；题目设置条（必填、显示条件弹出面板里
// 用嵌套条件编辑器设条件 → 题目上出现「显示条件：当…时显示」、删除题目连字段先确认）；右栏（提交次数限制连带登录、指定人强制登录 + 催填、停止收集、
// 复制链接、预填链接生成）；填写预览。公开页：条件显示（选了「智能门锁」才出现上传题）、必填 / 手机格式错误与焦点、上传（进度、失败 → 重试、取消、
// 删除、上传中不能提交）、录音（假麦克风）、验证插槽、提交失败保留内容、提交成功页摘要 + 再填一份；390 手机吸顶条「已填 N / M 题」、触屏尺寸 ≥ 44px；
// 1440 浅 / 深色；不横向溢出。截图在 test/artifacts/form-builder/，和已审定的样稿截图并排看。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { checkFlushSection, edges } from './flush-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/form-builder');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const url = server.resolvedUrls.local[0];
const step = (name) => console.log(`  · ${name}`);
const errors = [];
const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });
const png = (name) => ({ name, mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a3a1b9e40000000049454e44ae426082', 'hex') });
const mp4 = (name) => ({ name, mimeType: 'video/mp4', buffer: Buffer.alloc(8192, 1) });
const drag = async (page, from, to, steps = 14) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  await page.mouse.up();
};

try {
  // ================================================================ V9 FormBuilder（1440）
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone', 'clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  await page.goto(url);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '表单', exact: true }).click();
  const area = page.locator('#aui-page-forms');
  const fb = area.locator('.aui-fb');
  await fb.waitFor();
  const fieldsPane = fb.getByRole('complementary', { name: '字段' });
  const canvas = fb.getByRole('main', { name: '表单内容' });
  const settingsPane = fb.getByRole('complementary', { name: '表单设置' });
  const titles = () => canvas.locator('.aui-fb-q-title').evaluateAll((els) => els.map((el) => el.querySelector('.aui-fb-q-title-text, input')?.textContent || el.querySelector('input')?.value || ''));
  const groupText = async () => (await fieldsPane.locator('.aui-fb-group').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

  step('D08 three panes, selected question tray, locked first question');
  assert.deepEqual(await groupText(), ['已添加 7', '未添加 7 全部添加']);
  assert.equal((await titles()).length, 7);
  const q4 = canvas.getByRole('group', { name: '第 4 题：想了解的产品' });
  assert.equal(await q4.getAttribute('data-selected'), 'true', 'defaultSelected 的题目打开设置条');
  assert.ok(await q4.getByRole('group', { name: '第 4 题的设置' }).isVisible());
  assert.match(await q4.innerText(), /字段：想了解的产品（多选）/);
  assert.ok(await canvas.getByRole('img', { name: /「您的称呼」这一题固定在最前面/ }).isVisible(), '固定的题没有把手');
  assert.match(await canvas.getByRole('group', { name: /^第 5 题/ }).innerText(), /显示条件：当「想了解的产品」包含任一「智能门锁」时显示/);
  assert.equal(await fieldsPane.getByRole('img', { name: '有字段权限的字段：表单里只写不读' }).count(), 1, '成交价带锁');
  assert.match(await fieldsPane.innerText(), /负责人\s*不能做题/);
  await shot('builder-1440-light');

  step('+ adds, 从表单移除 removes (field and data stay)');
  await fieldsPane.getByRole('button', { name: '把「意向」加到表单' }).click();
  assert.deepEqual(await groupText(), ['已添加 8', '未添加 6 全部添加']);
  const q8 = canvas.getByRole('group', { name: '第 8 题：意向' });
  await q8.waitFor();
  assert.equal(await q8.getAttribute('data-selected'), 'true', '新加的题自动选中');
  await q8.getByRole('button', { name: '从表单移除' }).click();
  assert.deepEqual(await groupText(), ['已添加 7', '未添加 7 全部添加']);

  step('pointer drag in the field list: into 已添加 = add at the drop place, out = remove');
  const sourceGrip = fieldsPane.getByRole('button', { name: '移动「来源」' });
  const phoneRow = fieldsPane.locator('[data-sortable-row]', { has: page.getByRole('button', { name: '移动「手机」' }) });
  const from = await box(sourceGrip);
  const to = await box(phoneRow);
  await drag(page, from, { x: to.x, y: to.top + 4 });
  await page.waitForTimeout(100);
  assert.deepEqual((await titles()).slice(0, 3), ['您的称呼', '来源', '手机'], '拖到「手机」上面 = 第 2 题');
  assert.deepEqual(await groupText(), ['已添加 8', '未添加 6 全部添加']);
  const restHeader = fieldsPane.locator('[data-group]', { hasText: '未添加' });
  await drag(page, await box(fieldsPane.getByRole('button', { name: '移动「来源」' })), await box(restHeader).then((b) => ({ x: b.x, y: b.bottom - 3 })));
  await page.waitForTimeout(100);
  assert.ok(!(await titles()).includes('来源'), '拖回「未添加」= 从表单移除');
  assert.deepEqual(await groupText(), ['已添加 7', '未添加 7 全部添加']);

  step('keyboard reorder of questions (Alt+↑ / ↓), the pinned one is never passed');
  await canvas.getByRole('button', { name: '移动「地区」' }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.deepEqual((await titles()).slice(0, 3), ['您的称呼', '地区', '手机']);
  await page.keyboard.press('Alt+ArrowUp');
  assert.deepEqual((await titles()).slice(0, 2), ['您的称呼', '地区'], '不能越过固定的第一题');
  await page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual((await titles()).slice(0, 3), ['您的称呼', '手机', '地区']);

  step('search shows a flat list');
  await fieldsPane.getByRole('searchbox', { name: '搜索字段' }).fill('预');
  assert.deepEqual(await fieldsPane.getByRole('list', { name: '搜索结果' }).locator('li').allInnerTexts().then((t) => t.map((x) => x.trim().split(/\s/)[0])), ['预算', '预计金额']);
  await fieldsPane.getByRole('searchbox', { name: '搜索字段' }).fill('');

  step('display condition with the nested condition editor (earlier questions only)');
  await canvas.getByRole('button', { name: '编辑第 7 题「方便联系的时间」' }).click();
  const q7 = canvas.getByRole('group', { name: '第 7 题：方便联系的时间' });
  assert.equal(await q7.getAttribute('data-selected'), 'true');
  await q7.getByRole('switch', { name: '必填' }).click();
  assert.equal(await q7.locator('.aui-pform-req').count(), 1, '打开必填后题目带 *');
  await q7.getByRole('button', { name: '设置条件' }).click();
  const condPanel = page.getByRole('dialog', { name: '显示条件' });
  await condPanel.waitFor();
  await condPanel.getByRole('button', { name: '添加条件', exact: true }).click();
  const row1 = condPanel.getByRole('group', { name: '条件 1', exact: true });
  await row1.getByRole('button', { name: /^筛选字段/ }).click();
  const fieldList = page.getByRole('listbox', { name: '筛选字段' });
  const offered = await fieldList.getByRole('option').allInnerTexts();
  assert.ok(offered.includes('地区') && !offered.includes('上传户型图') && !offered.includes('方便联系的时间'), `只能选前面的题、附件不能做条件：${offered.join('、')}`);
  await fieldList.getByRole('option', { name: '地区' }).click();
  await row1.getByRole('combobox', { name: /^筛选值/ }).click();
  await page.getByRole('listbox', { name: '筛选值' }).getByRole('option', { name: '上海' }).click();
  await page.keyboard.press('Escape');
  await condPanel.getByRole('button', { name: '添加条件组' }).click();
  const group = condPanel.getByRole('group', { name: '条件组（任一满足）' });
  await group.waitFor();
  assert.equal(await group.getByRole('group', { name: '条件 1', exact: true }).count(), 1, '条件组带一个条件');
  assert.equal(await group.getByRole('button', { name: '添加条件组' }).count(), 0, '默认嵌套 1 层：条件组里不能再加组');
  await shot('builder-1440-condition');
  await group.getByRole('button', { name: '删除条件组' }).click();
  assert.match(await condPanel.innerText(), /当「地区」是「上海」时显示/);
  await condPanel.getByRole('button', { name: '完成' }).click();
  await condPanel.waitFor({ state: 'hidden' });
  assert.match(await q7.innerText(), /当「地区」是「上海」时显示/);
  await canvas.getByRole('button', { name: '编辑第 6 题「预算」' }).click();
  assert.match(await q7.innerText(), /显示条件：当「地区」是「上海」时显示/, '没选中的题目上显示条件胶囊');

  step('reorder clears conditions that would look at later questions');
  await canvas.getByRole('button', { name: '移动「方便联系的时间」' }).focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Alt+ArrowUp');
  assert.deepEqual((await titles()).slice(0, 2), ['您的称呼', '方便联系的时间']);
  assert.doesNotMatch(await canvas.getByRole('group', { name: /^第 2 题/ }).innerText(), /显示条件/, '挪到「地区」前面：条件去掉');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Alt+ArrowDown');

  step('删除题目（连字段） asks first');
  await canvas.getByRole('button', { name: /^编辑第 \d+ 题「方便联系的时间」/ }).click();
  await canvas.getByRole('group', { name: /方便联系的时间$/ }).getByRole('button', { name: '删除题目（连字段）' }).click();
  const confirm = page.getByRole('dialog', { name: '删除题目「方便联系的时间」' });
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /字段和全部 1,284 条记录/);
  await confirm.getByRole('button', { name: '删除字段和数据' }).click();
  await confirm.waitFor({ state: 'hidden' });
  assert.ok(!(await titles()).includes('方便联系的时间'));
  assert.equal(await fieldsPane.getByText('方便联系的时间').count(), 0, '字段也删了');

  step('settings: limits pull login in, 指定人 forces login + 催填, stop collecting, copy link, prefill link');
  const login = settingsPane.getByRole('switch', { name: '需要登录' });
  await settingsPane.getByRole('group', { name: '提交次数限制' }).getByRole('button', { name: '不限' }).click();
  await login.click();
  assert.equal(await login.getAttribute('aria-checked'), 'false');
  assert.equal(await settingsPane.getByRole('switch', { name: '允许修改自己的提交' }).getAttribute('aria-checked'), 'false', '关登录连带关「允许修改」');
  await settingsPane.getByRole('group', { name: '提交次数限制' }).getByRole('button', { name: '每天一次' }).click();
  assert.equal(await login.getAttribute('aria-checked'), 'true', '按人限制自动打开登录');
  await settingsPane.getByRole('group', { name: '谁能填写' }).getByRole('button', { name: '指定人' }).click();
  assert.ok(await login.isDisabled(), '指定人：登录关不掉');
  assert.match(await settingsPane.innerText(), /指定人填写时必须登录/);
  await settingsPane.getByRole('button', { name: '催填' }).click();
  await page.getByText('已提醒 3 个还没填的人').waitFor();
  await settingsPane.getByRole('group', { name: '谁能填写' }).getByRole('button', { name: '任何人' }).click();
  await settingsPane.getByRole('switch', { name: '停止收集' }).click();
  assert.match(await fb.locator('.aui-fb-top').innerText(), /已停止收集/);
  await settingsPane.getByRole('switch', { name: '停止收集' }).click();
  await settingsPane.getByRole('button', { name: '复制' }).click();
  await settingsPane.getByRole('button', { name: '已复制' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://app.example.com/f/kH8x2Q');
  await settingsPane.getByRole('button', { name: '添加要通知的人或群' }).click();
  assert.match(await settingsPane.getByRole('list', { name: '收到通知的人' }).innerText(), /陈主管/);
  await settingsPane.getByRole('button', { name: '不再通知 陈主管' }).click();
  await settingsPane.getByRole('button', { name: '生成预填链接' }).click();
  const prefill = page.getByRole('dialog', { name: '生成预填链接' });
  await prefill.waitFor();
  await prefill.getByRole('combobox', { name: '预填 1 的题目' }).click();
  await page.getByRole('option', { name: '地区' }).click();
  await prefill.getByRole('combobox', { name: '预填 1 的答案' }).click();
  await page.getByRole('option', { name: '苏州' }).click();
  const expected = `https://app.example.com/f/kH8x2Q?prefill_${encodeURIComponent('地区')}=${encodeURIComponent('苏州')}&hide_${encodeURIComponent('地区')}=1`;
  assert.equal(await prefill.locator('code').innerText(), expected);
  await prefill.getByRole('button', { name: '复制链接' }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), expected);
  await page.keyboard.press('Escape');

  step('填写预览 = the real public form (conditions work, submit does not save)');
  await fb.getByRole('group', { name: '表单视图' }).getByRole('button', { name: '填写预览' }).click();
  const preview = fb.locator('.aui-fb-preview .aui-pform');
  await preview.waitFor();
  assert.equal(await preview.getByText('上传户型图').count(), 0, '没选「智能门锁」时不显示上传题');
  await preview.getByRole('checkbox', { name: '智能门锁' }).click();
  await preview.getByText('上传户型图').waitFor();
  await fb.getByRole('group', { name: '表单视图' }).getByRole('button', { name: '编辑' }).click();
  assert.ok((await overflowOf(page)) <= 0, '1440 不横向溢出');

  step('dark + 390');
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
  await shot('builder-1440-dark');
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok((await overflowOf(page)) <= 0, `搭建器 390 横向溢出 ${await overflowOf(page)}px`);
  await shot('builder-390-light', true);
  await page.close();

  // ================================================================ V10 PublicForm + FormSuccess（1440）
  const pub = await context.newPage();
  pub.on('pageerror', (e) => errors.push(e.message));
  const pshot = (name, full = false) => pub.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  await pub.goto(`${url}#form-public=fill`);
  const form = pub.locator('.aui-pform');
  await form.waitFor();
  await pub.evaluate(() => { window.__formUploadSpeed = 60; });
  const q = (title) => form.locator('.aui-pform-q', { has: pub.locator('.aui-pform-qt', { hasText: title }) });

  step('conditional reveal follows the answers');
  assert.equal(await q('上传户型图').count(), 1);
  await form.getByRole('checkbox', { name: '智能门锁' }).click();
  await q('上传户型图').waitFor({ state: 'detached' });
  assert.equal(await form.locator('.aui-pform-q').count(), 6);
  await form.getByRole('checkbox', { name: '智能门锁' }).click();
  await q('上传户型图').waitFor();
  assert.deepEqual(await form.locator('.aui-pform-no').allInnerTexts(), ['1.', '2.', '3.', '4.', '5.', '6.', '7.'], '题号连续');

  step('required + phone format errors, focus goes to the first wrong question');
  await form.getByRole('button', { name: '提交', exact: true }).click();
  await q('手机').getByText('请填写手机').waitFor();
  assert.ok(await pub.evaluate(() => document.activeElement?.closest('.aui-pform-q')?.textContent?.includes('手机')), '焦点到手机');
  const phone = q('手机').getByRole('textbox');
  await phone.fill('12');
  await phone.blur();
  await q('手机').getByText('手机号位数不对').waitFor();
  assert.equal(await phone.getAttribute('aria-invalid'), 'true');
  await shot1440Errors();
  async function shot1440Errors() { await pshot('fill-1440-errors'); }
  await phone.fill('13800138000');
  await phone.blur();
  assert.equal(await q('手机').locator('.aui-pform-err').count(), 0);
  assert.match(await q('手机').getByRole('button', { name: /^国家 \/ 地区/ }).innerText(), /\+86\b/, '默认区号 +86');

  step('uploads: progress, failed + 重试, cancel, remove, submit waits for uploads');
  const picker = q('上传户型图').locator('input[type=file][multiple]');
  await pub.evaluate(() => { window.__formUploadSpeed = 250; });
  await picker.setInputFiles([mp4('大门口走一圈.mp4'), png('主卧门口.png')]);
  const uploading = q('上传户型图').getByRole('progressbar', { name: '大门口走一圈.mp4 上传进度' });
  await uploading.waitFor();
  await q('上传户型图').getByText('网络中断，已保留文件').waitFor();
  assert.ok(await q('上传户型图').getByText('上传失败').isVisible());
  await pshot('fill-1440-uploads');
  await form.getByRole('button', { name: '提交', exact: true }).click();
  await form.getByText('还有文件在上传，传完再提交').waitFor();
  await q('上传户型图').getByRole('button', { name: '重试' }).click();
  await q('上传户型图').getByText('主卧门口.png').waitFor();
  await q('上传户型图').getByRole('button', { name: '删除 主卧门口.png' }).waitFor({ timeout: 10000 });
  await q('上传户型图').getByRole('button', { name: '删除 大门口走一圈.mp4' }).waitFor({ timeout: 10000 });
  await pub.evaluate(() => { window.__formUploadSpeed = 400; });
  await picker.setInputFiles([mp4('不要了.mp4')]);
  await q('上传户型图').getByRole('button', { name: '取消上传 不要了.mp4' }).click();
  await q('上传户型图').getByText('不要了.mp4').waitFor({ state: 'detached' });
  await q('上传户型图').getByRole('button', { name: '删除 客厅.jpg' }).click();
  assert.equal(await q('上传户型图').getByText('客厅.jpg').count(), 0);
  assert.equal(await q('上传户型图').locator('.aui-pform-file').count(), 3);

  step('record a voice note (fake microphone) → goes up as an audio answer');
  await pub.evaluate(() => { window.__formUploadSpeed = 30; });
  await q('上传户型图').getByRole('button', { name: '录音' }).click();
  await q('上传户型图').getByRole('status').filter({ hasText: '正在录音' }).waitFor();
  await pub.waitForTimeout(1200);
  await q('上传户型图').getByRole('button', { name: '结束并保存' }).click();
  await q('上传户型图').locator('.aui-pform-audio').filter({ hasText: '语音说明' }).first().waitFor();
  await q('上传户型图').getByRole('button', { name: /^删除 语音说明/ }).waitFor({ timeout: 10000 });

  step('captcha slot, failed submit keeps the answers, success page + 再填一份');
  await form.getByRole('button', { name: '提交', exact: true }).click();
  await form.getByText('请先完成上面的验证').waitFor();
  await form.getByRole('button', { name: '拖动滑块完成验证' }).click();
  const name = q('您的称呼').getByRole('textbox');
  await name.fill('陈雅婷失败');
  await form.getByRole('button', { name: '提交', exact: true }).click();
  await form.getByText(/网络不稳，没提交成功/).waitFor();
  assert.equal(await name.inputValue(), '陈雅婷失败', '失败保留内容');
  await name.fill('陈雅婷');
  await form.getByRole('button', { name: '提交', exact: true }).click();
  const ok = pub.locator('.aui-pform-success');
  await ok.waitFor();
  const summary = ok.getByRole('region', { name: '您提交的内容' });
  assert.match(await summary.innerText(), /共 7 题，已答 6 题/);
  assert.match(await summary.innerText(), /138 \*\*\*\* 8000/, '手机打码（本国号码按当地写法）');
  assert.doesNotMatch(await summary.innerText(), /\+\d+ 0/, '国际写法不带开头的 0');
  assert.match(await summary.innerText(), /智能门锁[\s\S]*窗帘电机/);
  assert.match(await summary.innerText(), /共 4 个/, '附件按类型计数');
  assert.ok((await overflowOf(pub)) <= 0);
  await pshot('success-1440-light');
  await ok.getByRole('button', { name: '再填一份' }).click();
  await form.waitFor();
  assert.equal(await q('您的称呼').getByRole('textbox').inputValue(), '', '再填一份是空表');
  assert.equal(await q('上传户型图').count(), 0, '空表没选智能门锁：不显示上传题');

  step('prefill link fills and hides');
  await pub.goto(`${url}?prefill_${encodeURIComponent('地区')}=${encodeURIComponent('苏州')}&hide_${encodeURIComponent('地区')}=1#form-public=fill`);
  await form.waitFor();
  assert.equal(await q('地区').count(), 0, '预填并隐藏的题不显示');
  assert.deepEqual(await form.locator('.aui-pform-no').allInnerTexts(), ['1.', '2.', '3.', '4.', '5.', '6.']);

  step('dark: fill + success');
  await pub.goto(`${url}#form-public=fill&dark`);
  await form.waitFor();
  await pub.waitForTimeout(200);
  await pshot('fill-1440-dark');
  await q('手机').getByRole('textbox').fill('13800138000');
  await form.getByRole('button', { name: '拖动滑块完成验证' }).click();
  await form.getByRole('button', { name: '提交', exact: true }).click();
  await ok.waitFor();
  await pshot('success-1440-dark');
  await pub.close();
  await context.close();

  // ================================================================ 390 手机（触屏）
  step('390 phone: sticky 「已填 N / M 题」, touch sizes, recorder, success');
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, permissions: ['microphone'] });
  const m = await phoneCtx.newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  const mshot = (name, full = false) => m.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  await m.goto(`${url}#form-public=fill`);
  const mform = m.locator('.aui-pform');
  await mform.waitFor();
  const bar = mform.locator('.aui-pform-bar');
  assert.ok(await bar.isVisible(), '手机上有吸顶条');
  assert.match(await bar.innerText(), /已填 5 \/ 7 题/);
  const mq = (title) => mform.locator('.aui-pform-q', { has: m.locator('.aui-pform-qt', { hasText: title }) });
  await mq('手机').getByRole('textbox').fill('13800138000');
  assert.match(await bar.innerText(), /已填 6 \/ 7 题/);
  for (const [what, locator] of [
    ['输入框', mq('您的称呼').getByRole('textbox')],
    ['区号 + 号码框', mq('手机').locator('.aui-input-box').first()],
    ['单选', mq('地区').getByRole('radio').first()],
    ['多选胶囊', mq('想了解的产品').getByRole('checkbox').first()],
    ['提交', mform.getByRole('button', { name: '提交', exact: true })],
  ]) assert.ok((await box(locator)).height >= 44, `${what} 触屏高度 ≥ 44px`);
  await mq('上传户型图').scrollIntoViewIfNeeded();
  await mq('上传户型图').getByRole('button', { name: '录音' }).click();
  await mq('上传户型图').getByRole('status').filter({ hasText: '正在录音' }).waitFor();
  await m.evaluate(() => { const el = [...document.querySelectorAll('.aui-pform-q')].find((x) => x.textContent.includes('上传户型图')); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 56); });
  await m.waitForTimeout(400);
  assert.equal(Math.round((await box(bar)).top), 0, '滚动后吸顶条贴在顶上');
  assert.ok((await overflowOf(m)) <= 0, `390 横向溢出 ${await overflowOf(m)}px`);
  await mshot('fill-390-light');
  await mq('上传户型图').getByRole('button', { name: '取消录音（不保存）' }).click();
  await mshot('fill-390-light-full', true);
  await mform.getByRole('button', { name: '拖动滑块完成验证' }).click();
  await mform.getByRole('button', { name: '提交', exact: true }).click();
  const mok = m.locator('.aui-pform-success');
  await mok.waitFor();
  assert.ok((await box(mok.getByRole('button', { name: '再填一份' }))).height >= 44);
  assert.ok((await overflowOf(m)) <= 0);
  await mshot('success-390-light', true);
  await m.goto(`${url}#form-public=fill&dark`);
  await mform.waitFor();
  await m.waitForTimeout(200);
  await mshot('fill-390-dark');
  await phoneCtx.close();
  // bt/flush: FormBuilder straight in a workspace Pane (fill): no frame, flush against the pane edges, down to the bottom.
  step('flush in a workspace Pane (系统 → 工作区贴边 · 表单)');
  await checkFlushSection(browser, url, '表单', output, 'form-builder', async (p, area, { width, label }) => {
    const pane = area.locator('.aui-tabbed-panel:not([hidden]) .aui-pane[aria-label="表单搭建"]');
    const box = await edges(pane);
    const fb = await edges(pane.locator('.aui-fb'));
    assert.ok(fb.radius === 0 && fb.bl === 0 && fb.shadow === 'none', `${label}：表单搭建器没有外框圆角`);
    assert.ok(fb.x === box.ix && fb.right === box.iright, `${label}：表单搭建器贴着栏边（${fb.x}–${fb.right} / ${box.ix}–${box.iright}）`);
    if (width > 1100) assert.ok(Math.abs(fb.bottom - box.bottom) <= 1, `${label}：表单搭建器撑到栏底（${fb.bottom} / ${box.bottom}）`);
  });
} finally {
  await browser.close();
  await server.close();
}
assert.deepEqual(errors, [], `页面脚本错误：\n${errors.join('\n')}`);
console.log(`PASS form-builder (${output}): FormBuilder (panes, + / 从表单移除, pointer drag into / out of 已添加, keyboard reorder past pinned blocked, search, required switch, nested display condition popover (earlier questions only, group limit) + chip, reorder prunes conditions, delete-with-field confirm, settings knock-on login / 指定人 + 催填 / stop collecting / copy link / notify chips / prefill link, 填写预览), PublicForm (conditional reveal + numbering, required / phone errors + focus, uploads progress / failed + retry / cancel / remove / submit waits, voice recording, captcha slot, failed submit keeps input, prefill hides), FormSuccess (summary masked phone / chips / file counts, 再填一份), 1440 light / dark, 390 sticky progress + touch ≥ 44px + recorder, no overflow, flush in a workspace Pane (no frame, fills the pane) 1440 light / dark / 390`);
