// 6.0 page templates (PAGE-TEMPLATES.md, T01–T13): every template page of the starter at
// 1440×900, light and dark — no page errors, no horizontal overflow, no page header taking its own
// row, at most 3 visible row actions, compact KPI / stat tiles (≤ 100px), the workspace page never
// scrolls; plus no horizontal overflow at 390px. Screenshots go to test/artifacts/page-templates/ to compare with design/templates/tNN-*.png.
// bt/templates: T15 表格工作区 / T16 公开页 / T17 看板搭建器 bring their own shell and open as whole pages (#template=…):
// rail 60 + tree 232 + title bar 48, the page never scrolls, collapsible tree, tree search / keyboard, phone bottom bar +
// drawer; public pages centred (PublicForm 688 / FormSuccess 560 / narrow 440) with touch-size controls on phones;
// T17 = DashboardBuilder (232 | canvas | 324, rename / undo / redo / settings), t17-frame = BuilderLayout.
// Compare with design/templates/t15-workspace.png, t16-public-form.png, t17-dashboard-builder.png.
// bt/flush: 系统 → 工作区贴边 = TabbedPage with workspace sections + one card-flow section: the tab bar sits flush on the
// workspace (no 16px strip), a hidden-but-mounted workspace never strips the card-flow section's padding, Pane fill /
// notice / padding, QueryBar flush, ResourcePanel as a column scrolling inside, RecordHeader flat in a Pane header
// (test/flush-checks.mjs: no gaps, one line between columns, no rounded / shadowed panel inside .aui-workspace).
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import { checkFlushSection, edges, flushFacts, openFlush } from './flush-checks.mjs';
import { checkNarrowModes } from './narrow-checks.mjs';

const executablePath = () => { const cached = '/home/admin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'; return process.env.CHROMIUM_PATH || (existsSync(cached) ? cached : chromium.executablePath()); };

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/page-templates');
mkdirSync(output, { recursive: true });

const TEMPLATES = [
  ['tpl-t01', 'T01 工作台首页', 't01-home'],
  ['tpl-t02', 'T02 资源列表页', 't02-list'],
  ['tpl-t03', 'T03 指标 + 列表', 't03-kpi-list'],
  ['tpl-t04', 'T04 统计看板页', 't04-stats'],
  ['tpl-t05', 'T05 分区合并页', 't05-sections'],
  ['tpl-t06', 'T06 日志 / 时间线', 't06-log'],
  ['tpl-t07', 'T07 关系图 / 监控', 't07-graph'],
  ['tpl-t08', 'T08 设置 / 表单', 't08-settings'],
  ['tpl-t09', 'T09 权限配置页', 't09-matrix'],
  ['tpl-t10', 'T10 工具 / 工作区', 't10-workspace'],
  ['tpl-t11', 'T11 进度 / 工作项', 't11-board'],
  ['tpl-t12', 'T12 向导页', 't12-wizard'],
  ['tpl-t13', 'T13 个人页', 't13-personal'],
];

// bt/templates: [hash, name, screenshot slug]
const STANDALONE = [
  ['t15', 'T15 表格工作区', 't15-workspace'],
  ['t16-form', 'T16 公开页 · 填表', 't16-public-form'],
  ['t16-success', 'T16 公开页 · 提交成功', 't16-public-success'],
  ['t16-expired', 'T16 公开页 · 已停止收集', 't16-public-expired'],
  ['t16-visitor', 'T16 公开页 · 访客', 't16-public-visitor'],
  ['t16-password', 'T16 公开页 · 密码门', 't16-public-password'],
  ['t17', 'T17 看板搭建器', 't17-builder'],
  ['t17-frame', 'T17 搭建器框架', 't17-frame'],
];
const box = (page, selector) => page.locator(selector).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: Math.round(r.width), h: Math.round(r.height), bottom: r.bottom, right: r.right }; });
async function standalone(p, url, menu) {
  // The menu entries jump to the whole-page templates.
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto(url);
  await p.locator('tbody tr').first().waitFor();
  await menu.getByRole('button', { name: 'T15 表格工作区', exact: true }).click();
  await p.locator('.aui-rail-shell').waitFor();
  assert.match(p.url(), /#template=t15$/, '菜单「T15 表格工作区」打开整页');
  const open = async (hash, width) => {
    await p.setViewportSize({ width, height: width > 500 ? 900 : 844 });
    await p.goto(`${url}#template=${hash}`);
    await p.reload();
    await p.locator('.aui-rail-shell, .aui-public, .aui-pform').first().waitFor();
    await p.waitForTimeout(500);
    await p.mouse.move(width - 10, 10);
    await p.waitForTimeout(200);
  };
  const overflow = () => p.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
  for (const mode of ['light', 'dark']) {
    for (const [hash, name, slug] of STANDALONE) {
      await open(`${hash}${mode === 'dark' ? '&dark' : ''}`, 1440);
      const o = await overflow();
      assert.ok(o.x <= 0, `${name}（${mode}）横向溢出 ${o.x}px`);
      assert.equal(await p.locator('.aui-shell').count(), 0, `${name}：不在后台外壳里`);
      if (hash === 't15' || hash.startsWith('t17')) {
        assert.ok(o.y <= 0, `${name}（${mode}）整页不能滚：多出 ${o.y}px`);
        const rail = await box(p, '.aui-rail');
        assert.equal(rail.w, 60, `${name}：图标栏 60px（和 AdminShell 统一，实际 ${rail.w}）`);
        assert.equal(await p.locator('.aui-rail .aui-rail-item').count(), 9, `${name}：7 个模块 + 通知 + 设置`);
        const item = await box(p, '.aui-rail .aui-rail-item');
        assert.ok(item.w === 48 && item.h >= 48, `${name}：图标按钮 48×48 带文字（${item.w}×${item.h}）`);
      }
      if (hash === 't15') {
        assert.equal((await box(p, '.aui-rail-side')).w, 232, 'T15：目录 232px');
        const title = await box(p, '.aui-wtitle');
        assert.equal(title.h, 48, `T15：标题栏 48px（实际 ${title.h}）`);
        assert.equal(await p.locator('.aui-wtitle h1').textContent(), '客户', 'T15：标题栏显示表名');
        for (const sel of ['.aui-scope-pill', '.aui-wtitle .aui-avatar-stack', '.aui-vtabs', '.aui-grid-panel', '.aui-grid-leading .aui-split-button'])
          assert.ok(await p.locator(sel).first().isVisible(), `T15：${sel} 在`);
        const grid = await box(p, '.aui-grid-panel');
        assert.ok(grid.bottom <= 900 + 1, `T15：表格在一屏内撑到底（底边 ${grid.bottom}）`);
        assert.ok(title.y === 0 && (await box(p, '.aui-vtabs')).y >= 48, 'T15：标题栏 → 视图标签 → 工具栏 → 表格，从上往下');
      }
      if (hash === 't17') {
        // T17 = RailShell + DashboardBuilder（组件库 248 | 6 列画布；组件设置只在选中时出现，审阅 06）
        const lib = await box(p, '.aui-dbb-lib');
        const canvas = await box(p, '.aui-dbb-panes > .aui-dbb-scroll');
        assert.equal(await p.locator('.aui-dbb-cfg').count(), 0, 'T17：没选中卡片时没有设置栏');
        assert.ok(lib.w === 248 && canvas.w > 900, `T17：两栏 248 | 画布（${lib.w} | ${canvas.w}）`);
        await p.locator('.aui-dbb-widget', { hasText: '每天有效跟进' }).click({ position: { x: 300, y: 12 } });
        const cfg = await box(p, '.aui-dbb-cfg');
        assert.ok(cfg.w === 320, `T17：选中后右边 320 设置栏（${cfg.w}）`);
        assert.ok(lib.bottom <= 901 && cfg.bottom <= 901 && canvas.bottom <= 901, 'T17：三栏都在一屏内，各自滚');
        await p.keyboard.press('Escape');
        assert.ok(lib.x === 60, `T17：搭建器贴着图标栏（${lib.x}）`);
        assert.ok((await p.locator('.aui-dbb-widget').count()) >= 6, 'T17：画布上是真实的看板组件');
        for (const label of ['撤销（Ctrl+Z）', '重做（Ctrl+Shift+Z）', '预览', '保存']) assert.ok(await p.getByRole('button', { name: label, exact: true }).first().isVisible(), `T17：顶栏有「${label}」`);
      }
      if (hash === 't17-frame') {
        const lib = await box(p, '.aui-builder-library');
        const cfg = await box(p, '.aui-builder-config');
        const canvas = await box(p, '.aui-builder-canvas');
        assert.ok(lib.w === 232 && cfg.w === 324 && canvas.w > 700, `T17 框架：三栏 232 | 画布 | 324（${lib.w} | ${canvas.w} | ${cfg.w}）`);
        assert.ok(lib.bottom <= 901 && cfg.bottom <= 901 && canvas.bottom <= 901, 'T17 框架：三栏都在一屏内，各自滚');
        for (const label of ['撤销', '重做', '预览', '保存']) assert.ok(await p.getByRole('button', { name: label, exact: true }).first().isVisible(), `T17 框架：顶栏有「${label}」`);
      }
      if (hash === 't16-expired') {
        const card = await box(p, '.aui-pubform');
        assert.ok(card.w <= 440 && Math.abs(card.x - (1440 - card.right)) <= 2, `${name}：居中一栏 ≤ 440px（${card.w}，左 ${card.x}）`);
      }
      if (hash === 't16-form' || hash === 't16-success') {
        // T16 填表 = PublicForm（688），提交成功 = FormSuccess（560）
        const card = await box(p, '.aui-pform-card');
        const max = hash === 't16-form' ? 688 : 560;
        assert.ok(card.w <= max && Math.abs(card.x - (1440 - card.right)) <= 2, `${name}：居中一栏 ≤ ${max}px（${card.w}，左 ${card.x}）`);
      }
      await p.screenshot({ path: resolve(output, `${slug}${mode === 'dark' ? '-dark' : ''}.png`), animations: 'disabled' });
    }
  }

  // T15 behaviour: fold the tree away and back, search it, walk it with the keyboard, the business-line pill.
  await open('t15', 1440);
  await p.getByRole('button', { name: '收起数据表目录', exact: true }).click();
  assert.ok(await p.locator('.aui-rail-side').isHidden(), '收起目录');
  assert.equal((await box(p, '.aui-wtitle')).x, 60, '目录收起后工作区贴着图标栏');
  await p.getByRole('button', { name: '展开目录', exact: true }).click();
  assert.ok(await p.locator('.aui-rail-side').isVisible(), '标题栏「展开目录」');
  const tree = p.getByRole('navigation', { name: '数据表目录' });
  assert.equal(await tree.getByRole('button', { name: /^资料\s*3\s*项$/ }).getAttribute('aria-expanded'), 'false', '收起的文件夹');
  assert.equal(await tree.getByRole('button', { name: /^资料\s*3\s*项$/ }).locator('.aui-navtree-label').innerText(), '资料', '名字里不带括号数量');
  assert.equal(await tree.getByRole('button', { name: /^销售\s*3\s*项$/ }).locator('.aui-navtree-count').textContent(), '3 项', '展开的文件夹右侧也有灰色数量（「项」只给读屏）');
  await p.getByRole('searchbox', { name: '搜索数据表目录' }).fill('安装');
  assert.deepEqual(await tree.locator('.aui-navtree-item .aui-navtree-label').allTextContents(), ['安装工单', '安装手册'], '搜索：只留命中的行，文件夹自动展开');
  await p.getByRole('searchbox', { name: '搜索数据表目录' }).fill('没有这个');
  assert.match(await tree.textContent(), /没有找到「没有这个」/);
  await tree.getByRole('button', { name: '清除' }).click();
  await tree.getByRole('button', { name: /^销售\s*3\s*项$/ }).focus();
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(() => document.activeElement?.textContent?.trim()), '客户1,284', '↓ 走到下一行');
  await p.keyboard.press('End');
  assert.equal(await p.evaluate(() => document.activeElement?.textContent?.trim()), '官网咨询表单', 'End 到最后一行');
  await tree.getByRole('button', { name: /^交付\s*2\s*项$/ }).focus();
  await p.keyboard.press('ArrowLeft');
  assert.equal(await tree.getByRole('button', { name: /^交付\s*2\s*项$/ }).getAttribute('aria-expanded'), 'false', '← 收起文件夹');
  await tree.getByRole('button', { name: /^商机/ }).click();
  assert.equal(await tree.getByRole('button', { name: /^商机/ }).getAttribute('aria-current'), 'page', '点一行变成当前');
  await p.locator('.aui-scope-pill').click();
  assert.equal(await p.getByRole('menu').getByRole('menuitemcheckbox').count(), 3, '业务线胶囊：切换菜单列出业务线');
  await p.keyboard.press('Escape');

  // T17 框架（BuilderLayout）: undo / redo, rename in place, closing the settings pane.
  await open('t17-frame', 1440);
  for (let i = 0; i < 3; i++) await p.getByRole('button', { name: '撤销', exact: true }).click();
  assert.ok(await p.getByRole('button', { name: '撤销', exact: true }).isDisabled(), '撤销到头灰掉');
  assert.ok(await p.getByRole('button', { name: '重做', exact: true }).isEnabled(), '能重做');
  await p.getByRole('button', { name: '改名字', exact: true }).click();
  await p.getByRole('textbox', { name: '名字' }).fill('二组周会看板');
  await p.keyboard.press('Enter');
  await p.locator('.aui-builder-title h1', { hasText: '二组周会看板' }).waitFor();
  await p.getByRole('button', { name: '关闭组件设置', exact: true }).click();
  assert.equal(await p.locator('.aui-builder-config').count(), 0, '没有选中组件时不显示右栏');
  assert.ok((await box(p, '.aui-builder-canvas')).w > 1000, '右栏关掉后画布变宽');

  // T17 behaviour: rename in place, undo / redo, select a widget → its settings, close them.
  await open('t17', 1440);
  const undo = p.getByRole('button', { name: '撤销（Ctrl+Z）', exact: true });
  const redo = p.getByRole('button', { name: '重做（Ctrl+Shift+Z）', exact: true });
  assert.ok(await undo.isDisabled(), '没改过时撤销灰掉');
  await p.getByRole('button', { name: '改看板名称', exact: true }).click();
  await p.getByRole('textbox', { name: '看板名称' }).fill('二组周会看板');
  await p.keyboard.press('Enter');
  await p.locator('.aui-dbb-name b', { hasText: '二组周会看板' }).waitFor();
  assert.match(await p.locator('.aui-dbb-status').innerText(), /1 处修改未保存/);
  await undo.click();
  await p.locator('.aui-dbb-name b', { hasText: '一组周会看板' }).waitFor();
  assert.ok(await redo.isEnabled(), '撤销后能重做');
  await p.locator('.aui-dbb-widget', { hasText: '每天有效跟进' }).click({ position: { x: 300, y: 12 } });
  await p.getByRole('complementary', { name: '组件设置' }).getByRole('button', { name: '关闭组件设置', exact: true }).click();
  assert.equal(await p.locator('.aui-dbb-cfg').count(), 0, '关掉设置，画布占满');

  // Phones (390px): no overflow; T15 rail → bottom bar, tree → drawer; public pages use touch sizes.
  for (const [hash, name, slug] of STANDALONE) {
    await open(hash, 390);
    const o = await overflow();
    assert.ok(o.x <= 0, `${name}（390px）横向溢出 ${o.x}px`);
    if (hash === 't15') {
      assert.ok(await p.locator('.aui-rail').isHidden(), 'T15 手机：图标栏收起');
      const bottom = p.getByRole('navigation', { name: '常用模块' });
      assert.equal(await bottom.getByRole('button').count(), 5, 'T15 手机：底栏 4 个模块 + 更多');
      assert.ok(o.y <= 0, 'T15 手机：整页不滚');
      await p.getByRole('button', { name: '打开目录', exact: true }).click();
      await p.waitForTimeout(350);
      const side = await box(p, '.aui-rail-side');
      assert.ok(side.x >= 0 && side.right <= 390, 'T15 手机：目录从左边滑出');
      await p.screenshot({ path: resolve(output, `${slug}-390-drawer.png`), animations: 'disabled' });
      await p.getByRole('navigation', { name: '数据表目录' }).getByRole('button', { name: /^跟进记录/ }).click();
      await p.waitForTimeout(350);
      assert.ok((await box(p, '.aui-rail-side')).right <= 0, 'T15 手机：选了一张表，目录收回');
      await bottom.getByRole('button', { name: '更多' }).click();
      // 8.3: the phone sheet is a lazy chunk (prefetched when idle) — wait for it instead of checking at once
      assert.ok(await p.getByRole('menu', { name: '更多模块' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'T15 手机：「更多」列出其余模块');
      await p.keyboard.press('Escape');
    }
    if (hash.startsWith('t16')) {
      const small = await p.evaluate(() => [...document.querySelectorAll(':is(.aui-public, .aui-pform) :is(.aui-input, .aui-button:not(.aui-button-sm))')]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .filter((el) => el.getBoundingClientRect().height < 44).map((el) => `${el.className} ${Math.round(el.getBoundingClientRect().height)}`));
      assert.deepEqual(small, [], `${name}（390px）：按钮、输入框都是触屏尺寸（≥ 44px）`);
    }
    if (hash === 't16-form') assert.equal(await p.locator('.aui-pform-bar').evaluate((el) => getComputedStyle(el).position), 'sticky', 'T16 手机：「已填 N / M 题」进度条吸顶');
    await p.screenshot({ path: resolve(output, `${slug}-390.png`), fullPage: hash.startsWith('t16'), animations: 'disabled' });
  }
}


// bt/flush: the 工作区贴边 page. 客户表 = list Pane | Pane fill (notice + QueryBar flush + DataTable + pagination) | ResourcePanel column;
// 记录 = Pane with RecordHeader in the header + notice + padding md; 卡片流 = normal PageBody next to the mounted workspaces.
async function flushPage(browser, url) {
  await checkFlushSection(browser, url, '客户表', output, 'table', async (p, area, { width, label }) => {
    const visible = area.locator('.aui-tabbed-panel:not([hidden])');
    const pane = visible.locator('.aui-pane[aria-label="客户"]');
    const box = await edges(pane);
    const inset = width > 760 ? 16 : 12;
    const alert = await edges(pane.locator('.aui-pane-notice .aui-inline-alert'));
    assert.ok(alert.x - box.ix === inset && box.iright - alert.right === inset, `${label}：notice 提示条离栏边 ${inset}px（左 ${alert.x - box.ix}，右 ${box.iright - alert.right}）`);
    const query = await edges(pane.locator('.aui-query[data-variant=flush]'));
    assert.ok(query.x === box.ix && query.right === box.iright && query.radius === 0 && query.shadow === 'none' && query.bb === 1 && query.pl === inset, `${label}：QueryBar flush 贴边、底下一条线、内边距 ${inset}（${JSON.stringify(query)}）`);
    const table = await edges(pane.locator('.aui-table-panel'));
    assert.ok(table.x === box.ix && table.right === box.iright && table.radius === 0, `${label}：表格贴着栏边`);
    if (width <= 1100) return;
    assert.equal((await edges(pane.locator('.aui-pane-body'))).scroll, 0, `${label}：Pane fill 主体不滚`);
    assert.ok(Math.abs((await edges(pane.locator('.aui-pagination'))).bottom - box.bottom) <= 1, `${label}：分页贴着栏底`);
    // ResourcePanel as the right column: scrolls inside, header sticky, the page does not scroll.
    const resource = visible.locator('.aui-workspace > .aui-resource');
    const scroller = resource.locator('.aui-table-scroll');
    assert.ok((await edges(scroller)).scroll > 0, `${label}：ResourcePanel 一栏在自己的表格区里滚`);
    const head = await edges(resource.locator('.aui-panel-header'));
    assert.equal(head.h, (await edges(pane.locator('.aui-pane-head'))).h, `${label}：ResourcePanel 标题行和旁边栏头一样高`);
    await scroller.evaluate((el) => el.scrollTo(0, 300));
    assert.equal((await edges(scroller.locator('th'))).y, (await edges(scroller)).y, `${label}：滚动后表头吸顶`);
    assert.ok(Math.abs((await edges(resource)).bottom - box.bottom) <= 1, `${label}：ResourcePanel 一栏撑到底`);
  });
  await checkFlushSection(browser, url, '记录', output, 'record', async (p, area, { width, label }) => {
    const pane = area.locator('.aui-tabbed-panel:not([hidden]) .aui-pane[aria-label="客户详情"]');
    const box = await edges(pane);
    const inset = width > 760 ? 16 : 12;
    const head = await edges(pane.locator('.aui-pane-head'));
    const rhead = await edges(pane.locator('.aui-pane-head > .aui-rhead'));
    assert.ok(head.pl === 0 && rhead.x === box.ix && rhead.image === 'none' && rhead.radius === 0 && rhead.bb === 0, `${label}：RecordHeader 在栏头里是平的（无渐变块、无第二条线）（${JSON.stringify(rhead)}）`);
    const alert = await edges(pane.locator('.aui-pane-notice .aui-inline-alert'));
    assert.ok(alert.x - box.ix === inset && box.iright - alert.right === inset, `${label}：notice 离栏边 ${inset}px`);
    assert.equal((await edges(pane.locator('.aui-pane-body'))).pl, inset, `${label}：padding="md" 主体内边距 ${inset}px`);
  });
  // 页签 = Pane fill (ref, data-*, onContextMenuCapture) whose body is a Tabs with an owned tabpanel: the tab bar sits flush
  // (no 16px gap, one line), the panel is transparent to the flush rules (toolbar 16px, gallery 16px inset, table flush) and,
  // as the last block of the fill body, takes the remaining height (gallery / table scroll inside, pagination at the bottom).
  await checkFlushSection(browser, url, '页签', output, 'tabs', async (p, area, { width, label }) => {
    const pane = area.locator('.aui-tabbed-panel:not([hidden]) .aui-pane[aria-label="客户页签"]');
    const box = await edges(pane);
    const inset = width > 760 ? 16 : 12;
    assert.equal(await pane.getAttribute('data-demo'), 'pane-tabs', `${label}：data-* 传到 Pane 根元素`);
    assert.equal(await pane.evaluate((el) => el.tagName), 'SECTION');
    assert.match(await pane.locator('.aui-pane-title small').innerText(), new RegExp(`栏宽 ${box.w}px`), `${label}：ref 拿到 Pane 根元素（量出栏宽）`);
    const tab = pane.getByRole('tab', { name: /画册/ });
    const panel = pane.getByRole('tabpanel');
    assert.equal(await panel.count(), 1, `${label}：Tabs 自己的 tabpanel 还在`);
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    assert.equal(await tab.getAttribute('aria-controls'), await panel.getAttribute('id'), `${label}：tab aria-controls → tabpanel`);
    assert.equal(await panel.getAttribute('aria-labelledby'), await tab.getAttribute('id'), `${label}：tabpanel aria-labelledby → tab`);
    const bar = await edges(pane.locator('.aui-section-tabs-bar'));
    assert.ok(bar.x === box.ix && bar.right === box.iright && bar.bb === 1, `${label}：标签条贴着栏边、一条底线（${JSON.stringify(bar)}）`);
    assert.equal(await pane.locator('.aui-section-tabs-bar').evaluate((el) => parseFloat(getComputedStyle(el).marginBottom)), 0, `${label}：标签条下不留缝`);
    const toolbar = await edges(panel.locator('.aui-grid-toolbar'));
    assert.ok(toolbar.y === bar.bottom && toolbar.pl === inset, `${label}：面板里的工具栏紧贴标签条、左右 ${inset}px（${JSON.stringify(toolbar)}）`);
    const gallery = await edges(panel.locator('.aui-gallery-view'));
    assert.ok(gallery.x === box.ix && gallery.pl === inset, `${label}：面板里的画册离栏边 ${inset}px（${JSON.stringify(gallery)}）`);
    if (width > 1100) {
      assert.equal((await edges(pane.locator('.aui-pane-body'))).scroll, 0, `${label}：Pane fill 主体不滚`);
      assert.ok(Math.abs(gallery.bottom - box.bottom) <= 1, `${label}：面板里的画册撑到栏底（${gallery.bottom} / ${box.bottom}）`);
      assert.equal(await panel.locator('.aui-gallery-view').evaluate((el) => getComputedStyle(el).overflowY), 'auto', `${label}：画册在面板里自己滚`);
    }
    await pane.locator('.aui-gallery-view').click({ button: 'right', position: { x: 5, y: 5 } });
    await p.locator('.aui-notice', { hasText: '右键菜单（演示）' }).first().waitFor();
    await tab.focus();
    await p.keyboard.press('ArrowRight');
    const tableTab = pane.getByRole('tab', { name: '表格', exact: true });
    assert.equal(await tableTab.getAttribute('aria-selected'), 'true', `${label}：方向键切到「表格」`);
    assert.equal(await tableTab.getAttribute('aria-controls'), await panel.getAttribute('id'));
    const table = await edges(panel.locator('.aui-table-panel'));
    assert.ok(table.x === box.ix && table.right === box.iright && table.radius === 0 && table.shadow === 'none' && table.y === bar.bottom, `${label}：面板里的表格贴边、紧贴标签条（${JSON.stringify(table)}）`);
    if (width > 1100) {
      assert.ok(Math.abs((await edges(panel.locator('.aui-pagination'))).bottom - box.bottom) <= 1, `${label}：面板里的分页贴着栏底`);
      const scroller = panel.locator('.aui-table-scroll');
      await scroller.evaluate((el) => el.scrollTo(0, 200));
      assert.equal((await edges(scroller.locator('th'))).y, (await edges(scroller)).y, `${label}：面板里的表头吸顶`);
    }
    await tab.click();
    if (width > 760) return;
    // A tall phone: the stacked card grows down to the bottom of the shell content (it used to stop at 80dvh, grey strip under it).
    await p.setViewportSize({ width, height: 1300 });
    await p.waitForTimeout(300);
    const tall = await flushFacts(p);
    assert.ok(tall.fill && Math.abs(tall.fill.below - tall.fill.contentPadBottom) <= 1, `${label} 1300 高：卡片下面没有灰条（${JSON.stringify(tall.fill)}）`);
    assert.ok(Math.abs(tall.fill.paneBottom - tall.fill.wsInnerBottom) <= 1 && tall.overflowY <= 0, `${label} 1300 高：Pane fill 长到卡片底、整页不滚（${JSON.stringify(tall.fill)}）`);
    await p.screenshot({ path: resolve(output, 'flush-tabs-390-tall.png'), animations: 'disabled' });
    await p.setViewportSize({ width, height: 844 });
    await p.waitForTimeout(300);
  });
  // Card flow next to mounted (hidden) workspaces keeps the content padding, the tab bar keeps its 16px gap and
  // the cards stay cards; going back to a workspace section drops the padding again.
  for (const width of [1440, 390]) {
    const p = await browser.newPage();
    try {
      const area = await openFlush(p, url, '客户表', { width });
      for (const tab of ['画册', '记录', '卡片流']) { await area.getByRole('tab', { name: tab, exact: true }).click(); await p.waitForTimeout(300); }
      assert.ok(await area.locator('.aui-tabbed-panel[hidden] .aui-workspace').count() >= 3, '卡片流：前面打开过的工作区分区还挂着（隐藏）');
      const facts = await flushFacts(p);
      assert.ok(facts.contentPadding > 0, `卡片流（${width}）：外壳内容区保留内边距（${facts.contentPadding}）`);
      assert.equal(facts.tabsBarMargin, 16, `卡片流（${width}）：分区标签条下照常留 16px`);
      assert.ok(facts.overflowX <= 0, `卡片流（${width}）：横向溢出 ${facts.overflowX}px`);
      const cards = area.locator('.aui-tabbed-panel:not([hidden]) :is(.aui-panel, .aui-resource)');
      for (let i = 0; i < await cards.count(); i++) assert.ok((await edges(cards.nth(i))).radius > 0, `卡片流（${width}）：卡片照常是圆角卡片`);
      assert.match(await area.locator('.aui-tabbed-panel:not([hidden]) .aui-inline-alert').innerText(), width > 760 ? /宽屏布局/ : /手机布局/, 'useIsMobile 跟着窗口宽度');
      await p.screenshot({ path: resolve(output, `flush-cards${width < 500 ? '-390' : ''}.png`), animations: 'disabled', fullPage: true });
      await area.getByRole('tab', { name: '客户表', exact: true }).click();
      await p.waitForTimeout(300);
      if (width > 1100) assert.equal((await flushFacts(p)).contentPadding, 0, '回到工作区分区：内容区又贴边');
    } finally {
      await p.close();
    }
  }
}

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
  const menu = p.getByRole('navigation', { name: '主导航' });
  assert.equal(await menu.getByRole('group', { name: '页面模板' }).getByRole('button').count(), 17, '「页面模板」菜单组 T01–T17 共 17 项');

  const check = async (id, name, slug, mode) => {
    await menu.getByRole('button', { name, exact: true }).click();
    const page = p.locator(`#aui-page-${id}`);
    await page.locator('.aui-panel, .aui-resource, .aui-pane, .aui-workitem').first().waitFor();
    if (id === 'tpl-t04') await page.locator('canvas').first().waitFor();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.mouse.move(1430, 890);
    await p.waitForTimeout(350);
    const facts = await page.evaluate((el) => {
      const visible = (n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const rowButtons = [...el.querySelectorAll('.aui-row-actionbar-row')].filter(visible).map((row) => row.querySelectorAll(':scope > .aui-row-actionbar-button').length);
      const listButtons = [...el.querySelectorAll('.aui-alist-actions')].filter(visible).map((box) => box.querySelectorAll(':scope > .aui-button, .aui-row-actionbar-row > .aui-row-actionbar-button').length);
      const tiles = [...el.querySelectorAll('.aui-kpi-grid > .aui-panel, .aui-metrics > .aui-panel, .aui-stat')].filter(visible).map((n) => Math.round(n.getBoundingClientRect().height));
      const headers = [...el.querySelectorAll('.aui-page-header')].filter(visible).map((n) => n.textContent.trim().slice(0, 40));
      return {
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overflowY: document.documentElement.scrollHeight - innerHeight,
        rowButtons, listButtons, tiles, headers,
      };
    });
    assert.ok(facts.overflowX <= 0, `${name}（${mode}）横向溢出 ${facts.overflowX}px`);
    assert.deepEqual(facts.headers, [], `${name}（${mode}）页面头单独占了一行：${facts.headers.join(' | ')}`);
    for (const n of [...facts.rowButtons, ...facts.listButtons]) assert.ok(n <= 3, `${name}（${mode}）一行露出 ${n} 个按钮（最多 3 个）`);
    for (const h of facts.tiles) assert.ok(h <= 100, `${name}（${mode}）指标块 ${h}px 高（最多 100）`);
    if (id === 'tpl-t10') assert.ok(facts.overflowY <= 0, `${name}（${mode}）工作区页本身不能滚动：多出 ${facts.overflowY}px`);
    await p.screenshot({ path: resolve(output, `${slug}${mode === 'dark' ? '-dark' : ''}.png`), fullPage: true, animations: 'disabled' });
    return facts;
  };

  for (const mode of ['light', 'dark']) {
    if (mode === 'dark') await p.getByRole('button', { name: '切换到深色模式', exact: true }).click();
    for (const [id, name, slug] of TEMPLATES) await check(id, name, slug, mode);
  }

  // T14 has no page of its own: the menu item opens the C-version record detail demo (组件总览).
  await menu.getByRole('button', { name: 'T14 记录详情', exact: true }).click();
  await p.locator('#aui-page-kit').waitFor();
  assert.ok(await p.locator('#aui-page-kit').isVisible(), 'T14 打开组件总览里的记录详情演示');

  // Behaviour spot checks.
  await p.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  // T01: the to-do filter counts and filters rows.
  await menu.getByRole('button', { name: 'T01 工作台首页', exact: true }).click();
  const home = p.locator('#aui-page-tpl-t01');
  await home.getByRole('button', { name: '知道一下 1', exact: true }).click();
  assert.equal(await home.getByRole('list', { name: '待办' }).locator(':scope > li').count(), 1, '待办按分类筛选');
  await home.getByRole('button', { name: '全部 4', exact: true }).click();
  // T01 StatStrip (8.0.2): cells with onSelect are buttons over the whole cell — hover tint,
  // focus ring, selected = brand tint + aria-pressed; href cells are links; plain cells stay plain.
  const strip = home.locator('.aui-stat-strip').first();
  const cellBg = (i) => strip.locator('.aui-stat').nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
  const idle = strip.getByRole('button', { name: /^闲置授权\s*41/ });
  assert.equal(await idle.getAttribute('aria-pressed'), 'false', '指标格是按钮，名字 = 说明 + 数值');
  const idleBox = await idle.boundingBox();
  const idleCell = await strip.locator('.aui-stat').nth(2).boundingBox();
  assert.ok(idleBox && idleCell && Math.abs(idleBox.width - idleCell.width) <= 1.5 && Math.abs(idleBox.height - idleCell.height) < 1, `整格都能点 ${JSON.stringify({ idleBox, idleCell })}`);
  const plainBg = await cellBg(2);
  await idle.hover();
  await p.waitForTimeout(250);
  assert.notEqual(await cellBg(2), plainBg, '悬停有底色');
  await idle.click();
  assert.equal(await idle.getAttribute('aria-pressed'), 'true', '点了 = 选中');
  assert.equal(await strip.getByRole('button', { name: /^机器可达/ }).getAttribute('aria-pressed'), 'false', '只选中一格');
  await p.mouse.move(5, 5);
  await p.waitForTimeout(250);
  const selBg = await cellBg(2);
  assert.notEqual(selBg, plainBg, '选中 = 主色浅底');
  await p.keyboard.press('Shift+Tab');
  await p.keyboard.press('Tab');
  assert.match(await strip.locator('.aui-stat-hit:focus-visible').evaluate((el) => getComputedStyle(el).outlineStyle), /solid/, '键盘焦点有光圈');
  assert.equal(await strip.getByRole('link', { name: /^在线的人\s*2/ }).getAttribute('href'), '#online', 'href 的格子是链接');
  assert.equal(await strip.locator('.aui-stat').nth(5).locator('.aui-stat-hit').count(), 0, '没给 onSelect / href 的格子不可点');
  await strip.screenshot({ path: resolve(output, 'stat-strip-clickable-1440.png'), animations: 'disabled' });
  // T08: the save bar shows the unsaved changes and the discard button clears them.
  await menu.getByRole('button', { name: 'T08 设置 / 表单', exact: true }).click();
  const settings = p.locator('#aui-page-tpl-t08');
  const bar = settings.getByRole('region', { name: '未保存的改动' });
  await bar.waitFor();
  assert.match(await bar.textContent(), /改了 2 处/);
  assert.equal(await settings.locator('.aui-sidenav-dot').count(), 2, '有改动的分节带小点');
  await bar.getByRole('button', { name: '放弃', exact: true }).click();
  await settings.locator('.aui-sidenav-dot').first().waitFor({ state: 'detached' });
  assert.equal(await bar.count(), 1, '还有一处填写有误，保存条不消失');
  // T06: opening a row shows before / after.
  await menu.getByRole('button', { name: 'T06 日志 / 时间线', exact: true }).click();
  const log = p.locator('#aui-page-tpl-t06');
  assert.equal(await log.locator('.aui-log-diff').count(), 1, '默认展开一条');
  await log.getByRole('button', { name: '展开详情' }).first().click();
  assert.equal(await log.locator('.aui-log-detail').count(), 2, '点开第二条');
  // T09: a search that hides every item says what was searched, not the empty label (审阅 03).
  await menu.getByRole('button', { name: 'T09 权限配置页', exact: true }).click();
  const matrix = p.locator('#aui-page-tpl-t09');
  await matrix.getByRole('searchbox', { name: '人和组搜索' }).fill('没有这个人');
  assert.equal(await matrix.locator('.aui-slist-empty > b').textContent(), '没有找到「没有这个人」');
  assert.match(await matrix.locator('.aui-slist-empty').innerText(), /换个关键词/);
  await matrix.getByRole('searchbox', { name: '人和组搜索' }).fill('运维');
  assert.equal(await matrix.locator('.aui-slist-item mark').first().textContent(), '运维', '搜索命中的字高亮');
  await matrix.getByRole('searchbox', { name: '人和组搜索' }).fill('');
  assert.equal(await matrix.locator('.aui-slist-empty').count(), 0);

  // Phones (390px): no template widens the page (wide tables scroll inside their own box).
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);
  for (const [id, name, slug] of TEMPLATES) {
    await p.getByRole('button', { name: '打开菜单', exact: true }).click();
    await p.waitForTimeout(250);
    await menu.getByRole('button', { name, exact: true }).click();
    await p.locator(`#aui-page-${id}`).locator('.aui-panel, .aui-resource, .aui-pane, .aui-workitem').first().waitFor();
    await p.waitForTimeout(300);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 0, `${name}（390px）横向溢出 ${overflow}px`);
    // 审阅 04：步骤条在手机上不被截掉，当前步骤在可见范围里
    const steps = await p.locator(`#aui-page-${id} .aui-steps`).evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => {
      const r = e.getBoundingClientRect();
      const cur = e.querySelector('[aria-current=step]')?.getBoundingClientRect();
      return { left: r.left, right: r.right, cur: cur ? [cur.left, cur.right] : null };
    }));
    for (const s of steps) {
      assert.ok(s.right <= 390 + 1 && s.left >= -1, `${name}（390px）步骤条超出屏幕 ${JSON.stringify(s)}`);
      if (s.cur) assert.ok(s.cur[0] >= s.left - 1 && s.cur[1] <= s.right + 1, `${name}（390px）当前步骤看不到 ${JSON.stringify(s)}`);
    }
    await p.screenshot({ path: resolve(output, `${slug}-390.png`), fullPage: true, animations: 'disabled' });
  }

  await flushPage(browser, url);
  await checkNarrowModes(browser, url, output);
  await standalone(p, url, menu);

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`page-templates ok: ${TEMPLATES.length} templates × light/dark + T15–T17 (${STANDALONE.length} pages) light/dark/390 + 工作区贴边 (TabbedPage + workspace / card flow, Pane fill / notice / padding, QueryBar flush, ResourcePanel column, RecordHeader, Tabs in a Pane fill + Pane ref / data-* / events, no grey strip under a fill card at 390; narrow card / flush at 390 / 900 light + dark, Breadcrumbs gaps, neutral text) → ${output}`);
} finally {
  await server?.close();
  await browser.close();
}
