// 浏览器验收：starter「输入与表单」页的「上传、密码与密钥」分区（#inputs-upload）。
// 上传：一种拖放区（1.5px 虚线、圆角 12、36px 中性图标块；拖进来 = 主色实线 +「松手开始上传 3 个文件」；出错 / 禁用）、
// 表单里单个文件的一行版（选择文件 → 进度 → 缩略图 + 换一张 / 删除；类型不对当场拦）、上传队列（类型方块、4px 细条
//「N% · 还要 N 秒」、失败原因 + 重试、「全部重试」）、图片方块（96px、封面、圆环百分比、失败红边 + 重试、还能加 N 张）、
// 附件面板空的时候只有一个拖放区；密码：眼睛 aria-pressed、大写锁定、等宽、出错红边、强度 4 段 + 要求打勾、再输一次实时比对、
// 初始密码自动生成 / 换一个 / 我来设；分格密码 44 × 52、出错只变红边 + 抖一下 + 剩余次数点。
// 截图 1440 浅 / 深色 + 390 到 test/artifacts/inputs-uploads/，和已审定的样稿截图并排看。
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/inputs-uploads');
mkdirSync(output, { recursive: true });
// 「source」条件：@adminui/react 直接用 src（和 starter 里相对路径引的新组件是同一份模块）；固定端口、不热更新（别的 AI 同时在改文件）
const server = await createServer({
  root: resolve(root, 'examples/starter'),
  configFile: false,
  plugins: [react()],
  resolve: { conditions: ['source', 'module', 'browser', 'development'] },
  server: { host: '127.0.0.1', port: Number(process.env.AUI_TEST_PORT || 6130), strictPort: false, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || chromium.executablePath() });
let page;
const step = (name) => console.log(`  · ${name}`);
// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const style = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
  const box = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '输入与表单', exact: true }).click();
  const area = page.locator('#inputs-upload');
  await area.getByText('拖放区', { exact: true }).first().waitFor();
  const dangerColor = await area.evaluate((el) => getComputedStyle(el).getPropertyValue('--aui-danger').trim());
  // A token colour as the browser computes it (rgb(...)), to compare with computed borders.
  const tokenColor = (value) => page.evaluate((c) => { const s = document.createElement('span'); s.style.color = c; document.querySelector('.adminui')?.append(s); const v = getComputedStyle(s).color; s.remove(); return v; }, value);
  const danger = await tokenColor(dangerColor);
  const shot = (name) => area.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' });

  // ---- 拖放区：一种样子
  step('drop zone: one look, drag over, error, disabled');
  const zone = area.locator('.aui-dropzone[role=button]').first();
  assert.equal(await style(zone, 'border-top-style'), 'dashed');
  // 1.5px 在 1 倍屏上被 Chromium 吸附成 1px（2 倍屏是 1.5px）；量声明值
  assert.equal(await zone.evaluate((el) => [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } }).some((r) => r.selectorText === '.adminui .aui-dropzone' && r.cssText.includes('1.5px dashed'))), true, '虚线 1.5px');
  assert.equal(await style(zone, 'border-top-left-radius'), '12px');
  assert.deepEqual(await box(zone.locator('.aui-dropzone-icon')), { width: 36, height: 36 }, '36px 中性图标块');
  assert.match(await zone.innerText(), /把文件拖到这里，或 点击选择/);
  await zone.evaluate((el) => {
    const dt = new DataTransfer();
    for (const n of ['a.jpg', 'b.jpg', 'c.pdf']) dt.items.add(new File(['x'], n));
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await zone.getByText('松手开始上传 3 个文件').waitFor();
  assert.equal(await style(zone, 'border-top-style'), 'solid', '拖进来变实线');
  await shot('drag-over-1440');
  await zone.evaluate((el) => el.dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null })));
  await zone.getByText('点击选择').waitFor();
  const states = area.locator('#upload-states');
  assert.match(await states.getByRole('alert').innerText(), /只能传 PNG、JPG/);
  assert.equal(await style(states.locator('.aui-dropzone[data-error]'), 'border-top-color'), danger, '格式不对：红边');
  assert.match(await states.locator('.aui-dropzone[data-disabled]').innerText(), /已收集结束/);

  // ---- 单个文件：一行版
  step('UploadField: row → progress → file row (换一张 / 删除)');
  const empty = area.locator('#cover-empty');
  assert.equal(await empty.locator('.aui-dropzone[data-variant=row]').count(), 1, '表单里单个文件是一行');
  assert.match(await empty.innerText(), /上传封面[\s\S]*PNG、JPG，5 MB 以内；建议 16:9[\s\S]*选择文件/);
  const rowBox = await box(empty.locator('.aui-dropzone'));
  assert.ok(rowBox.height <= 72, `一行版不占一大块（${rowBox.height}）`);
  const emptyInput = empty.locator('input[type=file]').first();
  await emptyInput.setInputFiles({ name: 'bad.gif', mimeType: 'image/gif', buffer: PNG });
  await empty.getByRole('alert').waitFor();
  assert.equal(await empty.locator('.aui-dropzone[data-error]').count(), 1, '类型不对当场拦下、红边');
  await emptyInput.setInputFiles({ name: '智能门锁-封面.png', mimeType: 'image/png', buffer: PNG });
  await empty.getByRole('progressbar').waitFor();
  assert.equal(await empty.getByRole('button', { name: '取消上传' }).count(), 1);
  await empty.getByRole('button', { name: '换一张' }).waitFor({ timeout: 5000 });
  assert.match(await empty.locator('.aui-upload-file').innerText(), /智能门锁-封面\.png/);
  assert.equal(await empty.locator('.aui-upload-tile img').count(), 1, '图片显示缩略图');
  const done = area.locator('#cover-done');
  assert.match(await done.innerText(), /智能门锁安装入门-封面\.png[\s\S]*1\.2 MB/);
  await done.getByRole('button', { name: /^删除/ }).click();
  await done.locator('.aui-dropzone[data-variant=row]').waitFor();

  // ---- 上传队列
  step('queue: tiles, thin bar + 还要, failure reason, 全部重试');
  const queueZone = area.locator('.aui-upload-queue .aui-dropzone');
  await queueZone.locator('input[type=file]').setInputFiles([
    { name: '门锁安装位置.jpg', mimeType: 'image/jpeg', buffer: PNG },
    { name: '现场录像-失败.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 1) },
    { name: '报价单-v2.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.alloc(512, 1) },
    { name: '大文件-整屋.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(8192, 1) },
  ]);
  const queue = area.getByRole('group', { name: '上传队列' });
  const failedRow = queue.locator('.aui-upq-item').filter({ hasText: '现场录像-失败.mp4' });
  await failedRow.getByText('网络中断，已传 30%，重试会接着传').waitFor({ timeout: 5000 });
  assert.match(await queue.locator('h5').innerText(), /上传队列 · 4 个 · 1 个失败/);
  assert.equal(await queue.getByRole('button', { name: '全部重试' }).count(), 1, '有失败就出「全部重试」');
  assert.equal(await failedRow.locator('.aui-upload-tile[data-failed]').count(), 1, '只有失败的方块用异常浅底');
  assert.equal((await queue.locator('.aui-upq-item').filter({ hasText: '报价单-v2.xlsx' }).locator('.aui-upload-tile').innerText()).trim(), 'XLS');
  const big = queue.locator('.aui-upq-item').filter({ hasText: '大文件-整屋.mp4' });
  await big.getByText(/\d+% · 还要 \d+ 秒/).waitFor({ timeout: 4000 });
  assert.equal(Math.round((await box(big.locator('.aui-upq-bar'))).height), 4, '4px 细条');
  await queue.locator('.aui-upq-item').filter({ hasText: '门锁安装位置.jpg' }).getByText('已上传').waitFor({ timeout: 5000 });
  await shot('queue-1440');
  await queue.getByRole('button', { name: '全部重试' }).click();
  await failedRow.getByText('已上传').waitFor({ timeout: 6000 });
  assert.equal(await queue.getByRole('button', { name: '全部重试' }).count(), 0);

  // ---- 图片方块
  step('image grid: cover, ring, failed + retry, room');
  const grid = area.getByRole('group', { name: '现场照片' });
  await grid.locator('.aui-imgs-tile img').first().waitFor();
  assert.deepEqual(await box(grid.locator('.aui-imgs-tile').first()), { width: 96, height: 96 });
  assert.equal(await grid.locator('.aui-imgs-badge').count(), 1);
  assert.equal(await grid.locator('.aui-imgs-tile').first().locator('.aui-imgs-badge').innerText(), '封面', '第一张是封面');
  assert.match(await grid.locator('.aui-imgs-add').innerText(), /添加照片[\s\S]*还能加 5 张/);
  assert.equal(await style(grid.locator('.aui-imgs-x').first(), 'display'), 'none', '× 悬停才出现');
  await grid.locator('.aui-imgs-tile').first().hover();
  assert.equal(await style(grid.locator('.aui-imgs-x').first(), 'display'), 'grid');
  await grid.locator('input[type=file]').setInputFiles([
    { name: '门口.png', mimeType: 'image/png', buffer: PNG },
    { name: '插座-失败.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await grid.locator('.aui-imgs-ring').first().waitFor();
  assert.match(await grid.locator('.aui-imgs-pct').first().innerText(), /^\d+%$/);
  const failedTile = grid.locator('.aui-imgs-tile[data-failed]');
  await failedTile.waitFor({ timeout: 5000 });
  assert.equal(await style(failedTile, 'border-top-color'), danger, '失败红边');
  await page.mouse.move(0, 0);
  await shot('images-1440');
  await failedTile.getByRole('button', { name: /^重试/ }).click();
  await failedTile.waitFor({ state: 'detached', timeout: 6000 });
  await page.waitForFunction(() => document.querySelectorAll('#inputs-upload .aui-imgs-veil').length === 0, null, { timeout: 8000 });
  assert.equal(await grid.locator('.aui-imgs-tile').count(), 4);
  assert.match(await grid.locator('.aui-imgs-add').innerText(), /还能加 3 张/);

  // ---- 附件面板空状态：只有一个拖放区
  step('gallery empty: one drop zone with the buttons inside');
  const gallery = area.getByRole('group', { name: '赵静怡的附件' });
  assert.equal(await gallery.locator('.aui-dropzone').count(), 1);
  assert.equal(await gallery.locator('.aui-gallery-empty').count(), 0, '没有第二个「还没有文件」框');
  assert.match(await gallery.innerText(), /还没有附件[\s\S]*把文件拖到这里，或[\s\S]*选择文件[\s\S]*拍照[\s\S]*录音/);
  assert.equal(await style(gallery.locator('.aui-dropzone'), 'border-top-style'), 'dashed');

  // ---- 密码框
  step('password: eye, caps lock, mono, error');
  const pwA = area.locator('#pw-a');
  const eye = area.locator('.aui-field').filter({ has: page.locator('#pw-a') }).getByRole('button', { name: '显示密码' });
  assert.equal(await pwA.getAttribute('type'), 'password');
  assert.equal(await eye.getAttribute('aria-pressed'), 'false');
  assert.equal(await eye.getAttribute('data-tip'), '显示密码');
  assert.equal(await eye.getAttribute('title'), null, '不用原生 title');
  assert.deepEqual(await box(eye), { width: 24, height: 24 });
  assert.match(await style(pwA, 'font-family'), /mono|Consolas|Menlo/i, '等宽');
  await pwA.focus();
  await eye.click();
  assert.equal(await pwA.getAttribute('type'), 'text');
  assert.equal(await eye.getAttribute('aria-pressed'), 'true');
  assert.equal(await eye.getAttribute('data-tip'), '隐藏密码');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'pw-a', '点眼睛光标留在框里');
  await eye.click();
  await pwA.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, modifierCapsLock: true })));
  await area.getByText('大写锁定已打开').waitFor();
  await pwA.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keyup', { key: 'A', bubbles: true, modifierCapsLock: false })));
  await area.getByText('大写锁定已打开').waitFor({ state: 'detached' });
  const pwC = area.locator('.aui-field').filter({ has: page.locator('#pw-c') });
  assert.equal(await pwC.locator('.aui-input-box[data-invalid]').count(), 1, '出错红边');
  assert.match(await pwC.innerText(), /原密码不对，还能试 4 次/);
  await pwA.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true, modifierCapsLock: true })));
  await shot('password-1440');
  await pwA.blur();

  // ---- 改密码：强度 + 再输一次
  step('strength + confirm');
  const change = area.locator('#pw-change');
  const strength = change.locator('.aui-pw-strength');
  assert.equal(await strength.getAttribute('data-level'), '2');
  assert.match(await strength.innerText(), /太弱|一般/);
  assert.equal(await strength.locator('li[data-ok]').count(), 2);
  assert.equal(await change.locator('.aui-field').filter({ has: page.locator('#pw-again') }).locator('.aui-input-box[data-invalid]').count(), 1);
  assert.match(await change.getByRole('alert').innerText(), /和上面不一样/);
  await change.locator('#pw-new').fill('Linhome26!');
  assert.equal(await strength.getAttribute('data-level'), '4');
  assert.equal(await strength.locator('li[data-ok]').count(), 4, '四条要求都打勾');
  await change.locator('#pw-again').fill('Linhome2');
  assert.equal(await change.getByRole('alert').count(), 0, '还在打（前缀一致）不报错');
  await change.locator('#pw-again').fill('Linhome26!');
  await change.getByText('两次一致').waitFor();
  assert.equal(await change.getByRole('button', { name: '改密码' }).isEnabled(), true);

  // ---- 初始密码
  step('initial password: auto, 换一个, 我来设, back');
  const initial = area.locator('#pw-initial');
  await page.waitForFunction(() => /^\w{4}-\w{4}-\w{4}$/.test(document.querySelector('#pw-initial')?.value ?? ''));
  const first = await initial.inputValue();
  const field = area.locator('.aui-field').filter({ has: page.locator('#pw-initial') });
  await field.getByRole('button', { name: '换一个' }).click();
  assert.notEqual(await initial.inputValue(), first, '换一个');
  const second = await initial.inputValue();
  await field.getByRole('button', { name: '我来设' }).click();
  assert.equal(await initial.getAttribute('type'), 'password');
  await initial.fill('abc');
  await field.getByRole('button', { name: '自动生成' }).click();
  assert.equal(await initial.inputValue(), second, '切回来还是刚才生成的那个');

  // ---- 分格密码
  step('code input: 44 × 52, red borders + shake, tries dots');
  const code = area.getByRole('group', { name: '密码', exact: true });
  const cell = code.getByRole('textbox').first();
  assert.deepEqual(await box(cell), { width: 44, height: 52 });
  assert.equal(await style(cell, 'border-top-left-radius'), '10px');
  await cell.click();
  await page.keyboard.type('b8q1');
  await code.and(page.locator('[data-shake]')).waitFor();
  await page.waitForTimeout(400); // 边框颜色过渡结束
  assert.equal(await style(cell, 'border-top-color'), danger, '出错只变红边');
  assert.equal(await code.getAttribute('data-invalid'), 'true');
  const cellBg = await style(cell, 'background-color');
  const surface = await style(area.locator('.aui-panel').first(), 'background-color');
  assert.equal(cellBg, surface, '出错不铺红底');
  assert.match(await area.locator('#pw-code').getByRole('alert').innerText(), /密码不对，还能试 4 次/);
  assert.equal(await area.locator('#pw-code .aui-code-tries > i[data-used]').count(), 1);
  await shot('code-error-1440');
  await code.getByRole('textbox').first().click();
  await page.keyboard.type('A7K2');
  await area.getByText('密码对了，正在打开…').waitFor();

  // ---- 深色
  step('dark');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await page.waitForTimeout(200);
  await area.screenshot({ path: resolve(output, 'section-1440-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  await area.screenshot({ path: resolve(output, 'section-1440.png'), animations: 'disabled' });

  // ---- 手机 390
  step('390');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '390 不横向溢出');
  const overflow = await area.evaluate((el) => [...el.querySelectorAll('.aui-dropzone, .aui-upq, .aui-imgs, .aui-password, .aui-code-boxes')].filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.className));
  assert.deepEqual(overflow, [], '控件里不溢出');
  await area.screenshot({ path: resolve(output, 'section-390.png'), animations: 'disabled' });

  assert.deepEqual(errors, [], '页面不能有脚本错误');
  console.log(`PASS inputs-uploads (${output}): one drop zone (dashed 1.5px, radius 12, 36px icon block, drag over 3 files, error, disabled), UploadField row → progress → file row (thumbnail, 换一张 / 删除, type rejected at once), queue (type tiles, 4px bar + 还要 N 秒, reason + 全部重试), image grid (96px, cover, ring %, failed red + retry, room), gallery empty = one zone, password (eye aria-pressed + bubble, caps lock, mono, error), strength 4 levels + checklist, confirm live, initial password auto / 换一个 / 我来设, code 44 × 52 red borders + shake + tries dots; screenshots 1440 light / dark + 390`);
} catch (error) {
  await page?.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await server.close();
}
