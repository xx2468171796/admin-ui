// bt/access-modules 浏览器验收：starter「权限按模块」（演示 A1–A6）。
// ModulePermissionEditor（档位下拉的说明 / 授不出的档、自定义、改动点 + 改动条、细调：加 / 去掉 / 待确认 / 锁住 / 字段三态 / 恢复默认、
// 「成员·只看自己的」固定本人、用不了的模块、系统管理、集团只读 + 复制后修改）、PermissionDiff（改动、影响、数据变了、原因必填）、
// EffectiveAccessView（选人、来源、明细）；1440 浅 / 深色、390 手机（卡片 + 全屏细调）不溢出；截图和演示 PNG 对照。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/access-modules');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  const shot = async (name, full = true) => {
    // 操作通知会挡住截图：先关掉
    while (await page.getByRole('button', { name: '关闭通知' }).count()) await page.getByRole('button', { name: '关闭通知' }).first().click();
    await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: full, animations: 'disabled' });
  };
  const noOverflow = async (label, locator) => {
    const over = locator ? await locator.evaluate((el) => el.scrollWidth - el.clientWidth) : await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 1, `${label} 横向溢出 ${over}px`);
  };
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '权限按模块', exact: true }).click();
  const area = page.locator('#aui-page-accessmodules');
  const ed = area.locator('.aui-am');
  await ed.waitFor();
  const row = (name) => ed.locator('.aui-am-row').filter({ has: page.locator('.aui-am-mod-text b', { hasText: new RegExp(`^${name}`) }) });

  // ---- A1：模块行、改动点、改动条、自定义、用不了、系统管理
  assert.equal(await ed.locator('.aui-am-row[data-changed]').count(), 2, '多维表格、组织管理改过');
  assert.match(await ed.locator('.aui-am-bar').innerText(), /改了 2 个模块/);
  assert.match(await ed.locator('.aui-am-bar').innerText(), /多维表格：成员·只看自己的 → 成员·按范围看、本人 → 部门及下级、加导出、去掉导入记录/);
  assert.equal((await ed.getByRole('combobox', { name: '示例便签 档位' }).innerText()).trim(), '自定义');
  assert.match(await row('示例便签').innerText(), /比「成员·只看自己的」多 1 项/);
  assert.match(await row('CRM').innerText(), /本公司未开通\s*这一行不能设置/);
  assert.match(await row('知识库').innerText(), /按空间成员决定/);
  assert.match(await ed.locator('.aui-am-sec').innerText(), /系统管理/);
  await shot('a1-editor');
  // 档位下拉：说明、授不出的档灰掉写原因、缺的档底部说明
  await ed.getByRole('combobox', { name: '知识库 档位' }).click();
  const admin = page.getByRole('option', { name: /管理员/ });
  assert.equal(await admin.getAttribute('aria-disabled'), 'true');
  assert.match(await admin.innerText(), /你自己没有「知识库 · 管理员」/);
  assert.match(await page.locator('.aui-am-level-note').innerText(), /知识库没有「成员·只看自己的」这一档/);
  await shot('a1-editor-dropdown', false);
  await page.getByRole('option', { name: /成员·按范围看/ }).click();
  assert.equal(await ed.locator('.aui-am-row[data-changed]').count(), 3);
  // 成员·只看自己的：范围固定本人，不给选
  await ed.getByRole('combobox', { name: '示例便签 档位' }).click();
  await page.getByRole('option', { name: /成员·只看自己的/ }).click();
  assert.equal(await row('示例便签').getByRole('combobox', { name: /能看到的数据/ }).count(), 0, '只看自己的不给选范围');
  assert.match(await row('示例便签').locator('.aui-am-static').last().innerText(), /本人/);
  await ed.getByRole('button', { name: '撤销' }).click();
  assert.equal(await ed.locator('.aui-am-bar').count(), 0, '撤销后改动条消失');

  // 重新做出演示的改动（回到 starter 初始草稿：刷新）
  await page.reload();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '权限按模块', exact: true }).click();
  await ed.waitFor();

  // ---- A2：细调
  await row('多维表格').getByRole('button', { name: /细调/ }).click();
  const ft = ed.locator('.aui-am-ft');
  await ft.waitFor();
  assert.match(await ft.locator('.aui-am-ft-bar').innerText(), /自带 8 项 · 你加了 1 项 · 去掉 1 项/);
  assert.match(await ft.locator('.aui-inline-alert').innerText(), /新增了高危权限「批量删除」/);
  assert.equal(await ft.locator('.aui-am-ac[data-origin="added"]').count(), 1);
  assert.equal(await ft.locator('.aui-am-ac[data-origin="muted"]').count(), 1);
  assert.match(await ft.locator('.aui-am-ac[data-origin="muted"]').innerText(), /已手动去掉/);
  assert.equal(await ft.getByRole('checkbox', { name: '表结构 · 删表' }).isDisabled(), true, '管理员档才有');
  assert.match(await ft.locator('section[aria-label="表结构"]').innerText(), /「管理员」档才有/);
  assert.match(await ft.locator('section[aria-label="导入"]').innerText(), /不分范围/);
  await shot('a2-finetune');
  // 字段三态
  const floor = ft.getByRole('group', { name: '底价：字段权限' });
  assert.equal(await floor.getByRole('button', { name: '隐藏' }).getAttribute('aria-pressed'), 'true');
  await floor.getByRole('button', { name: '只读' }).click();
  assert.equal(await ft.locator('.aui-am-fr[data-changed]').count(), 2);
  // 勾 / 取消：档位里的去掉 = 静音；再勾回来
  await ft.getByRole('checkbox', { name: '记录 · 加' }).click();
  assert.equal(await ft.locator('.aui-am-ac[data-origin="muted"]').count(), 2);
  await ft.getByRole('checkbox', { name: '记录 · 加' }).click();
  // 待确认：给这个角色
  await ft.getByRole('button', { name: '给这个角色' }).click();
  assert.equal(await ft.locator('.aui-am-ac[data-origin="pending"]').count(), 0);
  assert.equal(await ft.getByRole('checkbox', { name: '记录 · 批量删除' }).getAttribute('data-state'), 'checked');
  // 恢复成档位默认
  await ft.getByRole('button', { name: '恢复成档位默认' }).click();
  assert.match(await ft.locator('.aui-am-ft-bar').innerText(), /你加了 0 项 · 去掉 0 项/);
  // 范围换「全部」
  await ft.getByRole('combobox', { name: '多维表格 · 记录 的数据范围' }).click();
  await page.getByRole('option', { name: '全部' }).click();
  assert.equal((await row('多维表格').getByRole('combobox', { name: '多维表格 能看到的数据' }).innerText()).trim(), '全部');
  await row('多维表格').getByRole('button', { name: /细调/ }).click();
  await ft.waitFor({ state: 'detached' });

  // ---- A4：保存前
  await page.reload();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '权限按模块', exact: true }).click();
  await ed.waitFor();
  await ed.getByRole('button', { name: '保存…' }).click();
  const dlg = page.getByRole('dialog', { name: '保存「销售主管」的改动' });
  await dlg.waitFor();
  assert.match(await dlg.innerText(), /数据变了/);
  assert.match(await dlg.innerText(), /改了 2 个模块 · 影响 3 人/);
  assert.equal(await dlg.locator('.aui-am-pd-mod').count(), 2);
  assert.match(await dlg.locator('.aui-am-pd-mod').first().innerText(), /高危 · 需二次验证/);
  assert.match(await dlg.locator('.aui-am-imp').innerText(), /影响 3 人[\s\S]*2 人多了权限、1 人少了、1 人不变/);
  await dlg.getByRole('button', { name: '确认保存' }).click();
  assert.match(await dlg.innerText(), /请填写修改原因/, '原因必填');
  await dlg.getByRole('textbox', { name: /修改原因/ }).fill('主管要能看、能导出整个部门的客户表，月底对账用');
  await shot('a4-diff', false);
  await dlg.getByRole('button', { name: '确认保存' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.equal(await ed.locator('.aui-am-bar').count(), 0, '保存后没有改动条');

  // ---- A3：集团只读
  await area.getByRole('button', { name: /销售代表/ }).click();
  assert.match(await ed.locator('.aui-am-ro').innerText(), /来自集团 · 只读/);
  assert.equal(await ed.getByRole('combobox').count(), 0, '只读没有下拉');
  assert.equal(await ed.getByRole('button', { name: /^查看/ }).count() > 0, true, '细调变查看');
  await shot('a3-group-readonly');
  await ed.getByRole('button', { name: '复制后修改' }).click();
  await row('多维表格').getByRole('button', { name: /^查看/ }).click();
  assert.equal(await ed.locator('.aui-am-ft').getByRole('checkbox').first().isDisabled(), true, '只读细调不能勾');

  // ---- A5：预览 / 诊断
  await area.getByRole('button', { name: /销售主管/ }).click();
  await area.getByRole('tab', { name: '预览 / 诊断' }).click();
  const ev = area.locator('.aui-am-ev');
  await ev.waitFor();
  assert.match(await ev.innerText(), /个人减：删记录/);
  await ev.getByRole('button', { name: /^明细/ }).click();
  await ev.locator('.aui-am-er-rows').waitFor();
  await shot('a5-effective');
  await ev.getByRole('button', { name: /陈会计/ }).click();
  assert.match(await ev.locator('.aui-am-ev-who').innerText(), /陈会计/);
  await noOverflow('1440');

  // ---- 深色
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await area.getByRole('tab', { name: '模块权限' }).click();
  await ed.waitFor();
  await shot('a1-editor-dark');
  await row('多维表格').getByRole('button', { name: /细调/ }).click();
  await shot('a2-finetune-dark');
  await row('多维表格').getByRole('button', { name: /细调/ }).click();
  await area.getByRole('tab', { name: '预览 / 诊断' }).click();
  await shot('a5-effective-dark');
  await page.getByRole('button', { name: '切换到浅色模式' }).click();

  // ---- 手机 390：卡片、全屏细调（先关掉操作通知，免得挡住截图）
  await page.setViewportSize({ width: 390, height: 844 });
  await area.getByRole('tab', { name: '模块权限' }).click();
  await ed.waitFor();
  assert.equal(await ed.getAttribute('data-layout'), 'cards');
  await noOverflow('模块权限 390');
  await shot('a1-editor-390');
  await row('多维表格').getByRole('button', { name: /细调/ }).click();
  const sheet = page.getByRole('dialog', { name: '多维表格 · 细调' });
  await sheet.waitFor();
  const sbox = await sheet.boundingBox();
  assert.ok(sbox && sbox.width >= 389, `全屏面板占满宽：${sbox?.width}`);
  await noOverflow('细调面板 390', sheet.locator('.aui-dialog-body'));
  const rowH = await sheet.locator('.aui-am-ac').first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(rowH >= 47, `手机上每个操作一行 ≥ 48px：${rowH}`);
  await shot('a6-mobile-sheet-390', false);
  await sheet.getByRole('checkbox', { name: '记录 · 删' }).click();
  assert.match(await sheet.innerText(), /改了 \d+ 项/);
  await sheet.getByRole('button', { name: '完成' }).click();
  await sheet.waitFor({ state: 'detached' });
  await ed.getByRole('button', { name: '保存…' }).click();
  await page.getByRole('dialog', { name: '保存「销售主管」的改动' }).waitFor();
  await noOverflow('保存弹框 390', page.locator('.aui-dialog-body'));
  await shot('a4-diff-390', false);
  await page.keyboard.press('Escape');
  await area.getByRole('tab', { name: '预览 / 诊断' }).click();
  await noOverflow('预览 390');
  await shot('a5-effective-390');

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS access-modules (${output}): editor rows / dirty dots / change bar / custom / unavailable / system section / level dropdown hints + ceiling + missing-level note / member_own fixed scope / undo; fine-tune add / mute / pending give / locked / fields three-state / reset / scope; PermissionDiff changes + impact + stale + required reason; group read-only + copy; EffectiveAccessView sources + detail + pick; dark; 390 cards + full-screen sheet (48px rows) no overflow`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
