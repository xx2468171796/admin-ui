// 记录详情 · 卡片分区浏览器验收（样稿 C）：starter「系统 → 记录详情 · 卡片」。
// 量的是：卡片版式（阶段 + 关键数整条在上、左宽主栏、右栏约 380px 的分区卡片）、空字段收起 / 显示（含能编辑的）、正文色、
// 阶段可点（鼠标、键盘、「更多」里的丢单）、关注、编辑布局（键盘 Alt+方向键换位置 / 换栏、拖动换栏、隐藏 + 托盘恢复、
// 整理字段只在分区里拖、取消还原、完成保存、恢复团队默认）、单栏（箭头阶段）/ 左右分栏、弹框里的 RecordLayout.cards（Esc 先退出编辑）、
// 阶段选项每行的宿主控件；1440 浅 / 深色、390 手机一列不溢出。截图存 test/artifacts/record-cards/，对照
// 已审定的样稿截图人工看。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/record-cards');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const shot = (target, name) => target.screenshot({ path: resolve(output, `${name}.png`) });
const STORE = 'starter:demo:record-cards:layout';

async function openPage(page, scheme) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.evaluate((key) => localStorage.removeItem(key), STORE);
  await page.reload();
  if (scheme === 'dark') await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1440) < 760) {
    const menu = page.getByRole('button', { name: /菜单|导航/ }).first();
    if (await menu.count()) await menu.click().catch(() => undefined);
  }
  await page.getByRole('button', { name: '记录详情 · 卡片', exact: true }).first().click();
  const detail = page.locator('.aui-record-detail').first();
  await detail.locator('.aui-rdetail').waitFor();
  return { errors, detail };
}
const box = async (locator) => {
  const b = await locator.boundingBox();
  assert.ok(b, 'element has a box');
  return b;
};
/** 时间线标记（头像 / 圆点 / 结果圆）圆心压在 1px 竖线的中线上（ActivityFeed / LogTimeline / 跟进时间线同一种解剖，|Δ| ≤ 0.6px，不被裁掉） */
const feedDotsOnLine = async (scope, what) => {
  const offsets = await scope.locator('.aui-tl-item').evaluateAll((items) => items.map((li) => {
    const line = getComputedStyle(li, '::before');
    const box = li.getBoundingClientRect();
    const lineCentre = box.left + parseFloat(line.left) + parseFloat(line.width) / 2;
    const m = li.querySelector('.aui-tl-marker').getBoundingClientRect();
    let clip = li.parentElement;
    while (clip && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
    const clipped = clip ? m.left < clip.getBoundingClientRect().left - 0.5 : false;
    return { delta: Math.abs(m.left + m.width / 2 - lineCentre), line: parseFloat(line.width), clipped };
  }));
  assert.ok(offsets.length > 0 && offsets.every((o) => o.delta <= 0.6 && o.line === 1 && !o.clipped), `${what}：跟进时间线圆点在线上 ${JSON.stringify(offsets)}`);
};
const lane = (detail, column) => detail.locator(`.aui-rdetail-col[data-lane-column=${column}]`);
const blockIds = (container) => container.locator(':scope > [data-block-id]').evaluateAll((els) => els.map((el) => el.getAttribute('data-block-id')));

try {
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
    const { errors, detail } = await openPage(page, scheme);
    const body = detail.locator('.aui-rdetail');
    assert.equal(await body.getAttribute('data-preset'), 'cards');
    // 顶上一整条：阶段 + 关键数，和下面两栏一样宽
    const top = await box(detail.locator('.aui-rdetail-top'));
    const cols = await box(detail.locator('.aui-rdetail-cols'));
    assert.ok(Math.abs(top.width - cols.width) < 2 && top.y < cols.y, '阶段和关键数整条在两栏上面');
    assert.deepEqual(await blockIds(detail.locator('.aui-rdetail-top')), ['stage', 'keyNumbers']);
    const main = await box(lane(detail, 'main'));
    const side = await box(lane(detail, 'side'));
    assert.ok(main.x < side.x && main.width > side.width * 1.5, `左宽主栏 ${main.width} / 右栏 ${side.width}`);
    assert.ok(side.width >= 300 && side.width <= 381, `右栏宽 ${side.width}`);
    assert.deepEqual(await blockIds(lane(detail, 'main')), ['activity', 'comments']);
    assert.deepEqual(await blockIds(lane(detail, 'side')), ['contact', 'needs', 'deal', 'system']);
    // 关键数：4 个一行
    const keys = detail.locator('.aui-rkey');
    assert.equal(await keys.count(), 4, '最多 4 个关键数');
    const k0 = await box(keys.nth(0));
    const k3 = await box(keys.nth(3));
    assert.ok(Math.abs(k0.y - k3.y) < 1 && k0.height <= 100, '关键数一行、紧凑');
    // 阶段：7 段 + 「更多」；当前第 2 段，「· 已 3 天」
    const stage = detail.locator('.aui-rstage');
    assert.equal(await stage.locator('.aui-stagepath-step').count(), 7);
    assert.match(await stage.locator('.aui-rstage-top').innerText(), /2 \/ 7\s*需求确认\s*· 已 3 天/);
    assert.equal(await stage.locator('[aria-current=step]').innerText().then((t) => t.replace(/\s+/g, ' ').trim()), '需求确认 第 3 天');
    // 7.12.1：以前走到过的「谈判」（带天数）在当前阶段后面 → 不填色；鼠标停在上面也不填色（只描边）
    const bars = await stage.locator('.aui-stagepath-step').evaluateAll((els) => els.map((el) => [el.getAttribute('data-state'), getComputedStyle(el.querySelector('.aui-stagepath-bar')).backgroundColor]));
    assert.deepEqual(bars.map(([s]) => s), ['done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo'], '只填到当前阶段');
    assert.equal(bars[3][1], bars[2][1], '谈判（走过、有天数）和报价一样是未开始的颜色');
    assert.notEqual(bars[3][1], bars[0][1], '不是已走过的颜色');
    await stage.locator('.aui-stagepath-step').nth(3).hover();
    await page.waitForTimeout(250);
    const hovered = await stage.locator('.aui-stagepath-step').nth(3).locator('.aui-stagepath-bar').evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.equal(hovered, bars[2][1], '悬停不把后面的阶段填成进度色');
    await page.mouse.move(0, 0);
    // 「更多」安静：小字、灰
    const more = await stage.locator('.aui-stagepath-more').evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), weight: getComputedStyle(el).fontWeight, name: parseFloat(getComputedStyle(el.closest('.aui-stagepath').querySelector('.aui-stagepath-name')).fontSize) }));
    assert.ok(more.size < more.name && Number(more.weight) <= 400, `「更多」是安静的小字（比阶段名小） ${JSON.stringify(more)}`);
    // 头部（样稿 C）：字母块、22px 标题、标题旁的标签、「·」分隔的灰字（负责人带小头像）
    const head = detail.locator('.aui-rhead');
    assert.equal((await head.locator('.aui-rhead-avatar').innerText()).trim(), '赵', '默认字母块 = 标题第一个字');
    const scale = more.size / 12.5;
    const h2 = await head.locator('h2').evaluate((el) => ({ size: parseFloat(getComputedStyle(el).fontSize), weight: getComputedStyle(el).fontWeight }));
    assert.ok(Math.abs(h2.size - 22 * scale) < 0.1 && h2.weight === '600', `标题 22px（× 字号缩放）600：${JSON.stringify(h2)}`);
    assert.deepEqual(await head.locator('.aui-rhead-badge').allInnerTexts(), ['跟进中', 'A 类']);
    assert.match((await head.locator('.aui-rhead-meta').innerText()).replace(/\s+/g, ' '), /总部大客户\s*·\s*小\s*小赵 负责\s*·\s*官网表单进线\s*·\s*建档 2 天/);
    assert.equal(await head.locator('.aui-rhead-person-avatar').count(), 1);
    // 字段说明：不出 ⓘ，悬停标签看
    const phoneLabel = detail.locator('.aui-rfield[data-field-key=phone] .aui-rfield-label');
    assert.equal(await phoneLabel.locator('svg').count(), 0, '字段行没有说明图标');
    assert.match(await phoneLabel.getAttribute('data-tip'), /客户本人的手机/);
    // 正文色：后台正文色，不是文档阅读区的纯中性灰
    const colors = await detail.locator('.aui-dcard[data-kind=section] .aui-rfield-value').first().evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--aui-text)';
      el.appendChild(probe);
      const text = getComputedStyle(probe).color;
      const neutral = (probe.style.color = 'var(--aui-neutral-1)', getComputedStyle(probe).color);
      probe.remove();
      return { value: getComputedStyle(el).color, text, neutral };
    });
    assert.equal(colors.value, colors.text, '字段值用 --aui-text');
    if (scheme === 'light') assert.notEqual(colors.value, colors.neutral);
    // 空字段收起（包括能编辑的「成交金额」）
    const deal = detail.locator('.aui-dcard[data-kind=section]').filter({ has: page.getByRole('heading', { name: '成交' }) });
    assert.match(await deal.locator('.aui-dcard-folded').innerText(), /3 个空字段已收起 · 显示/);
    assert.equal(await deal.locator('.aui-rfield').count(), 0);
    await feedDotsOnLine(detail, `1440 ${scheme}`);
    await shot(page, `cards-${scheme}`);
    if (scheme === 'dark') {
      assert.deepEqual(errors, []);
      await page.close();
      continue;
    }
    await deal.getByRole('button', { name: /显示「成交」的 3 个空字段/ }).click();
    assert.equal(await deal.locator('.aui-rfield').count(), 3);
    assert.equal(await deal.locator('.aui-rfield[data-field-key=dealAmount]').getAttribute('data-state'), 'editable', '能编辑的空字段显示后可以就地填');
    await deal.getByRole('button', { name: /收起「成交」的空字段/ }).click();

    // 写跟进（ActivityComposer）：方式小标签（单选）、短文本、底部一行（录音 / 附件 | 下次跟进 + 日期 + 1/3/7 天 + 保存跟进）
    const composer = detail.locator('.aui-acomposer');
    const kinds = composer.getByRole('group', { name: '跟进方式' });
    assert.equal(await kinds.getByRole('button').count(), 6);
    await kinds.getByRole('button', { name: 'LINE' }).click();
    assert.equal(await kinds.getByRole('button', { name: 'LINE' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await kinds.getByRole('button', { name: '电话' }).getAttribute('aria-pressed'), 'false');
    const chip = await box(kinds.getByRole('button', { name: '电话' }));
    assert.ok(chip.height <= 30 && chip.width < 90, `方式是小标签 ${chip.width}×${chip.height}`);
    const mic = await box(composer.getByRole('button', { name: '录音' }));
    const save = await box(composer.getByRole('button', { name: '保存跟进' }));
    const dueLabel = await box(composer.getByText('下次跟进', { exact: true }));
    assert.ok(Math.abs(mic.y + mic.height / 2 - (save.y + save.height / 2)) < 3 && Math.abs(dueLabel.y + dueLabel.height / 2 - (save.y + save.height / 2)) < 4, '底部一行：工具、下次跟进、保存');
    const composerBox = await box(composer.locator('.aui-acomposer-box'));
    assert.ok(composerBox.x + composerBox.width - (save.x + save.width) < 16, '保存跟进靠右');
    await composer.getByRole('textbox', { name: '跟进内容' }).fill('客户周末来门市看样品');
    await composer.getByRole('button', { name: '3 天' }).click();
    assert.match(await composer.locator('.aui-acomposer-date input').inputValue(), /^\d{4}-\d{2}-\d{2}$/);
    await shot(page, 'composer');
    await composer.getByRole('button', { name: '保存跟进' }).click();
    assert.equal(await composer.getByRole('textbox', { name: '跟进内容' }).inputValue(), '', '保存后清空');

    // 阶段可点：鼠标、键盘、更多 → 丢单
    await stage.getByRole('button', { name: /^报价/ }).click();
    assert.match(await stage.locator('[aria-current=step]').innerText(), /报价/);
    await stage.getByRole('button', { name: /^需求确认/ }).focus();
    await page.keyboard.press('Enter');
    assert.match(await stage.locator('[aria-current=step]').innerText(), /需求确认/);
    await stage.getByRole('button', { name: /^更多/ }).click();
    await page.getByRole('menuitemcheckbox', { name: '丢单' }).click();
    assert.equal(await stage.locator('.aui-rstage-name').innerText(), '丢单');
    assert.equal(await stage.locator('.aui-stagepath-more').getAttribute('data-exited'), 'true');
    assert.equal(await stage.getByRole('button', { name: /进入/ }).count(), 0, '退出后不再「进入下一阶段」');
    await stage.getByRole('button', { name: /^需求确认/ }).click();
    await stage.getByRole('button', { name: '进入报价' }).click();
    assert.match(await stage.locator('[aria-current=step]').innerText(), /报价/);
    await stage.getByRole('button', { name: /^需求确认/ }).click();
    // 关注
    const follow = detail.locator('.aui-rfollow');
    assert.equal(await follow.getAttribute('aria-pressed'), 'true');
    await follow.click();
    assert.equal(await follow.getAttribute('aria-pressed'), 'false');
    assert.equal(await follow.innerText(), '关注');

    // ---------------------------------------------------------------- 编辑布局
    await detail.getByRole('button', { name: '编辑布局' }).click();
    const bar = detail.getByRole('toolbar', { name: '编辑布局' });
    await bar.waitFor();
    assert.equal(await bar.getByRole('group', { name: '改给谁' }).count(), 1, '能改团队默认时有范围切换');
    assert.equal(await detail.locator('.aui-rlayout-open').count(), 0, '编辑时头部不再显示「编辑布局」');
    await shot(page, 'edit');
    // 键盘：「需求」Alt+← 换到主栏末尾，Alt+↑ 往上一格
    await detail.getByRole('button', { name: '移动「需求」' }).focus();
    await page.keyboard.press('Alt+ArrowLeft');
    assert.deepEqual(await blockIds(lane(detail, 'main')), ['activity', 'comments', 'needs']);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-grip-for')), 'needs', '焦点跟着移动的卡片');
    await page.keyboard.press('Alt+ArrowUp');
    assert.deepEqual(await blockIds(lane(detail, 'main')), ['activity', 'needs', 'comments']);
    assert.match(await detail.locator('[aria-live=assertive]').last().innerText(), /已把「需求」，左栏第 2 张，共 3 张/);
    // 空格拿起 → ↓ → Esc 放回原处
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    assert.deepEqual(await blockIds(lane(detail, 'main')), ['activity', 'comments', 'needs']);
    await page.keyboard.press('Escape');
    assert.deepEqual(await blockIds(lane(detail, 'main')), ['activity', 'needs', 'comments'], 'Esc 放回原处');
    assert.ok(await bar.isVisible(), 'Esc 只取消这次拿起，不退出编辑');
    // 拖动：「评论」拖到右栏最上面
    const grip = detail.getByRole('button', { name: '移动「评论」' });
    const g = await box(grip);
    const contact = await box(detail.locator('[data-block-id=contact]'));
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + 40, g.y + 10, { steps: 4 });
    await page.mouse.move(contact.x + contact.width / 2, contact.y + 12, { steps: 8 });
    assert.ok(await detail.locator('.aui-rlayout-line').isVisible(), '拖动时有落点线');
    await page.mouse.up();
    assert.deepEqual(await blockIds(lane(detail, 'side')), ['comments', 'contact', 'deal', 'system']);
    // 隐藏「系统信息」→ 托盘里恢复
    await detail.getByRole('button', { name: '隐藏「系统信息」' }).click();
    assert.equal(await detail.locator('[data-block-id=system]').count(), 0);
    const tray = detail.getByRole('group', { name: '已隐藏' });
    await tray.getByRole('button', { name: '显示「系统信息」' }).waitFor();
    // 整理字段：LINE ID 用键盘移到下一个分区（不能出到顶层）
    await detail.getByRole('button', { name: '整理「联系方式」的字段' }).click();
    const sheet = page.getByRole('dialog', { name: '整理字段' });
    await sheet.waitFor();
    await sheet.getByRole('button', { name: '移动「来源」' }).focus();
    await page.keyboard.press('Alt+ArrowDown');
    assert.equal(await sheet.getByRole('list', { name: '成交' }).getByRole('button', { name: '移动「来源」' }).count(), 1, '最后一个往下 = 进下一个分区（按阅读顺序：主栏的「需求」在前，右栏的「成交」在「联系方式」后）');
    await sheet.getByRole('button', { name: '隐藏字段「地址」' }).click();
    const rename = sheet.getByRole('textbox', { name: '分区「成交」的名称' });
    await rename.fill('成交信息');
    await rename.press('Enter');
    await sheet.getByRole('button', { name: '好了' }).click();
    await sheet.waitFor({ state: 'hidden' });
    assert.equal(await detail.locator('[data-block-id=deal] .aui-rfield[data-field-key=source]').count(), 1, '来源到了「成交」');
    assert.equal(await detail.locator('.aui-rfield[data-field-key=address]').count(), 0, '地址隐藏了');
    await tray.getByRole('button', { name: '显示字段「地址」' }).waitFor();
    await shot(page, 'edit-changed');
    // 取消：全部还原
    await bar.getByRole('button', { name: '取消' }).click();
    assert.deepEqual(await blockIds(lane(detail, 'side')), ['contact', 'needs', 'deal', 'system'], '取消还原');
    // 再来一次，完成保存（只改我的）
    await detail.getByRole('button', { name: '编辑布局' }).click();
    await detail.getByRole('button', { name: '移动「评论」' }).focus();
    await page.keyboard.press('Alt+ArrowRight');
    await bar.getByRole('button', { name: '完成' }).click();
    await bar.waitFor({ state: 'hidden' });
    assert.deepEqual(await blockIds(lane(detail, 'side')), ['contact', 'needs', 'deal', 'system', 'comments']);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORE);
    assert.equal(saved.mine.blocks.find((b) => b.id === 'comments').column, 'side', '宿主拿到 spec 存起来');
    // 恢复团队默认
    await detail.getByRole('button', { name: '编辑布局' }).click();
    await bar.getByRole('button', { name: '恢复团队默认' }).click();
    await bar.waitFor({ state: 'hidden' });
    assert.deepEqual(await blockIds(lane(detail, 'main')), ['activity', 'comments']);

    // ---------------------------------------------------------------- 版式
    const presets = page.getByRole('group', { name: '版式' }).first();
    await presets.getByRole('button', { name: '单栏' }).click();
    assert.equal(await body.getAttribute('data-preset'), 'single');
    assert.equal(await detail.locator('.aui-stagepath').getAttribute('data-variant'), 'chevrons', '单栏用箭头阶段');
    assert.equal(await detail.locator('.aui-rdetail-col').count(), 1);
    await shot(page, 'single');
    await presets.getByRole('button', { name: '左右分栏' }).click();
    assert.equal(await body.getAttribute('data-preset'), 'split');
    const left = await box(lane(detail, 'side'));
    const right = await box(lane(detail, 'main'));
    assert.ok(left.x < right.x, '左资料、右动态');
    await shot(page, 'split');
    await presets.getByRole('button', { name: '卡片分区' }).click();

    // ---------------------------------------------------------------- 弹框（RecordLayout.cards）
    await page.getByRole('button', { name: '在弹框里打开' }).click();
    const dialog = page.getByRole('dialog').filter({ has: page.locator('.aui-record-expanded[data-display=cards]') });
    await dialog.waitFor();
    assert.equal(await dialog.locator('.aui-rdetail[data-preset=cards] .aui-rstage').count(), 1);
    await page.waitForTimeout(200);
    await shot(page, 'dialog');
    // 7.12.1：右栏停在视口里（主栏往下滚时右栏不变空白），比可视区高时自己滚
    const sideCol = dialog.locator('.aui-rdetail-col[data-lane-column=side]');
    const sticky = await sideCol.evaluate((el) => ({ position: getComputedStyle(el).position, overflowY: getComputedStyle(el).overflowY, overflowX: getComputedStyle(el).overflowX }));
    assert.deepEqual(sticky, { position: 'sticky', overflowY: 'auto', overflowX: 'hidden' }, '弹框里右栏 sticky + 自己滚');
    const scroller = await dialog.evaluateHandle((el) => [...el.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY) && n.contains(el.querySelector('.aui-rdetail'))));
    const port = await scroller.evaluate((n) => { n.scrollTop = 600; return n.getBoundingClientRect().top; });
    await page.waitForTimeout(100);
    const sideTop = (await box(sideCol)).y;
    assert.ok(sideTop >= port - 1, `滚动后右栏还在可视区顶上 ${sideTop} ≥ ${port}`);
    await shot(page, 'dialog-scrolled');
    await scroller.evaluate((n) => { n.scrollTop = 0; });
    await dialog.getByRole('button', { name: '编辑布局' }).click();
    await dialog.getByRole('toolbar', { name: '编辑布局' }).waitFor();
    await shot(page, 'dialog-edit');
    await page.keyboard.press('Escape');
    await dialog.getByRole('toolbar', { name: '编辑布局' }).waitFor({ state: 'hidden' });
    assert.ok(await dialog.isVisible(), '编辑时 Esc 先退出编辑，不关弹框');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });

    // ---------------------------------------------------------------- 阶段选项：每行宿主控件 + meta
    const editor = page.getByRole('list', { name: '阶段选项顺序' });
    assert.equal(await editor.getByRole('combobox', { name: /的类别$/ }).count(), 9);
    await page.locator('.aui-panel', { has: editor }).screenshot({ path: resolve(output, 'stage-options.png') });
    const rate = editor.getByRole('spinbutton', { name: '选项 3 的默认赢率（%）' });
    await rate.fill('45');
    await editor.getByRole('button', { name: '移动「报价」' }).focus();
    await page.keyboard.press('Alt+ArrowUp');
    assert.equal(await editor.getByRole('spinbutton', { name: '选项 2 的默认赢率（%）' }).inputValue(), '45', 'meta 跟着选项换序');
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---------------------------------------------------------------- 手机
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const { errors, detail } = await openPage(phone, 'light');
  const ys = await Promise.all(['stage', 'keyNumbers', 'activity', 'comments', 'contact', 'system'].map(async (id) => (await box(detail.locator(`[data-block-id=${id}]`))).y));
  assert.deepEqual([...ys].sort((a, b) => a - b), ys, '一列：顶部、主栏、右栏');
  const keyBoxes = await detail.locator('.aui-rkey').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().y));
  assert.ok(keyBoxes[0] === keyBoxes[1] && keyBoxes[2] > keyBoxes[0], '关键数两个一行');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '手机不横向溢出');
  await feedDotsOnLine(detail, '390');
  await shot(phone, 'mobile');
  await detail.screenshot({ path: resolve(output, 'mobile-full.png') });
  assert.deepEqual(errors, []);
  console.log('record-cards ok');
} finally {
  await browser.close();
  await server.close();
}
