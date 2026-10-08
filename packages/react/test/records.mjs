// bt/records 浏览器验收：starter「记录与字段」（D11 记录详情 + 子表 + 评论 + 留痕查看，D12 新建字段 + 谁能看 / 谁能改）
// 和「表格权限」（D13 TableAccessPanel）。交互、键盘、1440 浅 / 深色、390 手机不溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { checkFlushSection, edges } from './flush-checks.mjs';
import { checkFlatRecord, checkInPlaceEditing } from './record-list-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/records');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '');
  const until = async (fn, label) => {
    for (let i = 0; i < 50; i++) { if (await fn()) return; await page.waitForTimeout(40); }
    assert.fail(label);
  };
  const noOverflow = async (label, locator) => {
    const over = locator ? await locator.evaluate((el) => el.scrollWidth - el.clientWidth) : await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 1, `${label} 横向溢出 ${over}px`);
  };
  await page.goto(server.resolvedUrls.local[0]);
  const nav = page.getByRole('navigation', { name: '主导航' });
  const openPage = async (name) => { await nav.getByRole('button', { name, exact: true }).click(); };
  await openPage('记录与字段');
  const area = page.locator('#aui-page-records');
  await area.getByRole('button', { name: '打开 李承恩（滨江豪宅）' }).waitFor();

  // ================================================================ D12 新建字段
  await area.getByRole('button', { name: '新建字段' }).click();
  const dlg = page.getByRole('dialog', { name: '新建字段' });
  await dlg.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.value), '客户质量', '打开后焦点在字段名称（不是标题旁的「?」）');
  const dlgBox = await box(dlg);
  assert.ok(dlgBox.width > 1000 && dlgBox.width <= 1120 + 1, `有右栏时弹框加宽到 1120：${dlgBox.width}`);
  // R1 类型格子：按组排，还没做的 12 种收成「还有 12 种在做」，展开后灰着不能选；单选已选中
  const types = dlg.getByRole('radiogroup', { name: '字段类型' });
  assert.equal(await types.getByRole('radio').count(), 17, '能用的 17 种');
  await dlg.getByRole('button', { name: '还有 12 种在做' }).click();
  assert.equal(await types.getByRole('radio').count(), 29);
  assert.equal(await types.getByRole('radio', { name: '单选' }).getAttribute('aria-checked'), 'true');
  const later = types.getByRole('radio', { name: /^附件/ });
  assert.equal(await later.getAttribute('aria-disabled'), 'true');
  assert.match(await later.getAttribute('data-tip'), /等文件存储/);
  await dlg.getByRole('button', { name: '还有 12 种在做' }).click();
  assert.match(await dlg.locator('.aui-ftype-desc').innerText(), /单选[\s\S]*从几个选项里选一个/, '选中类型的说明卡');
  assert.equal(await types.locator('[tabindex="0"]').count(), 1, '只有一个 tab 停留点');
  await types.getByRole('radio', { name: '单选' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await types.getByRole('radio', { name: '多选' }).getAttribute('aria-checked'), 'true', '→ 选中下一个（同组里单选后面是多选）');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await types.getByRole('radio', { name: '单选' }).getAttribute('aria-checked'), 'true');
  await page.keyboard.press('ArrowDown');
  const afterDown = await focused();
  assert.ok(!/附件|子表|关联|公式|查找引用|评分|进度/.test(afterDown), `↓ 跳过虚线格子，实际到「${afterDown}」`);
  await page.keyboard.press('Home');
  assert.equal(await types.getByRole('radio', { name: '文本', exact: true }).getAttribute('aria-checked'), 'true');
  await dlg.getByRole('searchbox', { name: '搜索字段类型' }).fill('关联');
  assert.equal(await types.getByRole('radio').count(), 1);
  await dlg.getByRole('searchbox', { name: '搜索字段类型' }).fill('不存在的类型');
  await dlg.getByText('没有叫「不存在的类型」的字段类型').waitFor();
  await dlg.getByRole('searchbox', { name: '搜索字段类型' }).fill('');
  assert.equal(await dlg.getByRole('list', { name: '选项顺序' }).count(), 0, '文本类型没有选项编辑');
  await types.getByRole('radio', { name: '单选' }).click();

  // R2 选项：顺序、回车加下一个、空名称退格删除、键盘移动、换颜色
  const optionList = dlg.getByRole('list', { name: '选项顺序' });
  const optionNames = () => optionList.locator('input').evaluateAll((els) => els.map((el) => el.value));
  assert.deepEqual(await optionNames(), ['高', '中', '低']);
  assert.match(await dlg.locator('.aui-opts-count').innerText(), /3 个选项/);
  await dlg.getByRole('textbox', { name: '选项 3 名称' }).press('End');
  await page.keyboard.press('Enter');
  assert.deepEqual(await optionNames(), ['高', '中', '低', '']);
  assert.equal(await focused(), '选项 4 名称', '回车后焦点在新选项');
  await page.keyboard.type('待定');
  assert.match(await dlg.locator('.aui-opts-preview').innerText(), /表格里：[\s\S]*待定/, '下面一行预览和表格里的标签一样');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  assert.deepEqual(await optionNames(), ['高', '中', '低'], '空名称再退格就删掉');
  assert.equal(await focused(), '选项 3 名称');
  await dlg.getByRole('button', { name: '移动「高」' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual(await optionNames(), ['中', '高', '低']);
  await page.keyboard.press('Alt+ArrowUp');
  await dlg.getByRole('button', { name: /^选项「高」的颜色/ }).click();
  const tones = page.getByRole('dialog', { name: '选项颜色' });
  await tones.waitFor();
  assert.equal(await tones.getByRole('radio').count(), 10, '10 色');
  await tones.getByRole('radio', { name: '红' }).click();
  await tones.waitFor({ state: 'detached' });
  assert.equal(await dlg.locator('.aui-opts-preview .aui-chip').first().getAttribute('data-tone'), 'red');
  assert.equal(await dlg.getByRole('switch', { name: '允许在单元格里直接新建选项' }).getAttribute('aria-checked'), 'true');
  // 重名标红
  await dlg.getByRole('textbox', { name: '选项 3 名称' }).fill('中');
  await dlg.getByRole('alert').filter({ hasText: '「中」出现了两次' }).waitFor();
  await dlg.getByRole('textbox', { name: '选项 3 名称' }).fill('低');

  // P3 GrantList picked：默认的人锁住、三行授权、改档、搜索添加、去掉、Esc 只收起列表
  const grants = dlg.getByRole('group', { name: '字段授权' });
  assert.equal(await grants.getByRole('list', { name: '默认就有权限、不能去掉的人' }).getByRole('listitem').count(), 3);
  const rows = grants.getByRole('list', { name: '已授权' }).getByRole('listitem');
  assert.equal(await rows.count(), 3);
  // 行内「去掉」悬停才出现（触屏常显）；搜索添加在名单上面
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
  const removeOpacity = () => grants.getByRole('button', { name: '去掉 运营', exact: true }).evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(await removeOpacity(), '0', '「去掉」平时不显示');
  await rows.nth(2).hover();
  await page.waitForTimeout(200);
  assert.equal(await removeOpacity(), '1', '悬停出现「去掉」');
  const addAbove = await grants.evaluate((g) => g.querySelector('.aui-grant-add').getBoundingClientRect().bottom <= g.querySelector('.aui-grant-rows').getBoundingClientRect().top);
  assert.ok(addAbove, '搜索添加在已选名单上面');
  await grants.getByRole('group', { name: '小A 的权限' }).getByRole('button', { name: '可读写' }).click();
  assert.equal(await grants.getByRole('group', { name: '小A 的权限' }).getByRole('button', { name: '可读写' }).getAttribute('aria-pressed'), 'true');
  const search = grants.getByRole('combobox');
  await search.fill('技术');
  const suggest = page.getByRole('listbox', { name: '可以授权的人、组和角色' });
  await suggest.waitFor();
  assert.equal(await suggest.getByRole('option').count(), 1);
  assert.equal(await focused(), '添加人、组或角色（只列你管得着的）', '列表不抢焦点');
  await shot('field-dialog-suggest');
  await page.keyboard.press('Escape');
  await suggest.waitFor({ state: 'detached' });
  assert.ok(await dlg.isVisible(), 'Esc 只收起建议，不关弹框');
  await page.keyboard.press('ArrowDown');
  await suggest.waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await rows.count(), 4);
  assert.match(await rows.nth(3).innerText(), /技术部/);
  assert.equal(await search.inputValue(), '');
  await dlg.getByText('现在能看的共 8 人').waitFor();
  await dlg.getByText('销售、经理看不到这个字段').waitFor();
  await search.fill('火星人');
  await page.getByText('没有匹配的；只能授给你管得着的人').waitFor();
  await search.fill('');
  await grants.getByRole('button', { name: '去掉 技术部' }).click();
  assert.equal(await rows.count(), 3);
  assert.equal(await focused(), '去掉 运营', '去掉后焦点到相邻一行');
  await shot('field-dialog');
  await noOverflow('新建字段弹框（1440）', dlg.locator('.aui-dialog-body'));

  // R3 校验与失败：名称必填 / 重名，保存失败留在弹框
  const name = dlg.getByRole('textbox', { name: /字段名称/ });
  await name.fill('');
  await dlg.getByRole('button', { name: '确定' }).click();
  await dlg.getByRole('alert').filter({ hasText: '请填写字段名称' }).first().waitFor();
  assert.equal(await name.getAttribute('aria-invalid'), 'true');
  assert.equal(await focused(), '', '焦点回到名称框（它的名字来自 label）');
  await name.fill('阶段');
  await dlg.getByText('已经有叫「阶段」的字段了').first().waitFor();
  await name.fill('失败测试');
  await name.press('Enter');
  await dlg.getByRole('alert').filter({ hasText: '保存失败：网络中断，请重试' }).waitFor();
  assert.equal(await name.inputValue(), '失败测试', '失败后输入还在');
  await name.fill('客户质量');
  await dlg.getByRole('button', { name: '确定' }).click();
  await dlg.waitFor({ state: 'detached' });
  await page.getByText('已新建字段「客户质量」').waitFor();

  // ================================================================ GrantList list 模式（SharePicker）、SensitiveValue
  const share = area.getByRole('group', { name: '分享给' });
  await share.getByRole('checkbox').nth(0).check();
  assert.match(await share.locator('.aui-note').last().innerText(), /已选 2 个/);
  const phone = area.locator('.aui-sensitive').first();
  await phone.getByRole('button', { name: '查看手机' }).click();
  await phone.getByText('138-0013-8000').waitFor();
  await phone.getByText(/\d+ 秒后隐藏/).waitFor();
  await phone.getByRole('button', { name: '隐藏手机' }).click();
  await phone.getByText('138-****-8000').waitFor();
  const idCard = area.locator('.aui-sensitive').nth(1);
  await idCard.getByRole('button', { name: '查看身份证' }).click();
  await idCard.getByRole('alert').filter({ hasText: '你没有查看身份证的权限' }).waitFor();
  assert.ok(await idCard.getByText('A12*****89').isVisible(), '没权限时还是打码');

  // ================================================================ D11 记录详情
  await area.getByRole('button', { name: '打开 李承恩（滨江豪宅）' }).click();
  const rec = page.getByRole('dialog', { name: '李承恩（滨江豪宅）' });
  await rec.waitFor();
  const profile = rec.getByRole('region', { name: '客户资料' });
  await profile.getByText('2 个字段你看不到').waitFor();
  // 列表展示（飞书式）：平的、悬停才有按钮、点值就地编辑（文本 / 长文本 / 单选 / 日期 / 失败 / 锁）
  await checkInPlaceEditing(page, rec, shot);
  assert.match(await profile.locator('.aui-hidden-fields').getAttribute('data-tip'), /管理员设置了字段权限/);
  // R4 / R6 手机方块：留痕查看 + 拨打 + 复制
  const phoneTile = profile.locator('.aui-rfield').filter({ hasText: '手机' });
  assert.equal(await phoneTile.getByRole('link', { name: '拨打手机' }).getAttribute('href'), 'tel:13912345781');
  assert.equal(await phoneTile.getByRole('button', { name: '复制手机' }).count(), 0, '打码时不给复制（复制的会是星号）');
  await phoneTile.getByRole('button', { name: '查看手机（会被记录）' }).click();
  await phoneTile.getByText('139-1234-5781').waitFor();
  await page.getByText('已记录：小B 查看了「手机」').waitFor();
  assert.equal(await phoneTile.getByRole('button', { name: '隐藏手机' }).getAttribute('aria-pressed'), 'true');
  await phoneTile.getByText(/30 秒后隐藏|29 秒后隐藏/).waitFor();
  await phoneTile.getByRole('button', { name: '复制手机' }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '139-1234-5781', '查看后复制明文');
  await phoneTile.getByRole('button', { name: '隐藏手机' }).click();
  await phoneTile.getByText('139-****-5781').waitFor();
  // 换记录：查看过的明文不跟到下一条；还在路上的查看结果也不落到下一条
  const phoneOf = (name) => page.getByRole('dialog', { name }).getByRole('region', { name: '客户资料' }).locator('.aui-rfield').filter({ hasText: '手机' });
  await phoneTile.getByRole('button', { name: '查看手机（会被记录）' }).click();
  await phoneTile.getByText('139-1234-5781').waitFor();
  await rec.getByRole('button', { name: /^下一条/ }).click();
  const other = phoneOf('王美玲（徐汇公寓）');
  await other.getByText('136-****-2456').waitFor();
  assert.equal(await page.getByRole('dialog').getByText('139-1234-5781').count(), 0, '下一条不显示上一条的明文');
  assert.equal(await other.getByRole('button', { name: '查看手机（会被记录）' }).getAttribute('aria-pressed'), 'false', '下一条的手机是打码状态');
  await page.getByRole('dialog', { name: '王美玲（徐汇公寓）' }).getByRole('button', { name: /^上一条/ }).click();
  await phoneTile.getByText('139-****-5781').waitFor();
  await phoneTile.getByRole('button', { name: '查看手机（会被记录）' }).click();
  await rec.getByRole('button', { name: /^下一条/ }).click();
  await other.getByText('136-****-2456').waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole('dialog').getByText(/139-1234-5781|136-2222-2456/).count(), 0, '切走前发出的查看，结果不落到另一条');
  assert.ok(await other.getByText('136-****-2456').isVisible(), '仍是打码');
  assert.equal(await other.getByRole('button', { name: '查看手机（会被记录）' }).isDisabled(), false, '不卡在加载中');
  await page.getByRole('dialog', { name: '王美玲（徐汇公寓）' }).getByRole('button', { name: /^上一条/ }).click();
  await phoneTile.getByText('139-****-5781').waitFor();
  // 一个方块多个按钮
  const nextTile = profile.locator('.aui-rfield').filter({ hasText: '下次跟进' });
  await nextTile.getByRole('button', { name: '提醒我（下次跟进）' }).click();
  await page.getByText('到时提醒你').waitFor();
  assert.ok(await rec.isVisible(), '方块按钮不关详情');
  // 子表区块
  const sub = rec.getByRole('region', { name: '跟进记录' });
  assert.equal(await sub.locator('tbody tr').count(), 4);
  assert.match(await sub.locator('.aui-subtable-foot').innerText(), /共 9 条，显示最近 4 条/);
  const colsButton = sub.getByRole('button', { name: '显示列' });
  await colsButton.click();
  const colsPanel = page.getByRole('dialog', { name: '显示列' });
  await colsPanel.waitFor();
  assert.equal(await colsPanel.getByRole('checkbox').first().isDisabled(), true, '第一列固定');
  const headCount = () => sub.locator('thead th').count();
  const before = await headCount();
  await colsPanel.getByRole('checkbox').last().click();
  assert.equal(await headCount(), before - 1, '去掉「下一步」列');
  await page.keyboard.press('Escape');
  await colsPanel.waitFor({ state: 'detached' });
  assert.equal(await focused(), '显示列');
  assert.ok(await rec.isVisible(), 'Esc 只关列面板');
  await sub.getByRole('button', { name: '在表格中打开' }).click();
  await page.getByText('打开「跟进记录」表，筛选到这个客户').waitFor();

  // R5 评论
  const thread = rec.getByRole('region', { name: '评论' });
  const articles = thread.getByRole('article');
  // 默认「未解决」，已解决的不显示；「全部」里已解决的收成一行灰条
  const filters = thread.getByRole('group', { name: '评论筛选' });
  assert.equal(await filters.getByRole('button', { name: /^未解决/ }).getAttribute('aria-pressed'), 'true', '默认未解决');
  assert.equal(await articles.count(), 5, '3 条没解决的 + 2 条回复');
  assert.equal(await thread.locator('.aui-comment-at').first().innerText(), '@小王');
  await filters.getByRole('button', { name: '全部' }).click();
  assert.equal(await articles.count(), 5, '已解决的收成一行，不是一条评论');
  assert.match(await thread.locator('.aui-comment-folded').innerText(), /已解决[\s\S]*客户电话已核实/);
  // 图片附件 → 大图预览
  await thread.getByRole('button', { name: '查看 样品间-客厅.jpg' }).click();
  const viewer = page.getByRole('dialog', { name: '样品间-客厅.jpg' });
  await viewer.waitFor();
  await page.keyboard.press('Escape');
  await viewer.waitFor({ state: 'detached' });
  // @ 补全
  const box1 = thread.getByRole('combobox', { name: '写评论' });
  await box1.click();
  await page.keyboard.type('@阿');
  const mentions = page.getByRole('listbox', { name: '提到同事' });
  await mentions.waitFor();
  assert.equal(await mentions.getByRole('option').count(), 1);
  // @ 弹层开在输入框上方（审阅 07：往下开会盖住下面的子表）；上面放不下才往下
  const geo = await page.evaluate(() => {
    const layer = document.querySelector('.aui-suggest').getBoundingClientRect();
    const box = document.querySelector('.aui-comment-composer').getBoundingClientRect();
    return { layerTop: layer.top, layerBottom: layer.bottom, boxTop: box.top, boxBottom: box.bottom, height: layer.height };
  });
  if (geo.boxTop - 12 >= geo.height) assert.ok(geo.layerBottom <= geo.boxTop + 0.5, `@ 弹层应在输入框上方 ${JSON.stringify(geo)}`);
  else assert.ok(geo.layerTop >= geo.boxBottom - 0.5, `上面放不下就开在下面 ${JSON.stringify(geo)}`);
  await page.keyboard.press('Enter');
  assert.equal(await box1.inputValue(), '@阿明 ');
  await mentions.waitFor({ state: 'detached' });
  await page.keyboard.type('周六能一起去看配电箱吗');
  await shot('record-detail-composer');
  await page.keyboard.press('Control+Enter');
  await thread.getByRole('article').filter({ hasText: '周六能一起去看配电箱吗' }).waitFor();
  await until(async () => (await box1.inputValue()) === '', '发送后清空');
  assert.equal(await articles.count(), 6);
  assert.equal(await articles.first().locator('.aui-comment-at').innerText(), '@阿明', '新评论里的提到高亮');
  // 发送失败保留文字
  await box1.fill('这条会失败');
  await thread.getByRole('button', { name: '发送' }).click();
  await thread.getByRole('alert').filter({ hasText: '发送失败' }).waitFor();
  assert.equal(await box1.inputValue(), '这条会失败');
  await box1.fill('');
  // 回复、回应、解决
  await thread.getByRole('article', { name: '陈主管 的评论' }).hover();
  await thread.getByRole('article', { name: '陈主管 的评论' }).getByRole('button', { name: '回复' }).click();
  const replyBox = thread.getByRole('combobox', { name: '回复 陈主管' });
  assert.equal(await focused(), '回复 陈主管', '点回复后焦点在输入框');
  await replyBox.fill('好的，按 6% 报');
  await page.keyboard.press('Control+Enter');
  await thread.getByRole('article').filter({ hasText: '好的，按 6% 报' }).waitFor();
  assert.equal(await thread.getByRole('article').filter({ hasText: '好的，按 6% 报' }).getAttribute('data-reply'), 'true');
  const chen = thread.getByRole('article', { name: '陈主管 的评论' });
  await chen.hover();
  await chen.getByRole('button', { name: /^回应/ }).click();
  const picker = page.getByRole('dialog', { name: /^回应/ });
  assert.deepEqual(await picker.getByRole('button').allInnerTexts(), ['赞', '收到', '看过', '有疑问'], '回应固定 4 种');
  await picker.getByRole('button', { name: '赞' }).click();
  assert.equal(await chen.getByRole('button', { name: '赞 1' }).getAttribute('aria-pressed'), 'true');
  await chen.hover();
  await chen.getByRole('button', { name: '解决' }).click();
  // 「全部」里解决后收成一行，点开看、可重新打开
  await thread.locator('.aui-comment-folded').filter({ hasText: '陈主管' }).click();
  await chen.getByText('已解决 · 小B').waitFor();
  await chen.hover();
  await chen.getByRole('button', { name: '重新打开' }).click();

  // 编辑 / 删除自己的评论：「⋯」只给自己的，编辑就地复用输入框，Esc 取消，Ctrl + Enter 保存，删除先确认
  const MORE = '更多操作（小B的评论）';
  const mine = thread.getByRole('article', { name: '小B 的评论' }).filter({ hasText: '报价单 v1' });
  await mine.locator('.aui-comment-edited').filter({ hasText: '已编辑' }).waitFor();
  assert.match(await mine.locator('.aui-comment-edited').getAttribute('data-tip'), /^编辑于 /, '「已编辑」带编辑时间');
  assert.equal(await chen.getByRole('button', { name: /^更多操作/ }).count(), 0, '别人的评论没有「⋯」');
  await mine.hover();
  await mine.getByRole('button', { name: MORE }).click();
  const moreMenu = page.getByRole('menu', { name: MORE });
  await moreMenu.waitFor();
  assert.deepEqual((await moreMenu.getByRole('menuitem').allInnerTexts()).map((t) => t.trim()), ['编辑', '删除']);
  await moreMenu.getByRole('menuitem', { name: '编辑' }).click();
  const editBox = thread.getByRole('combobox', { name: '编辑评论' });
  await until(async () => (await focused()) === '编辑评论', '进入编辑后焦点在输入框');
  assert.equal(await editBox.inputValue(), '报价单 v1 已发给客户，@陈主管 帮忙看下折扣');
  assert.equal(await mine.getByRole('button', { name: '保存', exact: true }).isDisabled(), true, '没改不能保存');
  assert.ok(await mine.getByRole('button', { name: '添加图片' }).isVisible(), '编辑时也能加附件');
  assert.equal(await mine.getByRole('button', { name: '回复' }).count(), 0, '编辑时收起操作行');
  assert.equal(await editBox.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby'))?.textContent), 'Ctrl + Enter 保存，Esc 取消', '读屏告诉快捷键');
  await page.keyboard.type('吧');
  await noOverflow('编辑中的评论区（1440）', thread);
  const sideOver = await thread.evaluate((el) => {
    const out = [];
    for (let node = el; node && !node.classList.contains('aui-dialog'); node = node.parentElement) if (node.scrollWidth - node.clientWidth > 1 && getComputedStyle(node).overflowX !== 'visible') out.push(`${node.className}: ${node.scrollWidth - node.clientWidth}px`);
    return out;
  });
  assert.deepEqual(sideOver, [], '编辑时右栏不横向滚动');
  await shot('comment-edit');
  await page.keyboard.press('Escape');
  await editBox.waitFor({ state: 'detached' });
  assert.ok(await rec.isVisible(), 'Esc 只取消编辑，不关详情');
  assert.match(await mine.locator('.aui-comment-text').innerText(), /帮忙看下折扣$/, '取消后文字不变');
  await until(async () => (await focused()) === MORE, '取消后焦点回「⋯」');
  // 键盘进编辑：↓ 打开菜单，回车选「编辑」；@ 补全照常；保存失败留在编辑态
  await page.keyboard.press('ArrowDown');
  await moreMenu.waitFor();
  await page.keyboard.press('Enter');
  await until(async () => (await focused()) === '编辑评论', '键盘进入编辑');
  await page.keyboard.type('，@阿');
  await mentions.waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await editBox.inputValue(), '报价单 v1 已发给客户，@陈主管 帮忙看下折扣，@阿明 ');
  await page.keyboard.type('失败');
  await page.keyboard.press('Control+Enter');
  await mine.getByRole('alert').filter({ hasText: '保存失败' }).waitFor();
  assert.match(await editBox.inputValue(), /@阿明 失败$/, '失败后文字还在');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('一起看');
  await page.keyboard.press('Control+Enter');
  await editBox.waitFor({ state: 'detached' });
  assert.match(await mine.locator('.aui-comment-text').innerText(), /@阿明 一起看$/);
  assert.deepEqual(await mine.locator('.aui-comment-at').allInnerTexts(), ['@陈主管', '@阿明'], '新提到的人也高亮');
  await until(async () => (await focused()) === MORE, '保存后焦点回「⋯」');
  assert.equal(await thread.getByRole('status').innerText(), '评论已保存');
  // 删除：先确认（Esc 不删），没回复的整条去掉，焦点到输入框
  const sent = thread.getByRole('article').filter({ hasText: '周六能一起去看配电箱吗' });
  await sent.hover();
  await sent.getByRole('button', { name: MORE }).click();
  await moreMenu.getByRole('menuitem', { name: '删除' }).click();
  // 删除是小气泡确认，不是大弹框
  const confirmDelete = page.getByRole('dialog', { name: '删掉这条评论？' });
  await confirmDelete.waitFor();
  assert.match(await confirmDelete.innerText(), /删除后不能恢复。/);
  await shot('comment-delete-confirm');
  await page.keyboard.press('Escape');
  await confirmDelete.waitFor({ state: 'detached' });
  assert.ok(await rec.isVisible(), 'Esc 只关确认框');
  assert.equal(await sent.count(), 1, '取消后没删');
  await sent.hover();
  await sent.getByRole('button', { name: MORE }).click();
  await moreMenu.getByRole('menuitem', { name: '删除' }).click();
  await confirmDelete.getByRole('button', { name: '删除', exact: true }).click();
  await confirmDelete.waitFor({ state: 'detached' });
  await until(async () => (await sent.count()) === 0, '删掉了');
  await until(async () => (await focused()) === '写评论', '删除后焦点到输入框');
  assert.equal(await thread.getByRole('status').innerText(), '评论已删除');
  // 有回复的删除：留「评论已删除」墓碑，回复还在
  await mine.hover();
  await mine.getByRole('button', { name: MORE }).click();
  await moreMenu.getByRole('menuitem', { name: '删除' }).click();
  await confirmDelete.waitFor();
  assert.match(await confirmDelete.innerText(), /回复会留着/);
  await confirmDelete.getByRole('button', { name: '删除', exact: true }).click();
  const tomb = thread.getByRole('article', { name: '已删除的评论' });
  await tomb.waitFor();
  assert.equal((await tomb.innerText()).trim(), '评论已删除');
  assert.equal(await tomb.getByRole('button').count(), 0, '墓碑没有操作');
  assert.ok(await thread.getByText('收到，明天给意见').isVisible(), '回复保留');
  await shot('record-detail');
  await noOverflow('记录详情（1440）', rec.locator('.aui-dialog-body'));
  await page.keyboard.press('Escape');
  await rec.waitFor({ state: 'detached' });

  // ================================================================ 深色
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await area.getByRole('button', { name: '新建字段' }).click();
  await dlg.waitFor();
  await shot('field-dialog-dark');
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
  await area.getByRole('button', { name: '打开 李承恩（滨江豪宅）' }).click();
  await rec.waitFor();
  await shot('record-detail-dark');
  await checkFlatRecord(rec, '记录详情深色');
  const myReply = rec.getByRole('article').filter({ hasText: '好的，按 6% 报' });
  await myReply.hover();
  await myReply.getByRole('button', { name: '更多操作（小B的评论）' }).click();
  await page.getByRole('menu', { name: '更多操作（小B的评论）' }).getByRole('menuitem', { name: '编辑' }).click();
  await rec.getByRole('combobox', { name: '编辑评论' }).waitFor();
  await myReply.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot('comment-edit-dark');
  await page.keyboard.press('Escape');
  await rec.getByRole('combobox', { name: '编辑评论' }).waitFor({ state: 'detached' });
  // 深色下留痕胶囊、提到高亮的对比度
  const contrast = await rec.evaluate((root) => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const ratio = (el) => { const s = getComputedStyle(el); const a = lum(s.color); let bgEl = el; let bg = getComputedStyle(bgEl).backgroundColor; while (/rgba\(.*, 0\)|transparent/.test(bg) && bgEl.parentElement) { bgEl = bgEl.parentElement; bg = getComputedStyle(bgEl).backgroundColor; } const b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    return { pill: ratio(root.querySelector('.aui-hidden-fields')), at: ratio(root.querySelector('.aui-comment-at')) };
  });
  assert.ok(contrast.pill >= 4.5 && contrast.at >= 4.5, `深色对比度 ${JSON.stringify(contrast)}`);
  await page.keyboard.press('Escape');
  await rec.waitFor({ state: 'detached' });

  // ================================================================ D13 表格权限
  await openPage('表格权限');
  const ta = page.locator('#aui-page-tableaccess .aui-taccess');
  await ta.waitFor();
  await shot('table-access-dark');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  const impact = ta.locator('.aui-taccess-impact');
  assert.match(await impact.innerText(), /保存后：技术部 6 人里 6 人会多看到 41 条/);
  await ta.getByRole('button', { name: '看每个人的变化' }).click();
  await ta.getByRole('region', { name: '影响预览' }).waitFor();
  assert.ok(await ta.getByRole('cell', { name: '阿明' }).isVisible());
  await ta.getByRole('button', { name: '收起每个人的变化' }).click();
  const roles = ta.getByRole('navigation', { name: '角色' });
  assert.equal(await roles.getByRole('button').filter({ hasText: '技术' }).getAttribute('aria-current'), 'true');
  assert.equal(await roles.getByRole('img', { name: '有没保存的改动' }).count(), 2, '技术（当前，有改动）和销售都有黄点');
  // 记录范围：按条件 → 条件编辑器；方向键换档
  const tiers = ta.getByRole('group', { name: '记录范围' });
  assert.ok(await tiers.getByRole('radio', { name: /按条件/ }).isChecked());
  await ta.getByRole('group', { name: '条件', exact: true }).waitFor();
  assert.equal(await ta.getByRole('group', { name: '条件', exact: true }).locator('li').count(), 2);
  await tiers.getByRole('radio', { name: /按条件/ }).focus();
  await page.keyboard.press('ArrowUp');
  assert.ok(await tiers.getByRole('radio', { name: /本业务线全部/ }).isChecked(), '↑ 换到上一档');
  assert.equal(await ta.getByRole('group', { name: '条件', exact: true }).count(), 0);
  await page.keyboard.press('ArrowDown');
  await ta.getByRole('group', { name: '条件', exact: true }).waitFor();
  // 能做的操作
  const acts = ta.getByRole('group', { name: '能做的操作' });
  assert.deepEqual(await acts.getByRole('checkbox').evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked'))), ['true', 'false', 'true', 'false', 'false']);
  await acts.getByRole('checkbox').nth(4).click();
  assert.equal(await acts.getByRole('checkbox').nth(4).getAttribute('aria-checked'), 'true');
  // 字段矩阵
  const matrix = ta.getByRole('table', { name: '技术的字段权限' });
  const head = () => matrix.locator('thead th').nth(1).innerText();
  assert.match(await head(), /11 \/ 15/);
  assert.equal(await matrix.getByRole('checkbox', { name: '客户名称 可读' }).isDisabled(), true, '主字段始终可见');
  assert.match(await matrix.getByRole('row', { name: /客户名称/ }).innerText(), /始终可见/);
  assert.match(await matrix.getByRole('row', { name: /预计金额/ }).innerText(), /技术看不到/);
  assert.equal(await matrix.getByRole('checkbox', { name: '客户质量 可读' }).isDisabled(), true, '别人加的字段锁住');
  assert.match(await matrix.getByRole('row', { name: /客户质量/ }).innerText(), /运营专用，小B 加的/);
  assert.equal(await matrix.getByRole('checkbox', { name: '阶段 打码' }).count(), 0, '不敏感的字段没有打码格');
  await matrix.getByRole('checkbox', { name: '预计金额 可导出' }).click();
  assert.equal(await matrix.getByRole('checkbox', { name: '预计金额 可读' }).getAttribute('aria-checked'), 'true', '勾导出自动带上读');
  assert.match(await head(), /12 \/ 15/);
  await ta.getByRole('group', { name: '显示哪些字段' }).getByRole('button', { name: '看不到的' }).click();
  assert.equal(await matrix.locator('tbody tr').count(), 3, '成交价、客户质量、运营备注');
  await ta.getByRole('group', { name: '显示哪些字段' }).getByRole('button', { name: '全部' }).click();
  await shot('table-access');
  await noOverflow('表格权限（1440）');
  // 保存：确认弹框列出改动；放弃改动
  const save = ta.getByRole('button', { name: /^保存（\d+ 处改动）$/ });
  await save.click();
  const confirm = page.getByRole('dialog', { name: '保存「技术」在客户表上的权限' });
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /记录范围[\s\S]*本部门[\s\S]*按条件/);
  assert.match(await confirm.innerText(), /字段「预计金额」/);
  await page.keyboard.press('Escape');
  await confirm.waitFor({ state: 'detached' });
  await ta.getByRole('button', { name: '放弃改动' }).click();
  await impact.waitFor({ state: 'detached' });
  assert.equal(await ta.getByRole('button', { name: '保存', exact: true }).isDisabled(), true, '没改动时保存变灰');
  assert.equal(await roles.getByRole('img', { name: '有没保存的改动' }).count(), 1);

  // ================================================================ 手机 390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow('表格权限 390');
  await shot('table-access-390', true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPage('记录与字段');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow('记录与字段 390');
  await area.getByRole('button', { name: '新建字段' }).click();
  await dlg.waitFor();
  await page.waitForTimeout(250);
  await noOverflow('新建字段弹框 390', dlg.locator('.aui-dialog-body'));
  const mainBox = await box(dlg.locator('.aui-fdlg-main'));
  const asideBox = await box(dlg.locator('.aui-fdlg-aside'));
  assert.ok(asideBox.top >= mainBox.bottom - 1, '手机上右栏移到下面');
  const tile = await box(dlg.getByRole('radio', { name: '文本', exact: true }));
  assert.ok(tile.height >= 40, `手机上类型格子 ≥ 40px：${tile.height}`);
  await shot('field-dialog-390');
  await dlg.locator('.aui-fdlg-aside').scrollIntoViewIfNeeded();
  await shot('field-dialog-390-aside');
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
  await area.getByRole('button', { name: '打开 李承恩（滨江豪宅）' }).click();
  await rec.waitFor();
  await page.waitForTimeout(250);
  const recBox = await box(rec);
  assert.ok(recBox.width >= 389, '手机上记录详情全屏');
  await noOverflow('记录详情 390', rec.locator('.aui-dialog-body'));
  await checkFlatRecord(rec, '记录详情 390');
  {
    // 手机：字段名在值上面，点值就地编辑，编辑框不超出屏幕
    const amount = rec.locator('.aui-rfield').filter({ has: page.locator('.aui-rfield-label', { hasText: /^预计金额$/ }) });
    const lab = await box(amount.locator('.aui-rfield-label'));
    const val = await box(amount.locator('.aui-rfield-value'));
    assert.ok(val.top >= lab.bottom - 1, `手机上字段名在上、值在下 ${JSON.stringify({ lab, val })}`);
    await amount.locator('.aui-rfield-value').click();
    const inp = amount.locator('.aui-rfield-value input');
    await inp.waitFor();
    const ib = await box(inp);
    assert.ok(ib.left >= 0 && ib.right <= 390, `手机上编辑框不出屏：${JSON.stringify(ib)}`);
    await shot('record-list-edit-390');
    await page.keyboard.press('Escape');
    await inp.waitFor({ state: 'detached' });
  }
  await shot('record-detail-390');
  await rec.getByRole('region', { name: '评论' }).scrollIntoViewIfNeeded();
  await shot('record-detail-390-comments');
  const replyMore = rec.getByRole('article').filter({ hasText: '好的，按 6% 报' }).getByRole('button', { name: '更多操作（小B的评论）' });
  const moreBox = await box(replyMore);
  assert.ok(moreBox.width >= 32 && moreBox.height >= 32, `手机上「⋯」≥ 32px：${moreBox.width}×${moreBox.height}`);
  await replyMore.click();
  await page.getByRole('menu', { name: '更多操作（小B的评论）' }).getByRole('menuitem', { name: '编辑' }).click();
  const editBox390 = rec.getByRole('combobox', { name: '编辑评论' });
  await editBox390.waitFor();
  await page.waitForTimeout(150);
  await noOverflow('评论编辑 390', rec.locator('.aui-dialog-body'));
  await editBox390.scrollIntoViewIfNeeded();
  await shot('comment-edit-390');
  await page.keyboard.press('Escape');
  await editBox390.waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');

  // bt/flush: TableAccessPanel straight in a workspace Pane: the three rounded cards become columns split by one line,
  // the toolbar gets a bottom line, the impact banner keeps 16px (12 on phones) from the pane edges.
  await checkFlushSection(browser, server.resolvedUrls.local[0], '表格权限', output, 'table-access', async (p, area, { width, label }) => {
    const pane = area.locator('.aui-tabbed-panel:not([hidden]) .aui-pane[aria-label="表格权限"]');
    const box = await edges(pane);
    const inset = width > 760 ? 16 : 12;
    const [roles, scope, fields] = await Promise.all(['.aui-taccess-roles', '.aui-taccess-scope', '.aui-taccess-fields'].map((s) => edges(pane.locator(s))));
    for (const [name, b] of [['角色', roles], ['记录范围', scope], ['字段权限', fields]]) assert.ok(b.radius === 0 && b.shadow === 'none', `${label}：${name}不再是圆角卡片`);
    if (width > 1180) {
      assert.ok(roles.x === box.ix && roles.right === scope.x && scope.right === fields.x && fields.right === box.iright, `${label}：三栏贴着排、贴着栏边（${roles.x} | ${scope.x} | ${fields.x} | ${fields.right}）`);
      assert.ok(roles.bl === 0 && scope.bl === 1 && fields.bl === 1, `${label}：栏与栏之间一条线`);
      assert.ok(roles.h === scope.h && scope.h === fields.h, `${label}：三栏一样高，分隔线到底`);
    } else {
      assert.ok(roles.x === box.ix && roles.right === box.iright, `${label}：手机上角色条贴边`);
    }
    const bar = await edges(pane.locator('.aui-taccess-bar'));
    assert.ok(bar.pl === inset && bar.bb === 1, `${label}：工具行留 ${inset}px、下面一条线`);
    const impact = await edges(pane.locator('.aui-taccess-impact'));
    assert.ok(impact.x - box.ix === inset && box.iright - impact.right === inset, `${label}：改动提示条离栏边 ${inset}px（左 ${impact.x - box.ix}，右 ${box.iright - impact.right}）`);
  });

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS records (${output}): FieldTypePicker (29 tiles, dashed later, roving 2-D keys, search), OptionsEditor (Enter adds, Backspace removes, Alt+arrows, 10 tones, duplicates), FieldDialog (1120 with aside, validation, failure keeps input, 390 stacks), GrantList picked (locked chips, levels, combobox add/Esc/remove focus, audience banners) + list mode, SensitiveValue audited reveal + re-mask countdown + denied, record detail hidden-fields pill / reveal+call+copy / multiple tile actions / SubTableSection columns panel, CommentThread (@ autocomplete, Ctrl+Enter, failure keeps text, reply, reaction menu, resolve, only-unresolved, lightbox, own-comment menu, inline edit with @ / Esc cancel / Ctrl+Enter save / failure keeps text / focus return, edited marker, delete confirm + removal + tombstone keeps replies), TableAccessPanel (impact + RuleImpactView, dirty dots, tiers + CondBuilder + arrows, action chips, field matrix counts/tags/locks/filter, confirm ChangeList, discard), dark contrast, 390 no overflow, TableAccessPanel flush in a workspace Pane (columns split by one line, inset banner) 1440 light / dark / 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
