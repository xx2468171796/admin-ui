// 录音文字稿 + 分配规则 浏览器验收：starter「系统 → 录音文字稿」（样稿 D27t）、「系统 → 分配规则」（样稿 D26）。
// TranscriptViewer：波形（按说话人上色）+ 说话人条 + AI 标注钉（点了跳）、播放 / 暂停 / 空格、±15 秒、倍速、键盘拖进度、
// 点时间跳转、跟着播放滚动（当前句高亮、自己滚动后暂停跟随 →「回到正在播放」）、静默分隔、搜索（计数 / 回车下一个）、
// 打码 + 留痕查看、关掉 AI 标注、说话占比、导出 / 复制全文；RuleList：条件摘要、拖动 + 键盘排序、开关、复制 / 删除、
// 修改（侧边弹层 + 条件编辑器 + 宿主的「然后」表单）、兜底固定；1440 浅 / 深色、390 不溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/builders');
const txOutput = resolve(root, 'test/artifacts/transcript');
mkdirSync(output, { recursive: true });
mkdirSync(txOutput, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), args: ['--autoplay-policy=no-user-gesture-required'] });
const noOverflow = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));
const closeToasts = async (page) => {
  for (const close of await page.getByRole('button', { name: '关闭通知' }).all()) await close.click().catch(() => undefined);
};
const valueNow = (slider) => slider.getAttribute('aria-valuenow').then(Number);

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('button', { name: '录音文字稿', exact: true }).click();
  const viewer = page.getByRole('region', { name: '录音文字稿' });
  await viewer.waitFor();
  const slider = viewer.getByRole('slider', { name: /播放进度/ });
  const list = viewer.getByRole('list', { name: '文字稿' });
  const current = list.locator('.aui-tx-row[data-current]');

  // ---- 说话人、标注钉、静默分隔、说话占比
  assert.match(await viewer.locator('.aui-tx-speakers').innerText(), /小王\s*销售[\s\S]*李先生\s*客户[\s\S]*李太太\s*客户/);
  assert.match(await viewer.locator('.aui-tx-ai-badge').innerText(), /AI 标注 11 处/);
  assert.equal(await viewer.locator('.aui-tx-pin').count(), 6, '每句每类一个钉');
  assert.equal(await list.locator('.aui-tx-row').count(), 21);
  assert.deepEqual(await list.locator('.aui-tx-gap').allInnerTexts(), ['跳过 12 秒静默', '跳过 50 秒静默', '跳过 2 分 2 秒静默']);
  const shares = await viewer.locator('.aui-tx-share-legend b').allInnerTexts();
  assert.equal(shares.reduce((n, s) => n + Number(s.replace('%', '')), 0), 100, `说话占比加起来 100：${shares}`);
  const barColours = await viewer.locator('.aui-wave > i[data-c]').evaluateAll((els) => new Set(els.map((e) => getComputedStyle(e).getPropertyValue('--aui-wave-c').trim())).size);
  assert.ok(barColours >= 3, `波形按说话人上色（${barColours} 种）`);
  // 说话人 = 10 色里的分类色 蓝 / 橙 / 青（图例、波形、头像、占比条同一个颜色），不用主色深浅
  const tones = await viewer.evaluate((root) => {
    const probe = document.createElement('i');
    root.appendChild(probe);
    const resolveColor = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
    const want = ['blue', 'orange', 'teal'].map((h) => resolveColor(`var(--aui-option-${h})`));
    const primary = resolveColor('var(--aui-primary)');
    probe.remove();
    const dots = [...root.querySelectorAll('.aui-tx-speaker > i')].map((e) => getComputedStyle(e).backgroundColor);
    const legendTones = [...root.querySelectorAll('.aui-tx-speaker')].map((e) => e.dataset.tone);
    const share = [...root.querySelectorAll('.aui-tx-share-legend i')].map((e) => getComputedStyle(e).backgroundColor);
    const rows = [...root.querySelectorAll('.aui-tx-row')];
    const avatarTone = (name) => rows.find((r) => r.querySelector('.aui-tx-who b')?.textContent === name)?.dataset.tone;
    return { want, primary, dots, legendTones, share, avatars: ['小王', '李先生', '李太太'].map(avatarTone) };
  });
  assert.deepEqual(tones.legendTones, ['blue', 'orange', 'teal'], '图例按顺序 蓝 / 橙 / 青');
  assert.deepEqual(tones.dots, tones.want, '图例色块 = --aui-option-blue / orange / teal');
  assert.deepEqual(tones.share, tones.want, '说话占比条同色');
  assert.deepEqual(tones.avatars, ['blue', 'orange', 'teal'], '头像用说话人色');
  assert.ok(!tones.dots.includes(tones.primary), '不用主色');
  const waveColours = await viewer.locator('.aui-wave > i[data-c]').evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).getPropertyValue('--aui-wave-c').trim()))].sort());
  const toneHex = await viewer.evaluate((root) => ['blue', 'orange', 'teal'].map((h) => getComputedStyle(root).getPropertyValue(`--aui-option-${h}`).trim()).sort());
  assert.deepEqual(waveColours, toneHex, `波形按说话人上色 ${waveColours}`);
  assert.equal(await viewer.locator('.aui-tx-pin-name:visible').count(), 0, '没开始播放时标注钉只是小点，不出名字');
  assert.ok(await viewer.locator('.aui-tx-tag[data-tone=greenSolid]').count() > 0, '顾虑用实心主色，不用状态色');

  // ---- 点时间跳转：当前句高亮、进度到那里
  await list.getByRole('button', { name: '跳到 07:42（李先生）' }).click();
  assert.equal(await valueNow(slider), 462);
  assert.match(await current.innerText(), /两百万到两百二十万/);
  assert.match(await current.innerText(), /播放到这里/);
  // 播过的段满色、没播的 35% 淡；当前句的标注钉出名字
  const opacity = await viewer.evaluate((root) => {
    const bars = [...root.querySelectorAll('.aui-wave > i[data-c]')];
    const op = (e) => getComputedStyle(e).opacity;
    return { played: [...new Set(bars.filter((b) => b.hasAttribute('data-played')).map(op))], unplayed: [...new Set(bars.filter((b) => !b.hasAttribute('data-played')).map(op))] };
  });
  assert.deepEqual(opacity, { played: ['1'], unplayed: ['0.35'] }, `播过 / 没播 ${JSON.stringify(opacity)}`);
  assert.deepEqual(await viewer.locator('.aui-tx-pin[data-current] .aui-tx-pin-name').allInnerTexts(), ['预算'], '当前句的钉出名字');

  // ---- 键盘拖进度、±15、标注钉
  await slider.focus();
  await page.keyboard.press('End');
  assert.equal(await valueNow(slider), 1085);
  await page.keyboard.press('Home');
  await page.waitForTimeout(300);
  assert.equal(await valueNow(slider), 12, 'Home → 开头，跳过静音时直接到第一句（00:12）');
  await page.keyboard.press('ArrowRight');
  assert.equal(await valueNow(slider), 17, '→ 5 秒');
  await viewer.getByRole('button', { name: '前进 15 秒' }).click();
  assert.equal(await valueNow(slider), 32);
  await viewer.getByRole('button', { name: '后退 15 秒' }).click();
  assert.equal(await valueNow(slider), 17);
  await viewer.getByRole('button', { name: '决策人，跳到 16:08' }).click();
  assert.equal(await valueNow(slider), 968);
  await page.waitForTimeout(700);
  const inView = async () => {
    const [box, row] = await Promise.all([list.boundingBox(), current.boundingBox()]);
    return Boolean(box && row && row.y >= box.y - 1 && row.y + row.height <= box.y + box.height + 1);
  };
  assert.ok(await inView(), '跳到后面那句，文字稿滚到它');
  assert.match(await current.innerText(), /她决定/);

  // ---- 播放：时间往前走，当前句跟着换；倍速
  await viewer.getByRole('button', { name: '1.5x' }).click();
  assert.equal(await viewer.getByRole('button', { name: '1.5x' }).getAttribute('aria-pressed'), 'true');
  await list.getByRole('button', { name: '跳到 02:31（小王）' }).click();
  await viewer.getByRole('button', { name: '播放（空格）' }).click();
  await viewer.getByRole('button', { name: '暂停（空格）' }).waitFor();
  await page.waitForTimeout(1500);
  const playedTo = await valueNow(slider);
  assert.ok(playedTo >= 152, `播放中时间在走（${playedTo}）`);
  assert.match(await current.innerText(), /正在播放/);
  assert.equal(await page.evaluate(() => document.querySelector('.aui-transcript audio')?.playbackRate), 1.5, '倍速作用到播放');
  // 自己滚文字稿 → 暂停跟随，出「回到正在播放」
  await list.hover();
  await page.mouse.wheel(0, 900);
  await viewer.getByRole('button', { name: '回到正在播放' }).waitFor();
  assert.ok(!(await inView()), '滚走了');
  await viewer.getByRole('button', { name: '回到正在播放' }).click();
  await page.waitForTimeout(800);
  assert.ok(await inView(), '回到当前句');
  assert.equal(await viewer.getByRole('button', { name: '回到正在播放' }).count(), 0);
  // 跳到静默里：跳过静音直接到下一句
  await slider.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const pausedState = await page.evaluate(() => document.querySelector('.aui-transcript audio')?.paused);
  assert.equal(pausedState, false, '在进度条上按空格不抢（进度条自己不处理空格，继续播放）');
  await viewer.getByRole('button', { name: '暂停（空格）' }).click();
  await viewer.getByRole('button', { name: '播放（空格）' }).waitFor();
  await list.locator('.aui-tx-row').first().locator('p').click();
  await page.keyboard.press('Space');
  await viewer.getByRole('button', { name: '暂停（空格）' }).waitFor();
  await page.keyboard.press('Space');
  await viewer.getByRole('button', { name: '播放（空格）' }).waitFor();

  // ---- 搜索
  const search = viewer.getByRole('textbox', { name: '在文字稿里搜' });
  await search.fill('断网');
  assert.equal(await viewer.locator('.aui-tx-search-count').innerText(), '1 / 3');
  assert.equal(await list.locator('mark.aui-tx-hit').count(), 3);
  await search.press('Enter');
  assert.equal(await viewer.locator('.aui-tx-search-count').innerText(), '2 / 3');
  assert.match(await list.locator('mark[data-active]').evaluate((el) => el.closest('.aui-tx-row').innerText), /断网的时候/);
  await search.fill('A12');
  assert.equal(await viewer.locator('.aui-tx-search-count').innerText(), '没有找到', '打码的内容搜不到');
  await search.press('Escape');
  assert.equal(await search.inputValue(), '');

  // ---- 打码 + 留痕查看
  const mask = list.getByRole('button', { name: /查看身份证原文/ });
  await mask.click();
  await list.getByText('身份证 A123456789').waitFor();
  assert.match(await list.locator('.aui-tx-mask[data-shown]').innerText(), /秒后隐藏/);
  await page.getByText('已记录：你查看了身份证号码').waitFor();
  await list.getByRole('button', { name: '隐藏身份证' }).click();
  await list.getByText('身份证 A12****789').waitFor();

  // ---- 关掉 AI 标注
  await viewer.getByRole('switch', { name: '显示AI 标注' }).click();
  assert.equal(await viewer.locator('.aui-tx-pin').count(), 0);
  assert.equal(await list.locator('.aui-tx-tag').count(), 0);
  await viewer.getByRole('switch', { name: '显示AI 标注' }).click();
  assert.equal(await list.locator('.aui-tx-tag').count(), 11);

  // ---- 导出（标题行的「导出 ⌄」下拉）、复制全文（打码后的文字）
  assert.equal(await viewer.locator('.aui-tx-side').getByText('导出文字稿').count(), 0, '右栏不再有导出大卡');
  await viewer.locator('.aui-tx-header').getByRole('button', { name: '导出' }).click();
  const exportPanel = page.getByRole('dialog', { name: '导出文字稿' });
  await exportPanel.waitFor();
  await exportPanel.getByRole('button', { name: 'TXT' }).click();
  await exportPanel.getByRole('checkbox', { name: '带 AI 标注' }).click();
  assert.match(await exportPanel.innerText(), /打码/, "导出也是打码后的");
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(txOutput, 'transcript-export-1440.png') });
  await exportPanel.getByRole('button', { name: '导出文字稿' }).click();
  await page.getByText('已导出 TXT（带时间、带说话人、带 AI 标注）').waitFor();
  await exportPanel.waitFor({ state: 'detached' });
  await viewer.locator('.aui-tx-header').getByRole('button', { name: '导出' }).click();
  await exportPanel.getByRole('button', { name: '复制全文' }).click();
  await exportPanel.getByText('已复制全文').waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /^\[00:12\] 小王：李先生、李太太好/);
  assert.match(copied, /全屋都做智能〔需求〕/);
  assert.match(copied, /身份证 A12\*\*\*\*789/);
  assert.ok(!copied.includes('A123456789'), '复制的是打码后的');
  await page.keyboard.press('Escape');
  await exportPanel.waitFor({ state: 'detached' });
  // 摘要里的时间点
  await viewer.locator('.aui-tx-points').getByRole('button', { name: '跳到 11:26' }).click();
  assert.equal(await valueNow(slider), 686);

  // ---- 截图
  await closeToasts(page);
  await list.getByRole('button', { name: '跳到 07:42（李先生）' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await noOverflow(page, 'transcript 1440');
  // 控制一行：后退 · 播放 · 前进 · 时间 · 倍速 …… 三个小开关在同一行右边
  const rowTops = await viewer.locator('.aui-tx-controls').evaluate((row) => {
    const mid = (el) => { const r = el.getBoundingClientRect(); return Math.round(r.top + r.height / 2); };
    return [...row.querySelectorAll('.aui-tx-skip, .aui-tx-play, .aui-tx-time, .aui-segmented, .aui-tx-toggle')].map(mid);
  });
  assert.ok(rowTops.length >= 8 && Math.max(...rowTops) - Math.min(...rowTops) <= 4, `控制条一行 ${rowTops}`);
  assert.equal(await viewer.locator('.aui-tx-toggle').count(), 3);
  await page.screenshot({ path: resolve(txOutput, 'transcript-1440.png') });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(500);
  const darkDots = await viewer.evaluate((root) => {
    const probe = document.createElement('i');
    root.appendChild(probe);
    probe.style.color = 'var(--aui-option-blue)';
    const blue = getComputedStyle(probe).color;
    probe.remove();
    return { blue, dot: getComputedStyle(root.querySelector('.aui-tx-speaker > i')).backgroundColor };
  });
  assert.equal(darkDots.dot, darkDots.blue, '深色下用深色版的蓝');
  await page.screenshot({ path: resolve(txOutput, 'transcript-dark.png') });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await noOverflow(page, 'transcript 390');
  await page.screenshot({ path: resolve(txOutput, 'transcript-390.png'), fullPage: true });
  const play = await viewer.getByRole('button', { name: /播放（空格）|暂停（空格）/ }).boundingBox();
  assert.ok(play && play.width >= 44 && play.height >= 44, `手机上播放按钮 ≥44px（${play?.width}）`);
  // 手机：三个开关收进「⋯」
  assert.equal(await viewer.locator('.aui-tx-toggle').count(), 0, '手机上不摊开开关');
  await viewer.getByRole('button', { name: '播放设置' }).click();
  const skipItem = page.getByRole('menuitemcheckbox', { name: /跳过静音/ });
  await skipItem.waitFor();
  assert.equal(await skipItem.getAttribute('aria-checked'), 'true');
  assert.equal(await page.getByRole('menuitemcheckbox').count(), 3);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(txOutput, 'transcript-390-more.png') });
  await skipItem.click();
  await viewer.getByRole('button', { name: '播放设置' }).click();
  assert.equal(await page.getByRole('menuitemcheckbox', { name: /跳过静音/ }).getAttribute('aria-checked'), 'false', '在菜单里改开关');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });

  // ================================================================ RuleList（D26）
  await nav.getByRole('button', { name: '分配规则', exact: true }).click();
  await page.locator('.aui-rulelist').waitFor();
  const ruleList = page.locator('.aui-rulelist');
  const ifTexts = () => ruleList.locator('.aui-sortable-row .aui-rule-if').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  assert.deepEqual(await ifTexts(), [
    '如果 客户质量 = 高 且 来源 是 官网表单、转介绍',
    '如果 客户质量 = 中',
    '如果 来源 = 展会 且 地区 = 广州',
    '如果 客户质量 = 低 或 客户质量 为空',
  ]);
  assert.match(await ruleList.locator('.aui-sortable-row').nth(0).innerText(), /精英销售池[\s\S]*轮流分（按权重）[\s\S]*近 7 天\s*46\s*条/);
  assert.equal(await ruleList.locator('.aui-rule-hits[data-low]').count(), 1, '命中很少的有提示');
  assert.match(await ruleList.locator('.aui-rule-fallback').innerText(), /兜底[\s\S]*都不匹配 \/ 池子里没人可分[\s\S]*留在客户池[\s\S]*近 7 天\s*7\s*条/);
  assert.equal(await ruleList.locator('.aui-rule-fallback .aui-sortable-grip').count(), 0, '兜底没有拖动手柄');
  assert.equal(await ruleList.locator('.aui-rule-fallback [role=switch]').count(), 0, '兜底不能停用');
  // 键盘排序：第 3 条 Alt+↑
  const grips = ruleList.locator('.aui-sortable-grip');
  await grips.nth(2).focus();
  await page.keyboard.press('Alt+ArrowUp');
  assert.equal((await ifTexts())[1], '如果 来源 = 展会 且 地区 = 广州', 'Alt+↑ 上移一条');
  assert.equal(await ruleList.locator('.aui-rule-no').nth(1).innerText(), '2', '序号跟着变');
  // 指针拖动：第 4 条拖到最上
  const from = await grips.nth(3).boundingBox();
  const to = await ruleList.locator('.aui-sortable-row').nth(0).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y - 20, { steps: 4 });
  await page.mouse.move(to.x + 40, to.y + 6, { steps: 10 });
  await page.mouse.up();
  assert.equal((await ifTexts())[0], '如果 客户质量 = 低 或 客户质量 为空', '拖到最上');
  // 开关
  const sw = ruleList.getByRole('switch', { name: '停用规则 1' });
  await sw.click();
  assert.equal(await ruleList.locator('.aui-rule[data-off]').count(), 1);
  assert.match(await ruleList.locator('.aui-rule[data-off]').innerText(), /已停用/);
  await ruleList.getByRole('switch', { name: '启用规则 1' }).click();
  // 复制 / 删除
  await ruleList.getByRole('button', { name: '规则 2 的更多操作' }).click();
  await page.getByRole('menuitem', { name: /复制一条/ }).click();
  assert.equal(await ruleList.locator('.aui-sortable-row').count(), 5);
  assert.equal(await ruleList.locator('.aui-rule[data-off]').count(), 1, '复制的那条先停用');
  await ruleList.getByRole('button', { name: '规则 3 的更多操作' }).click();
  await page.getByRole('menuitem', { name: '删除' }).click();
  const confirm = page.getByRole('dialog', { name: '删除规则' });
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /删除规则 3：客户质量 = 高 且 来源 是 官网表单、转介绍/);
  await confirm.getByRole('button', { name: '删除' }).click();
  await confirm.waitFor({ state: 'detached' });
  assert.equal(await ruleList.locator('.aui-sortable-row').count(), 4);
  // 修改：侧边弹层、条件编辑器、宿主的「然后」表单
  // 现在的顺序：低 / 高 / 展会 / 中
  await ruleList.getByRole('button', { name: '修改规则 3' }).click();
  const sheet = page.getByRole('dialog', { name: '修改规则 3' });
  await sheet.waitFor();
  assert.match(await sheet.innerText(), /如果 来源 = 展会 且 地区 = 广州/);
  await sheet.getByRole('button', { name: '添加条件', exact: true }).click();
  assert.equal(await sheet.locator('.aui-grid-cond-row').count(), 3);
  await sheet.getByRole('button', { name: '删除条件 3' }).click();
  await sheet.getByRole('textbox', { name: '规则名称' }).fill('广州展会');
  await sheet.getByRole('button', { name: '放进池子让人领' }).click();
  await sheet.getByRole('button', { name: '完成' }).click();
  await sheet.waitFor({ state: 'detached' });
  assert.match(await ruleList.locator('.aui-sortable-row').nth(2).innerText(), /广州展会[\s\S]*放进池子让人领/);
  // 添加
  await ruleList.getByRole('button', { name: '添加规则' }).click();
  const add = page.getByRole('dialog', { name: '添加规则' });
  await add.waitFor();
  await add.getByRole('button', { name: '取消' }).click();
  await add.waitFor({ state: 'detached' });

  await closeToasts(page);
  await page.waitForTimeout(300);
  await noOverflow(page, 'rules 1440');
  await page.screenshot({ path: resolve(output, 'rules-1440.png') });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'rules-dark.png') });
  await ruleList.getByRole('button', { name: '修改规则 1' }).click();
  await page.getByRole('dialog', { name: '修改规则 1' }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'rules-sheet-dark.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await noOverflow(page, 'rules 390');
  await page.screenshot({ path: resolve(output, 'rules-390.png'), fullPage: true });

  assert.deepEqual(errors, [], errors.join('; '));
  console.log('PASS transcript: TranscriptViewer (speaker waveform + lane, pins jump, play / Space / ±15 / speed / keyboard seek, timestamps, follow playback + pause on user scroll + 回到正在播放, silence dividers, search with masks excluded, audited reveal, annotations switch, talk share, export / copy masked text), RuleList (summaries, keyboard + pointer reorder, switch, duplicate, delete confirm, fixed fallback, edit sheet with condition editor + host action form, add), 1440 light / dark, 390');
} finally {
  await browser.close();
  await server.close();
}
