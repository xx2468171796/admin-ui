// bt/views 浏览器验收：starter「视图」页（@adminui/react/views）。
// V1 视图标签（更多、⋯ 菜单）+ 视图管理（三档、必看不能隐藏、眼睛、键盘排序、改名、新建）；
// V3 看板（指针拖动 + 落点 + 变更提示、Esc 取消、键盘 Alt+方向键、失败回滚、收起列、改颜色、加载更多、左右翻页、封面灯箱）；
// V4 画册（卡片五个固定位、不显示字段名、空的不占行、下次跟进今天 / 逾期、字段名开关、密度、灯箱、筛选空状态）；V5 月历（跨周多日条带 ‹、每格 3 行 + 更多、
// 今天主色、休 国庆日 / 班、周末假日浅底、定时事件色点、事件卡、双击开详情、＋新建、拖到另一天、键盘、无日期抽屉拖到某天）；V6 周 / 日（全天 2 行 + 展开、主色现在线、
// 重叠并排、上下拖改时间 / 左右拖换天带预览、拉伸、拖空白新建、事件卡、右键菜单、键盘）；V7 甘特（浅填充条形、主色今天线、条外文字、窗口外小牌、拖动 / 拉伸 / 键盘、刻度、休息日斜纹、
// 分隔条、分组收起、悬停提示）；V8 甘特设置；1440 浅 / 深色、390 手机（看板横滑吸附、月历变日程、甘特变列表）不横向溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { checkFlushSection, edges } from './flush-checks.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/views');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const shot = (name, full = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const live = (scope) => scope.locator('[role=status][aria-live=polite]').first().innerText();
  const drag = async (from, to, steps = 12) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  };
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '视图', exact: true }).click();
  const area = page.locator('#aui-page-views');
  await area.locator('.aui-kanban').waitFor();
  const tabs = area.getByRole('navigation', { name: '视图' });
  const tab = (name) => tabs.getByRole('button', { name, exact: true });
  /** 点一个视图标签；标签栏放不下（右边有仪表盘分组）就从「更多」里选 */
  const openTab = async (name) => {
    if (await tab(name).count()) return tab(name).click();
    await area.getByRole('button', { name: /^更多 \d+/ }).click();
    await page.getByRole('menuitem', { name }).click();
  };

  // ================================================================ V1 视图标签 + 视图管理
  step('V1 view tabs + manager');
  assert.equal(await tab('阶段看板').getAttribute('aria-current'), 'page');
  // 一行；档位记号 = 标准小锁、共享两个人、我的不加；不再有带框的「标准 / 共享」字
  assert.equal(await tab('阶段看板').locator('svg.aui-vtab-tier[data-tier=standard]').count(), 1, '标准视图带小锁');
  assert.equal(await area.locator('.aui-vtabs .aui-vtab[data-tier=mine] .aui-vtab-tier').count(), 0, '我的视图不加记号');
  assert.equal(await area.locator('.aui-vtabs-manage').count(), 1);
  const stripBox = await box(area.locator('.aui-vtabs').first());
  assert.ok(stripBox.height <= 46, `标签栏一行 ${stripBox.height}`);
  assert.ok((await box(area.locator('.aui-vtabs-manage'))).left > (await box(tab('阶段看板'))).left, '「视图」（管理）在右侧');
  const more = area.getByRole('button', { name: /^更多 \d+/ });
  if (await more.count()) {
    await more.click();
    const menu = page.getByRole('menu', { name: /^更多视图/ });
    await menu.waitFor();
    assert.ok(await menu.getByRole('menuitem', { name: '管理视图…' }).isVisible(), '「更多」最下面是「管理视图…」');
    assert.match(await menu.innerText(), /共享视图|我的视图/, '「更多」按档分组');
    await menu.getByRole('menuitem', { name: '我的客户' }).click();
    assert.equal(await tab('我的客户').getAttribute('aria-current'), 'page', '从「更多」选的视图进到标签栏并选中');
    await openTab('阶段看板');
  }
  // ←/→ 在标签间移动焦点
  await tab('阶段看板').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '跟进日历');
  // 当前标签的 ⋯：标准视图的必看不能隐藏
  await area.getByRole('button', { name: '「阶段看板」视图菜单' }).click();
  const tabMenu = page.getByRole('menu', { name: '「阶段看板」视图菜单' });
  await tabMenu.waitFor();
  assert.ok(await tabMenu.getByRole('menuitem', { name: '复制为我的视图' }).isVisible());
  assert.equal(await tabMenu.getByRole('menuitem', { name: /删除视图/ }).count(), 0, '标准视图普通人不能删');
  await page.keyboard.press('Escape');

  await area.getByRole('button', { name: '视图', exact: true }).click();
  const vm = page.getByRole('dialog', { name: '视图管理' });
  await vm.waitFor();
  assert.match(await vm.innerText(), /11 个 · 隐藏 1/);
  for (const tier of ['业务线标准视图', '共享视图', '我的视图']) assert.ok(await vm.getByRole('region', { name: tier, exact: true }).isVisible(), tier);
  assert.match(await vm.getByRole('region', { name: '业务线标准视图' }).innerText(), /林经理维护/);
  // 必看：眼睛不能点
  const mustSee = vm.getByRole('button', { name: '从标签栏隐藏「智能家居 · 全部客户」' });
  assert.equal(await mustSee.getAttribute('aria-disabled'), 'true');
  assert.equal(await mustSee.getAttribute('data-tip'), '必看视图不能隐藏');
  await mustSee.click({ force: true });
  assert.equal(await tab('智能家居 · 全部客户').count(), 1, '必看视图还在标签栏');
  // 隐藏 / 恢复普通视图
  await vm.getByRole('button', { name: '从标签栏隐藏「现场照片」' }).click();
  assert.equal(await tab('现场照片').count(), 0);
  assert.match(await vm.innerText(), /11 个 · 隐藏 2/);
  await vm.getByRole('button', { name: '在标签栏显示「现场照片」' }).click();
  // 我的视图：键盘排序（Alt+↓）
  const mine = vm.getByRole('region', { name: '我的视图', exact: true });
  const order = () => mine.locator('.aui-vm-text').allInnerTexts();
  assert.deepEqual(await order(), ['我的客户', '我的逾期跟进', '上海大户']);
  await mine.getByRole('button', { name: '移动「我的客户」' }).focus();
  await page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual(await order(), ['我的逾期跟进', '我的客户', '上海大户'], 'Alt+↓ 在本档内下移');
  // 标准视图 ⋯：重命名不可用（写原因），我的视图 ⋯：重命名
  await vm.getByRole('button', { name: '「阶段看板」的操作' }).click();
  const stdMenu = page.getByRole('menu', { name: '「阶段看板」的操作' });
  await stdMenu.waitFor();
  assert.equal(await stdMenu.getByRole('menuitem', { name: /重命名/ }).getAttribute('aria-disabled'), 'true');
  assert.match(await stdMenu.getByRole('menuitem', { name: /重命名/ }).innerText(), /业务线标准视图由负责人维护/);
  await page.keyboard.press('Escape');
  await vm.getByRole('button', { name: '「上海大户」的操作' }).click();
  await page.getByRole('menu', { name: '「上海大户」的操作' }).getByRole('menuitem', { name: '重命名' }).click();
  const rename = vm.getByRole('textbox', { name: '视图名称' });
  await rename.fill('上海大户 · 100 万以上');
  await rename.press('Enter');
  assert.ok(await vm.getByText('上海大户 · 100 万以上').isVisible(), '改名生效');
  await shot('view-manager');
  // 7.12.1：从视图管理里删「我的视图」→ 确认框在面板上面、能点（以前压在面板下面点不到）；Esc 只关确认框
  const askDelete = async () => {
    await vm.getByRole('button', { name: '「我的逾期跟进」的操作' }).click();
    await page.getByRole('menu', { name: '「我的逾期跟进」的操作' }).getByRole('menuitem', { name: /删除视图/ }).click();
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /删除视图/ })).first();
    await confirm.waitFor();
    return confirm;
  };
  let confirmBox = await askDelete();
  const button = confirmBox.getByRole('button', { name: '删除视图' });
  const onTop = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return Boolean(hit && el.contains(hit));
  });
  assert.ok(onTop, '确认框的「删除视图」按钮在最上面（没被视图管理面板挡住）');
  await shot('view-manager-delete');
  await page.keyboard.press('Escape');
  await confirmBox.waitFor({ state: 'hidden' });
  assert.ok(await vm.isVisible(), 'Esc 只关确认框，视图管理还开着');
  confirmBox = await askDelete();
  await confirmBox.getByRole('button', { name: '删除视图' }).click();
  await confirmBox.waitFor({ state: 'hidden' });
  assert.ok(await vm.isVisible(), '点确认框不会把视图管理当成「点外面」关掉');
  assert.deepEqual(await order(), ['我的客户', '上海大户 · 100 万以上'], '删掉了');
  // 眼睛悬停才出（必看 / 隐藏的一直在）
  await page.mouse.move(2, 2);
  const eye = vm.getByRole('button', { name: '从标签栏隐藏「本月成交」' });
  assert.equal(await eye.evaluate((el) => (el.closest('.aui-vm-row')?.matches(':focus-within') ? '0' : getComputedStyle(el).opacity)), '0', '眼睛平时不出');
  await eye.hover();
  assert.equal(await eye.evaluate((el) => getComputedStyle(el).opacity), '1', '悬停出眼睛');
  // 新建视图：视图管理底部「新建视图」→ 6 张类型卡 + 名字 + 给谁看
  await vm.getByRole('button', { name: '新建视图' }).click();
  const create = page.getByRole('dialog', { name: '新建视图' });
  await create.waitFor();
  assert.equal(await create.getByRole('radio').count(), 6, '6 张类型卡');
  assert.match(await create.innerText(), /按阶段拖卡片/, '卡片上写一句用途');
  await create.getByRole('radio', { name: /甘特/ }).click();
  const nameBox = create.getByRole('textbox', { name: '视图名称' });
  assert.match(await nameBox.inputValue(), /^甘特/, '默认名字跟着类型');
  await nameBox.fill('二组排期');
  await create.getByRole('button', { name: '共享给一组' }).click();
  await shot('view-create');
  await create.getByRole('button', { name: '建好' }).click();
  await create.waitFor({ state: 'detached' });
  await tab('二组排期').waitFor();
  assert.equal(await tab('二组排期').getAttribute('data-tier'), 'shared', '共享给一组 → 共享视图（两个人）');
  // 双击「我的」视图就地改名
  await openTab('我的客户');
  await tab('我的客户').dblclick();
  const inline = area.getByRole('textbox', { name: '视图名称' });
  await inline.fill('我的客户 A');
  await inline.press('Enter');
  await tab('我的客户 A').waitFor();
  await openTab('阶段看板');

  // ================================================================ V3 看板
  step('V3 kanban');
  await openTab('阶段看板');
  const board = area.locator('.aui-kanban');
  await board.waitFor();
  const col = (key) => board.locator(`section[data-col="${key}"]`);
  const cardIn = (key, id) => col(key).locator(`[data-card-id="${id}"]`);
  assert.equal(await col('__unset').getAttribute('data-collapsed'), '', '未设置列默认收起');
  assert.match(await col('first').getAttribute('aria-label'), /首通，12 条/);
  // 列头：10 色软标签 + 条数 + 金额合计；卡片不显示字段名、没填的不占行
  assert.match(await col('quote').locator('.aui-kanban-sum').innerText(), /¥/, '列头有金额合计');
  assert.equal(await board.locator('.aui-rcard dt:not(.aui-sr-only)').count(), 0, '卡片默认不显示字段名');
  assert.equal(await col('quote').evaluate((el) => getComputedStyle(el).borderTopWidth), '0px', '列无边框');
  assert.equal(await col('won').locator('.aui-kanban-head .aui-chip').getAttribute('data-tone'), 'greenSolid', '成交 = 实心绿（旧 solid）');
  // 指针拖动：李承恩 报价 → 成交，落点 + 变更提示
  await cardIn('quote', 'C1009').scrollIntoViewIfNeeded();
  const lee = await box(cardIn('quote', 'C1009').locator('.aui-rcard-body'));
  const wonList = await box(col('won').locator('.aui-kanban-list'));
  await drag({ x: lee.cx, y: lee.top + 10 }, { x: wonList.cx, y: wonList.top + 60 });
  await page.waitForTimeout(80);
  assert.match(await board.locator('.aui-kanban-slot').innerText(), /松开放到「成交」/);
  assert.equal(await board.locator('.aui-kanban-slot').evaluate((el) => getComputedStyle(el).borderTopStyle), 'dashed', '落点虚线框');
  const hint = page.locator('.aui-kanban-hint');
  assert.match(await hint.innerText(), /阶段：报价 → 成交[\s\S]*Esc 取消/, '底部提示条');
  const hintBox = await box(hint);
  assert.ok(hintBox.bottom > 900 - 60, `提示条在底部 ${JSON.stringify(hintBox)}`);
  assert.equal(await col('won').getAttribute('data-over'), 'true');
  await shot('kanban-drag');
  await page.mouse.up();
  await cardIn('won', 'C1009').waitFor();
  assert.equal(await cardIn('quote', 'C1009').count(), 0);
  assert.equal(await col('won').locator('[data-card-id]').first().getAttribute('data-card-id'), 'C1009', '放在列首');
  // 放下后可撤销
  const undoToast = page.locator('.aui-notices > *').filter({ hasText: '阶段：报价 → 成交' }).first();
  await undoToast.waitFor();
  await undoToast.getByRole('button', { name: /撤销/ }).click();
  await cardIn('quote', 'C1009').waitFor();
  assert.equal(await cardIn('won', 'C1009').count(), 0, '撤销后回到「报价」');
  await page.waitForTimeout(350);
  // 锁住的记录（成交只有主管能换阶段）：标题旁小锁，按住写原因
  const locked = board.locator('[data-card-id]').filter({ hasText: '杨佩珊' }).first();
  assert.equal(await locked.getAttribute('data-locked'), '', '锁住的卡片有小锁');
  const lockedBox = await box(locked.locator('.aui-rcard-body'));
  await page.mouse.move(lockedBox.cx, lockedBox.top + 10);
  await page.mouse.down();
  await page.mouse.up();
  assert.match(await page.locator('.aui-kanban-hint[data-locked]').innerText(), /成交只有主管能换阶段/);
  // Esc 取消拖动
  await cardIn('quote', 'C1008').scrollIntoViewIfNeeded();
  const huang = await box(cardIn('quote', 'C1008').locator('.aui-rcard-body'));
  await drag({ x: huang.cx, y: huang.top + 10 }, { x: wonList.cx, y: wonList.top + 80 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(await cardIn('quote', 'C1008').count(), 1, 'Esc 放回原处');
  assert.equal(await board.locator('.aui-kanban-slot').count(), 0);
  // 键盘：Alt+→ 移到下一列，焦点跟着卡片
  await cardIn('first', 'C1003').getByRole('button', { name: '王美玲', exact: true }).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await cardIn('second', 'C1003').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), '王美玲', '焦点留在移动的卡片上');
  assert.match(await live(board), /阶段：首通 → 二通/);
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForTimeout(350);
  // 失败回滚：郑淑惠不能退回
  await cardIn('won', 'C1010').getByRole('button', { name: '郑淑惠', exact: true }).focus();
  // The optimistic move lasts only until the host rejects (250 ms): watch for it in the page, so a
  // slow machine can't miss the short window between two Playwright polls.
  const sawOptimistic = page.evaluate(() => new Promise((done) => {
    const seen = () => Boolean(document.querySelector('#aui-page-views .aui-kanban section[data-col="quote"] [data-card-id="C1010"]'));
    if (seen()) return done(true);
    const mo = new MutationObserver(() => { if (seen()) { mo.disconnect(); done(true); } });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true });
    setTimeout(() => { mo.disconnect(); done(false); }, 10_000);
  }));
  await page.keyboard.press('Alt+ArrowLeft');
  assert.ok(await sawOptimistic, '先乐观地移到「报价」');
  await cardIn('won', 'C1010').waitFor({ timeout: 5000 });
  await board.locator('[role=status][aria-live=polite]', { hasText: '没有移动成功：演示：郑淑惠已签约' }).first().waitFor({ timeout: 5000 });
  // 右键 / Shift+F10 菜单：移到…
  await cardIn('second', 'C1005').getByRole('button', { name: '蔡依琳', exact: true }).focus();
  await page.waitForTimeout(250); // 聚焦会把卡片滚进列里；菜单遇到滚动会关，等滚动停下
  await page.keyboard.press('Shift+F10');
  const cardMenu = page.getByRole('menu', { name: '「蔡依琳」的操作' });
  await cardMenu.waitFor();
  assert.ok(await cardMenu.getByRole('menuitem', { name: /移到/ }).isVisible());
  // bt/templates：菜单只跟着它所属的卡片——别的列滚动不关，卡片所在的列滚动才关
  await col('first').locator('.aui-kanban-list').evaluate((el) => el.dispatchEvent(new Event('scroll')));
  await page.waitForTimeout(120);
  assert.ok(await cardMenu.isVisible(), '别的列滚动，卡片菜单不关');
  await col('second').locator('.aui-kanban-list').evaluate((el) => el.dispatchEvent(new Event('scroll')));
  await cardMenu.waitFor({ state: 'detached' });
  // 收起的列展开
  await board.getByRole('button', { name: /展开「未设置」列/ }).click();
  assert.equal(await col('__unset').getAttribute('data-collapsed'), null);
  // 列 ⋯：改颜色、收起
  await board.getByRole('button', { name: '「二通」列菜单' }).click();
  await page.getByRole('menu', { name: '「二通」列菜单' }).getByRole('menuitem', { name: '列颜色' }).click();
  const swatch = page.getByRole('dialog', { name: '「二通」的颜色' });
  await swatch.waitFor();
  await swatch.getByRole('radio', { name: '蓝' }).click();
  assert.equal(await col('second').locator('.aui-kanban-head .aui-chip').getAttribute('data-tone'), 'blue');
  await page.keyboard.press('Escape');
  await board.getByRole('button', { name: '「未设置」列菜单' }).click();
  await page.getByRole('menu', { name: '「未设置」列菜单' }).getByRole('menuitem', { name: '收起这一列' }).click();
  assert.equal(await col('__unset').getAttribute('data-collapsed'), '');
  // 加载更多
  const firstCount = await col('first').locator('[data-card-id]').count();
  // 「加载更多」：滚到列底自动加载（按钮留给键盘）
  assert.match(await col('first').locator('.aui-kanban-more').innerText(), /还有 \d+ 条 · 滚到底自动加载|加载中/);
  await col('first').locator('.aui-kanban-list').evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForFunction((n) => document.querySelectorAll('section[data-col="first"] [data-card-id]').length >= n + 3, firstCount);
  // 左右翻页：边缘渐隐 + 按钮
  await board.evaluate((el) => (el.querySelector('.aui-kanban-scroll').scrollLeft = 0));
  await page.waitForTimeout(100);
  const right = board.getByRole('button', { name: '往右翻' });
  await right.waitFor();
  assert.ok(await board.locator('.aui-kanban-fade[data-side=end]').count() === 1);
  await right.click();
  await page.waitForFunction(() => document.querySelector('.aui-kanban-scroll').scrollLeft > 100);
  await board.getByRole('button', { name: '往左翻' }).waitFor();
  await board.evaluate((el) => (el.querySelector('.aui-kanban-scroll').scrollLeft = 0));
  // 看板默认不显示封面；封面 → 灯箱在画册里测
  assert.equal(await board.locator('.aui-rcard-cover').count(), 0, '看板卡片默认没有封面');
  await page.waitForTimeout(200);
  await shot('kanban');
  // 从视图打开记录 = 右侧抽屉：没有遮罩，看板还能点，↑ ↓ 切上下条
  await cardIn('quote', 'C1008').getByRole('button', { name: '黄淑芬', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '黄淑芬' });
  await drawer.waitFor();
  await page.waitForTimeout(450); // 滑入动画
  assert.equal(await page.locator('.aui-dialog-overlay').count(), 0, '抽屉没有遮罩');
  const dBox = await box(drawer);
  assert.ok(Math.abs(dBox.right - 1440) <= 1 && dBox.width <= 641, `右侧 640 抽屉 ${JSON.stringify(dBox)}`);
  assert.match(await drawer.locator('.aui-rframe-count').innerText(), /\d+ \/ \d+ · 阶段看板/);
  assert.equal(await board.locator('[data-card-id="C1008"]').first().getAttribute('data-selected'), 'true', '打开的卡片在视图里高亮');
  await shot('record-drawer');
  await cardIn('quote', 'C1009').getByRole('button', { name: /李承恩/ }).click();
  await page.getByRole('dialog', { name: /李承恩/ }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: '黄淑芬' }).count(), 0, '点别的卡片直接换人');
  const before = await page.locator('.aui-rframe-count').innerText();
  await page.locator('.aui-rframe-bar').getByRole('button', { name: /下一条/ }).click();
  assert.notEqual(await page.locator('.aui-rframe-count').innerText(), before, '↓ 下一条');
  // 三档同一外框：切到居中弹框
  await page.locator('.aui-rframe-bar').getByRole('button', { name: '居中弹框' }).click();
  await page.locator('.aui-dialog-overlay').waitFor();
  await shot('record-dialog');
  await page.locator('.aui-rframe-bar').getByRole('button', { name: '右侧抽屉' }).click();
  await page.keyboard.press('Escape');
  await page.locator('.aui-rframe-bar').waitFor({ state: 'detached' });

  // ================================================================ V4 画册
  step('V4 gallery');
  await openTab('现场照片');
  const gallery = area.locator('.aui-gallery');
  await gallery.waitFor();
  assert.ok((await gallery.locator('.aui-gallery-item').count()) >= 18);
  assert.match(await gallery.locator('.aui-gallery-summary').innerText(), /按「最后跟进」从新到旧/);
  // 审阅 08：没附件 = 中性底 + 图标，不写字、不画插画
  const noCover = gallery.locator('[data-card-id="C1002"] .aui-rcard-nocover');
  assert.equal((await noCover.innerText()).trim(), '', '没附件的封面不写「没有附件」');
  assert.equal(await noCover.locator('svg').count(), 1, '没附件的封面只有一个图标');
  // 卡片五个固定位：不显示字段名、空的不占行（不画「—」）
  const c1 = gallery.locator('[data-card-id="C1001"] .aui-rcard');
  assert.deepEqual(await c1.locator('.aui-rcard-tags .aui-chip').allInnerTexts(), ['首通', '智能门锁', '窗帘'], '标签行 = 阶段 + 产品');
  assert.match(await c1.locator('.aui-rcard-keyline').innerText(), /^¥ ?380,000 · 上海$/, '关键数 = 金额 · 地区');
  assert.equal(await c1.locator('.aui-rcard-keyline > span[data-strong]').count(), 1, '金额加粗');
  assert.match(await c1.locator('.aui-rcard-owner').innerText(), /小王/);
  assert.equal(await c1.locator('.aui-rcard-due').innerText(), '10-08');
  assert.equal(await gallery.locator('.aui-rcard-fields[data-labels], .aui-rcard-field > dt:not(.aui-sr-only)').count(), 0, '默认不显示字段名');
  assert.equal(await gallery.locator('.aui-rcard', { hasText: '—' }).count(), 0, '空字段不画「—」');
  assert.equal(await gallery.locator('[data-card-id="C1006"] .aui-rcard-tags .aui-chip').count(), 2, '刘建宏：阶段 + 网络');
  // 下次跟进：今天 = 注意色、逾期 = 异常色「逾期 N 天」、明天、其余灰
  const due = (id) => gallery.locator(`[data-card-id="${id}"] .aui-rcard-due`);
  assert.equal(await due('C1005').innerText(), '今天');
  assert.equal(await due('C1005').getAttribute('data-tone'), 'attention');
  assert.equal(await due('C1003').innerText(), '逾期 3 天');
  assert.equal(await due('C1003').getAttribute('data-tone'), 'danger');
  assert.equal(await due('C1004').innerText(), '明天');
  assert.equal(await due('C1004').getAttribute('data-tone'), null);
  // 卡片圆角 8、平时没有阴影
  assert.deepEqual(await c1.evaluate((el) => [getComputedStyle(el).borderRadius, getComputedStyle(el).boxShadow]), ['8px', 'none']);
  // 字段名开关：两列对齐
  await gallery.getByRole('switch', { name: '显示字段名' }).click();
  assert.deepEqual(await c1.locator('.aui-rcard-field > dt').allInnerTexts(), ['阶段', '产品', '预计金额', '地区']);
  await shot('gallery-labels');
  await gallery.getByRole('switch', { name: '显示字段名' }).click();
  await gallery.locator('[data-card-id="C1007"]').getByRole('button', { name: /预览/ }).click();
  await page.getByRole('region', { name: /张家豪/ }).waitFor();
  await shot('gallery-lightbox');
  await page.keyboard.press('Escape');
  await gallery.getByRole('button', { name: '紧凑' }).click();
  assert.equal(await gallery.getAttribute('data-density'), 'compact');
  await shot('gallery-compact');
  await gallery.getByRole('button', { name: '常规' }).click();
  // 筛选无结果：写当前筛选 +「清空筛选」
  await gallery.getByRole('button', { name: '看空状态' }).click();
  const emptyState = gallery.locator('.aui-gallery-noresult');
  assert.match(await emptyState.innerText(), /当前筛选：阶段 = 成交 · 地区 = 漠河/);
  await shot('gallery-empty');
  await emptyState.getByRole('button', { name: '清空筛选' }).click();
  assert.ok((await gallery.locator('.aui-gallery-item').count()) >= 18, '清空筛选后卡片回来');
  await c1.hover();
  assert.equal(await c1.locator('.aui-rcard-expand').evaluate((el) => getComputedStyle(el).visibility), 'visible', '悬停出「展开」');
  await shot('gallery');

  // ================================================================ V5 月历
  step('V5 calendar month');
  await openTab('跟进日历');
  const cal = area.locator('.aui-cal[data-mode=month]');
  await cal.waitFor();
  assert.match(await cal.locator('.aui-cal-title').innerText(), /2026 年 10 月/);
  assert.equal(await cal.locator('.aui-cal-weekday').first().innerText(), '周一', '一周从周一开始');
  const primaryColor = await cal.evaluate((el) => { const s = document.createElement('span'); s.style.color = 'var(--aui-primary)'; el.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  const primaryFill = await cal.evaluate((el) => { const s = document.createElement('span'); s.style.color = 'var(--aui-primary-fill)'; el.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  // 跨周多日条：李承恩 安装 10-09 → 10-15 拆成两段，续段带「‹」
  const leeBars = cal.locator('.aui-cal-ev[aria-label^="李承恩（滨江豪宅） · 安装"]');
  assert.equal(await leeBars.count(), 2, '跨周拆成两段');
  assert.match(await leeBars.nth(1).innerText(), /^‹/);
  assert.equal(await leeBars.nth(0).getAttribute('data-cont-after'), 'true');
  assert.notEqual(await leeBars.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', '全天条 = 选项软底');
  // 今天 = 主色圆底数字；假日「休 国庆日」、补班「班」；周末 / 假日浅底
  const day = (d) => cal.locator(`[data-day="${d}"]`);
  assert.match(await day('2026-10-05').innerText(), /今天/);
  assert.equal(await day('2026-10-05').locator('.aui-cal-date').evaluate((el) => getComputedStyle(el).backgroundColor), primaryFill, '今天的数字是主色圆底');
  assert.equal(await day('2026-10-03').locator('.aui-cal-badge').innerText(), '休');
  assert.equal(await day('2026-10-03').locator('.aui-cal-holiday').innerText(), '国庆日', '假日写宿主给的名称');
  assert.equal(await day('2026-10-10').locator('.aui-cal-badge').innerText(), '班');
  const bg = (d) => day(d).evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.notEqual(await bg('2026-10-11'), await bg('2026-10-12'), '周日浅底，周一不着色');
  assert.equal(await bg('2026-10-08'), await bg('2026-10-11'), '假日（周四）和周末同一种浅底');
  // 定时事件 = 色点 + 时间 + 标题，不铺底
  const wuChip = cal.locator('.aui-cal-ev[aria-label^="吴宗翰，"]');
  assert.equal(await wuChip.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', '定时事件不铺底');
  assert.equal(await wuChip.locator('.aui-cal-dot').count(), 1);
  // 每格最多 3 行 +「+N 更多」（另起一行）
  const tops = await cal.locator('.aui-cal-ev').evaluateAll((list) => list.map((el) => parseFloat(el.style.top)));
  assert.ok(tops.every((t) => t <= 30 + 2 * 22), `每格最多 3 行（${[...new Set(tops)].join(',')}）`);
  const moreText = await cal.locator('.aui-cal-more').evaluateAll((list) => list.map((el) => el.textContent));
  assert.ok(moreText.length > 0, '有「+N 更多」');
  await cal.locator('.aui-cal-more').first().click();
  const morePanel = page.getByRole('dialog').filter({ has: page.locator('.aui-cal-morelist') });
  await morePanel.waitFor();
  const moreN = Number(/\+(\d+)/.exec(moreText[0])?.[1]);
  assert.ok((await morePanel.locator('li').count()) > moreN, '弹层列出这天全部');
  await shot('calendar-more');
  await page.keyboard.press('Escape');
  // 点事件出事件卡（主按钮「打开详情」+「清除日期」）；双击直接开详情
  await wuChip.click();
  const evCard = page.getByRole('dialog', { name: '吴宗翰详情' });
  await evCard.waitFor();
  assert.match(await evCard.getByRole('button', { name: '打开详情' }).getAttribute('class'), /aui-button-primary/, '「打开详情」是主按钮');
  assert.ok(await evCard.getByRole('button', { name: '清除日期' }).isVisible());
  await shot('calendar-card');
  await page.keyboard.press('Escape');
  await evCard.waitFor({ state: 'detached' });
  await wuChip.dblclick();
  await page.getByText('打开「吴宗翰」').first().waitFor();
  // 格子右上角 ＋ 就地新建（日期填好）
  await day('2026-10-14').hover({ position: { x: 30, y: 12 } });
  await day('2026-10-14').getByRole('button', { name: /新建/ }).click();
  await page.getByText('新建跟进：2026-10-14').first().waitFor();
  // 拖到另一天：吴宗翰 10-05 → 10-12（保留时间）
  const wu = await box(wuChip);
  const d12 = await box(day('2026-10-12'));
  await drag({ x: wu.cx, y: wu.cy }, { x: d12.cx, y: d12.bottom - 12 });
  assert.match(await day('2026-10-12').innerText(), /放到 10-12/);
  await shot('calendar-drag');
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.match(await wuChip.getAttribute('aria-label'), /2026-10-12 15:00/);
  // 键盘：Alt+→ 推后一天
  await wuChip.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForTimeout(350);
  assert.match(await wuChip.getAttribute('aria-label'), /2026-10-13 15:00/);
  // 无日期抽屉（300 宽、40px 行）：拖刘建宏到 10-20 = 设日期
  await cal.getByRole('button', { name: /无日期/ }).click();
  const undatedDrawer = cal.getByRole('complementary', { name: '没有日期的记录' });
  await undatedDrawer.waitFor();
  assert.equal(Math.round((await box(undatedDrawer)).width), 300, '抽屉 300 宽');
  const liuRow = undatedDrawer.locator('.aui-cal-undated', { hasText: '刘建宏' });
  assert.equal(Math.round((await box(liuRow)).height), 40, '抽屉行 40px');
  assert.equal(await liuRow.locator('.aui-chip').innerText(), '二通', '行上有阶段标签');
  assert.match(await undatedDrawer.innerText(), /设「跟进时间」/);
  await shot('calendar-undated');
  const liu = await box(liuRow);
  const d20 = await box(day('2026-10-20'));
  await drag({ x: liu.cx, y: liu.cy }, { x: d20.cx, y: d20.bottom - 12 });
  assert.match(await day('2026-10-20').innerText(), /放到 10-20/);
  await shot('calendar-undated-drag');
  await page.mouse.up();
  await page.waitForTimeout(400);
  assert.equal(await liuRow.count(), 0, '放上去后离开无日期列表');
  assert.match(await cal.locator('.aui-cal-ev[aria-label^="刘建宏，"]').getAttribute('aria-label'), /2026-10-20/, '拖出来 = 设了日期');
  await cal.getByRole('button', { name: '关闭无日期列表' }).click();
  // 日子格是方向键网格
  await day('2026-10-05').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-day')), '2026-10-12');
  // 事件小条在 role=row 外的浮层里：aria-owns 交给它开始那天的 gridcell（ARIA：row 只含 gridcell）
  const owned = await cal.locator('.aui-cal-month').evaluate((grid) => {
    const bad = [...grid.querySelectorAll('.aui-cal-ev, .aui-cal-more')].filter((el) => !grid.querySelector(`[role=gridcell][aria-owns~="${el.id}"]`));
    return { total: grid.querySelectorAll('.aui-cal-ev').length, bad: bad.length, segs: grid.querySelector('.aui-cal-segs')?.getAttribute('role') };
  });
  assert.ok(owned.total > 0 && owned.bad === 0 && owned.segs === 'presentation', `每个事件条都归某个日子格（${JSON.stringify(owned)}）`);
  await shot('calendar-month');

  // ================================================================ V6 周 / 日
  step('V6 calendar week');
  await cal.getByRole('button', { name: '周', exact: true }).click();
  const week = area.locator('.aui-cal[data-mode=week]');
  await week.waitFor();
  assert.match(await week.locator('.aui-cal-title').innerText(), /2026 年 10 月 5 日 – 11 日/);
  const block = (name) => week.locator(`.aui-calw-ev[aria-label^="${name}，"]`);
  // 表头：假日「国庆日 休」，今天主色圆牌
  assert.match(await week.locator('.aui-calw-dayhead').nth(1).innerText(), /国庆日/);
  assert.equal(await week.locator('.aui-calw-num[data-today]').evaluate((el) => getComputedStyle(el).backgroundColor), primaryFill);
  // 「现在」= 主色线 + 主色时间牌（不用异常红）
  assert.equal(await week.locator('.aui-calw-now').evaluate((el) => getComputedStyle(el).backgroundColor), primaryColor, '现在线是主色');
  assert.equal(await week.locator('.aui-calw-nowlabel').evaluate((el) => getComputedStyle(el).backgroundColor), primaryFill, '现在时间牌是主色');
  assert.equal(await week.locator('.aui-calw-nowlabel').innerText(), '10:42');
  // 全天栏最多 2 行 +「+N 更多」+ 展开；不再在名字后面重复日期
  const allday = week.locator('.aui-calw-allday');
  const laneTops = await allday.locator('.aui-cal-ev').evaluateAll((list) => [...new Set(list.map((el) => parseFloat(el.style.top)))]);
  assert.ok(laneTops.length <= 2, `全天栏最多 2 行（${laneTops}）`);
  assert.ok((await allday.locator('.aui-cal-more').count()) >= 1, '放不下的「+N 更多」');
  assert.doesNotMatch(await allday.innerText(), /（10-/, '全天事件名字后面不写日期');
  await shot('calendar-week-allday');
  await allday.getByRole('button', { name: '展开全天事件' }).click();
  assert.ok((await allday.locator('.aui-cal-ev').evaluateAll((list) => new Set(list.map((el) => el.style.top)).size)) >= 3, '展开后全部显示');
  assert.equal(await allday.locator('.aui-cal-more').count(), 0);
  // 重叠的并排：蔡依琳 10:00–11:00、林志明 10:30–11:30
  const cai = await box(block('蔡依琳'));
  const lin = await box(block('林志明'));
  const colWidth = (await box(week.locator('.aui-calw-col[data-day="2026-10-06"]'))).width;
  assert.ok(cai.width < colWidth * 0.6 && lin.width < colWidth * 0.6, '重叠的各占一半');
  assert.ok(lin.left > cai.left + cai.width * 0.8, '并排不叠');
  assert.ok(Math.abs(lin.top - cai.top - 26) <= 2, '半小时 = 26px');
  // 定时块 = 软底 + 同色细边
  assert.notEqual(await block('蔡依琳').evaluate((el) => getComputedStyle(el).borderTopColor), await block('蔡依琳').evaluate((el) => getComputedStyle(el).backgroundColor));
  // 全天行：王美玲 · 安装 10-08 → 10-09；Alt+→ 推后一天，菜单有 提前一天 / 推后一天
  const wmBar = allday.locator('.aui-cal-ev[aria-label^="王美玲 · 安装"]');
  assert.equal(await wmBar.count(), 1);
  await wmBar.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForTimeout(350);
  assert.match(await wmBar.getAttribute('aria-label'), /10-09 → 10-10/, '全天条 Alt+→ 推后一天');
  await wmBar.click({ button: 'right' });
  const barMenu = page.getByRole('menu', { name: '「王美玲 · 安装」的操作' });
  await barMenu.waitFor();
  assert.ok(await barMenu.getByRole('menuitem', { name: /提前一天/ }).isVisible() && await barMenu.getByRole('menuitem', { name: /推后一天/ }).isVisible());
  await barMenu.getByRole('menuitem', { name: /提前一天/ }).click();
  await page.waitForTimeout(350);
  assert.match(await wmBar.getAttribute('aria-label'), /10-08 → 10-09/, '菜单「提前一天」');
  await allday.getByRole('button', { name: '收起全天事件' }).click();
  // 上下拖改时间：黄淑芬 09:00 → 10:00（虚线预览写时间）
  await week.locator('.aui-calw-scroll').evaluate((el) => (el.scrollTop = 8 * 52));
  const hs = await box(block('黄淑芬'));
  await drag({ x: hs.cx, y: hs.top + 8 }, { x: hs.cx, y: hs.top + 8 + 52 });
  assert.match(await week.locator('.aui-calw-preview').innerText(), /10:00–11:00/);
  await shot('calendar-week-drag');
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.match(await block('黄淑芬').getAttribute('aria-label'), /10:00–11:00/);
  // 左右拖换天：黄淑芬 10-07 → 10-08，预览在 10-08 那一列
  const hs2 = await box(block('黄淑芬'));
  await drag({ x: hs2.cx, y: hs2.top + 8 }, { x: hs2.cx + colWidth, y: hs2.top + 8 });
  const pv = await box(week.locator('.aui-calw-preview'));
  const col8 = await box(week.locator('.aui-calw-col[data-day="2026-10-08"]'));
  assert.ok(pv.left >= col8.left - 1 && pv.right <= col8.right + 1, '虚线预览在新的那天');
  assert.match(await week.locator('.aui-calw-preview').innerText(), /10:00–11:00/);
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.match(await block('黄淑芬').getAttribute('aria-label'), /2026-10-08 10:00–11:00/, '左右拖 = 换天，时间不变');
  // 拉伸：王美玲 13:00–14:00 → 15:00
  const wm = await box(block('王美玲'));
  await drag({ x: wm.cx, y: wm.bottom - 3 }, { x: wm.cx, y: wm.bottom - 3 + 52 });
  assert.match(await week.locator('.aui-calw-preview').innerText(), /13:00–15:00/);
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.match(await block('王美玲').getAttribute('aria-label'), /13:00–15:00/);
  // 拖空白新建：10-11 15:00–16:00
  const c9 = await box(week.locator('.aui-calw-col[data-day="2026-10-11"]'));
  const yAt = (min) => c9.top + (min / 60) * 52;
  await drag({ x: c9.cx, y: yAt(15 * 60) + 2 }, { x: c9.cx, y: yAt(16 * 60) - 2 });
  assert.match(await week.locator('.aui-calw-preview[data-kind=create]').innerText(), /15:00–16:00/);
  await page.mouse.up();
  await page.getByText(/新建跟进：2026-10-11T07:00:00.000Z/).waitFor();
  // 键盘新建：日子列是一个 Tab 停点，← / → 换天，Enter 在可见区第一格新建
  await week.locator('.aui-calw-scroll').evaluate((el) => (el.scrollTop = 9 * 52));
  const colStop = week.locator('.aui-calw-col[tabindex="0"]');
  assert.equal(await colStop.count(), 1, '日子列只有一个 Tab 停点');
  await colStop.focus();
  const firstDay = await colStop.getAttribute('data-day');
  await page.keyboard.press('ArrowLeft');
  const nextDay = await page.evaluate(() => document.activeElement?.getAttribute('data-day'));
  assert.ok(nextDay && nextDay < firstDay, `← 换到前一天（${firstDay} → ${nextDay}）`);
  await page.keyboard.press('Enter');
  await page.getByText(new RegExp(`新建跟进：${nextDay}T01:00:00.000Z`)).waitFor();
  // 点定时块出事件卡
  await block('林志明').click();
  await page.getByRole('dialog', { name: '林志明详情' }).waitFor();
  await shot('calendar-week-card');
  await page.keyboard.press('Escape');
  // 右键菜单
  await block('林志明').click({ button: 'right' });
  const evMenu = page.getByRole('menu', { name: '「林志明」的操作' });
  await evMenu.waitFor();
  for (const item of ['打开详情', '提前 30 分钟', '推后 30 分钟', '清除日期', '设置提醒', '分享记录', '删除记录']) assert.ok(await evMenu.getByRole('menuitem', { name: new RegExp(item) }).isVisible(), item);
  await shot('calendar-week-menu');
  await page.keyboard.press('Escape');
  // 键盘：Alt+↓ 推后 30 分钟
  await block('林志明').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(350);
  assert.match(await block('林志明').getAttribute('aria-label'), /11:00–12:00/);
  await week.locator('.aui-calw-scroll').evaluate((el) => (el.scrollTop = 8 * 52));
  await shot('calendar-week');
  await week.getByRole('button', { name: '日', exact: true }).click();
  await area.locator('.aui-cal[data-mode=day]').waitFor();
  assert.equal(await area.locator('.aui-calw-col').count(), 1);
  await area.locator('.aui-cal[data-mode=day]').getByRole('button', { name: '月', exact: true }).click();

  // ================================================================ V7 甘特 + V8 设置
  step('V7 gantt + V8 settings');
  await openTab('安装排期');
  const gantt = area.locator('.aui-gantt');
  await gantt.waitFor();
  const title = () => gantt.locator('.aui-cal-title').innerText();
  assert.equal(await title(), '2026 年 10 月');
  // 默认两周：时间轴正好 15 天，今天（10-05）在第 3 列，左侧拿剩下的宽度、5 列表头不省略
  const dayCols = () => gantt.locator('.aui-gantt-th-bottom > span').count();
  const dayLabels = () => gantt.locator('.aui-gantt-th-bottom > span > b').allInnerTexts();
  const listWidth = () => gantt.locator('.aui-gantt-list').evaluate((el) => el.getBoundingClientRect().width);
  assert.equal(await dayCols(), 15, '默认显示 15 天');
  assert.equal((await dayLabels()).indexOf('5'), 2, '今天在第 3 列');
  assert.ok(await gantt.locator('.aui-gantt-th-bottom > span[data-today]').evaluate((el) => el.getBoundingClientRect().left - el.parentElement.getBoundingClientRect().left < 100), '今天靠左');
  const tlBox = await box(gantt.locator('.aui-gantt-tl'));
  const lastDay = await box(gantt.locator('.aui-gantt-th-bottom > span').last());
  assert.ok(Math.abs(lastDay.right - tlBox.right) <= 1, `15 天正好铺满时间轴，没有半天露在边上（${lastDay.right} / ${tlBox.right}）`);
  assert.ok(lastDay.width >= 28 && lastDay.width <= 40, `一天 ${lastDay.width}px`);
  assert.ok((await listWidth()) >= 600, `左侧 ${await listWidth()}px ≥ 600`);
  const heads = await gantt.locator('.aui-gantt-lh > span').evaluateAll((list) => list.map((el) => ({ text: el.textContent, cut: el.scrollWidth > el.clientWidth })));
  assert.deepEqual(heads.map((h) => h.text), ['客户名称', '安装负责人', '手机', '安装日期', '完工日期']);
  assert.deepEqual(heads.filter((h) => h.cut), [], '左侧表头都不省略');
  assert.equal(await gantt.locator('.aui-gantt-cell').evaluateAll((list) => list.filter((el) => el.scrollWidth > el.clientWidth).length), 0, '左侧单元格都完整显示');
  await shot('gantt-default');
  // 审阅 08：今天 = 主色 2px 线 + 表头主色日期圆牌（不用红）；条形 = 选项色软底 + 同色细边；假日斜纹 + 表头「休」
  const gPrimary = await gantt.evaluate((el) => { const s = document.createElement('span'); s.style.color = 'var(--aui-primary)'; el.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  const gPrimaryFill = await gantt.evaluate((el) => { const s = document.createElement('span'); s.style.color = 'var(--aui-primary-fill)'; el.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; });
  assert.equal(await gantt.locator('.aui-gantt-today').evaluate((el) => getComputedStyle(el).backgroundColor), gPrimary, '今天线是主色');
  assert.equal(await gantt.locator('.aui-gantt-today').evaluate((el) => getComputedStyle(el).width), '2px');
  assert.equal(await gantt.locator('.aui-gantt-th-bottom > span[data-today] > b').evaluate((el) => getComputedStyle(el).backgroundColor), gPrimaryFill, '表头今天是主色圆牌');
  assert.equal(await gantt.locator('.aui-gantt-todaytag').count(), 0, '日子刻度上不再另放「今天」红牌');
  assert.equal(await gantt.locator('.aui-gantt-bar[data-vtone$=Solid], .aui-gantt-bar[data-vtone=solid]').count(), 0, '条形一律软底（实心选项也用它的浅色）');
  assert.notEqual(await gantt.locator('.aui-gantt-bar').first().evaluate((el) => getComputedStyle(el).backgroundColor), gPrimaryFill, '条形不是主色实底');
  assert.ok((await gantt.locator('.aui-gantt-backdrop > span[data-holiday]').count()) >= 1, '假日斜纹');
  assert.equal(await gantt.locator('.aui-gantt-th-bottom > span[data-holiday] > small').first().innerText(), '休');
  // 放不下的字挪到条形右边，带面板底色（今天线不穿过）
  const after = gantt.locator('.aui-gantt-after').first();
  assert.ok((await gantt.locator('.aui-gantt-after').count()) >= 1, '短条的字在条外');
  assert.notEqual(await after.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', '条外的字带底色');
  assert.ok(Number(await after.evaluate((el) => getComputedStyle(el).zIndex)) > Number(await gantt.locator('.aui-gantt-today').evaluate((el) => getComputedStyle(el).zIndex)), '条外的字压在今天线上面');
  const lrow = (name) => gantt.locator('.aui-gantt-lrow', { hasText: name });
  const bar = (name) => gantt.getByRole('button', { name: new RegExp(`^${name}，`) });
  // 两级分组 + 收起
  assert.match(await gantt.locator('.aui-gantt-grp-toggle').first().innerText(), /阿明\s*5 条/);
  // 边缘箭头：陈雅婷 09-28 → 09-30 在左边
  const pill = gantt.getByRole('button', { name: /陈雅婷，09-28 → 09-30，在左边/ });
  assert.equal(await pill.innerText(), '09-28 → 09-30');
  assert.equal(await pill.evaluate((el) => getComputedStyle(el).borderRadius), '6px', '窗口外 = 当行边缘一个小牌');
  await pill.click();
  assert.equal(await title(), '2026 年 9 – 10 月', '跳过去：窗口从 09-26 开始，跨月写起止月');
  assert.equal((await dayLabels())[2], '28', '条的开始在第 3 列');
  assert.ok(await gantt.locator('.aui-gantt-bar[aria-label^="陈雅婷，"]').isVisible());
  // ‹ › 一次翻 15 天，「今天」回来、今天在第 3 列
  await gantt.getByRole('button', { name: '往后' }).click();
  assert.equal((await dayLabels())[0], '11', '09-26 往后 15 天 = 10-11');
  assert.equal(await dayCols(), 15);
  await gantt.getByRole('button', { name: '往前' }).click();
  assert.equal((await dayLabels())[0], '26');
  await gantt.getByRole('button', { name: '今天' }).click();
  assert.equal(await title(), '2026 年 10 月');
  assert.equal((await dayLabels()).indexOf('5'), 2);
  // 休息日斜纹（只算工作日）：李承恩 10-09 → 10-15 含周日
  assert.ok((await bar('李承恩（滨江豪宅）').locator('.aui-gantt-hatch').count()) >= 1);
  // 悬停提示
  await bar('李承恩（滨江豪宅）').hover();
  const tip = page.getByRole('dialog', { name: '条形详情' });
  await tip.waitFor();
  assert.match(await tip.innerText(), /6 个工作日（含 1 天休息日不计）/);
  assert.match(await tip.innerText(), /10-10 补班照常计入/);
  await shot('gantt-hover');
  // 拖动移动：黄淑芬 10-19 → 10-21 推后 2 天（先往后翻到 10-18 起的两周）
  const dayPx = lastDay.width;
  assert.equal(await gantt.locator('.aui-gantt-pill[aria-label^="黄淑芬，"]').count(), 1, '10-19 在默认两周外：右边缘箭头');
  await gantt.getByRole('button', { name: '往后' }).click();
  const hb = await box(gantt.locator('.aui-gantt-bar[aria-label^="黄淑芬，"]'));
  await drag({ x: hb.left + 6, y: hb.cy }, { x: hb.left + 6 + dayPx * 2, y: hb.cy });
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.match(await lrow('黄淑芬').innerText(), /10-21\s+10-23/);
  await gantt.getByRole('button', { name: '今天' }).click();
  // 选中后拖右端：王美玲 10-08 → 10-09 改成到 10-10
  await bar('王美玲').click();
  const handle = bar('王美玲').locator('.aui-gantt-handle[data-edge=end]');
  const hd = await box(handle);
  await drag({ x: hd.cx, y: hd.cy }, { x: hd.cx + dayPx, y: hd.cy });
  await shot('gantt-resize');
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.match(await lrow('王美玲').innerText(), /10-08\s+10-10/);
  // 键盘：→ 整条推后一天
  await bar('王美玲').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  assert.match(await lrow('王美玲').innerText(), /10-09\s+10-11/);
  // 分组收起
  await gantt.getByRole('button', { name: /苏州\s*3 条/ }).click();
  assert.equal(await lrow('刘建宏').count(), 0);
  await gantt.getByRole('button', { name: /苏州\s*3 条/ }).click();
  // 分隔条：拖动、键盘调宽度（定了宽度后时间轴按一天 36px 铺满），双击回到默认，收起
  const split = gantt.getByRole('separator', { name: '调整左侧宽度' });
  const w0 = Number(await split.getAttribute('aria-valuenow'));
  assert.equal(Math.round(await listWidth()), w0);
  const sb = await box(split);
  await drag({ x: sb.cx, y: sb.top + 200 }, { x: sb.cx - 180, y: sb.top + 200 });
  await page.mouse.up();
  assert.ok(Math.abs(Number(await split.getAttribute('aria-valuenow')) - (w0 - 180)) <= 2, '拖动分隔条改左侧宽度');
  assert.ok((await dayCols()) > 15, `左侧变窄后时间轴多放几天（${await dayCols()} 天）`);
  await shot('gantt-dragged');
  const w1 = Number(await split.getAttribute('aria-valuenow'));
  await split.focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(Number(await split.getAttribute('aria-valuenow')), w1 - 24);
  await split.dblclick();
  assert.equal(Number(await split.getAttribute('aria-valuenow')), w0, '双击分隔条回到默认宽度');
  assert.equal(await page.evaluate(() => String(getSelection())), '', '双击分隔条不选中旁边的字');
  assert.equal(await dayCols(), 15);
  await gantt.getByRole('button', { name: '收起左侧字段' }).click();
  assert.equal(Number(await split.getAttribute('aria-valuenow')), 0);
  assert.ok((await dayCols()) > 15, '收起左侧：时间轴铺满');
  await gantt.getByRole('button', { name: '展开左侧字段' }).click();
  assert.equal(await dayCols(), 15);
  // 刻度
  await gantt.getByRole('button', { name: '季', exact: true }).click();
  assert.equal(await title(), '2026 年第 4 季度');
  await shot('gantt-quarter');
  await gantt.getByRole('button', { name: '年', exact: true }).click();
  assert.equal(await title(), '2026 年');
  assert.equal(Number(await split.getAttribute('aria-valuenow')), w0, '换刻度左侧宽度不变');
  await gantt.getByRole('button', { name: '周', exact: true }).click();
  assert.equal(await dayCols(), 7, '周刻度 7 天');
  assert.equal(Number(await split.getAttribute('aria-valuenow')), w0);
  await shot('gantt-week');
  await gantt.getByRole('button', { name: '两周', exact: true }).click();
  assert.equal(await dayCols(), 15);
  // 甘特设置
  await area.getByRole('button', { name: '甘特设置' }).click();
  const gs = page.getByRole('dialog', { name: '甘特设置' });
  await gs.waitFor();
  for (const s of ['时间', '分组', '显示']) assert.ok(await gs.getByRole('region', { name: s }).isVisible(), s);
  assert.match(await gs.innerText(), /2 \/ 3 级/);
  await gs.getByRole('button', { name: '添加字段' }).click();
  await page.getByRole('menu', { name: '添加条上字段' }).getByRole('menuitem', { name: '负责人', exact: true }).click();
  assert.match(await gantt.locator('.aui-gantt-after, .aui-gantt-bar-text').allInnerTexts().then((t) => t.join(' ')), /李承恩（滨江豪宅） · 美华/);
  await shot('gantt-settings');
  await gs.getByRole('switch', { name: '工期只算工作日' }).click();
  assert.equal(await gantt.locator('.aui-gantt-wdc').count(), 0);
  await gs.getByRole('switch', { name: '工期只算工作日' }).click();
  // bt/templates：颜色依据「按条件」= 表格填色的规则模型（条件树 + 选项 10 色），只按整行；条件没填完的规则不着色
  const tones = () => gantt.locator('.aui-gantt-bar').evaluateAll((list) => [...new Set(list.map((el) => el.getAttribute('data-vtone')))].sort().join(','));
  assert.notEqual(await tones(), 'green', '按单选字段：条形有好几种色调');
  await gs.getByRole('button', { name: '按条件', exact: true }).click();
  const rules = gs.getByRole('group', { name: '按条件着色的规则' });
  await rules.waitFor();
  assert.equal(await rules.getByRole('group', { name: '规则 1' }).count(), 1, '切到按条件：自动加一条规则');
  assert.equal(await rules.getByRole('group', { name: '规则 1' }).getByText('单元格').count(), 0, '甘特只按整行，没有「整行 / 单元格」');
  assert.equal(await tones(), 'green', '条件还没填完：不着色，统一主色');
  await shot('gantt-settings-condition');
  await gs.getByRole('button', { name: '按单选字段', exact: true }).click();
  assert.equal(await rules.count(), 0, '切回按单选字段：规则收起');
  assert.notEqual(await tones(), 'green');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await shot('gantt');

  // ================================================================ 深色
  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(250);
  // 审阅 08：条形 / 事件一律选项软底 + 深色模式下的选项字色（不再有白字实底）
  assert.equal(await area.locator('.aui-gantt-bar:is([data-vtone=solid], [data-vtone$=Solid])').count(), 0);
  assert.notEqual(await area.locator('.aui-gantt-bar').first().evaluate((el) => getComputedStyle(el).color), 'rgb(255, 255, 255)');
  await shot('gantt-dark');
  await openTab('阶段看板');
  await area.locator('.aui-kanban').waitFor();
  await shot('kanban-dark');
  await openTab('现场照片');
  await shot('gallery-dark');
  await openTab('跟进日历');
  await area.locator('.aui-cal').waitFor();
  assert.equal(await area.locator('.aui-cal-ev:is([data-vtone=solid], [data-vtone$=Solid])').count(), 0, '日历事件一律软底');
  await shot('calendar-month-dark');
  await area.getByRole('button', { name: '周', exact: true }).click();
  await shot('calendar-week-dark');
  await area.getByRole('button', { name: '月', exact: true }).click();
  await area.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('dialog', { name: '视图管理' }).waitFor();
  await shot('view-manager-dark');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  // ================================================================ 手机 390
  step('390');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  for (const name of ['阶段看板', '现场照片', '跟进日历', '安装排期']) {
    const t = tab(name);
    if (await t.count()) await t.click();
    else {
      await area.getByRole('button', { name: /^更多 \d+/ }).click();
      await page.getByRole('menuitem', { name }).click();
    }
    await page.waitForTimeout(350);
    const o = await overflow();
    assert.ok(o <= 0, `390 ${name} 横向溢出 ${o}px`);
    await shot(`views-390-${name}`);
  }
  // 8.0.2: mounting a view on a phone never scrolls the PAGE — the board / calendar / gantt below the fold
  // (spacer above) used to drag the window down to the kanban pills (scrollIntoView). Tabs clicked from JS
  // so the click itself doesn't scroll.
  {
    const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ph.goto(server.resolvedUrls.local[0]);
    await ph.addStyleTag({ content: '#aui-page-views { padding-top: 1600px !important; }' });
    await ph.getByRole('button', { name: /菜单|导航/ }).first().click().catch(() => undefined);
    await ph.getByRole('button', { name: '视图', exact: true }).first().evaluate((el) => el.click());
    await ph.locator('#aui-page-views .aui-kanban-pills').waitFor({ state: 'attached' });
    await ph.waitForTimeout(500);
    assert.equal(await ph.evaluate(() => Math.round(scrollY)), 0, '390 看板挂上后整页不滚');
    for (const [name, sel] of [['跟进日历', '.aui-cal'], ['安装排期', '.aui-gantt'], ['阶段看板', '.aui-kanban-pills']]) {
      await ph.evaluate(() => scrollTo(0, 0));
      await ph.locator('#aui-page-views .aui-vtab').filter({ hasText: name }).first().evaluate((el) => el.click());
      await ph.locator(`#aui-page-views ${sel}`).first().waitFor({ state: 'attached' });
      await ph.waitForTimeout(500);
      assert.equal(await ph.evaluate(() => Math.round(scrollY)), 0, `390 切到「${name}」整页不滚`);
    }
    await ph.close();
  }
  // 手机上所有标签一行横滑（没有「更多」），当前标签滚进来；仪表盘组收进「视图」
  {
    assert.equal(await area.getByRole('button', { name: /^更多 \d+/ }).count(), 0, '手机不出「更多」');
    assert.equal(await area.locator('.aui-vtabs-trailing').count(), 0, '仪表盘组不占标签行');
    const list = area.locator('.aui-vtabs-list').first();
    assert.equal(await list.evaluate((el) => getComputedStyle(el).overflowX), 'auto', '标签横滑');
    const cur = await box(area.locator('.aui-vtab[aria-current=page]'));
    const lb = await box(list);
    assert.ok(cur.left >= lb.left - 1 && cur.right <= lb.right + 1, `当前标签在可见区 ${JSON.stringify(cur)} ${JSON.stringify(lb)}`);
    await area.getByRole('button', { name: '视图管理' }).click();
    const sheet = page.getByRole('dialog', { name: '视图管理' });
    await sheet.waitFor();
    assert.equal(await sheet.getAttribute('data-sheet'), 'true', '手机视图管理 = 底部弹层');
    assert.ok(await sheet.getByRole('navigation', { name: '仪表盘' }).isVisible(), '仪表盘组在「视图」里');
    await shot('views-390-tabs-manager');
    await page.keyboard.press('Escape');
  }
  // 手机上：甘特是按分组的列表 + 进度小轨道（带今天线）
  assert.equal(await area.locator('.aui-gantt[data-narrow]').count(), 1, '甘特在窄屏变列表');
  {
    const phone = area.locator('.aui-gantt-phone');
    assert.ok((await phone.locator('.aui-gantt-mrow').count()) > 3, '甘特手机列表');
    assert.ok((await phone.locator('.aui-gantt-track-today').count()) > 3, '每行进度轨道上有今天线');
    assert.ok((await phone.locator('.aui-gantt-track-bar').count()) >= 1, '窗口里的记录在轨道上有一段');
    assert.match(await phone.locator('.aui-gantt-phone-scale').innerText(), /今天 10-05/);
    assert.ok((await box(phone.locator('.aui-gantt-mrow').first())).height >= 44);
  }
  // 画册手机 2 列：不写字段名、负责人只留头像
  {
    const t = tab('现场照片');
    if (await t.count()) await t.click();
    else await openTab('现场照片');
    const g = area.locator('.aui-gallery');
    await g.waitFor();
    const cols = await g.locator('.aui-gallery-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(cols, 2, '手机画册 2 列');
    assert.equal(await g.locator('.aui-rcard-owner-name').first().evaluate((el) => el.getBoundingClientRect().width), 1, '负责人只留头像（名字只给读屏）');
    assert.equal(await g.getByRole('switch', { name: '显示字段名' }).isVisible(), false, '手机没有字段名开关');
    await shot('views-390-gallery-cards');
  }
  // 手机日历只给「月 + 当天日程」：周视图在手机上自动回到月；月历 = 小格 + 彩点 + 选中那天的日程（44px 行）
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTab('跟进日历');
  await area.locator('.aui-cal').getByRole('button', { name: '周', exact: true }).click();
  await area.locator('.aui-cal[data-mode=week]').waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await area.locator('.aui-cal-mini').waitFor();
  assert.equal(await area.locator('.aui-cal[data-mode=week], .aui-cal[data-mode=day]').count(), 0, '手机没有周 / 日视图');
  assert.equal(await area.locator('.aui-cal').getByRole('button', { name: '周', exact: true }).count(), 0, '手机工具栏没有 日 / 周');
  assert.equal(await area.locator('.aui-cal-mini-day[data-day="2026-10-05"]').getAttribute('data-selected'), 'true', '默认选中今天');
  assert.ok((await area.locator('.aui-cal-mini-day[data-day="2026-10-05"] .aui-cal-mini-dots > i').count()) >= 1, '有事件的日子有彩点');
  await area.locator('.aui-cal-mini-day[data-day="2026-10-07"]').click();
  const dayAgenda = area.locator('.aui-cal-dayagenda');
  assert.match(await dayAgenda.locator('h4').innerText(), /10月7日/);
  const agendaItem = await box(dayAgenda.locator('.aui-cal-agenda-item').first());
  assert.ok(agendaItem.height >= 44, '日程行 ≥ 44px 触屏');
  assert.ok((await overflow()) <= 0, '手机日历不横向溢出');
  await shot('views-390-calendar');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(250);
  await shot('views-390-calendar-dark');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  await (async () => {
    const t = tab('阶段看板');
    if (await t.count()) await t.click();
    else {
      await area.getByRole('button', { name: /^更多 \d+/ }).click();
      await page.getByRole('menuitem', { name: '阶段看板' }).click();
    }
  })();
  const snap = await area.locator('.aui-kanban-scroll').evaluate((el) => getComputedStyle(el).scrollSnapType);
  assert.match(snap, /x mandatory/);
  const colW = (await box(area.locator('section[data-col="first"]'))).width;
  assert.ok(colW <= 390 * 0.87, `手机列宽 86% ${colW}`);

  // bt/flush: 画册 in a workspace Pane (系统 → 工作区贴边): GridToolbar without 行高, the gallery keeps 16px (12 on phones)
  // from the pane edges and (wide) scrolls inside the pane (fill) while the toolbar stays put.
  await checkFlushSection(browser, server.resolvedUrls.local[0], '画册', output, 'gallery', async (p, area, { width, label }) => {
    const pane = area.locator('.aui-tabbed-panel:not([hidden]) .aui-pane[aria-label="客户画册"]');
    const toolbar = pane.locator('.aui-grid-toolbar');
    assert.equal(await toolbar.getByRole('button', { name: '行高' }).count(), 0, `${label}：画册工具栏没有「行高」`);
    assert.ok(await toolbar.getByRole('searchbox', { name: '搜索记录' }).isVisible(), `${label}：工具栏照常有搜索`);
    // 审阅 08：客户表没有图片字段（coverFields 为空）→ 画册默认「不显示封面」，卡片不写字段名
    assert.equal(await pane.locator('.aui-rcard-cover').count(), 0, `${label}：没有图片字段时默认不显示封面`);
    assert.ok((await pane.locator('.aui-rcard-keyline').count()) > 0, `${label}：卡片有关键数行`);
    const inset = width > 760 ? 16 : 12;
    const box = await edges(pane);
    const summary = await edges(pane.locator('.aui-gallery-summary'));
    const grid = await edges(pane.locator('.aui-gallery-grid'));
    assert.equal(summary.x - box.ix, inset, `${label}：「共 N 条」离栏左边 ${inset}px（实际 ${summary.x - box.ix}）`);
    assert.ok(grid.x - box.ix === inset && box.iright - grid.right >= inset, `${label}：卡片离栏边 ≥ ${inset}px（左 ${grid.x - box.ix}，右 ${box.iright - grid.right}）`);
    if (width <= 1100) return; // 窄屏上下排：栏主体滚，画册按内容高
    assert.ok((await edges(pane.locator('.aui-gallery-view'))).scroll > 0, `${label}：卡片区在栏里自己滚`);
    assert.equal((await edges(pane.locator('.aui-pane-body'))).scroll, 0, `${label}：栏主体本身不滚（工具栏不跟着滚走）`);
    await pane.locator('.aui-gallery-view').evaluate((el) => el.scrollTo(0, 400));
    assert.equal((await edges(toolbar)).y, (await edges(pane.locator('.aui-pane-body'))).y, `${label}：滚动卡片后工具栏还在栏顶`);
  });

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS views (${output}): view tabs (more / ⋯ / keys), view manager tiers (must-see lock, eye, Alt+↓ reorder, rename, create), kanban (pointer drag + slot + change tip, Esc, Alt+arrows, rollback, collapse, colour, load more, paging, lightbox), gallery (density, cover, lightbox), month (spans across weeks, +N, today, 休/班, hover card, drag, keys, undated drag), week/day (overlaps, move / resize preview, create, menu, keys), gantt (pills, hatch, tip, move / resize / keys, groups, splitter, scales) + settings, dark, 390 (agenda, list, snap, no overflow), gallery flush in a workspace Pane (no 行高, 16px inset, own scroll) 1440 light / dark / 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
