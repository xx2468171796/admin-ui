// 协作与审批浏览器验收（样稿 comments + approval）：
// starter「系统 → 协作与分享」：评论栏自己滚、输入框贴底；默认「未解决」，「全部」里已解决收成一行可展开；回应 4 种（图标 + 字）+ 谁点的；
// 悬停 / 聚焦才出行内小工具、手机常显；提到我 = 实底；回复折叠「展开 N 条回复」；@ 弹层往上开、看不到的人灰掉不能选；删除小气泡 → 墓碑；
// 知识库式划词引用（原文已删除）、activeId / onSelect；ChangeValue 旧值删除线 + 新值加粗。
// 「系统 → 审批」：列表分段 / 待我审批数 / 两行行高、详情只有一个实心主按钮、驳回必须写原因、批准推进到下一级、撤回、进度卡；
// 1440 浅 / 深色、390（列表 → 详情、小工具常显）不横向溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/collab');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const noOverflow = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));
const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage });
const errors = [];
const open = async (page, name) => {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await open(page, '协作与分享');
  const thread = page.getByRole('region', { name: '评论', exact: true });
  await thread.waitFor();

  // ---- 标题行：评论 N + 分段，默认「未解决」；已解决的不显示
  const seg = thread.getByRole('group', { name: '评论筛选' });
  assert.equal(await seg.getByRole('button', { name: /^未解决 \d+$/ }).getAttribute('aria-pressed'), 'true', '默认未解决');
  assert.equal(await seg.getByRole('button', { name: '@我 1' }).count(), 1, '@我 计数（提到小王的一条）');
  assert.equal(await thread.getByText('客户电话已核实').count(), 0, '已解决的默认不显示');
  assert.ok(await thread.locator('.aui-comments-day').filter({ hasText: /^今天 / }).count() >= 1, '日分隔「今天 …」');

  // ---- 列表自己滚、输入框贴底
  const geo = await thread.evaluate((el) => {
    const list = el.querySelector('.aui-comments-list').getBoundingClientRect();
    const foot = el.querySelector('.aui-comments-foot').getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const l = el.querySelector('.aui-comments-list');
    return { scrolls: l.scrollHeight > l.clientHeight, footBottom: Math.round(box.bottom - foot.bottom), footBelowList: foot.top >= list.bottom - 1 };
  });
  assert.ok(geo.scrolls && geo.footBelowList && geo.footBottom <= 2, `列表自己滚、输入框贴底 ${JSON.stringify(geo)}`);

  // ---- 提到我 = 主色实底；回应胶囊 = 图标 + 字 + 数，悬停说是谁
  const zhou = thread.getByRole('article', { name: '周组长 的评论' });
  assert.equal(await zhou.locator('.aui-comment-at[data-me]').innerText(), '@小王');
  const ok = zhou.getByRole('button', { name: '收到 2' });
  assert.equal(await ok.getAttribute('aria-pressed'), 'true');
  assert.equal(await ok.getAttribute('data-tip'), '收到：你、小李');
  assert.match(await ok.innerText(), /收到 2/);

  // ---- 行内小工具：平时看不见，悬停才出
  const tools = zhou.locator('.aui-comment-hover').first();
  assert.equal(await tools.evaluate((el) => getComputedStyle(el).opacity), '0', '不悬停时小工具隐藏');
  await zhou.locator('.aui-comment-text').first().hover();
  await page.waitForTimeout(250);
  assert.equal(await tools.evaluate((el) => getComputedStyle(el).opacity), '1', '悬停时小工具出现');
  await zhou.getByRole('button', { name: '回应周组长的评论' }).click();
  const picker = page.getByRole('dialog', { name: '回应周组长的评论' });
  await picker.waitFor();
  assert.deepEqual(await picker.getByRole('button').allInnerTexts(), ['赞', '收到', '看过', '有疑问'], '回应固定 4 种，不用 emoji');
  await shot(page, 'comments-react-picker');
  await picker.getByRole('button', { name: '有疑问' }).click();
  await zhou.getByRole('button', { name: '有疑问 1' }).waitFor();

  // ---- 回复折叠
  const chen = thread.getByRole('article', { name: '陈主管 的评论' }).first();
  const more = thread.getByRole('button', { name: '展开 2 条回复' });
  await more.waitFor();
  await more.click();
  await thread.getByText('好，按这个出 v3').waitFor();
  assert.ok(await chen.locator('.aui-comment-doc').count() === 1, '文件是小卡片');

  // ---- 「全部」：已解决收成一行，点开看
  await seg.getByRole('button', { name: '全部' }).click();
  const folded = thread.locator('.aui-comment-folded');
  await folded.waitFor();
  assert.match(await folded.innerText(), /已解决[\s\S]*小A：客户电话已核实[\s\S]*小B 解决/);
  await folded.click();
  await thread.getByRole('article', { name: '小A 的评论' }).getByRole('button', { name: '重新打开', includeHidden: true }).waitFor({ state: 'attached' });

  // ---- 回复：输入框上方「回复 X ×」；@ 往上开，看不到的人灰掉
  await thread.getByRole('article', { name: '小李 的评论' }).hover();
  await thread.getByRole('article', { name: '小李 的评论' }).getByRole('button', { name: '回复' }).click();
  await thread.locator('.aui-comment-replying').filter({ hasText: '回复 小李' }).waitFor();
  const box = thread.getByRole('combobox', { name: '回复 小李' });
  await box.fill('@林');
  const list = page.getByRole('listbox', { name: '提到同事' });
  await list.waitFor();
  const [lb, cb] = [await list.boundingBox(), await box.boundingBox()];
  assert.ok(lb.y + lb.height <= cb.y + 2, '@ 弹层往上开');
  assert.equal(await list.getByRole('option', { name: /林宁/ }).getAttribute('aria-disabled'), 'true', '看不到记录的人不能选');
  assert.match(await list.getByRole('option', { name: /林宁/ }).innerText(), /看不到这条记录/);
  await shot(page, 'comments-mention');
  await page.keyboard.press('Enter');
  await box.pressSequentially('库存够');
  await page.keyboard.press('Control+Enter');
  await thread.getByText('@林经理 库存够').waitFor();

  // ---- 删除自己的：小气泡确认 → 墓碑，回复保留
  const mine = thread.getByRole('article', { name: '小王 的评论' }).filter({ hasText: '我先报 9 折' });
  await mine.scrollIntoViewIfNeeded();
  await mine.hover();
  await mine.getByRole('button', { name: /^更多操作/ }).click();
  await page.getByRole('menuitem', { name: '删除' }).click();
  const bubble = page.getByRole('dialog', { name: '删掉这条评论？' });
  await bubble.waitFor();
  assert.match(await bubble.innerText(), /回复会留着/);
  await shot(page, 'comments-delete-bubble');
  await bubble.getByRole('button', { name: '删除' }).click();
  await thread.getByRole('article', { name: '已删除的评论' }).waitFor();
  await thread.getByText('9 折不行，最多 94 折').waitFor();

  // ---- 知识库式：划词引用、原文已删除、activeId / onSelect
  const doc = page.getByRole('region', { name: '页面评论' });
  assert.match(await doc.locator('.aui-comment-quote').first().innerText(), /窗帘电机断网后/);
  assert.equal(await doc.locator('.aui-comment-thread[data-active]').count(), 1);
  await doc.locator('.aui-comment-quote[data-state=orphaned]').waitFor();
  assert.match(await doc.locator('.aui-comment-quote[data-state=orphaned]').innerText(), /原文已删除/);
  await doc.getByText('整页的价格表下个月要换新版').click();
  assert.match(await doc.locator('.aui-comment-thread[data-active]').innerText(), /整页的价格表/, 'onSelect → activeId');

  // ---- ChangeValue
  const change = page.locator('.aui-change-value').filter({ hasText: '¥2,180,000' }).first();
  const cv = await change.evaluate((el) => ({ before: getComputedStyle(el.querySelector('.aui-change-value-before')).textDecorationLine, after: getComputedStyle(el.querySelector('.aui-change-value-after')).fontWeight, sr: el.querySelector('.aui-sr-only').textContent }));
  assert.deepEqual(cv, { before: 'line-through', after: '600', sr: '改成' });
  const empty = await page.locator('.aui-change-value-before[data-empty]').first().evaluate((el) => getComputedStyle(el).textDecorationLine);
  assert.equal(empty, 'none', '「空」不划线');

  await page.evaluate(() => window.scrollTo(0, 0));
  await noOverflow(page, '协作 1440');
  await shot(page, 'collab-1440', true);
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(300);
  await zhou.locator('.aui-comment-text').first().hover();
  await page.waitForTimeout(250);
  await shot(page, 'collab-dark', true);
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();

  // ================================================================ 审批
  await open(page, '审批');
  const listRegion = page.getByRole('region', { name: '审批', exact: true });
  await listRegion.waitFor();
  const scope = listRegion.getByRole('group', { name: '审批范围' });
  assert.equal(await scope.getByRole('button', { name: '待我审批 2' }).getAttribute('aria-pressed'), 'true');
  const rows = listRegion.locator('.aui-approval-row');
  assert.equal(await rows.count(), 2);
  const h = await rows.first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(h >= 56 && h <= 72, `两行行高 ${h}`);
  const detail = page.getByRole('region', { name: '周敏 申请权限「导出客户」' });
  await detail.waitFor();
  assert.match(await detail.locator('.aui-approval-subject').innerText(), /能导出客户表[\s\S]*能看到成交价/);
  assert.equal(await detail.locator('[aria-current=step]').count(), 1, '当前步高亮');
  assert.equal(await page.locator('main .aui-button-primary:visible').count(), 1, '一屏一个实心主按钮（批准）');
  await shot(page, 'approval-1440', true);

  // 驳回必须写原因
  await detail.getByRole('button', { name: '驳回' }).click();
  await detail.getByRole('alert').filter({ hasText: '驳回要写原因，申请人会看到' }).waitFor();
  assert.equal(await detail.getByRole('textbox', { name: '审批意见' }).getAttribute('aria-invalid'), 'true');
  await shot(page, 'approval-reject-required');
  await detail.getByRole('textbox', { name: '审批意见' }).fill('导出要走数据申请单');
  await detail.getByRole('button', { name: '驳回' }).click();
  await detail.locator('.aui-badge').filter({ hasText: '已驳回' }).waitFor();
  assert.match(await detail.locator('.aui-approval-reason').innerText(), /导出要走数据申请单/);
  assert.equal(await detail.getByRole('button', { name: '批准' }).count(), 0, '结束后没有审批按钮');

  // all 模式：批准后还在这一级等财务
  await scope.getByRole('button', { name: '全部' }).click();
  await listRegion.getByRole('button', { name: /报价折扣 12%/ }).click();
  const discount = page.getByRole('region', { name: /^报价折扣 12%/ });
  await discount.getByText('需 2 人都批准').waitFor();
  await discount.getByRole('button', { name: '批准' }).click();
  await discount.getByText(/需 2 人都批准 · 已批 1/).waitFor();
  assert.equal(await discount.locator('.aui-badge').filter({ hasText: '审批中' }).count(), 1, '还要等陈晓');

  // 撤回自己的
  await scope.getByRole('button', { name: '我的申请' }).click();
  await listRegion.getByRole('button', { name: /郑凯 请假 2 天/ }).click();
  const leave = page.getByRole('region', { name: /^郑凯 请假 2 天/ });
  await leave.getByRole('button', { name: '撤回申请' }).click();
  await page.getByRole('dialog', { name: '撤回这条申请？' }).getByRole('button', { name: '撤回' }).click();
  await leave.locator('.aui-badge').filter({ hasText: '已撤回' }).waitFor();

  // 进度卡
  const card = page.getByRole('region', { name: /^审批进度：报价折扣/ });
  assert.match(await card.innerText(), /等 陈晓 审批/);

  await noOverflow(page, '审批 1440');
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, 'approval-dark', true);
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await context.close();

  // ================================================================ 390 手机：小工具常显、列表 → 详情
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const m = await phone.newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  await m.goto(url);
  await m.getByRole('button', { name: '打开菜单' }).click();
  await open(m, '协作与分享');
  const mt = m.getByRole('region', { name: '评论', exact: true });
  await mt.waitFor();
  await m.waitForTimeout(400);
  const mtools = mt.getByRole('article', { name: '周组长 的评论' }).locator('.aui-comment-hover');
  assert.equal(await mtools.evaluate((el) => getComputedStyle(el).opacity), '1', '手机上小工具常显');
  assert.match(await mtools.innerText(), /回应[\s\S]*回复[\s\S]*解决/, '手机是一行小字动作');
  await noOverflow(m, '协作 390');
  await shot(m, 'collab-390', true);
  await m.getByRole('button', { name: '打开菜单' }).click();
  await open(m, '审批');
  await m.getByRole('region', { name: '审批', exact: true }).locator('.aui-approval-row').first().click();
  await m.getByRole('region', { name: '周敏 申请权限「导出客户」' }).waitFor();
  await m.waitForTimeout(400);
  const approve = await m.getByRole('button', { name: '批准' }).boundingBox();
  assert.ok(approve && approve.height >= 40, `手机按钮 ≥ 40：${approve?.height}`);
  await noOverflow(m, '审批 390');
  await shot(m, 'approval-390', true);
  await phone.close();

  assert.deepEqual(errors, [], errors.join('; '));
  console.log(`PASS collab (${output}): CommentThread (default 未解决, @我 count, day separators, own scroll + sticky composer, solid @me, 4 reactions with who, hover-only tools + picker, folded replies, resolved folded line under 全部, reply bar + @ upward + unavailable greyed, delete bubble → tombstone, knowledge quotes / orphaned / activeId+onSelect), ChangeValue (strike + bold, empty not struck), Approval (scopes + todo count, 56px rows, one primary, reject needs reason, all-mode keeps waiting, withdraw, progress card), 1440 light / dark, 390 tools always shown + list → detail`);
} finally {
  await browser.close();
  await server.close();
}
