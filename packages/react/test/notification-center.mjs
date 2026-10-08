// 浏览器验收：starter「系统 → 反馈与弹层」里的通知中心。
// 铃铛角标（未读 + 待我处理，99+ 封顶）、面板 420 宽挂在铃铛下右对齐且整个在视口里、标签切换（方向键）、今天 / 昨天 / 更早、
// 点一条 = 标为已读（圆点没了、角标减一）+ 关面板 + 焦点回铃铛、悬停「标为已读」、加载更多、全部已读、待我处理同意 / 拒绝（原因必填）/
// 失败留在原处 + 行内错误、出错 + 重试、空状态、Esc 焦点回铃铛、不横向溢出、没有原生 title、没有脚本错误。
// 截图 test/artifacts/notification-center/（1440 浅 / 深色、390 整屏），和已审定的样稿截图并排看。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/notification-center');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 6151, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const flat = (text) => text.replace(/\s+/g, '');
const step = (name) => console.log(`  · ${name}`);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name) => page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
  const noOverflow = async (label) => assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${label} 不横向溢出`);

  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '反馈与弹层', exact: true }).click();
  const area = page.locator('#aui-page-overlays #ov-inbox');
  await area.waitFor();
  const topbar = area.locator('[data-demo=topbar]');
  const bell = topbar.locator('.aui-ncenter-bell > button');
  const badge = topbar.locator('.aui-ncenter-badge');
  const panel = page.locator('.aui-ncenter[role=dialog]');
  const items = panel.locator('.aui-ncenter-item');
  const waitList = () => panel.locator('.aui-ncenter-list[aria-busy]').waitFor({ state: 'detached' });
  const openPanel = async () => {
    await bell.click();
    await panel.waitFor();
    await waitList();
  };

  step('bell: red badge = unread + 待我处理, aria-label, 99+ cap');
  assert.equal(await badge.innerText(), '7', '4 条未读 + 3 件待我处理');
  assert.equal(await bell.getAttribute('aria-label'), '通知，4 条未读，3 件待我处理');
  assert.equal(await bell.getAttribute('aria-expanded'), 'false');
  const badgeColor = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
  const danger = await page.evaluate(() => { const probe = document.createElement('span'); probe.style.color = 'var(--aui-danger-fill)'; document.querySelector('.adminui').append(probe); const c = getComputedStyle(probe).color; probe.remove(); return c; });
  assert.equal(badgeColor, danger, '角标红底');
  assert.equal(await area.locator('[data-demo=many] .aui-ncenter-badge').innerText(), '99+', '超过 99 显示 99+');
  // The demo sits low on the 「反馈与弹层」 page: bring the fake top bar to the top so the panel has room below.
  await area.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const bellBox = await box(bell);
  const badgeBox = await box(badge);
  assert.ok(badgeBox.right > bellBox.left + bellBox.width / 2 && badgeBox.top < bellBox.top + 6, '角标在右上');
  assert.equal(Math.round(bellBox.width), 32, '铃铛 32');

  step('panel: 420 wide, under the bell, right-aligned, inside the viewport; first load = skeleton');
  await bell.click();
  await panel.waitFor();
  assert.ok(await panel.locator('.aui-content-skeleton').count(), '首次加载是骨架');
  await waitList();
  assert.equal(await bell.getAttribute('aria-expanded'), 'true');
  const p = await box(panel);
  assert.equal(Math.round(p.width), 420, `宽 420（${p.width}）`);
  assert.ok(Math.abs(p.right - bellBox.right) <= 2, `右对齐铃铛 ${p.right} / ${bellBox.right}`);
  assert.ok(p.top >= bellBox.bottom && p.top - bellBox.bottom <= 8, '挂在铃铛下面');
  assert.ok(p.left >= 0 && p.bottom <= 900 && p.right <= 1440, '整个在视口里');
  assert.ok(p.height <= 621, '最高 620');
  const look = await panel.evaluate((el) => { const s = getComputedStyle(el); return { radius: s.borderTopLeftRadius, shadow: s.boxShadow, border: s.borderTopWidth }; });
  assert.equal(look.radius, '12px');
  assert.notEqual(look.shadow, 'none');
  assert.equal(look.border, '1px');
  assert.equal(await panel.getAttribute('aria-label'), '通知');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('role'));
  assert.equal(focused, 'tab', '打开后焦点在当前标签');

  step('tabs + day groups + item anatomy');
  const tabs = panel.getByRole('tab');
  assert.deepEqual((await tabs.allInnerTexts()).map(flat), ['通知4', '待我处理3'], '标签带数字');
  const days = await panel.locator('.aui-ncenter-day').allInnerTexts();
  assert.deepEqual(days, ['今天', '昨天', '更早']);
  assert.equal(await items.count(), 8, '第一页 8 条');
  const first = items.first();
  assert.equal(await first.getAttribute('data-unread'), 'true');
  assert.equal(await first.locator('.aui-ncenter-kind svg').count(), 1, '头像角上有类型图标');
  assert.match(await first.locator('.aui-ncenter-quote').innerText(), /K7 展示机/);
  assert.match(await first.locator('.aui-ncenter-meta').innerText(), /智能家居客户 · \d+ 分钟前/);
  const dotBox = await box(first.locator('.aui-ncenter-dot'));
  assert.equal(Math.round(dotBox.width), 8, '未读圆点 8px');
  assert.equal(await panel.locator('.aui-ncenter-day').first().evaluate((el) => getComputedStyle(el).fontWeight), '600');
  await page.mouse.move(0, 0);
  await shot('inbox-desktop');

  step('hover: the dot becomes 「标为已读」; clicking it marks read and the badge drops');
  const second = items.nth(1);
  await second.hover();
  const markBtn = second.getByRole('button', { name: '标为已读' });
  assert.equal(await markBtn.evaluate((el) => getComputedStyle(el.parentElement).opacity), '1', '悬停出「标为已读」');
  assert.equal(await second.locator('.aui-ncenter-dot').evaluate((el) => getComputedStyle(el).opacity), '0', '圆点让位');
  await shot('inbox-hover');
  await markBtn.click();
  await page.waitForFunction(() => !document.querySelectorAll('.aui-ncenter-item')[1]?.hasAttribute('data-unread'));
  assert.equal(await badge.innerText(), '6');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('aui-ncenter-main')), true, '焦点留在这一行');

  step('click a row: marks read, closes, focus back on the bell, badge drops');
  await first.locator('.aui-ncenter-main').click();
  await panel.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.aui-ncenter-bell') !== null), true, '焦点回到铃铛');
  await page.waitForFunction(() => document.querySelector('[data-demo=topbar] .aui-ncenter-badge')?.textContent === '5');
  await page.waitForTimeout(300); // both markRead calls resolved: the host count must agree, never bounce back up
  assert.equal(await badge.innerText(), '5');
  assert.equal(await bell.getAttribute('aria-label'), '通知，2 条未读，3 件待我处理');

  step('Esc closes and returns focus to the bell');
  await openPanel();
  assert.equal(await items.first().getAttribute('data-unread'), null, '刚点过的这条已读');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.aui-ncenter-bell') !== null), true, 'Esc 后焦点回铃铛');

  step('加载更多 appends page 2 (deduped)');
  await openPanel();
  const more = panel.getByRole('button', { name: '加载更多' });
  await more.scrollIntoViewIfNeeded();
  await more.click();
  await page.waitForFunction(() => document.querySelectorAll('.aui-ncenter-item').length === 11);
  assert.equal(await panel.getByRole('button', { name: '加载更多' }).count(), 0, '没有下一页就不显示');
  const ids = await items.evaluateAll((els) => els.map((el) => el.textContent));
  assert.equal(new Set(ids).size, 11, '不重复');
  const list = panel.locator('.aui-ncenter-list');
  assert.equal(await list.evaluate((el) => el.scrollWidth - el.clientWidth), 0, '列表不横向溢出');

  step('全部已读: every dot gone, button disabled, badge = 待我处理 only');
  await panel.getByRole('button', { name: '全部已读' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.aui-ncenter-item[data-unread]').length === 0);
  await page.waitForFunction(() => document.querySelector('[data-demo=topbar] .aui-ncenter-badge')?.textContent === '3');
  assert.equal(await panel.getByRole('button', { name: '全部已读' }).isDisabled(), true);

  step('filter 未读 → empty state');
  await panel.getByRole('button', { name: '未读', exact: true }).click();
  await panel.locator('.aui-ncenter-empty').waitFor();
  assert.match(await panel.locator('.aui-ncenter-empty').innerText(), /都看完了/);
  await panel.getByRole('button', { name: '全部', exact: true }).click();
  await panel.locator('.aui-ncenter-item').first().waitFor();

  step('tabs: arrow keys switch to 待我处理, grouped by module');
  await panel.getByRole('tab', { name: /^通知/ }).focus();
  await page.keyboard.press('ArrowRight');
  const inboxTab = panel.getByRole('tab', { name: /待我处理/ });
  assert.equal(await inboxTab.getAttribute('aria-selected'), 'true');
  await waitList();
  assert.deepEqual((await panel.locator('.aui-ncenter-day').allInnerTexts()).map(flat), ['权限申请2', '停用交接1']);
  assert.equal(await panel.locator('.aui-segmented').count(), 0, '待我处理没有筛选');
  await shot('inbox-todo');

  step('approve: loading, then the item leaves and the count drops');
  const zhou = items.filter({ hasText: '周经理' });
  await zhou.getByRole('button', { name: '同意' }).click();
  await zhou.locator('.aui-button[data-loading]').waitFor();
  await zhou.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('[data-demo=topbar] .aui-ncenter-badge')?.textContent === '2');
  assert.match(await inboxTab.innerText(), /待我处理\s*2/);

  step('reject: reason first, required, then the item leaves');
  const cai = items.filter({ hasText: '蔡欣怡' });
  await cai.getByRole('button', { name: '拒绝' }).click();
  const reason = cai.getByRole('textbox', { name: '拒绝的原因' });
  await reason.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'TEXTAREA', '原因框拿到焦点');
  await cai.getByRole('button', { name: '确认拒绝' }).click();
  assert.match(await cai.locator('.aui-ncenter-error').innerText(), /请写拒绝的原因/);
  await shot('inbox-reason');
  await reason.fill('导出要走月底统一流程');
  await cai.getByRole('button', { name: '确认拒绝' }).click();
  await cai.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('[data-demo=topbar] .aui-ncenter-badge')?.textContent === '1');

  step('failure: the item stays with an inline error');
  await page.keyboard.press('Escape');
  await area.getByRole('switch', { name: '模拟加载失败' }).click();
  await bell.click();
  await panel.waitFor();
  const guo = items.filter({ hasText: '郭依琳' });
  await guo.waitFor();
  await guo.getByRole('button', { name: '确认接收' }).click();
  await guo.locator('.aui-ncenter-error').waitFor();
  assert.match(await guo.locator('.aui-ncenter-error').innerText(), /没办成/);
  assert.equal(await guo.count(), 1, '失败的这条还在');
  assert.equal(await badge.innerText(), '1');

  step('error state + 重试 (a list never loaded while the service is down)');
  await panel.getByRole('tab', { name: /^通知/ }).click();
  await panel.getByRole('button', { name: '@我' }).click();
  const errorState = panel.locator('.aui-state-error');
  await errorState.waitFor();
  assert.match(await errorState.innerText(), /通知服务暂时连不上/);
  await errorState.getByRole('button', { name: '重试' }).click();
  await panel.locator('.aui-content-skeleton').waitFor();
  await errorState.waitFor();
  await shot('inbox-error');
  await page.keyboard.press('Escape');
  await area.getByRole('switch', { name: '模拟加载失败' }).click();

  step('empty 待我处理');
  await area.getByRole('switch', { name: '清空待办' }).click();
  await bell.click();
  await panel.waitFor();
  await panel.getByRole('tab', { name: /待我处理/ }).click();
  await panel.locator('.aui-ncenter-empty').waitFor();
  assert.match(await panel.locator('.aui-ncenter-empty').innerText(), /没有要你处理的事/);
  await panel.getByRole('tab', { name: /^通知/ }).click();
  await panel.getByRole('button', { name: '未读', exact: true }).click();
  await panel.locator('.aui-ncenter-empty').waitFor();
  await shot('inbox-empty');
  await panel.getByRole('button', { name: '全部', exact: true }).click();
  await waitList();
  await noOverflow('1440');
  assert.equal(await page.locator('.adminui [title]:not(iframe):not(svg):not(abbr)').count(), 0, '没有原生 title');
  await page.keyboard.press('Escape');
  await area.getByRole('switch', { name: '清空待办' }).click();

  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(150);
  await openPanel();
  await page.mouse.move(0, 0);
  await shot('inbox-dark');
  const elev = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  const surface = await page.evaluate(() => getComputedStyle(document.querySelector('.aui-panel')).backgroundColor);
  assert.notEqual(elev, surface, '深色：弹层比页面亮一档');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  step('390: full-height sheet with 全部已读 + ×');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  await noOverflow('390');
  await bell.scrollIntoViewIfNeeded();
  await openPanel();
  assert.equal(await panel.getAttribute('data-sheet'), 'true');
  await panel.evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)));
  const s = await box(panel);
  assert.ok(s.top <= 1 && Math.round(s.height) >= 843 && Math.round(s.width) === 390, `整屏 ${JSON.stringify(s)}`);
  assert.equal(await panel.locator('.aui-ncenter-head').count(), 0, '手机用底部面板的标题行');
  await panel.locator('.aui-ncenter-item').first().waitFor();
  await shot('inbox-mobile');
  await panel.getByRole('button', { name: '关闭' }).click();
  await panel.waitFor({ state: 'detached' });
  await noOverflow('390 关闭后');

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS notification-center (${output}): badge (sum, red, 99+), 420 panel right-aligned under the bell, skeleton, tabs (arrows), day groups, hover mark-read, click → read + close + focus, Esc focus, load more dedupe, 全部已读, 未读 empty, approve / reject with required reason / failure stays, error + 重试, empty inbox, dark, 390 full-height sheet`);
} finally {
  await browser.close();
  await server.close();
}
