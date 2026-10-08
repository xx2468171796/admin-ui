// 分享套件浏览器验收：starter「系统 → 分享与历史」（样稿 D20 / D22 / D25）和公开页 #share-public=visitor | password | secret（D21 / D21m / D21s）。
// 分享弹窗（二维码、复制链接 / 链接和密码、策略锁住的密码和「永久」、换密码 / 自己填、有效期小时档、阅后即焚 + 次数、能做什么 → 字段、
// 调整字段面板、指定的人、保存状态、访问记录侧板、作废确认）；我的分享（指标带、展开访问记录、筛选、封 IP、⋯ 菜单、暂停、作废）；
// 单元格修改历史（版本、当前版本、恢复写新版本、整条记录、Esc 焦点回到格子）；访客页（原地编辑、保存失败留在编辑态、水印）；
// 密码门（错误、圆点、连错 3 次要滑块、输对打开密钥）；一次性密钥（复制、剪贴板说明、隐藏、倒计时到点自动隐藏、立即销毁）；
// 1440 浅 / 深色、390 手机、触屏尺寸 ≥ 44px、不横向溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/share');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const noOverflow = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));
const shot = (page, name, fullPage = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage });
const errors = [];
const watch = (page) => page.on('pageerror', (e) => errors.push(e.message));

/** 时间线圆点圆心和线的中线对齐（7.12.1，|Δ| ≤ 0.5px）：线是每个版本行的 ::before */
async function versionDotsOnLine(page, what) {
  const cell = page.getByRole('button', { name: /查看修改历史/ });
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  const hist = page.getByRole('dialog', { name: /^修改历史：/ });
  await hist.waitFor();
  await page.waitForTimeout(250);
  const offsets = await hist.locator('.aui-cell-version').evaluateAll((rows) => rows.map((row) => {
    const line = getComputedStyle(row, '::before');
    const lineX = row.getBoundingClientRect().left + parseFloat(line.left) + parseFloat(line.width) / 2;
    const dot = row.querySelector('.aui-cell-version-dot').getBoundingClientRect();
    return { delta: Math.abs(dot.left + dot.width / 2 - lineX), dot: dot.width, line: parseFloat(line.width) };
  }));
  assert.ok(offsets.length > 0 && offsets.every((o) => o.delta <= 0.5 && o.dot === 8 && o.line === 2), `${what}：圆点圆心在线上（8px 点、2px 线）${JSON.stringify(offsets)}`);
  await page.keyboard.press('Escape');
  await hist.waitFor({ state: 'detached' });
}

try {
  // 浏览器时区故意和弹窗的 timeZone（Asia/Shanghai）不同：自定义有效期按 timeZone 读写
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  watch(page);
  await page.goto(url);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '分享与历史', exact: true }).click();
  await page.getByRole('button', { name: '分享记录' }).waitFor();

  // ================================================================ D20 分享弹窗（600 宽一列、不套卡片、一个实心主按钮、改了立刻生效）
  await page.getByRole('button', { name: '分享记录' }).click();
  const dialog = page.getByRole('dialog', { name: '分享李承恩（滨江豪宅）' });
  await dialog.waitFor();
  await page.waitForTimeout(350);
  const dialogRect = await dialog.boundingBox();
  assert.ok(dialogRect && Math.abs(dialogRect.width - 600) <= 1, `弹窗 600 宽：${dialogRect?.width}`);
  assert.ok(dialogRect.y >= 0 && dialogRect.y + dialogRect.height <= 900, `1440×900 弹窗整个在屏幕里 ${JSON.stringify(dialogRect)}`);
  const overflowY = await dialog.locator('.aui-share-body').evaluate((el) => el.scrollHeight - el.clientHeight);
  assert.ok(overflowY <= 0, `1440×900 一屏放下、不用滚（多出 ${overflowY}px）`);
  assert.equal(await dialog.locator('.aui-button-primary').count(), 1, '整个弹窗只有一个实心主按钮');
  assert.match(await dialog.locator('.aui-button-primary').innerText(), /复制链接和密码/);
  assert.match(await dialog.getByRole('button', { name: '完成' }).getAttribute('class'), /aui-button-outline/, '「完成」是描边');
  assert.equal(await dialog.locator('.aui-share-group, .aui-card, [aria-label=当前设置]').count(), 0, '不套卡片、没有重复的胶囊排');
  const sentence = () => dialog.locator('.aui-share-sentence').innerText();
  assert.equal(await sentence(), '互联网上拿到链接和密码的人 · 可编辑 2 个字段 · 7 天后（10月12日 周一 18:00）失效 · 还能打开 17 次');
  assert.match(await dialog.locator('.aui-share-bar[data-tone=info]').innerText(), /华南子公司要求：对外分享必须设密码，最长 30 天/);
  assert.match(await dialog.locator('.aui-share-urlbox').innerText(), /app.example.com\/s\/Kp7xQ2[\s\S]*密码 8K3F/);
  // 复制 = 链接 + 密码 + 有效期 一段话
  await dialog.getByRole('button', { name: '复制链接和密码' }).click();
  await dialog.getByRole('button', { name: '已复制' }).waitFor();
  assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll(String.fromCharCode(13), ''), '「李承恩（滨江豪宅）」\n链接：https://app.example.com/s/Kp7xQ2\n密码：8K3F\n有效期：2026-10-12 18:00 前\n最多打开 20 次');
  // 二维码收进链接旁的图标按钮：点开出气泡（真编码 + 下载 PNG），Esc 只关气泡
  await dialog.getByRole('button', { name: '二维码' }).click();
  const qrPop = page.getByRole('dialog', { name: '二维码' });
  await qrPop.waitFor();
  const qr = qrPop.getByRole('img', { name: '李承恩（滨江豪宅） 的分享二维码' });
  assert.equal(await qr.getAttribute('data-qr-version'), '3', '二维码是真编码（3 版）');
  await qrPop.getByRole('button', { name: '下载 PNG' }).waitFor();
  await shot(page, 'dialog-qr');
  await page.keyboard.press('Escape');
  await qrPop.waitFor({ state: 'detached' });
  assert.ok(await dialog.isVisible(), 'Esc 只关二维码气泡');
  const saved = () => dialog.locator('.aui-share-saved[data-kind=saved]').filter({ hasText: '已保存，立即生效' }).waitFor();
  // 密码：策略要求 → 开关锁住（悬停写原因）；换一个；自己填（小写转大写）
  const pwRow = dialog.locator('.aui-share-row[data-row=密码]');
  assert.ok(await pwRow.getByRole('switch').isDisabled(), '策略强制的密码不能关');
  assert.match(await pwRow.locator('.aui-share-locked').getAttribute('data-tip'), /华南子公司要求/);
  await pwRow.getByRole('button', { name: '换一个' }).click();
  await dialog.locator('.aui-share-saved[data-kind=saving]').filter({ hasText: '保存中…' }).waitFor();
  await saved();
  const pin = (await pwRow.locator('.aui-share-code').getAttribute('aria-label')).replace('分享密码 ', '');
  assert.match(pin, /^[2-9A-HJKMNP-Z]{4}$/, `新密码 ${pin}`);
  assert.notEqual(pin, '8K3F');
  assert.match(await dialog.locator('.aui-share-pw').innerText(), new RegExp(`密码 ${pin}`), '链接行跟着变');
  await pwRow.getByRole('button', { name: '自己填' }).click();
  await page.keyboard.type('ab');
  assert.match(await pwRow.locator('.aui-code-error').innerText(), /还差 2 位/);
  await page.keyboard.type('12');
  await saved();
  assert.equal(await pwRow.locator('.aui-share-code').getAttribute('aria-label'), '分享密码 AB12');
  // 有效期（已通过的分段）：永久被策略锁住（锁 + 原因、点了没用）；第一次选 30 天演示保存失败 → 改回原值、底栏原因 + 重试（不弹框）
  const expiry = dialog.getByRole('group', { name: '有效期', exact: true });
  const forever = expiry.getByRole('button', { name: /永久/ });
  assert.equal(await forever.getAttribute('aria-disabled'), 'true');
  assert.match(await forever.getAttribute('data-tip'), /华南子公司要求最长 30 天/);
  await forever.click({ force: true });
  assert.equal(await expiry.getByRole('button', { name: '7 天', exact: true }).getAttribute('aria-pressed'), 'true', '点被锁住的档不改设置');
  await expiry.getByRole('button', { name: '30 天', exact: true }).click();
  assert.equal(await expiry.getByRole('button', { name: '30 天', exact: true }).getAttribute('aria-pressed'), 'true', '先乐观地显示新值');
  const failure = dialog.locator('.aui-share-saved[data-kind=error]');
  await failure.waitFor();
  assert.match(await failure.innerText(), /「30 天」没保存：网络中断/);
  assert.equal(await expiry.getByRole('button', { name: '7 天', exact: true }).getAttribute('aria-pressed'), 'true', '失败改回原值');
  assert.equal(await page.getByRole('alertdialog').count(), 0, '失败不弹框');
  await shot(page, 'dialog-save-failed');
  await failure.getByRole('button', { name: '重试' }).click();
  await saved();
  assert.equal(await expiry.getByRole('button', { name: '30 天', exact: true }).getAttribute('aria-pressed'), 'true', '重试成功');
  assert.match(await sentence(), /30 天后（11月4日 周三 18:00）失效/);
  await expiry.getByRole('button', { name: '自定义' }).click();
  await dialog.getByLabel('失效时间').fill('2027-01-01T10:00');
  assert.match(await dialog.getByRole('alert').filter({ hasText: '最长' }).innerText(), /华南子公司要求最长 30 天/, '自定义也受策略限制');
  await dialog.getByLabel('失效时间').fill('2026-10-20T10:00');
  await saved();
  assert.match(await dialog.locator('.aui-share-row[data-row=有效期] small').first().innerText(), /15 天后（10月20日 周二 10:00）失效/, '自定义时间按弹窗时区显示，填几点就是几点');
  await expiry.getByRole('button', { name: '7 天', exact: true }).click();
  await saved();
  // 打开次数：阅后即焚 → 最多（步进器回到上次的次数）→ 加一次
  const opens = dialog.getByRole('group', { name: '打开次数', exact: true });
  await opens.getByRole('button', { name: '阅后即焚' }).click();
  assert.match(await sentence(), /打开一次就销毁$/);
  await opens.getByRole('button', { name: '最多' }).click();
  assert.equal(await dialog.getByRole('spinbutton', { name: '最多打开次数' }).inputValue(), '20', '回到上次的次数');
  await dialog.getByRole('button', { name: '增加最多打开次数' }).click();
  assert.match(await sentence(), /还能打开 18 次$/);
  assert.match(await dialog.locator('.aui-share-meter').innerText(), /3 \/ 21/);
  // 能做什么 → 字段：只能看时「可改」都关；调整 ⌄ 展开勾选列表，每个字段「可改」小开关
  const cap = dialog.getByRole('group', { name: '访客能做什么', exact: true });
  const fieldsHint = () => dialog.locator('.aui-share-row[data-row=访客能看到的字段] small').first().innerText();
  assert.equal(await fieldsHint(), '9 / 14 个 · 可改 2 个 · 成交价不能对外');
  await cap.getByRole('button', { name: '只能看' }).click();
  assert.match(await sentence(), / · 只能看 · /);
  assert.match(await fieldsHint(), /可改 0 个/, '只能看时没有可改的字段');
  await cap.getByRole('button', { name: '可编辑' }).click();
  await dialog.getByRole('button', { name: '调整' }).click();
  const fieldList = dialog.getByRole('list', { name: '访客能看到的字段' });
  await fieldList.waitFor();
  assert.equal(await fieldList.locator('li').count(), 14);
  assert.equal(await fieldList.locator('li[data-off] [data-tip]').getAttribute('data-tip'), '成交价由管理员禁止对外', '禁止对外的字段带锁写原因');
  await fieldList.getByRole('checkbox', { name: '给访客看 来源' }).click();
  await fieldList.getByRole('switch', { name: '访客可改 来源' }).click();
  // 只能看时「可改」都关掉了，回到可编辑再打开
  await fieldList.getByRole('switch', { name: '访客可改 下次跟进' }).click();
  await fieldList.getByRole('switch', { name: '访客可改 备注' }).click();
  assert.equal(await fieldsHint(), '10 / 14 个 · 可改 3 个 · 成交价不能对外');
  assert.equal(await fieldList.getByRole('switch', { name: /访客可改 阶段/ }).count(), 0, '不能改的字段没有「可改」');
  await shot(page, 'dialog-fields');
  await dialog.getByRole('button', { name: '调整' }).click();
  await fieldList.waitFor({ state: 'detached' });
  // 指定的人 = 授权名单 picked：搜索添加 + 锁住的负责人 + 档位下拉 + 灰色一句话
  await dialog.getByRole('radio', { name: /指定的人/ }).click();
  const people = dialog.getByRole('group', { name: '指定的人' });
  await people.waitFor();
  assert.match(await sentence(), /^指定的 1 个人 · /);
  assert.ok(await pwRow.getByRole('switch').isEnabled(), '指定的人时策略不强制密码');
  assert.match(await people.locator('.aui-grant-row[data-locked]').innerText(), /小王[\s\S]*负责人[\s\S]*可编辑/);
  await people.getByRole('combobox').fill('阿明');
  await page.getByRole('listbox', { name: '可以授权的人、组和角色' }).waitFor();
  await page.keyboard.press('Enter');
  await people.getByRole('button', { name: '阿明 的权限：只能看' }).click();
  await page.getByRole('menu').getByRole('menuitemcheckbox', { name: '可编辑' }).or(page.getByRole('menu').getByRole('menuitem', { name: '可编辑' })).first().click();
  await people.getByRole('button', { name: '阿明 的权限：可编辑' }).waitFor();
  assert.match(await people.locator('.aui-grant-summary').innerText(), /共 3 人能打开 · 阿明看不到「预计金额」/);
  const avatarTones = await people.locator('.aui-avatar').evaluateAll((els) => els.map((e) => e.dataset.tone));
  assert.ok(new Set(avatarTones).size > 1, `头像按人分色 ${avatarTones}`);
  await shot(page, 'dialog-people');
  await dialog.getByRole('radio', { name: /互联网上任何人/ }).click();
  await people.waitFor({ state: 'detached' });
  // ⋯：暂停 / 预览 / 提醒；暂停后顶上一条注意色说明 + 恢复，复制按钮不能点
  await dialog.getByRole('button', { name: '更多分享操作' }).click();
  const more = page.getByRole('menu');
  await more.waitFor();
  const moreItems = (await more.innerText()).replace(/\s+/g, ' ');
  for (const n of ['暂停链接', '以访客身份预览', '有人打开时通知我', '到期前 1 天提醒我']) assert.ok(moreItems.includes(n), `⋯ 菜单有「${n}」：${moreItems}`);
  await more.getByRole('menuitem', { name: /暂停链接/ }).click();
  assert.equal(await dialog.locator('.aui-share-state').innerText(), '已暂停');
  assert.match(await dialog.locator('.aui-share-bar[data-tone=warning]').innerText(), /链接暂停中/);
  assert.ok(await dialog.locator('.aui-share-copy').isDisabled(), '暂停时不能复制');
  await shot(page, 'dialog-paused');
  await dialog.getByRole('button', { name: '恢复链接' }).click();
  assert.equal(await dialog.locator('.aui-share-state').innerText(), '链接有效');
  // 访问记录 → 侧边弹层
  await dialog.getByRole('button', { name: /访问记录/ }).click();
  const sheet = page.getByRole('dialog', { name: '访问记录 · 李承恩（滨江豪宅）' });
  await sheet.waitFor();
  assert.equal(await sheet.locator('.aui-access-row').count(), 6);
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  // 作废：先确认
  await dialog.getByRole('button', { name: '作废' }).click();
  const confirm = page.getByRole('dialog', { name: '作废这个分享链接？' });
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /立刻失效[\s\S]*不能恢复/);
  await confirm.getByRole('button', { name: '取消' }).click();
  await confirm.waitFor({ state: 'detached' });
  await dialog.locator('.aui-share-body').evaluate((el) => el.scrollTo(0, 0));
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  await shot(page, 'dialog-1440');
  await dialog.getByRole('button', { name: '完成' }).click();
  await dialog.waitFor({ state: 'detached' });

  // ================================================================ 授权名单即改即生效（知识库「页面权限」：GrantList picked + apply=instant）
  const grants = page.getByRole('group', { name: '页面权限', exact: true });
  await grants.scrollIntoViewIfNeeded();
  assert.equal(await grants.getByRole('button', { name: /保存/ }).count(), 0, '没有保存按钮');
  assert.match(await grants.locator('.aui-grant-row[data-locked]').innerText(), /小王[\s\S]*负责人[\s\S]*可管理/);
  assert.equal(await grants.getByRole('button', { name: '去掉 小王' }).count(), 0, '负责人去不掉');
  const removeOpacity = (name) => grants.getByRole('button', { name }).evaluate((el) => getComputedStyle(el).opacity);
  await page.mouse.move(5, 5);
  assert.equal(await removeOpacity('去掉 阿明'), '0', '行内「去掉」平时不显示');
  await grants.locator('.aui-grant-row', { hasText: '阿明' }).hover();
  await page.waitForTimeout(200);
  assert.equal(await removeOpacity('去掉 阿明'), '1', '悬停出现');
  await grants.getByRole('button', { name: '阿明 的权限：可查看' }).click();
  await page.getByRole('menu').getByRole('menuitemcheckbox', { name: '可管理' }).or(page.getByRole('menu').getByRole('menuitem', { name: '可管理' })).first().click();
  await grants.getByRole('status', { name: '正在保存 阿明' }).waitFor();
  await grants.locator('.aui-grant-status[data-kind=saving]').waitFor();
  const rowError = grants.locator('.aui-grant-row[data-failed] .aui-grant-error');
  await rowError.waitFor();
  assert.match(await rowError.innerText(), /「阿明」改成「可管理」没保存：只有空间管理员能给「可管理」/);
  await grants.getByRole('button', { name: '阿明 的权限：可查看' }).waitFor();
  await shot(page, 'grants-failed');
  await rowError.getByRole('button', { name: '重试' }).click();
  await grants.getByRole('button', { name: '阿明 的权限：可管理' }).waitFor();
  await grants.locator('.aui-grant-status[data-kind=saved]').filter({ hasText: '已保存，立即生效' }).waitFor();
  assert.equal(await grants.locator('.aui-grant-row[data-failed]').count(), 0);
  await grants.getByRole('button', { name: '去掉 上海安装组' }).click();
  await grants.locator('.aui-grant-row', { hasText: '上海安装组' }).waitFor({ state: 'detached' });
  await grants.getByRole('combobox').fill('林经理');
  await page.getByRole('listbox', { name: '可以授权的人、组和角色' }).waitFor();
  await page.keyboard.press('Enter');
  await grants.locator('.aui-grant-status[data-kind=saved]').waitFor();
  assert.match(await grants.locator('.aui-grant-rows').innerText(), /小王[\s\S]*阿明[\s\S]*林经理/);
  assert.match(await grants.locator('.aui-grant-summary').innerText(), /共 3 个人或组能看这个页面/);
  await grants.screenshot({ path: resolve(output, 'grants-instant.png') });

  // ================================================================ D22 我的分享
  const strip = page.getByRole('definition').first();
  await strip.waitFor();
  assert.match(await page.locator('.aui-stat-strip').innerText(), /有效\s*12\s*条链接[\s\S]*即将到期\s*2/);
  const manager = page.locator('.aui-share-manager');
  const table = manager.getByRole('table', { name: '我的分享' });
  assert.equal(await table.locator('tbody tr:not(.aui-table-expanded)').count(), 7);
  const log = manager.getByRole('region', { name: '访问记录', exact: true });
  assert.equal(await log.locator('.aui-access-row').count(), 6, '第 1 行展开着访问记录');
  const logWidth = await log.evaluate((el) => el.getBoundingClientRect().width);
  assert.ok(logWidth > 1000, `访问记录占满表格宽度 ${logWidth}`);
  // 1440 带侧栏（审阅 07）：表格不横着滚，风险行的「封这个 IP」整个看得见
  const fit = await manager.evaluate((m) => {
    const scroll = m.querySelector('.aui-table-scroll');
    const box = scroll.getBoundingClientRect();
    const block = m.querySelector('.aui-access-block').getBoundingClientRect();
    return { over: scroll.scrollWidth - scroll.clientWidth, blockRight: block.right, right: box.right };
  });
  assert.ok(fit.over <= 0, `1440 我的分享横着滚 ${fit.over}px`);
  assert.ok(fit.blockRight <= fit.right, `「封这个 IP」被切掉（${fit.blockRight} > ${fit.right}）`);
  assert.match(await log.locator('.aui-access-row').nth(1).innerText(), /下次跟进\s*2026-10-09\s*(改成\s*)?2026-10-11/);
  assert.equal(await log.locator('.aui-access-row s').first().innerText(), '2026-10-09', '改前划线');
  await log.getByRole('group', { name: '按类型筛选访问记录' }).getByRole('button', { name: '安全 1' }).click();
  assert.equal(await log.locator('.aui-access-row').count(), 1);
  await log.getByRole('button', { name: '封这个 IP' }).click();
  await log.getByRole('button', { name: '已封' }).waitFor();
  await log.getByRole('group', { name: '按类型筛选访问记录' }).getByRole('button', { name: '全部 6' }).click();
  // 有效期 48 小时内的用注意色
  const soonColor = await table.locator('tr', { hasText: '平面图.pdf' }).locator('.aui-share-two-line[data-tone=attention]').count();
  assert.equal(soonColor, 1, '明天到期的标注意色');
  // ⋯ 菜单：延长 / 暂停 / 再分享 / 访问记录 / 作废
  const row4 = table.locator('tr', { hasText: '平面图.pdf' });
  await row4.getByRole('button', { name: '平面图.pdf 的更多操作' }).click();
  const menu = page.getByRole('menu');
  await menu.waitFor();
  const names = await menu.getByRole('menuitem').allInnerTexts();
  for (const n of ['延长 7 天', '暂停', '按这个设置再分享', '访问记录', '作废链接']) assert.ok(names.some((x) => x.includes(n)), `菜单有「${n}」：${names}`);
  await shot(page, 'manager-menu');
  await menu.getByRole('menuitem', { name: '访问记录' }).click();
  assert.equal(await manager.getByRole('region', { name: '访问记录', exact: true }).count(), 1, '一次只展开一行');
  await row4.getByRole('button', { name: '平面图.pdf 的更多操作' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: '暂停' }).click();
  assert.equal(await table.locator('tbody tr:not(.aui-table-expanded)').count(), 6, '暂停的离开「有效」');
  assert.match(await manager.getByRole('group', { name: '分享状态' }).innerText(), /已暂停 1/);
  const row6 = table.locator('tr', { hasText: '滨江样品间 Wi-Fi 管理员' });
  await row6.getByRole('button', { name: '滨江样品间 Wi-Fi 管理员 的更多操作' }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: '作废链接' }).click();
  const voidConfirm = page.getByRole('dialog', { name: '作废这个分享链接？' });
  await voidConfirm.getByRole('button', { name: '作废链接' }).click();
  await voidConfirm.waitFor({ state: 'detached' });
  assert.equal(await table.locator('tbody tr:not(.aui-table-expanded)').count(), 5);
  await manager.getByRole('searchbox').or(manager.getByRole('textbox', { name: '搜索分享' })).first().fill('报价');
  assert.equal(await table.locator('tbody tr:not(.aui-table-expanded)').count(), 1, '搜索');
  await manager.getByRole('searchbox').or(manager.getByRole('textbox', { name: '搜索分享' })).first().fill('');

  // ================================================================ D25 单元格修改历史
  const cell = page.getByRole('button', { name: /查看修改历史/ });
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  const hist = page.getByRole('dialog', { name: '修改历史：黄淑芬 · 预计金额' });
  await hist.waitFor();
  assert.equal(await hist.locator('.aui-cell-version').count(), 5);
  assert.match(await hist.locator('.aui-cell-version').first().innerText(), /¥450,000[\s\S]*¥480,000[\s\S]*小李[\s\S]*10-05 15:05[\s\S]*表格[\s\S]*OP-20261005-0151[\s\S]*当前/);
  assert.equal(await hist.locator('.aui-cell-version').first().locator('s.aui-change-value-before').innerText(), '¥450,000', '旧值删除线（ChangeValue）');
  const histBox = await hist.boundingBox();
  assert.ok(histBox && Math.abs(histBox.width - 380) <= 1, `修改历史 380 宽：${histBox?.width}`);
  assert.equal(await hist.locator('.aui-cell-version-source[data-tone]').count(), 0, '来源一律灰色小标');
  assert.equal(await hist.locator('[title]').count(), 0, '没有原生 title 提示');
  await page.mouse.move(5, 5);
  const actOpacity = (i) => hist.locator('.aui-cell-version').nth(i).locator('.aui-cell-version-act').evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(await actOpacity(1), '0', '「恢复」平时不显示');
  await hist.locator('.aui-cell-version').nth(1).hover();
  await page.waitForTimeout(150);
  assert.equal(await actOpacity(1), '1', '悬停那一行出现「恢复」');
  await page.waitForTimeout(200);
  await shot(page, 'history-1440');
  await hist.getByRole('button', { name: '恢复到 10-05 14:20 的版本' }).click();
  const ask = hist.getByRole('group', { name: '确认恢复' });
  assert.match(await ask.innerText(), /恢复成 ¥450,000？会记成一个新版本/);
  await page.waitForTimeout(150);
  await shot(page, 'history-confirm');
  await ask.getByRole('button', { name: '恢复', exact: true }).click();
  await hist.locator('.aui-cell-version').nth(5).waitFor();
  assert.match(await hist.locator('.aui-cell-version').first().innerText(), /¥480,000[\s\S]*¥450,000[\s\S]*我[\s\S]*恢复[\s\S]*当前/, '恢复写成一个新版本');
  await hist.getByRole('button', { name: '整条记录' }).click();
  assert.match(await hist.innerText(), /下次跟进[\s\S]*分享页/, '整条记录：带字段名，有分享页来源');
  assert.ok(await hist.getByRole('button', { name: /恢复到 09-30/ }).isDisabled(), '只读字段不能恢复');
  await page.keyboard.press('Escape');
  await hist.waitFor({ state: 'detached' });
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), /查看修改历史/, '焦点回到格子');
  await versionDotsOnLine(page, '1440 浅色');

  // ---- 截图：页面 1440 浅 / 深、弹窗深色、390
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const close of await page.getByRole('button', { name: '关闭通知' }).all()) await close.click().catch(() => undefined);
  await noOverflow(page, '1440');
  await shot(page, 'share-1440', true);
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, 'share-dark', true);
  await versionDotsOnLine(page, '1440 深色');
  await page.getByRole('button', { name: '分享记录' }).click();
  await dialog.waitFor();
  await page.waitForTimeout(350);
  assert.equal(await dialog.locator('.aui-button-primary').count(), 1, '深色：一个实心主按钮');
  await shot(page, 'dialog-dark');
  // 深色：二维码在气泡里，白底（扫码要浅底）+ 外面一圈面板色卡框，不是一块刺眼的白方块
  await dialog.getByRole('button', { name: '二维码' }).click();
  const darkQr = page.getByRole('dialog', { name: '二维码' }).getByRole('img', { name: '李承恩（滨江豪宅） 的分享二维码' });
  await darkQr.waitFor();
  const qrColors = await darkQr.evaluate((el) => ({ bg: getComputedStyle(el.querySelector('.aui-qr-bg')).fill, fg: getComputedStyle(el.querySelector('.aui-qr-fg')).fill }));
  const lum = (c) => {
    const [r, g, b] = c.match(/[\d.]+/g).map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  assert.ok(lum(qrColors.bg) > lum(qrColors.fg) + 120, `深色下二维码仍是浅底深点 ${JSON.stringify(qrColors)}`);
  const qrFrame = await darkQr.evaluate((el) => getComputedStyle(el).boxShadow);
  assert.match(qrFrame, /0px 0px 0px 6px[\s\S]*0px 0px 0px 7px/, `深色二维码有卡框 ${qrFrame}`);
  await page.waitForTimeout(150);
  await shot(page, 'dialog-qr-dark');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow(page, '390');
  await shot(page, 'share-390', true);
  await versionDotsOnLine(page, '390');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '分享记录' }).click();
  await dialog.waitFor();
  await page.waitForTimeout(300);
  await noOverflow(page, '390 弹窗');
  const dialogBox = await page.locator('.aui-dialog').boundingBox();
  assert.ok(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 391, `手机上弹窗不出屏 ${JSON.stringify(dialogBox)}`);
  assert.ok(dialogBox.height >= 844 - 13 && dialogBox.y + dialogBox.height >= 843, `手机：底部弹层占满高度 ${JSON.stringify(dialogBox)}`);
  const copyBox = await dialog.locator('.aui-share-copy').boundingBox();
  assert.ok(copyBox && copyBox.height >= 44 && copyBox.width >= 260, `手机：复制按钮 44 高、占一行 ${JSON.stringify(copyBox)}`);
  const segFill = await dialog.getByRole('group', { name: '访客能做什么', exact: true }).evaluate((el) => el.getBoundingClientRect().width / el.closest('.aui-share-rows').getBoundingClientRect().width);
  assert.ok(segFill > 0.97, `手机：分段撑满宽度 ${segFill}`);
  await shot(page, 'dialog-390');
  await dialog.locator('.aui-share-body').evaluate((el) => el.scrollTo(0, 560));
  await page.waitForTimeout(150);
  await shot(page, 'dialog-390-2');
  await page.keyboard.press('Escape');
  await context.close();

  // ================================================================ D21 访客页
  const visitorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const visitor = await visitorContext.newPage();
  watch(visitor);
  await visitor.goto(`${url}#share-public=visitor`);
  const card = visitor.getByRole('region', { name: '李承恩（滨江豪宅）' });
  await card.waitFor();
  assert.equal(await visitor.locator('.aui-admin-shell, .aui-shell').count(), 0, '公开页没有后台外壳');
  assert.ok(await visitor.locator('.aui-watermark-mark').count() > 10, '水印默认开、铺满');
  assert.equal(await visitor.locator('.aui-watermark-mark').first().innerText(), '访客 203.0.**.18 · 10-05 20:16', '默认水印 = 访客 IP（打码）+ 打开时间');
  const wm = await visitor.locator('.aui-watermark').evaluate((el) => ({ pe: getComputedStyle(el).pointerEvents, color: getComputedStyle(el).color, rotate: getComputedStyle(el).getPropertyValue('--aui-wm-rotate') }));
  assert.equal(wm.pe, 'none', '水印不挡点击');
  assert.match(wm.rotate.trim(), /^-\d+deg$/, `斜铺 ${wm.rotate}`);
  const wmAlpha = Number((wm.color.match(/[\d.]+\)$/) ?? ['1'])[0].replace(')', ''));
  assert.ok(wmAlpha > 0.05 && wmAlpha <= 0.2, `水印很淡（备注色 14%）${wm.color}`);
  assert.match(await visitor.locator('.aui-public-top').innerText(), /小王 分享给你的客户记录[\s\S]*已验证[\s\S]*7 天后失效\s*· 还能打开 17 次/);
  assert.match(await card.locator('.aui-shared-can').innerText(), /你可以改 2 个字段/);
  assert.match(await card.locator('.aui-shared-perm').innerText(), /看 9 个字段[\s\S]*复制文字已关闭/);
  await card.getByRole('button', { name: '修改下次跟进' }).click();
  const dateInput = card.getByLabel('下次跟进可改');
  await dateInput.or(card.locator('.aui-shared-editor input')).first().fill('2026-10-12');
  await card.getByRole('button', { name: '保存' }).click();
  await card.getByText('2026-10-12').waitFor();
  assert.match(await card.innerText(), /刚改过/);
  await card.getByRole('button', { name: '修改备注' }).click();
  await card.locator('textarea').fill('');
  await card.getByRole('button', { name: '保存' }).click();
  await card.getByRole('alert').filter({ hasText: '不能为空' }).waitFor();
  assert.equal(await card.locator('textarea').count(), 1, '保存失败留在编辑态');
  await card.locator('textarea').fill('周六 10 点看样品间，大门加人脸门锁一起报价');
  assert.match(await card.locator('.aui-shared-editor-count').innerText(), /\d+ \/ 500/);
  await shot(visitor, 'visitor-editing');
  await card.getByRole('button', { name: '保存' }).click();
  await card.getByText('周六 10 点看样品间，大门加人脸门锁一起报价').waitFor();
  const media = visitor.getByRole('region', { name: '现场资料' });
  assert.equal(await media.locator('.aui-media-tile, .aui-media-thumb').count() > 0, true, '附件方块');
  await noOverflow(visitor, '访客页 1440');
  await shot(visitor, 'visitor-1440', true);
  await visitor.goto(`${url}?nowm#share-public=visitor`);
  await card.waitFor();
  assert.equal(await visitor.locator('.aui-watermark').count(), 0, 'watermark={false} 关掉水印');
  await visitor.goto(`${url}#share-public=visitor&dark`);
  await card.waitFor();
  await visitor.waitForTimeout(300);
  await shot(visitor, 'visitor-dark', true);
  await visitor.setViewportSize({ width: 390, height: 844 });
  await visitor.goto(`${url}#share-public=visitor`);
  await card.waitFor();
  await visitor.waitForTimeout(300);
  await noOverflow(visitor, '访客页 390');
  const small = await visitor.locator('.aui-public .aui-button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 40).map((e) => `${e.textContent}:${e.getBoundingClientRect().height}`));
  assert.deepEqual(small, [], '手机上公开页按钮 ≥ 40px（主按钮 ≥ 44px）');
  await shot(visitor, 'visitor-390', true);
  await visitorContext.close();

  // ================================================================ D21m 密码门 → D21s 一次性密钥
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'], hasTouch: true });
  const gate = await phone.newPage();
  watch(gate);
  await gate.goto(`${url}#share-public=password`);
  const boxes = gate.getByRole('group', { name: '分享密码' }).locator('input');
  await boxes.first().waitFor();
  const boxHeight = await boxes.first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(boxHeight >= 44, `密码格 ≥ 44px：${boxHeight}`);
  assert.ok(await gate.getByRole('button', { name: '查看' }).isDisabled(), '没填满不能提交');
  assert.equal(await gate.locator('.aui-watermark').count(), 0, '密码门（narrow）默认不加水印');
  await shot(gate, 'password-390');
  const tryCode = async (code) => {
    await boxes.first().click();
    for (let i = 0; i < 4; i++) await gate.keyboard.press('Backspace');
    await boxes.first().click();
    await gate.keyboard.type(code);
  };
  await tryCode('1111');
  await gate.getByRole('alert').filter({ hasText: '密码不对，还能试 4 次' }).waitFor();
  assert.equal(await gate.locator('.aui-gate-dots > i[data-state=failed]').count(), 1);
  await shot(gate, 'password-error-390');
  await tryCode('2222');
  await gate.getByText('还能试 3 次').waitFor();
  await tryCode('3333');
  await gate.getByText('还能试 2 次').waitFor();
  const captcha = gate.getByRole('button', { name: '（演示）拖动滑块完成验证' });
  await captcha.waitFor();
  await tryCode('7k2q');
  assert.ok(await gate.getByRole('button', { name: '查看' }).isDisabled(), '连错 3 次后要先过滑块');
  await captcha.click();
  await gate.getByRole('button', { name: '查看' }).click();
  // D21s
  const secret = gate.getByRole('region', { name: '企业微信管理后台' });
  await secret.waitFor();
  assert.match(await gate.locator('.aui-secret-voided').innerText(), /这个链接已作废/);
  assert.equal(await secret.getByRole('timer').count(), 1, '倒计时圆环');
  const pw = secret.locator('.aui-secret-value[data-secret] .aui-secret-text');
  assert.equal(await pw.innerText(), 'Ln#8vQ2-xT9k');
  assert.equal(await pw.locator('span, b, i').count(), 0, '密码字符不上色');
  await secret.getByRole('button', { name: '复制密码' }).click();
  assert.equal(await gate.evaluate(() => navigator.clipboard.readText()), 'Ln#8vQ2-xT9k');
  assert.match(await secret.locator('.aui-secret-copied').innerText(), /已复制\s*剪贴板尽量在 60 秒后清空/);
  await secret.getByRole('button', { name: '隐藏' }).click();
  assert.match(await pw.innerText(), /^•+$/);
  await secret.getByRole('button', { name: '显示' }).click();
  await gate.waitForTimeout(300);
  await noOverflow(gate, '密钥 390');
  await shot(gate, 'secret-390', true);
  await gate.getByRole('button', { name: '我已记好，立即销毁' }).click();
  await gate.getByText('已销毁').waitFor();
  assert.equal(await gate.getByText('Ln#8vQ2-xT9k').count(), 0, '销毁后页面上不再有密码');

  // 倒计时到点自动隐藏（假时钟快进 61 秒）
  const timed = await phone.newPage();
  watch(timed);
  await timed.clock.install();
  await timed.goto(`${url}#share-public=secret&dark`);
  await timed.getByRole('region', { name: '企业微信管理后台' }).waitFor();
  await timed.waitForTimeout(200);
  await shot(timed, 'secret-dark-390', true);
  await timed.clock.fastForward(30_000);
  await timed.getByText('还剩 30 秒').waitFor();
  await timed.getByRole('button', { name: '复制密码' }).click();
  assert.equal(await timed.evaluate(() => navigator.clipboard.readText()), 'Ln#8vQ2-xT9k');
  await timed.clock.fastForward(31_000);
  await timed.getByText('已自动隐藏').waitFor();
  assert.equal(await timed.getByText('Ln#8vQ2-xT9k').count(), 0, '到点后密码从页面清除');
  // 字段随隐藏卸载，剪贴板清空的计时不能跟着取消
  await timed.clock.fastForward(30_000);
  await timed.waitForFunction(async () => (await navigator.clipboard.readText()) === '', null, { polling: 100, timeout: 3000 }).catch(() => undefined);
  assert.equal(await timed.evaluate(() => navigator.clipboard.readText()), '', '自动隐藏后剪贴板照样按时清空');
  const destroy = await timed.getByRole('button', { name: '我已记好，立即销毁' }).boundingBox();
  assert.ok(destroy && destroy.height >= 44, `销毁按钮 ≥ 44px：${destroy?.height}`);
  await timed.goto(`${url}#share-public=password&dark`);
  await timed.getByRole('group', { name: '分享密码' }).waitFor();
  await timed.waitForTimeout(200);
  await shot(timed, 'password-dark-390', true);
  await phone.close();

  assert.deepEqual(errors, [], errors.join('; '));
  console.log(`PASS share (${output}): ShareDialog (600 wide one column fits 1440×900 without scrolling, one solid primary 复制链接和密码 + outline 完成, summary sentence follows settings, QR popover + download, policy-locked password / 永久 with reasons, instant save → 保存中 / 已保存, failed 30 天 reverts with reason + 重试 inline, custom expiry capped, burn / max N stepper + meter, capability → fields expand list with 可改 switches, people = GrantList picked (locked owner, menu levels, summary, per-person avatar tones), ⋯ pause / preview / reminders, paused bar, access log SideSheet, void confirm, dark QR card ring, 390 full-height sheet + 44px copy + full-width segmented), GrantList instant (hover-only remove, row spinner, failure reverts + row reason + 重试, saved line, add / remove), ShareManager (KPI strip, expanded full-width log, filter chips, block IP, ⋯ extend / pause / reshare / log / void, attention expiry, search), CellHistoryPopover, visitor page (default watermark text / faint / pointer-events none, watermark={false} off, inline edit, failed save stays, 390 touch), PasswordGate (no watermark, error, dots, captcha after 3, unlock), SecretReveal (copy + clipboard note, hide, destroy, fake-clock auto-hide), 1440 light / dark, 390 no overflow`);
} finally {
  await browser.close();
  await server.close();
}
