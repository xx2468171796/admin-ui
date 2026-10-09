// 看板搭建器浏览器验收：starter「看板 → 看板搭建」（样稿 D32 + 组件库审阅 06，@adminui/react/dashboard-builder）。
// 审阅 06：存的是版本 1（64px 行）→ 读进来换成 28px 行、大小不变；工具条一行、「N 处修改未保存」；卡头不挂「标准」；
// 卡片工具在卡头里；没选中不出设置面板；组件库能收成图标栏；新组件 数字组 / 环 / 条形 / 堆叠 / 实际 vs 目标 / 子弹图（目标值）。
// 组件库（搜索、点一下加到最后、指针拖进画布指定格）；画布（拖手柄移动、拖边角改大小、选中框 + 工具条 复制 / 上移 / 下移 / 删除、
// 键盘 方向键移动 / Shift 改大小 / Delete / Ctrl+D、空状态）；撤销 / 重做（按钮 + Ctrl+Z / Ctrl+Shift+Z）；组件设置（数据源、
// 标准 / 自定义口径、分组、对比覆盖、粒度、图表类型、自己的条件、继承看板筛选 + 覆盖提示、样式）；看板筛选变化重新取数；
// 预览；保存；1440 浅 / 深色、390「请在电脑上编辑」只读预览、不溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/builders');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const noOverflow = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));
const closeToasts = async (page) => {
  for (const close of await page.getByRole('button', { name: '关闭通知' }).all()) await close.click().catch(() => undefined);
};

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '看板搭建', exact: true }).click();
  const builder = page.locator('.aui-dbb');
  await builder.waitFor();
  const canvas = page.getByRole('region', { name: '看板画布' });
  const widgets = canvas.locator('.aui-dbb-widget');
  const widget = (title) => canvas.locator('.aui-dbb-widget', { has: page.locator(`h3[data-tip="${title}"]`) }).first();
  const place = (title) => widget(title).evaluate((el) => `${el.style.gridColumn} | ${el.style.gridRow}`);
  const status = builder.locator('.aui-dbb-status');
  const undo = builder.getByRole('button', { name: '撤销（Ctrl+Z）' });
  const redo = builder.getByRole('button', { name: '重做（Ctrl+Shift+Z）' });
  await widget('有效跟进 · 今天').getByText('64').waitFor();

  // ---- 初始：6 个组件（版本 1 的存档换成 28px 行，像素大小不变）、口径标、覆盖提示、数据来自 loadWidgetData
  assert.equal(await widgets.count(), 6);
  assert.equal(await status.innerText(), '已保存');
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 1 / span 4', '版本 1 的 2 行（140px）→ 4 行（148px）');
  assert.equal(await place('每天有效跟进'), '1 / span 4 | 5 / span 7');
  assert.equal(await place('逾期客户'), '1 / span 6 | 12 / span 6');
  const kpiHeight = await widget('有效跟进 · 今天').evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(Math.abs(kpiHeight - 148) <= 2, `数字卡高 ${kpiHeight}px`);
  assert.match(await widget('有效跟进 · 今天').innerText(), /有效跟进 · 今天[\s\S]*64\s*条[\s\S]*比 9-21 同时段/);
  assert.equal(await canvas.locator('.aui-dbb-tag[data-kind=standard]').count(), 0, '卡头不再挂「标准」');
  assert.equal(await canvas.locator('.aui-dbb-tag').evaluateAll((els) => els.map((e) => e.textContent).filter((t) => t === '标准').length), 0);
  assert.equal(await widget('逾期客户').locator('.aui-dbb-sub').innerText(), '多维表格 · 客户', '来源是卡头灰字');
  assert.equal(await page.getByRole('complementary', { name: '组件设置' }).count(), 0, '没选中卡片就没有设置面板');
  assert.match(await widget('上门次数').locator('.aui-dbb-head').innerText(), /自定义口径[\s\S]*覆盖看板筛选/, '窄组件的覆盖标是图标 + 读屏文字');
  assert.equal(await widget('上门次数').locator('.aui-dbb-tag[data-kind=custom]').getAttribute('data-tip'), '口径：跟进方式 = 上门（不看有没有定位 / 照片）');
  await widget('每天有效跟进').locator('canvas').first().waitFor();
  assert.match(await widget('逾期客户').innerText(), /何俊贤[\s\S]*9 天/);
  assert.match(await widget('本月客户推进 · 一组').innerText(), /首次接触[\s\S]*成交/);
  assert.equal(await undo.isDisabled(), true);

  // ---- 组件库：搜索、点一下加到最后、撤销 / 重做
  const lib = page.getByRole('complementary', { name: '添加卡片' });
  await lib.getByRole('textbox', { name: '搜索卡片、指标' }).fill('漏斗');
  assert.deepEqual(await lib.locator('button[aria-label^="添加"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), ['添加漏斗（漏斗）', '添加客户卡在哪一步（漏斗）']);
  await lib.getByRole('textbox', { name: '搜索卡片、指标' }).fill('');
  await lib.getByRole('button', { name: '添加数字卡（数字卡）' }).click();
  assert.equal(await widgets.count(), 7);
  assert.equal(await place('数字卡'), '1 / span 1 | 18 / span 3', '加到最下面（数字卡 1 列 × 3 行）');
  assert.equal(await widget('数字卡').getAttribute('data-selected'), 'true', '新加的选中');
  assert.match(await page.getByRole('complementary', { name: '组件设置' }).innerText(), /组件设置\s*数字卡/);
  assert.equal(await status.innerText(), '1 处修改未保存');
  await undo.click();
  assert.equal(await widgets.count(), 6, '撤销');
  await redo.click();
  assert.equal(await widgets.count(), 7, '重做');
  await page.keyboard.press('Control+z');
  assert.equal(await widgets.count(), 6, 'Ctrl+Z');
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await widgets.count(), 7, 'Ctrl+Shift+Z');
  await page.keyboard.press('Control+z');

  // ---- 从组件库拖进画布左上角：原来的组件往下让
  const item = lib.getByRole('button', { name: '添加客户卡在哪一步（漏斗）' });
  const from = await item.boundingBox();
  const target = await widget('有效跟进 · 今天').boundingBox();
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 10, { steps: 4 });
  await page.mouse.move(target.x + 20, target.y + 20, { steps: 12 });
  assert.ok(await builder.locator('.aui-dbb-ghost').isVisible(), '拖动时跟着指针的名字');
  assert.equal(await canvas.locator('.aui-dbb-widget[data-dragging]').count(), 1, '画布上先预览落点');
  await page.mouse.up();
  assert.equal(await widgets.count(), 7);
  assert.equal(await place('客户卡在哪一步'), '1 / span 3 | 1 / span 8', '漏斗默认 3 列 × 8 行');
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 9 / span 4', '被压到的往下让');
  await page.getByText('已添加 客户卡在哪一步').first().waitFor({ state: 'attached' });
  await undo.click();
  assert.equal(await widgets.count(), 6);
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 1 / span 4');

  // ---- 拖手柄移动：每天有效跟进 往右两列
  const chart = widget('每天有效跟进');
  const grip = chart.locator('.aui-dbb-grip');
  const g = await grip.boundingBox();
  const colStep = (await canvas.boundingBox()).width / 6;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + colStep * 2 + 6, g.y + 4, { steps: 12 });
  assert.equal(await chart.getAttribute('data-dragging'), 'true');
  await page.mouse.up();
  assert.equal(await place('每天有效跟进'), '3 / span 4 | 5 / span 7', '移到第 3 列');
  assert.equal(await place('本月客户推进 · 一组'), '5 / span 2 | 12 / span 7', '被压到的往下');
  await undo.click();
  assert.equal(await place('每天有效跟进'), '1 / span 4 | 5 / span 7');

  // ---- 拖底边改大小：漏斗高一行
  await widget('本月客户推进 · 一组').click({ position: { x: 60, y: 12 } });
  const handle = widget('本月客户推进 · 一组').locator('.aui-dbb-handle[data-axis=y]');
  const h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + 20, { steps: 4 });
  assert.equal(await builder.locator('.aui-dbb-size').innerText(), '2 列 × 7 行', '改大小时的尺寸提示');
  await page.mouse.move(h.x + h.width / 2, h.y + 42, { steps: 4 });
  assert.equal(await builder.locator('.aui-dbb-size').innerText(), '2 列 × 8 行');
  await page.mouse.up();
  assert.equal(await place('本月客户推进 · 一组'), '5 / span 2 | 5 / span 8', '高 7 → 8（一行 28px + 间距 12）');
  // 拖角：宽改成 3（左边的图被压到下面）
  const c = await widget('本月客户推进 · 一组').locator('.aui-dbb-handle[data-axis=both]').boundingBox();
  await page.mouse.move(c.x + 4, c.y + 4);
  await page.mouse.down();
  await page.mouse.move(c.x - colStep + 4, c.y + 4, { steps: 8 });
  await page.mouse.up();
  assert.equal(await place('本月客户推进 · 一组'), '5 / span 2 | 5 / span 8', '漏斗最窄 2 列');
  await undo.click();
  assert.equal(await place('本月客户推进 · 一组'), '5 / span 2 | 5 / span 7');

  // ---- 键盘：方向键移动、Shift 改大小、Delete、Ctrl+D
  const kpi = widget('有效跟进 · 今天');
  await kpi.focus();
  assert.equal(await kpi.getAttribute('data-selected'), 'true', '聚焦即选中');
  await page.keyboard.press('Shift+ArrowDown');
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 1 / span 5');
  await page.keyboard.press('Shift+ArrowUp');
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 1 / span 4');
  await page.keyboard.press('ArrowDown');
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 8 / span 4', '↓ 跳到下面那个组件的下面');
  assert.equal(await place('每天有效跟进'), '1 / span 4 | 1 / span 7');
  await page.keyboard.press('ArrowUp');
  assert.equal(await place('有效跟进 · 今天'), '1 / span 2 | 1 / span 4', '↑ 回到上面');
  assert.match(await builder.locator('[role=status][aria-live=polite]').last().innerText(), /第 1 列第 1 行/);
  await page.keyboard.press('Control+d');
  assert.equal(await canvas.locator('h3[data-tip="有效跟进 · 今天"]').count(), 2, 'Ctrl+D 复制');
  await page.keyboard.press('Delete');
  assert.equal(await canvas.locator('h3[data-tip="有效跟进 · 今天"]').count(), 1, 'Delete 删掉复制出来的那个');
  assert.equal(await widgets.count(), 6);

  // ---- 卡片工具在卡头里（审阅 06）：悬停 / 选中才出现，不压标题；复制 / 设置 / 删除
  const tools = (title) => widget(title).getByRole('toolbar');
  await page.mouse.move(5, 5);
  await page.keyboard.press('Escape');
  assert.equal(await tools('逾期客户').isVisible(), false, '没悬停、没选中时不出现，也不占标题的地方');
  await widget('逾期客户').hover({ position: { x: 300, y: 60 } });
  const head = await widget('逾期客户').locator('.aui-dbb-head').boundingBox();
  const bar = await tools('逾期客户').boundingBox();
  assert.ok(bar.y >= head.y - 1 && bar.y + bar.height <= head.y + head.height + 1, '工具在卡头里，不浮在卡片上方');
  const title = await widget('逾期客户').locator('h3').boundingBox();
  assert.ok(bar.x >= title.x + title.width, '不压标题');
  assert.equal(await tools('逾期客户').isVisible(), true, '悬停出现');
  await tools('逾期客户').getByRole('button', { name: '复制' }).click();
  assert.equal(await canvas.locator('h3[data-tip="逾期客户"]').count(), 2);
  await undo.click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('complementary', { name: '组件设置' }).count(), 0);
  await widget('上门次数').hover();
  await tools('上门次数').getByRole('button', { name: '设置' }).click();
  assert.match(await page.getByRole('complementary', { name: '组件设置' }).innerText(), /组件设置\s*数字卡/, '「设置」打开设置面板');
  await tools('上门次数').getByRole('button', { name: '删除' }).click();
  assert.equal(await widgets.count(), 5);
  assert.equal(await page.getByRole('complementary', { name: '组件设置' }).count(), 0, '删了就收起设置');
  await undo.click();
  assert.equal(await widgets.count(), 6);

  // ---- 组件设置：指标口径、图表类型、分组、对比、粒度、筛选、继承
  const cfg = page.getByRole('complementary', { name: '组件设置' });
  await widget('每天有效跟进').click({ position: { x: 300, y: 12 } });
  assert.match(await cfg.innerText(), /柱图/);
  assert.match(await cfg.innerText(), /标准口径 v1/);
  assert.equal(await cfg.getByRole('button', { name: /跟进\s*$/ }).first().getAttribute('aria-pressed'), 'true', '数据源：跟进');
  assert.match(await cfg.innerText(), /收款：财务模块上线后可用/);
  assert.match(await cfg.innerText(), /筛选\s*1 条/);
  assert.match(await cfg.innerText(), /另外继承看板筛选：时间、对比、组/);
  // 图表类型（审阅 06：在「样式」里换）→ 折线
  await cfg.getByRole('tab', { name: '样式' }).click();
  await cfg.getByRole('radio', { name: '折线' }).click();
  assert.equal(await widget('每天有效跟进').getAttribute('data-kind'), 'line');
  await widget('每天有效跟进').locator('canvas').first().waitFor();
  await cfg.getByRole('radio', { name: '折线' }).press('ArrowLeft');
  assert.equal(await widget('每天有效跟进').getAttribute('data-kind'), 'hbar', '方向键换类型（折线前面是条形）');
  await cfg.getByRole('radio', { name: '条形' }).press('ArrowLeft');
  assert.equal(await widget('每天有效跟进').getAttribute('data-kind'), 'bar');
  await cfg.getByRole('tab', { name: '数据' }).click();
  // 分组
  await cfg.getByRole('combobox', { name: '分组' }).click();
  await page.getByRole('option', { name: '负责人' }).click();
  assert.match(await cfg.getByRole('combobox', { name: '分组' }).innerText(), /负责人/);
  // 对比覆盖
  await cfg.getByRole('combobox', { name: '对比基准' }).click();
  await page.getByRole('option', { name: '目标' }).click();
  assert.match(await cfg.innerText(), /已覆盖看板筛选：对比/);
  assert.equal(await widget('每天有效跟进').locator('.aui-dbb-tag[data-kind=override]').count(), 1, '组件头标出覆盖');
  // 不跟看板的「组」
  await cfg.getByRole('checkbox', { name: '跟看板的「组」筛选' }).click();
  assert.match(await cfg.innerText(), /已覆盖看板筛选：对比、组/);
  // 粒度
  await cfg.getByRole('button', { name: '周', exact: true }).click();
  assert.equal(await cfg.getByRole('button', { name: '周', exact: true }).getAttribute('aria-pressed'), 'true');
  // 自己的条件
  await cfg.getByRole('button', { name: '添加条件', exact: true }).click();
  assert.match(await cfg.innerText(), /筛选\s*2 条/);
  // 换成自定义口径
  await cfg.getByRole('button', { name: '自定义' }).click();
  await cfg.getByRole('textbox', { name: '口径说明' }).fill('跟进方式 = 上门');
  assert.equal(await widget('每天有效跟进').locator('.aui-dbb-tag[data-kind=custom]').count(), 1, '组件标「自定义口径」');
  await cfg.getByRole('button', { name: '标准指标' }).click();
  assert.equal(await widget('每天有效跟进').locator('.aui-dbb-tag[data-kind=custom]').count(), 0);
  // 样式：标题
  await cfg.getByRole('tab', { name: '样式' }).click();
  await cfg.getByRole('textbox', { name: '标题' }).fill('每天有效跟进（一组）');
  assert.equal(await canvas.locator('h3[data-tip="每天有效跟进（一组）"]').count(), 1);
  await cfg.getByRole('textbox', { name: '标题' }).press('Backspace');
  assert.equal(await canvas.locator('h3[data-tip="每天有效跟进（一组"]').count(), 1);
  // 连着打字算一步：一次撤销回到原标题
  await undo.click();
  assert.equal(await canvas.locator('h3[data-tip="每天有效跟进"]').count(), 1, '撤销整段输入');

  // ---- 文字说明组件：没有「数据」页
  await lib.getByRole('button', { name: '添加文字（文字）' }).click();
  assert.equal(await cfg.getByRole('tab', { name: '数据' }).isDisabled(), true);
  await cfg.getByRole('textbox', { name: '说明文字' }).fill('9-25 中秋、10-01 国庆放假，这几天不算。');
  assert.match(await widget('文字').innerText(), /国庆放假/);
  await cfg.getByRole('button', { name: '关闭组件设置' }).click();
  assert.equal(await cfg.count(), 0, '关掉设置，画布占满');
  const panes = await builder.locator('.aui-dbb-panes').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(panes, 2, '组件库 | 画布');

  // ---- 审阅 06 新组件：数字组（2–6 个等宽）、环、条形、堆叠、实际 vs 目标（目标值）、子弹图
  await lib.getByRole('button', { name: '添加本周关键数字（数字组）' }).click();
  const group = widget('本周关键数字');
  await group.locator('.aui-dbb-group-item').nth(3).locator('.aui-kpi-value strong').waitFor();
  assert.equal(await group.locator('.aui-dbb-group-item').count(), 4);
  const widths = await group.locator('.aui-dbb-group-item').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `等宽 ${widths}`);
  assert.match(await cfg.innerText(), /数字\s*4 个 · 2–6 个，等宽/);
  await cfg.getByRole('button', { name: '加一个数字' }).click();
  await cfg.getByRole('button', { name: '加一个数字' }).click();
  assert.equal(await cfg.getByRole('button', { name: '加一个数字' }).isDisabled(), true, '最多 6 个');
  await group.locator('.aui-dbb-group-item').nth(5).waitFor();
  await undo.click();
  await undo.click();
  await group.locator('.aui-dbb-group-item').nth(3).waitFor();
  assert.equal(await group.locator('.aui-dbb-group-item').count(), 4, '撤销两步回到 4 个');
  for (const [label, kind] of [['跟进方式分布', 'donut'], ['谁本周有效跟进最多', 'hbar'], ['各阶段客户数（按负责人）', 'stacked'], ['每周有效跟进 vs 目标', 'targetBar']]) {
    await lib.getByRole('button', { name: new RegExp(`^添加${label.replace(/[()（）]/g, '.')}`) }).click();
    assert.equal(await widget(label).getAttribute('data-kind'), kind);
    await widget(label).locator('canvas').first().waitFor();
  }
  await widget('每周有效跟进 vs 目标').click({ position: { x: 200, y: 12 } });
  assert.equal(await cfg.getByRole('spinbutton', { name: '目标值' }).inputValue(), '300', '目标值存在卡片上');
  await widget('各阶段客户数（按负责人）').click({ position: { x: 200, y: 12 } });
  assert.match(await cfg.getByRole('combobox', { name: '堆叠按' }).innerText(), /负责人/);
  await lib.getByRole('button', { name: '添加按时有效跟进率 vs 目标（子弹图）' }).click();
  await widget('按时有效跟进率 vs 目标').locator('.aui-bullet').waitFor();
  // 组件库收成图标栏
  await lib.getByRole('button', { name: '收起组件库' }).click();
  assert.equal(await lib.getAttribute('data-collapsed'), '');
  assert.ok((await lib.boundingBox()).width <= 57, '图标栏 56px');
  await lib.getByRole('button', { name: '添加环图（环图）' }).waitFor();
  await lib.getByRole('button', { name: '展开组件库' }).click();
  for (let i = 0; i < 6; i++) await undo.click();
  await cfg.getByRole('button', { name: '关闭组件设置' }).click().catch(() => undefined);

  // ---- 8.4 目标进度（targetProgress）：用表上的目标（targetRef）——实际 / 目标、完成率、「按时间应完成」刻度、「还差 X · 剩 N 天」；
  // 换成固定数值但不填 →「还没有目标」+「设目标」（点了打开组件设置）；填了超过实际 →「已超额」。时长单位：秒写成「5.1 小时」
  await lib.getByRole('button', { name: /^添加本月成交金额 · 目标进度/ }).click();
  const goal = widget('本月成交金额');
  await goal.locator('.aui-dbb-target').waitFor();
  const goalText = await goal.innerText();
  assert.match(goalText, /CN¥255\.1万\s*\/ 目标 CN¥300万/);
  assert.match(goalText, /完成率\s*85%/);
  assert.match(goalText, /按时间应完成 \d+%/);
  assert.match(goalText, /还差 CN¥44\.9万 · 剩 \d+ 天/);
  assert.match(goalText, /本月 · 全公司目标/);
  assert.equal(await goal.getByRole('meter', { name: '本月成交金额目标进度' }).count(), 1);
  assert.match(await cfg.getByRole('combobox', { name: '目标' }).innerText(), /每月成交金额（每月 · 元）/, '组件设置里选的是表上的目标');
  assert.equal(await cfg.getByRole('spinbutton', { name: '目标值' }).count(), 0, '用表上的目标时不填数');
  await cfg.getByRole('button', { name: '关闭组件设置' }).click();
  await page.waitForTimeout(300);
  await goal.screenshot({ path: resolve(output, 'target-progress-1440.png') });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(400);
  await goal.screenshot({ path: resolve(output, 'target-progress-dark.png') });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await goal.click({ position: { x: 100, y: 12 } });
  await cfg.getByRole('combobox', { name: '目标' }).click();
  await page.getByRole('option', { name: '固定数值' }).click();
  await goal.getByText('还没有目标').waitFor();
  await cfg.getByRole('button', { name: '关闭组件设置' }).click();
  await goal.getByRole('button', { name: '设目标' }).click();
  await cfg.getByRole('spinbutton', { name: '目标值' }).fill('2000000');
  await goal.getByText(/已超额 CN¥55\.1万/).waitFor();
  await lib.getByRole('button', { name: /^添加首次响应时长（中位）/ }).click();
  await widget('首次响应时长（中位）').getByText('5.1 小时').waitFor();
  while ((await widgets.count()) > 6) await undo.click();
  await cfg.getByRole('button', { name: '关闭组件设置' }).click().catch(() => undefined);

  // ---- 看板筛选变化：组件按新的筛选重新取数
  await page.getByRole('group', { name: '看板筛选' }).getByRole('button', { name: '今天', exact: true }).click().catch(async () => {
    await builder.locator('.aui-dbb-filters').getByRole('button', { name: '今天', exact: true }).click();
  });
  await widget('有效跟进 · 今天').getByText('40', { exact: true }).waitFor();

  // ---- 预览 / 保存
  await builder.getByRole('button', { name: '预览' }).click();
  assert.equal(await status.innerText(), '预览中');
  assert.equal(await builder.locator('.aui-dbb-grip').count(), 0, '预览没有拖动手柄');
  assert.equal(await page.getByRole('complementary', { name: '添加卡片' }).count(), 0);
  // 8.6: number cards hug their content in the view (no empty space under the number); cards of one row are equally tall
  await page.waitForTimeout(400);
  const kpis = await builder.locator('.aui-dbb-grid .aui-dbb-widget:is([data-kind=kpi], [data-kind=group])').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    const kids = [...el.querySelectorAll('.aui-dbb-body *')].filter((k) => k.getClientRects().length && !k.closest('[aria-hidden=true]'));
    const content = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
    return { top: Math.round(r.top), height: Math.round(r.height), spare: Math.round(r.bottom - content) };
  }));
  assert.ok(kpis.length >= 1, '预览里有数字卡');
  for (const k of kpis) assert.ok(k.height <= 140 && k.spare <= 24, `数字卡贴着内容，不再留一大块空白（${JSON.stringify(k)}）`);
  for (const row of Object.values(Object.groupBy(kpis, (k) => k.top))) assert.equal(new Set(row.map((k) => k.height)).size, 1, `同一行的数字卡一样高（${JSON.stringify(row)}）`);
  await builder.getByRole('button', { name: '继续编辑' }).click();
  await builder.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('看板已保存', { exact: true }).waitFor();
  assert.equal(await status.innerText(), '已保存');
  assert.equal(await builder.getByRole('button', { name: '保存', exact: true }).isDisabled(), true, '没改动不能再保存');

  // ---- 窄画布里的大数字（审阅 06：编辑时组件库 + 设置把画布挤窄，数字卡只剩「1.」）：
  // 画布有最小宽度、放不下就横 / 竖都能滚；数字先缩字号，再换成 万（全数在 title），从不截在数字中间
  await lib.getByRole('button', { name: '添加本月成交金额（数字卡）' }).click();
  const amount = widget('本月成交金额');
  await amount.locator('.aui-kpi-value strong').waitFor();
  const amountFit = () => amount.locator('.aui-kpi-value strong').evaluate((el) => ({ text: el.textContent, title: el.getAttribute('data-tip'), over: el.scrollWidth - el.clientWidth, size: parseFloat(getComputedStyle(el).fontSize) }));
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(400);
    const grid = await canvas.evaluate((el) => ({ width: el.getBoundingClientRect().width, scroll: getComputedStyle(el.parentElement).overflowX }));
    assert.ok(grid.width >= 559, `${width} 画布不被挤窄（${grid.width}px）`);
    assert.equal(grid.scroll, 'auto', '画布横向能滚');
    await noOverflow(page, `builder ${width}`);
    for (const narrow of [false, true]) {
      if (narrow) {
        await amount.focus();
        for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
        await page.waitForTimeout(300);
      }
      const fit = await amountFit();
      assert.ok(fit.over <= 1, `${width}${narrow ? ' 最窄' : ''} 数字被截断：${JSON.stringify(fit)}`);
      assert.match(fit.text, /^(1,594,200|159\.4万)$/, `${width} 数字完整或换成万：${fit.text}`);
      if (fit.text.endsWith('万')) assert.equal(fit.title, '1,594,200', '换成万时全数在 title');
      if (narrow) await amount.screenshot({ path: resolve(output, `builder-kpi-narrow-${width}.png`) });
      if (narrow) for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  // ---- 截图：选中柱图（像样稿）
  // 重新打开（回到样稿的摆法），选中柱图
  await page.reload();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '看板搭建', exact: true }).click();
  await widget('每天有效跟进').locator('canvas').first().waitFor();
  await widget('每天有效跟进').click({ position: { x: 300, y: 12 } });
  await page.waitForTimeout(600);
  await noOverflow(page, 'builder 1440');
  await page.screenshot({ path: resolve(output, 'dashboard-builder-1440.png') });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(output, 'dashboard-builder-dark.png') });
  await builder.getByRole('button', { name: '预览' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(output, 'dashboard-builder-preview-dark.png') });
  await builder.getByRole('button', { name: '继续编辑' }).click();
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await builder.getByText('请在电脑上编辑').waitFor();
  assert.equal(await builder.locator('.aui-dbb-grip').count(), 0, '手机上只读');
  assert.equal(await builder.getByRole('button', { name: '保存', exact: true }).count(), 0);
  await noOverflow(page, 'builder 390');
  await page.screenshot({ path: resolve(output, 'dashboard-builder-390.png'), fullPage: true });

  assert.deepEqual(errors, [], errors.join('; '));
  console.log('PASS dashboard-builder: version-1 spec migrated to 28px rows, toolbar 「N 处修改未保存」, no 「标准」 tag, card tools in the header, config only on selection, new kinds (数字组 / donut / hbar / stacked / actual vs target + 目标值 / bullet / 目标进度 + targetRef + 设目标 / duration unit), library icon rail, library (search, click to add, pointer drag onto a cell), canvas (grip move, edge / corner resize with minimum, selection toolbar copy / up / down / delete, keyboard move / resize / Delete / Ctrl+D), undo / redo (buttons, Ctrl+Z, Ctrl+Shift+Z), config (source, standard vs custom metric badge, chart-type tiles + arrows, group-by, comparison override, dimension follow, granularity, own conditions, title), text note, dashboard filter reload, preview, save, 1440 light / dark, 390 read-only');
} finally {
  await browser.close();
  await server.close();
}
