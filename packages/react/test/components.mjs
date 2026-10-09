// 1.10.0 components on the real starter: RowActions menu, ConfirmDialog, ChangeList,
// OneTimeSecretDialog, DescriptionList, PageBody/PageHeader layout, shell title, silent refresh,
// narrow-phone pagination and the dark-mode fixes.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const executablePath = () => { const cached = '/home/admin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'; return process.env.CHROMIUM_PATH || (existsSync(cached) ? cached : chromium.executablePath()); };

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/components');
mkdirSync(output, { recursive: true });
const shot = (page, name) => page.screenshot({ path: resolve(output, `${name}.png`) });
const browser = await chromium.launch({ headless: true, executablePath: executablePath(), args: ['--no-sandbox'] });
let server;
try {
  server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url);
  await p.locator('tbody tr').first().waitFor();
  const nav = (name) => p.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();

  // Shell: document.title follows the active tab; topbar title never wraps; sidebar column painted full height.
  assert.equal(await p.title(), '用户管理 · Acme 工作台');
  assert.equal(await p.locator('.aui-topbar-crumbs [aria-current=page]').evaluate((el) => getComputedStyle(el).whiteSpace), 'nowrap');
  assert.match(await p.locator('.aui-shell').evaluate((el) => getComputedStyle(el).backgroundImage), /linear-gradient/);

  // 6.3：PageBody fill —— 列表卡片撑满一屏：底边到「视口底 − 内容区下内边距」，页面不竖向滚动；
  // 搜不到时空状态在表头与分页之间居中（不和表头平分高度），分页贴卡片底。
  const fillFacts = () => p.locator('#aui-page-users').evaluate((page) => {
    const content = page.parentElement;
    const card = page.querySelector('.aui-page-body[data-fill] > .aui-resource:last-child');
    const table = card.querySelector('.aui-table-panel');
    const head = table.querySelector('.aui-table-scroll').getBoundingClientRect();
    const foot = table.querySelector('.aui-pagination').getBoundingClientRect();
    const state = table.querySelector(':scope > .aui-state')?.getBoundingClientRect();
    return {
      gap: Math.round(innerHeight - card.getBoundingClientRect().bottom),
      padBottom: Math.round(parseFloat(getComputedStyle(content).paddingBottom)),
      overflowY: document.documentElement.scrollHeight - innerHeight,
      footGap: Math.round(card.getBoundingClientRect().bottom - foot.bottom),
      stateOffset: state ? Math.round((state.top + state.bottom) / 2 - (head.bottom + foot.top) / 2) : null,
    };
  });
  {
    const f = await fillFacts();
    assert.ok(f.overflowY <= 0, `fill 页面不该竖向滚动，多出 ${f.overflowY}px`);
    assert.ok(Math.abs(f.gap - f.padBottom) <= 1, `fill 列表卡片应伸到底（离视口底 ${f.gap}px，应为 ${f.padBottom}px）`);
    assert.ok(f.footGap <= 1, `分页应贴卡片底（差 ${f.footGap}px）`);
    await p.locator('#aui-page-users').getByRole('textbox', { name: '搜索关键词' }).fill('不存在的人zzz');
    await p.locator('#aui-page-users').getByRole('textbox', { name: '搜索关键词' }).press('Enter'); // 打字就筛，回车立即搜
    await p.locator('#aui-page-users .aui-table-panel > .aui-state:not(.aui-state-loading)').waitFor();
    const e = await fillFacts();
    assert.ok(e.overflowY <= 0, `空表时页面不该竖向滚动，多出 ${e.overflowY}px`);
    assert.ok(Math.abs(e.gap - e.padBottom) <= 1, `空表时卡片仍应伸到底（离视口底 ${e.gap}px）`);
    assert.ok(Math.abs(e.stateOffset) <= 2, `空状态应在表头与分页之间居中（偏 ${e.stateOffset}px）`);
    await shot(p, 'page-body-fill-empty');
    await p.locator('#aui-page-users').getByRole('textbox', { name: '搜索关键词' }).press('Escape'); // Esc 清空 = 以前的「重置」
    await p.locator('#aui-page-users tbody tr').first().waitFor();
  }

  // 5.3：页面按钮不单独占一行，并进下面列表面板的第一行（和面板自己的按钮一行，靠右）。8.6：用户列表是页面里唯一的
  // 列表，标题不再单独占一行（读屏标题还在），第一行就是筛选行，数量和按钮在它右端。
  assert.equal(await p.locator('#aui-page-users .aui-page-header').count(), 0, '没有单独的页面头一行');
  assert.equal(await p.locator('#aui-page-users .aui-resource > .aui-panel-header').count(), 0, '8.6：唯一的列表不再有标题行');
  assert.match(await p.locator('#aui-page-users .aui-resource > h2.aui-sr-only').innerText(), /^用户列表/, '8.6：标题留给读屏');
  const header = await p.locator('#aui-page-users .aui-resource > .aui-resource-filters[data-bar]').first().evaluate((el) => {
    const box = el.getBoundingClientRect();
    const actions = el.querySelector(':scope > .aui-header-actions');
    const add = [...actions.querySelectorAll('button')].find((b) => b.textContent.includes('新增用户'));
    // 按钮和「?」一样高时才比顶边；这里比中线，并跳过不显示的按钮
    const centers = [...actions.querySelectorAll('button')].map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.round((r.top + r.bottom) / 2));
    return { right: Math.round(box.right - actions.getBoundingClientRect().right), hasAdd: Boolean(add), oneRow: Math.max(...centers) - Math.min(...centers) <= 1 };
  });
  await shot(p, 'desktop-users-header');
  assert.ok(header.hasAdd && header.oneRow && header.right < 24, '「新增用户」并进用户列表第一行（筛选行）、一行靠右，实测 ' + JSON.stringify(header));

  // Silent refresh keeps rows: no loading state, rows stay on screen.
  await p.getByRole('button', { name: '刷新', exact: true }).click();
  assert.equal(await p.locator('#aui-page-users .aui-table-panel').getAttribute('aria-busy'), 'false', '静默刷新不进入 loading');
  assert.equal(await p.locator('#aui-page-users tbody tr').count(), 10, '静默刷新保留当前行');

  // RowActionBar：放得下几个就露几个，⋯ 旁边不许还有放得下下一个按钮的空位。
  const barCheck = () => p.evaluate(() => [...document.querySelectorAll('.aui-row-actionbar')].map((bar) => {
    const row = bar.firstElementChild; const ruler = bar.lastElementChild;
    const inline = row.querySelectorAll(':scope > .aui-row-actionbar-button').length;
    const candidates = ruler.children.length - 1;
    const used = [...row.children].reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + 4 * Math.max(0, row.children.length - 1);
    const free = bar.clientWidth - used;
    const next = inline < candidates ? ruler.children[inline].getBoundingClientRect().width + 4 : Infinity;
    return { inline, candidates, free: Math.round(free), next: Math.round(next), menu: Boolean(row.querySelector('.aui-row-actions-trigger')) };
  }));
  // 点一行的某个操作：露在行里就直接点，否则从 ⋯ 菜单里点。
  const rowAct = async (scope, name) => {
    const inline = scope.locator('.aui-row-actionbar-row > .aui-row-actionbar-button', { hasText: name }).first();
    if (await inline.count()) return inline.click();
    await scope.getByRole('button', { name: /的更多操作$/ }).first().click();
    await p.getByRole('menu').getByRole('menuitem', { name }).click();
  };
  const bars = await barCheck();
  assert.ok(bars.length >= 5, '用户表每行都有操作条');
  for (const bar of bars) assert.ok(bar.inline <= 3, `一行最多露 3 个按钮：${JSON.stringify(bar)}`);
  for (const bar of bars) assert.ok(bar.free < bar.next, `⋯ 旁边还有空位能放下一个按钮：${JSON.stringify(bar)}`);
  assert.ok(bars[0].inline >= 2, `桌面至少露 2 个按钮：${JSON.stringify(bars[0])}`);
  const shownFirst = bars[0].inline;
  // RowActions (the ⋯ menu of the bar): menu semantics, keyboard, disabled reason, Esc returns focus.
  const trigger = p.getByRole('button', { name: /的更多操作$/ }).first();
  const triggerName = await trigger.getAttribute('aria-label');
  await trigger.click();
  const menu = p.getByRole('menu');
  await menu.waitFor();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  await shot(p, 'desktop-row-menu');
  const items = menu.getByRole('menuitem');
  assert.equal(await items.count(), 5 - shownFirst, '露出来的不再进菜单');
  const firstItem = await items.first().textContent();
  assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('role')), 'menu', '鼠标打开：焦点在菜单本身，不高亮');
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(() => document.activeElement?.textContent), firstItem, '↓ 进第一项');
  await p.keyboard.press('End');
  const last = await p.evaluate(() => ({ text: document.activeElement?.textContent, disabled: document.activeElement?.getAttribute('aria-disabled'), described: document.getElementById(document.activeElement?.getAttribute('aria-describedby') ?? '')?.textContent }));
  assert.deepEqual(last, { text: '删除演示数据不能删除', disabled: 'true', described: '演示数据不能删除' }, '带原因的禁用项可聚焦并读出原因');
  await p.keyboard.press('Enter');
  assert.equal(await menu.count(), 1, '禁用项不能执行');
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(() => document.activeElement?.textContent), firstItem, '方向键循环');
  await p.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
  assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('aria-label')), triggerName, 'Esc 后焦点回到触发按钮');
  // Outside click closes.
  await trigger.click();
  await menu.waitFor();
  await p.mouse.click(5, 880);
  await menu.waitFor({ state: 'detached' });

  // ConfirmDialog + ChangeList: required reason, failure keeps dialog, discard prompt only after typing.
  const activeId = await p.locator('#aui-page-users tbody tr').filter({ hasText: '正常' }).first().locator('td').nth(1).innerText();
  const rowOf = (id) => p.locator('#aui-page-users tbody tr').filter({ has: p.getByRole('cell', { name: id, exact: true }) });
  await rowOf(activeId).getByRole('button', { name: /的更多操作$/ }).click();
  await menu.getByRole('menuitem', { name: '停用账号' }).click();
  const dialog = p.getByRole('dialog');
  await dialog.waitFor();
  assert.ok(await dialog.getByText(/将停用 .*立刻被登出/).isVisible(), '显示对象和后果');
  assert.deepEqual((await dialog.locator('.aui-change-list tbody tr').first().locator('th,td').allTextContents()).map((t) => t.replace(/\s+/g, '')), ['账号状态', '正常→改为停用', '立即']);
  assert.ok(await dialog.getByText('带 * 的为必填项').isVisible(), '原因必填时才显示必填说明');
  await dialog.getByRole('button', { name: '停用', exact: true }).click();
  await dialog.getByText('请填写原因').waitFor();
  await shot(p, 'desktop-confirm-required');
  assert.equal(await dialog.getByLabel('原因').getAttribute('aria-invalid'), 'true', 'FormField 自动接 aria-invalid');
  assert.match(await dialog.getByLabel('原因').getAttribute('aria-describedby'), /-error$/, 'FormField 自动接 aria-describedby');
  await dialog.getByLabel('原因').fill('模拟失败');
  await dialog.getByRole('button', { name: '停用', exact: true }).click();
  await dialog.getByText('演示：服务端拒绝了这次操作，请重试').waitFor();
  assert.equal(await dialog.getByLabel('原因').inputValue(), '模拟失败', 'onConfirm 失败时弹窗不关、原因不丢');
  await dialog.getByLabel('原因').fill('测试停用');
  await p.keyboard.press('Escape');
  await p.getByRole('heading', { name: '放弃已填写的原因？' }).waitFor();
  await p.getByRole('button', { name: '继续填写', exact: true }).click();
  assert.equal(await dialog.getByLabel('原因').inputValue(), '测试停用', '放弃确认返回后原因还在');
  await dialog.getByRole('button', { name: '停用', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await rowOf(activeId).getByText('停用', { exact: true }).waitFor();

  // OneTimeSecretDialog: cannot close before copy or acknowledgement.
  await rowAct(p.locator('#aui-page-users tbody tr').first(), '生成接口令牌');
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('button', { name: '我已保存，关闭' }).count(), 1);
  await p.keyboard.press('Escape');
  await dialog.getByText(/还没有保存/).waitFor();
  await p.waitForTimeout(300);
  await shot(p, 'desktop-secret-warning');
  assert.ok(await dialog.isVisible(), '未复制未勾选时 Esc 不关闭');
  await dialog.getByRole('button', { name: '我已保存，关闭' }).click();
  assert.ok(await dialog.isVisible(), '未复制未勾选时底部按钮也不关闭');
  await dialog.getByRole('button', { name: '复制', exact: true }).click();
  await dialog.getByText(/已复制到剪贴板|复制失败，请手动选中复制/).waitFor();
  if (await dialog.getByText('复制失败，请手动选中复制').count()) {
    assert.ok(await dialog.isVisible());
    await dialog.getByLabel('我已保存').click();
  }
  await dialog.getByRole('button', { name: '我已保存，关闭' }).click();
  await dialog.waitFor({ state: 'hidden' });

  // DescriptionList on the detail page: missing value renders —.
  await p.getByRole('button', { name: '查看详情', exact: true }).first().click();
  await p.getByRole('heading', { name: '用户详情', exact: true }).waitFor();
  const facts = await p.locator('#aui-page-detail .aui-desc-item').evaluateAll((els) => els.map((el) => [el.querySelector('dt').textContent, el.querySelector('dd').firstChild?.textContent]));
  assert.deepEqual(facts.at(-1), ['邀请人', '—']);
  await shot(p, 'desktop-detail-description-list');
  assert.equal(await p.title(), '用户详情 · Acme 工作台');
  await p.getByRole('button', { name: '返回列表' }).click();

  // Dark mode: in-page tabs have no slab.
  await p.getByRole('button', { name: '切换到深色模式' }).click();
  await nav('系统设置');
  const wrap = await p.locator('.aui-section-tabs-wrap').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(wrap, 'rgba(0, 0, 0, 0)', '深色模式下页内 Tabs 不画一块底色');
  await shot(p, 'dark-settings-tabs');
  await nav('用户管理');
  await p.getByRole('button', { name: /的更多操作$/ }).first().click();
  await menu.waitFor();
  await shot(p, 'dark-row-menu');
  await p.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached' });
  await rowAct(p.locator('#aui-page-users tbody tr').first(), '编辑资料');
  await dialog.waitFor();
  await p.getByRole('button', { name: '取消', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await p.getByRole('button', { name: '切换到浅色模式' }).click();

  // 2.4.0 TabbedPage: one big title, tab ↔ panel wiring, embedded PageHeader, keepMounted, active flag.
  await nav('系统设置');
  const settings = p.locator('#aui-page-settings');
  const tab = (name) => settings.getByRole('tab', { name, exact: true });
  assert.equal(await settings.locator('h1').count(), 1, 'TabbedPage 只有一个大标题');
  await tab('安全策略').click();
  const security = settings.getByRole('tabpanel', { name: '安全策略' });
  await security.waitFor();
  assert.equal(await tab('安全策略').getAttribute('aria-controls'), await security.getAttribute('id'), '当前 tab 的 aria-controls 指向分区面板');
  assert.equal(await settings.locator('h1').count(), 1, '分区里的 PageHeader 不再出第二个大标题');
  // 5.2 / 5.3：分区页头的说明收进「?」，按钮和「?」并进分区里第一个面板（登录防护）的标题行，不单独占一行
  assert.equal(await security.getByText(/登录防护、短信配额/).count(), 0, '分区页头不显示说明段落');
  const panelHead = security.locator('.aui-panel-header').first();
  const help = panelHead.getByRole('button', { name: '安全策略说明' });
  await help.hover();
  assert.ok(await p.getByRole('tooltip').filter({ hasText: /登录防护、短信配额/ }).isVisible(), '悬停「?」显示说明');
  await p.mouse.move(5, 5);
  assert.ok(await panelHead.getByRole('button', { name: '模拟渲染出错' }).isVisible(), '分区按钮并进面板标题行');
  assert.equal(await security.locator('.aui-page-header').count(), 0, '分区页头不单独占一行');
  assert.equal(await settings.locator('[role=tabpanel][hidden]').count(), 1, '打开过的分区切走不卸载');
  assert.ok(await security.getByText('本分区可见').isVisible(), '当前分区 active=true');

  // SegmentedControl: arrows move focus only, skip disabled, wrap; Enter picks; one tab stop.
  const level = security.getByRole('group', { name: '验证强度' });
  const pressed = () => level.locator('[aria-pressed=true]').innerText();
  const focused = () => p.evaluate(() => document.activeElement?.textContent);
  assert.equal(await pressed(), '标准');
  assert.deepEqual(await level.getByRole('button').evaluateAll((els) => els.map((b) => b.tabIndex)), [-1, 0, -1, -1], '只有选中项在 Tab 顺序里');
  await level.getByRole('button', { name: '标准' }).focus();
  await p.keyboard.press('ArrowRight');
  assert.equal(await focused(), '严格');
  assert.equal(await pressed(), '标准', '方向键只移焦点、不选');
  await p.keyboard.press('ArrowRight');
  assert.equal(await focused(), '宽松', '跳过禁用项并循环');
  await p.keyboard.press('Enter');
  assert.equal(await pressed(), '宽松', 'Enter 才选');
  await level.getByRole('button', { name: '严格' }).click();
  assert.equal(await pressed(), '严格');

  // ChipGroup: aria-pressed toggles, disabled chip inert.
  const chips = security.getByRole('group', { name: '二次验证方式' });
  await chips.getByRole('button', { name: /^邮箱/ }).click();
  await chips.getByRole('button', { name: /^短信/ }).click();
  assert.deepEqual(await chips.getByRole('button').evaluateAll((els) => els.map((b) => b.getAttribute('aria-pressed'))), ['false', 'true', 'false', 'false']);
  assert.equal(await chips.getByRole('button', { name: '硬件密钥' }).isDisabled(), true);

  // QuickDatePresets fill the datetime-local input; 永久 clears it.
  const datePresets = security.getByRole('group', { name: '快捷截止时间' });
  await datePresets.getByRole('button', { name: '7 天', exact: true }).click();
  assert.match(await security.getByLabel('临时放行截止', { exact: true }).inputValue(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, 'DateTimePicker 显示「日期 时间」，值仍是 datetime-local 格式');
  await datePresets.getByRole('button', { name: '永久', exact: true }).click();
  assert.equal(await security.getByLabel('临时放行截止', { exact: true }).inputValue(), '');
  await shot(p, 'desktop-tabbed-page');

  // keepMounted: local state survives switching sections; hidden section gets active=false.
  await tab('模块开关').click();
  assert.equal(await settings.locator('[role=tabpanel][hidden]').getByText('本分区隐藏').count(), 1, '隐藏分区 active=false');
  await tab('安全策略').click();
  assert.equal(await pressed(), '严格', '切走再回来，分区里的状态还在');

  // PanelErrorBoundary: a crash breaks only the section; 重试 remounts it.
  await security.getByRole('button', { name: '模拟渲染出错' }).click();
  await security.getByRole('alert').filter({ hasText: '这一块出错了：演示：分区渲染异常' }).waitFor();
  assert.equal(await settings.locator('h1').count(), 1, '页头和分区标签照常显示');
  await shot(p, 'desktop-tabbed-page-error');
  await tab('模块开关').click();
  assert.ok(await settings.getByRole('switch', { name: '开放注册' }).isVisible(), '别的分区照常可用');
  await tab('安全策略').click();
  await security.getByRole('button', { name: '重试', exact: true }).click();
  await security.getByRole('group', { name: '验证强度' }).waitFor();

  // CopyableValue variant="inline": as tall as plain text in the same row, named copy icon.
  await nav('资金账本');
  const ledgerRow = p.locator('#aui-page-ledger tbody tr').first();
  await ledgerRow.waitFor();
  const copyCell = await ledgerRow.evaluate((row) => {
    const [first, second] = row.querySelectorAll('td');
    // A plain-text cell's line box is its line-height; the copy value must not exceed one line.
    return { copy: first.querySelector('.aui-copy-inline').getBoundingClientRect().height, line: parseFloat(getComputedStyle(second).lineHeight) };
  });
  assert.ok(copyCell.copy <= copyCell.line + 0.5, `行内复制和普通文字一样高（一行），实测 ${JSON.stringify(copyCell)}`);
  const copyButton = ledgerRow.getByRole('button', { name: /^复制流水号 / });
  await copyButton.click();
  await ledgerRow.getByRole('status').filter({ hasText: /已复制|复制失败/ }).waitFor();

  // CommandPalette: header search from navCommands, word matching in any order, group as the right-side note, left-aligned.
  const paletteTrigger = p.getByRole('button', { name: /^搜索与命令/ });
  assert.equal(await paletteTrigger.count(), 1);
  assert.ok(await paletteTrigger.locator('.aui-keys').isVisible(), '桌面显示 Ctrl/⌘ K 提示');
  await paletteTrigger.click();
  const palette = p.getByRole('dialog', { name: '搜索与命令' });
  const paletteInput = palette.getByRole('combobox', { name: '搜索与命令' });
  await paletteInput.fill('内容 用户');
  assert.deepEqual(await palette.locator('[role=option] .aui-cmdk-title').allInnerTexts(), ['用户管理', '公告编辑'], '每个词都要出现，不分先后（分组也能搜）');
  assert.equal(await palette.locator('[role=option]').first().locator('.aui-cmdk-meta').textContent(), '用户与内容');
  assert.ok(await palette.locator('[role=option]').first().evaluate((el) => el.querySelector('.aui-cmdk-title').getBoundingClientRect().left - el.getBoundingClientRect().left < 60), '结果左对齐');
  await shot(p, 'desktop-command-palette');
  await paletteInput.fill('账单');
  await palette.getByRole('option', { name: /资金账本/ }).click();
  await palette.waitFor({ state: 'hidden' });
  assert.equal(await p.title(), '资金账本 · Acme 工作台', 'NavItem.keywords 可搜，选中后跳到对应页面');

  // Narrow phone: pagination shows 「第 x / y 页」 between prev/next, footer does not wrap.
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto(url);
  // 手机上 DataTable 是卡片列表
  await phone.locator('#aui-page-users .aui-table-card').first().waitFor();
  await shot(phone, 'phone-users');
  const footer = phone.locator('#aui-page-users .aui-pagination');
  assert.ok(await footer.locator('.aui-page-compact').isVisible(), '窄屏显示文字页码');
  assert.equal(await footer.getByRole('button', { name: '第 2 页' }).isVisible(), false, '窄屏不显示页码按钮');
  const row = await footer.locator('> div').evaluate((el) => {
    const buttons = [...el.querySelectorAll(':scope > button, :scope > .aui-page-compact')].map((b) => { const r = b.getBoundingClientRect(); return (r.top + r.bottom) / 2; });
    return Math.max(...buttons) - Math.min(...buttons);
  });
  assert.ok(row < 8, `翻页控件在同一行，实测高差 ${row}`);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '手机不横向溢出');
  assert.equal(await phone.locator('.aui-command-trigger .aui-keys').isVisible(), false, '≤720px 隐藏 Ctrl/⌘ K 提示');
  assert.ok(await phone.locator('.aui-topbar').evaluate((el) => el.scrollWidth <= el.clientWidth), '手机顶栏放得下搜索按钮');
  const menuTrigger = phone.getByRole('button', { name: /的更多操作$/ }).first();
  const size = await menuTrigger.evaluate((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height); });
  assert.ok(size >= 40, `手机上菜单按钮至少 40px，实测 ${size}`);
  await menuTrigger.click();
  const phoneMenu = await phone.getByRole('menu').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, item: el.querySelector('[role=menuitem]').getBoundingClientRect().height }; });
  await shot(phone, 'phone-row-menu');
  assert.ok(phoneMenu.left >= 8 && phoneMenu.right <= 390 - 8 && phoneMenu.item >= 40, `手机菜单在屏内且触控高度够，实测 ${JSON.stringify(phoneMenu)}`);
  await phone.close();

  // Field cells on the starter「客户与订单」: +N popover by keyboard (focus in, Tab closes back to +N), safe new-tab
  // link with one-line ellipsis, one-line date with time-zone title, people chips with hint in the title.
  await nav('客户与订单');
  const records = p.locator('#aui-page-business');
  await records.locator('tbody tr[data-row-key]').first().waitFor();
  const plus = records.locator('tr[data-row-key="SO-0003"] button.aui-chip-more').first();
  await plus.focus();
  await p.keyboard.press('Enter');
  const pop = p.getByRole('dialog', { name: /^另外 \d+ 项$/ });
  await pop.waitFor();
  assert.equal(await pop.evaluate((el) => el === document.activeElement), true, '+N 弹出层打开后接住焦点');
  await shot(p, 'desktop-cell-tags-popover');
  await p.keyboard.press('Tab');
  await pop.waitFor({ state: 'detached' });
  assert.equal(await p.evaluate(() => Boolean(document.activeElement?.closest('#aui-page-business tbody'))), true, 'Tab 关闭弹出层，焦点从 +N 接着往后走，不丢到页面顶部');
  const link = records.locator('tr[data-row-key="SO-0001"] a.aui-cell-link');
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(await link.locator('.aui-cell-link-text').evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === 'ellipsis'), '长网址一行省略');
  const date = records.locator('tr[data-row-key="SO-0001"] td').filter({ has: p.locator('time.aui-cell-date') }).last().locator('time.aui-cell-date');
  assert.match(await date.innerText(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.match(await date.getAttribute('data-tip'), /:\d{2}（Asia\/Shanghai）$/);
  assert.equal(await records.locator('tr[data-row-key="SO-0002"] .aui-chip[data-tip]').filter({ hasText: '林宁' }).first().getAttribute('data-tip'), '林宁 · 交付组');

  assert.deepEqual(errors, []);
  console.log(`PASS components (${output}): RowActionBar fit (no ⋯ beside room for the next button), RowActions menu (keyboard/Esc focus return/outside click/disabled reason/phone 40px), ConfirmDialog (impact, required reason, discard prompt only after typing, resolve closes), ChangeList, OneTimeSecretDialog close guard, DescriptionList —, PageHeader actions top-right, document.title, silent refresh keeps rows, narrow-phone pagination text, dark-mode tabs; 2.4.0 TabbedPage (one h1, aria wiring, embedded header row, keepMounted, active flag, error boundary + retry), SegmentedControl keyboard, ChipGroup, QuickDatePresets, inline CopyableValue height, CommandPalette word match / group / left-aligned / mobile kbd hidden; 3.0 CellTags +N keyboard popover, CellLink safe new tab + ellipsis, CellDate time-zone title, CellPeople hint`);
} finally {
  await server?.close();
  await browser.close();
}
