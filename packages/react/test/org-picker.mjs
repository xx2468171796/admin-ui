// 组织选人浏览器验收（样稿 A–I）：starter「系统 → 组织选人」。
// 弹框 1000 × 640 三栏、打开定位到我的部门但不勾、勾人 → 上级半选（aria-checked="mixed"）、整个部门含下级盖住下面的人、
// 键盘走树（↑↓←→ 空格 回车）、搜索分组带路径 + 高亮 + 「「X」已离职」、范围（别的公司隐藏、本公司管不着的灰掉带锁写原因）、
// 500 人虚拟滚动、单选转交（已授权的灰掉）、只选人最多 5 个、已离职的留在名单里直到手动去掉、行内输入（立刻 / 攒着添加）、
// GrantList / ShareDialog 接 orgSource、无障碍属性；1440 浅 / 深色、390 手机（下钻 + 底部已选条 + 已选面板）不溢出。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/org-picker');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
const errors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, fullPage = false) => page.screenshot({ path: resolve(output, `${name}.png`), fullPage, animations: 'disabled' });
  const noOverflow = (what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));
  const until = async (fn, label) => {
    for (let i = 0; i < 80; i++) { if (await fn()) return; await page.waitForTimeout(40); }
    assert.fail(label);
  };
  await page.goto(url);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '组织选人', exact: true }).click();
  await page.getByRole('button', { name: '分享给同事' }).waitFor();
  for (const close of await page.getByRole('button', { name: '关闭通知' }).all()) await close.click().catch(() => undefined);
  await noOverflow('1440 页面');
  await shot('page-1440', true);

  // ================================================================ A / B：三栏弹框，定位到「一组」但不勾
  await page.getByRole('button', { name: '分享给同事' }).click();
  const dialog = page.getByRole('dialog', { name: '分享给同事' });
  await dialog.waitFor();
  const tree = dialog.getByRole('tree', { name: '组织架构' });
  const node = (name) => tree.getByRole('treeitem', { name: new RegExp(`^${name}，`) });
  await node('一组').waitFor();
  await until(async () => (await node('一组').getAttribute('aria-selected')) === 'true', '打开时点中「一组」（defaultFocus）');
  await page.waitForTimeout(300);
  const box = await dialog.boundingBox();
  assert.ok(Math.abs(box.width - 1000) <= 1 && Math.abs(box.height - 640) <= 1, `弹框 1000 × 640：${box.width} × ${box.height}`);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '搜人、部门、角色、业务线，支持拼音首字母', '打开时焦点在搜索框');
  assert.equal(await node('一组').getAttribute('aria-checked'), 'false', '只定位不勾');
  assert.equal(await node('销售部').getAttribute('aria-expanded'), 'true', '展开到我的部门');
  assert.equal(await node('一组').getAttribute('aria-level'), '4');
  assert.equal(await tree.getAttribute('aria-multiselectable'), 'true');
  assert.equal(await tree.getByRole('treeitem', { name: /^深圳子公司/ }).count(), 0, '小王：别的公司隐藏');
  assert.match(await dialog.locator('.aui-orgp-tree-hidden').innerText(), /2 个不在你的管理范围，已隐藏/);
  const members = dialog.getByRole('listbox', { name: '一组 成员' });
  await members.waitFor();
  assert.equal(await members.getAttribute('aria-multiselectable'), 'true');
  assert.equal(await members.getByRole('option').count(), 5, '一组 5 个在职的人');
  assert.match(await dialog.locator('.aui-orgp-departed').innerText(), /另有 1 位已离职的不显示/);
  // 名单里原来就有已离职的李俊杰：右栏划掉 + 原因，确定时不悄悄去掉
  const side = dialog.getByRole('complementary', { name: '已选' });
  assert.match(await side.innerText(), /李俊杰[\s\S]*已离职 · 还在名单里，点 × 去掉/);
  assert.equal(await side.locator('[data-struck]').count(), 1);
  await shot('dialog-1440');

  // 勾小李 → 一组 / 销售部 / 华南子公司 半选
  await members.getByRole('option', { name: /^小李/ }).click();
  assert.equal(await members.getByRole('option', { name: /^小李/ }).getAttribute('aria-selected'), 'true');
  for (const name of ['一组', '销售部', '华南子公司']) assert.equal(await node(name).getAttribute('aria-checked'), 'mixed', `${name} 半选`);
  await dialog.getByRole('button', { name: '确定 (2)' }).waitFor();
  // 整个「一组」（含下级）→ 小李被盖住、人都写「已含在「一组」里」
  await dialog.getByRole('checkbox', { name: /整个「一组」/ }).click();
  assert.equal(await node('一组').getAttribute('aria-checked'), 'true');
  assert.match(await side.innerText(), /部门 · 1[\s\S]*一组[\s\S]*华南子公司 › 销售部 · 5 人/);
  assert.doesNotMatch(await side.innerText(), /小李/, '整组选上后小李不再单列');
  const chen = members.getByRole('option', { name: /^陈组长/ });
  assert.equal(await chen.getAttribute('aria-disabled'), 'true');
  assert.match(await chen.innerText(), /已含在「一组」里/);
  assert.match(await dialog.locator('.aui-orgp-reach').innerText(), /共覆盖 5 人（去重）/);
  // 右栏「含下级」开关
  await side.getByRole('switch', { name: '一组 含下级' }).waitFor();

  // ================================================================ 键盘走树
  await node('一组').focus();
  await page.keyboard.press('ArrowUp');
  await until(async () => (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).startsWith('新零售组') || (await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).startsWith('销售部'), '↑ 移到上一行');
  await node('销售部').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await node('销售部').getAttribute('aria-expanded'), 'false', '← 收起');
  await page.keyboard.press('ArrowRight');
  assert.equal(await node('销售部').getAttribute('aria-expanded'), 'true', '→ 展开');
  await page.keyboard.press('ArrowRight');
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), /^一组/, '展开的 → 进第一个子');
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? ''), /^销售部/, '← 回父');
  await page.keyboard.press(' ');
  assert.equal(await node('销售部').getAttribute('aria-checked'), 'true', '空格勾选');
  assert.doesNotMatch(await side.innerText(), /一组\s/, '勾上级后被盖住的「一组」从已选里去掉');
  await page.keyboard.press('Enter');
  await dialog.getByRole('listbox', { name: '销售部 成员' }).waitFor();
  assert.ok(await dialog.getByRole('button', { name: '回到我的位置' }).isVisible(), '不在我的位置时给「回到我的位置」');
  await dialog.getByRole('button', { name: '回到我的位置' }).click();
  await until(async () => (await node('一组').getAttribute('aria-selected')) === 'true', '回到一组');
  // 成员列表键盘：↓ 移、空格勾（被盖住的勾不了）
  await node('二组').click();
  const g2 = dialog.getByRole('listbox', { name: '二组 成员' });
  await g2.waitFor();
  assert.equal(await g2.getByRole('option').first().getAttribute('aria-disabled'), 'true', '销售部含下级 → 二组的人被盖住');
  await node('销售部').focus();
  await page.keyboard.press(' ');
  assert.equal(await node('销售部').getAttribute('aria-checked'), 'false', '再按空格取消');
  await g2.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  assert.equal(await g2.getByRole('option').nth(1).getAttribute('aria-selected'), 'true', '成员列表 ↓ + 空格勾选');
  assert.ok((await g2.getAttribute('aria-activedescendant'))?.endsWith('-1'), 'aria-activedescendant 跟着走');

  // ================================================================ D 搜索
  const search = dialog.getByRole('searchbox', { name: '搜人、部门、角色、业务线，支持拼音首字母' });
  await search.fill('销售');
  await dialog.getByText(/^共 \d+ 个结果$/).waitFor();
  const results = dialog.getByRole('listbox', { name: /共 \d+ 个结果/ });
  assert.ok(await results.getByRole('group', { name: '人' }).isVisible());
  assert.ok(await results.getByRole('group', { name: '部门 / 公司' }).isVisible());
  assert.ok((await results.locator('mark.aui-hl').count()) > 3, '命中的字标出来');
  assert.match(await results.getByRole('option', { name: /^林经理/ }).innerText(), /华南子公司 › 销售部/, '每条写路径');
  await shot('search-1440');
  await search.fill('ljj');
  const gone = results.getByRole('option', { name: '「李俊杰」已离职' });
  await gone.waitFor();
  assert.equal(await gone.getAttribute('aria-disabled'), 'true', '搜到已离职的人：点名且不能选');
  await search.fill('深圳子公司');
  await dialog.getByText('没有找到「深圳子公司」').waitFor();
  await search.fill('一组');
  await results.getByRole('option', { name: /^一组/ }).getByRole('button', { name: /下级/ }).click();
  await until(async () => (await node('一组').getAttribute('aria-selected')) === 'true', '「下级 ›」在树里定位');
  // 角色分页
  await dialog.getByRole('tab', { name: '角色' }).click();
  await dialog.getByRole('listbox', { name: '角色' }).getByRole('option', { name: /^财务/ }).click();
  assert.match(await side.innerText(), /角色 · 1[\s\S]*财务/);
  assert.match(await dialog.locator('.aui-orgp-reach').innerText(), /约覆盖/, '有角色时人数是估算');
  await dialog.getByRole('tab', { name: '组织架构' }).click();
  // 500 人：虚拟滚动 + 提示勾整个部门 + 不给「全选这些人」
  await node('客服中心').click();
  const cs = dialog.getByRole('listbox', { name: '客服中心 成员' });
  await cs.waitFor();
  assert.match(await dialog.locator('.aui-orgp-notice[data-tone=info]').innerText(), /500 人，只画看得见的几十行/);
  assert.ok((await cs.getByRole('option').count()) < 40, `只画看得见的行：${await cs.getByRole('option').count()}`);
  assert.equal(await dialog.getByRole('button', { name: '全选这些人' }).count(), 0, '超过 60 人不给全选');
  // 一页 60 人：一直往下滚，分页接着加载，最后一行画出来
  await until(async () => {
    await dialog.locator('.aui-orgp-members-list').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    return (await cs.getByRole('option').last().getAttribute('id'))?.endsWith('-499');
  }, '滚到底画最后一行（分页接着加载）');
  assert.ok((await cs.getByRole('option').count()) < 40, '滚到底也只画看得见的行');
  await shot('big-1440');
  // 确定：已离职的李俊杰仍在
  const confirm = dialog.getByRole('button', { name: /^确定 \(\d+\)$/ });
  await confirm.click();
  await dialog.waitFor({ state: 'detached' });
  const summary = page.locator('.aui-desc').first();
  assert.match(await summary.innerText(), /分享给\s*李俊杰、/, '确定时已离职的不悄悄去掉');
  assert.match(await summary.innerText(), /"kind":"person"/);

  // ================================================================ defaultFocus 晚到：打开时还不知道「我的部门」，到了要重新定位（不停在骨架上）
  await page.getByRole('button', { name: '分享（「我的部门」晚到）' }).click();
  const late = page.getByRole('dialog', { name: '分享给同事（定位晚到）' });
  await late.waitFor();
  const lateTree = late.getByRole('tree', { name: '组织架构' });
  const lateNode = (name) => lateTree.getByRole('treeitem', { name: new RegExp(`^${name}，`) });
  await lateNode('一组').waitFor({ timeout: 5000 });
  await until(async () => (await lateNode('一组').getAttribute('aria-selected')) === 'true', 'defaultFocus 晚到后点中「一组」');
  await late.getByRole('listbox', { name: '一组 成员' }).waitFor();
  await page.keyboard.press('Escape');
  await late.waitFor({ state: 'detached' });

  // ================================================================ C 范围：陈组长只管一组；王总看到三家公司
  await page.getByRole('group', { name: '打开的人' }).getByRole('button', { name: '陈组长 · 只管一组' }).click();
  await page.getByRole('button', { name: '分享给同事' }).click();
  await dialog.waitFor();
  await until(async () => (await node('一组').getAttribute('aria-selected')) === 'true', '陈组长停在一组');
  assert.equal(await node('运营部').getAttribute('aria-disabled'), 'true', '管不着的部门灰掉');
  assert.match(await node('运营部').getAttribute('aria-label'), /不在你的管理范围，找赵静怡开通/, '锁写找谁开');
  assert.equal(await node('销售部').locator('.aui-orgp-check[data-disabled]').count(), 1, '只管一部分：销售部能展开不能整选');
  await node('运营部').click({ force: true });
  await dialog.getByRole('listbox', { name: '运营部 成员' }).waitFor();
  const notice = await dialog.locator('.aui-orgp-notice').first().innerText();
  assert.match(notice, /不在你的管理范围，找赵静怡开通/);
  assert.doesNotMatch(notice, /跨公司分享要集团管理员/, '原因里已经写了找谁，不再接 lockedHint');
  assert.equal(await dialog.getByRole('listbox', { name: '运营部 成员' }).locator('[data-locked]').count(), 3, '里面的人带锁');
  await shot('scope-chen-1440');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('group', { name: '打开的人' }).getByRole('button', { name: '王总 · 集团管理员' }).click();
  await page.getByRole('button', { name: '分享给同事' }).click();
  await dialog.waitFor();
  await until(async () => (await node('Acme 集团').getAttribute('aria-selected')) === 'true', '王总停在集团');
  for (const name of ['集团总部', '华南子公司', '深圳子公司']) await node(name).waitFor();
  await node('深圳子公司').locator('.aui-orgp-check').click();
  assert.equal(await node('深圳子公司').getAttribute('aria-checked'), 'true', '集团管理员能跨公司勾');
  await shot('group-boss-1440');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('group', { name: '打开的人' }).getByRole('button', { name: '小王 · 销售' }).click();

  // ================================================================ F 单选转交、只选人最多 5 个
  await page.getByRole('button', { name: '转交负责人（单选）' }).click();
  const transfer = page.getByRole('dialog', { name: '转交客户 · 孙佳宁' });
  await transfer.waitFor();
  const tlist = transfer.getByRole('listbox', { name: '一组 成员' });
  await tlist.waitFor();
  assert.equal(await transfer.getByRole('complementary', { name: '已选' }).count(), 0, '单选没有右栏');
  assert.ok(Math.abs((await transfer.boundingBox()).width - 760) <= 1, '单选弹框窄一档（760）');
  assert.equal(await tlist.getAttribute('aria-multiselectable'), null);
  const wang = tlist.getByRole('option', { name: /^小王/ });
  assert.equal(await wang.getAttribute('aria-disabled'), 'true');
  assert.match(await wang.innerText(), /已授权 · 现在的负责人/);
  assert.equal(await transfer.getByRole('tree').getByRole('treeitem').first().getAttribute('aria-checked'), null, '只选人：树上没有勾选');
  await tlist.getByRole('option', { name: /^小李/ }).click();
  assert.match(await transfer.locator('.aui-orgp-foot-note').innerText(), /已选：小李（华南子公司 › 销售部 › 一组）/);
  await shot('single-1440');
  await transfer.getByRole('button', { name: '确定', exact: true }).click();
  await transfer.waitFor({ state: 'detached' });
  assert.match(await summary.innerText(), /新负责人\s*小李/);
  await page.getByRole('button', { name: '培训指派（只选人 · 最多 5 个）' }).click();
  const train = page.getByRole('dialog', { name: '培训指派 · 新人服务规范' });
  await train.waitFor();
  await train.getByRole('listbox', { name: '一组 成员' }).waitFor();
  await train.getByRole('button', { name: '全选这些人' }).click();
  assert.match(await train.locator('.aui-orgp-max').innerText(), /最多选 5 个，已满/);
  await train.getByRole('treeitem', { name: /^二组，/ }).click();
  const g2b = train.getByRole('listbox', { name: '二组 成员' });
  await g2b.waitFor();
  assert.equal(await g2b.getByRole('option').first().getAttribute('aria-disabled'), 'true', '满了没勾的变灰');
  await shot('max-1440');
  await train.getByRole('button', { name: '确定 (5)' }).click();
  await train.waitFor({ state: 'detached' });

  // ================================================================ E 行内输入
  const field = page.getByRole('combobox', { name: '添加人、部门或角色' }).first();
  await field.click();
  const pop = page.locator('.aui-orgp-pop');
  await pop.waitFor();
  assert.match(await pop.innerText(), /建议 · 你所在的部门和最近选过的/);
  await field.fill('xl');
  await pop.getByRole('option', { name: /小李/ }).waitFor();
  await shot('field-1440');
  await page.keyboard.press('Enter');
  await page.locator('.aui-orgp-chip', { hasText: '小李' }).first().waitFor();
  assert.match(await page.getByText('立刻进名单').locator('..').innerText(), /小李/);
  const batchBox = page.getByRole('combobox', { name: '攒几个再一起添加' });
  await batchBox.fill('阿明');
  await page.locator('.aui-orgp-pop').getByRole('option', { name: /阿明/ }).waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '添加 1 个' }).click();
  await until(async () => /攒好添加的\s*阿明/.test(await page.getByText('攒好添加的').locator('..').innerText()), '「添加 N 个」交给宿主');

  // ================================================================ GrantList / ShareDialog 接 orgSource
  const grants = page.getByRole('group', { name: '字段权限 · 认领时间' });
  await grants.scrollIntoViewIfNeeded();
  const gfield = grants.getByRole('combobox', { name: '添加人、部门或角色' });
  await gfield.waitFor();
  assert.match(await grants.innerText(), /李俊杰\s*已离职/, '已离职但还在授权里：标出来');
  await gfield.fill('二组');
  await page.locator('.aui-orgp-pop').getByRole('option', { name: /黄淑芬/ }).waitFor();
  assert.equal(await page.locator('.aui-orgp-pop').getByRole('option', { name: /^二组/ }).count(), 0, '已经在名单里的不再出现');
  await gfield.fill('张家豪');
  await page.locator('.aui-orgp-pop').getByRole('option', { name: /张家豪/ }).waitFor();
  await page.keyboard.press('Enter');
  await grants.getByText('张家豪').waitFor();
  assert.match(await grants.innerText(), /张家豪\s*人 · 华南子公司 › 销售部 › 一组/);
  await grants.getByRole('button', { name: '组织架构' }).click();
  const grantDialog = page.getByRole('dialog', { name: '字段权限 · 认领时间 · 再授权给' });
  await grantDialog.waitFor();
  await grantDialog.getByRole('listbox', { name: '一组 成员' }).waitFor();
  assert.match(await grantDialog.getByRole('option', { name: /^张家豪/ }).innerText(), /已授权 · 可读/, '大弹框里灰着写「已授权 · 档位」');
  await grantDialog.getByRole('option', { name: /^阿杰/ }).click();
  await grantDialog.getByRole('button', { name: '确定 (1)' }).click();
  await grants.getByText('阿杰').waitFor();
  await shot('grantlist-1440');
  await page.getByRole('button', { name: '分享客户记录' }).click();
  const share = page.getByRole('dialog', { name: /分享/ });
  await share.waitFor();
  await share.getByRole('combobox', { name: '添加人、部门或角色' }).waitFor();
  await share.getByRole('combobox', { name: '添加人、部门或角色' }).fill('林经理');
  await page.locator('.aui-orgp-pop').getByRole('option', { name: /林经理/ }).waitFor();
  await page.keyboard.press('Enter');
  await share.getByText('林经理').first().waitFor();
  await shot('share-1440');
  await page.keyboard.press('Escape');
  await share.waitFor({ state: 'detached' });

  // ================================================================ 深色
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '分享给同事' }).click();
  await dialog.waitFor();
  await until(async () => (await node('一组').getAttribute('aria-selected')) === 'true', '深色：停在一组');
  await dialog.getByRole('listbox', { name: '一组 成员' }).getByRole('option', { name: /^陈组长/ }).click();
  await page.waitForTimeout(200);
  await shot('dialog-dark');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await shot('page-dark', true);
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click().catch(() => undefined);

  // ================================================================ G 手机 390
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await noOverflow('390 页面');
  await shot('page-390', true);
  await page.getByRole('button', { name: '分享给同事' }).click();
  await dialog.waitFor();
  await page.waitForTimeout(400);
  const mbox = await dialog.boundingBox();
  assert.ok(mbox.width >= 389 && mbox.height >= 843, `手机整屏：${mbox.width} × ${mbox.height}`);
  const crumbs = dialog.getByRole('navigation', { name: '组织架构' });
  await crumbs.waitFor();
  assert.match(await crumbs.innerText(), /Acme 集团[\s\S]*华南子公司[\s\S]*销售部[\s\S]*一组/, '面包屑');
  const mlist = dialog.getByRole('listbox', { name: '一组 成员' });
  await mlist.waitFor();
  const rowH = await mlist.getByRole('option').first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(rowH >= 56, `手机行高 ≥ 56：${rowH}`);
  await mlist.getByRole('option', { name: /^小李/ }).click();
  await noOverflow('390 弹框');
  await shot('dialog-390');
  await crumbs.getByRole('button', { name: '销售部' }).click();
  await dialog.getByRole('button', { name: '展开 二组' }).waitFor();
  await dialog.getByRole('button', { name: '展开 二组' }).click();
  await dialog.getByRole('listbox', { name: '二组 成员' }).waitFor();
  await dialog.getByRole('listbox', { name: '二组 成员' }).getByRole('option').first().click();
  const bar = dialog.locator('.aui-orgp-bar-open');
  assert.match(await bar.innerText(), /已选 \d+ 人/);
  await bar.click();
  const sheet = dialog.getByRole('dialog', { name: '已选' });
  await sheet.waitFor();
  assert.match(await sheet.innerText(), /李俊杰[\s\S]*小李/);
  await shot('sheet-390');
  await sheet.getByRole('button', { name: '收起' }).click();
  await sheet.waitFor({ state: 'detached' });
  const touch = await dialog.getByRole('button', { name: /^确定/ }).boundingBox();
  assert.ok(touch.height >= 44, `确定按钮触屏尺寸 ${touch.height}`);
  await dialog.getByRole('searchbox').fill('销售');
  await dialog.getByText(/^共 \d+ 个结果$/).waitFor();
  await noOverflow('390 搜索');
  await shot('search-390');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '转交负责人（单选）' }).click();
  await transfer.waitFor();
  await transfer.getByRole('listbox', { name: '一组 成员' }).getByRole('option', { name: /^小李/ }).click();
  assert.match(await transfer.locator('.aui-orgp-bar').innerText(), /小李/);
  assert.ok((await transfer.boundingBox()).width >= 389, '手机上单选也整屏');
  const wangName = await transfer.getByRole('option', { name: /^小王/ }).locator('.aui-orgp-row-text').evaluate((el) => el.getBoundingClientRect().width);
  assert.ok(wangName >= 72, `有「已授权」小标时名字也放得下：${wangName}`);
  await shot('single-390');

  assert.deepEqual(errors, [], '页面没有报错');
  console.log('org-picker 浏览器验收通过，截图在 test/artifacts/org-picker/');
} finally {
  await browser.close();
  await server.close();
}
