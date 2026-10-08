// 媒体与附件浏览器验收：starter「系统 → 媒体与附件」（样稿 D19 / D07 / D11 / D18 / D27m）。
// 附件集（分区、封面 / 时长角标、锁标、无权限不能打开、网格 ⇄ 列表、勾选 + 批量下载）；大图预览（整屏沉浸 + 媒体 token、
// 缩放按钮 / + - 0 / Ctrl+滚轮、拖动平移、旋转、信息、← / → / Esc、缩略条、焦点回到触发按钮、手机全屏 + 左右滑）；音频（播放 / 暂停、同一时间只放一个、倍速、键盘拖进度、迷你版放进 32px 格子）；
// 上传队列（多文件、进度 + 剩余时间、失败原因 + 重试续传、取消、类型不符拒收）；录音（Chromium 假麦克风：录 / 暂停 / 继续 /
// 结束得到 Blob；权限被拒、不支持）；按住说话（按住录、松开发送、上滑取消、太短不发、≥44px）；1440 浅 / 深色、390 不溢出。
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/media');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const noOverflow = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what} 横向溢出 ${d}px`));
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '媒体与附件', exact: true }).click();
  const gallery = page.getByRole('group', { name: '现场资料' });
  await gallery.waitFor();

  // ---- 附件集：分区、角标、锁
  const sections = gallery.locator('.aui-gallery-section > h4');
  assert.deepEqual(await sections.allInnerTexts().then((l) => l.map((t) => t.split('\n').slice(0, 2).join(' '))), ['图片和视频 4', '音频 2', '文件 3']);
  assert.equal(await gallery.locator('.aui-media-badge[data-pos=cover]').innerText(), '封面');
  assert.match(await gallery.locator('.aui-media-badge[data-pos=duration]').first().innerText(), /01:05/);
  assert.equal(await gallery.locator('.aui-media-lock').count(), 2);
  // 锁标不把文件名挤没（审阅 07：「报… .xlsx」）：名字完整，锁标先缩、全文在 title
  const lockedFile = gallery.locator('.aui-media-file', { hasText: '报价单' });
  assert.equal(await lockedFile.locator('.aui-fname > span').first().evaluate((el) => el.scrollWidth <= el.clientWidth), true, '「报价单」没被省略');
  assert.equal(await lockedFile.locator('.aui-media-lock').getAttribute('data-tip'), '仅能看价格的人可见：这个附件带价格，只有能看「成交价」的人看得到');
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    const stem = await lockedFile.locator('.aui-fname > span').first().evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(stem >= 30, `${width} 宽文件名主名还有 ${stem}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await gallery.getByRole('button', { name: '预览 成本核算.xlsx' }).count(), 0, '没权限的文件没有预览');
  assert.equal(await gallery.getByRole('checkbox', { name: '选择 成本核算.xlsx' }).count(), 0, '没权限的文件不能选');
  const thumbHeights = await gallery.locator('.aui-media-tiles .aui-media-thumb').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  assert.ok(thumbHeights.every((h) => h === 124), `缩略图一样高 ${thumbHeights}`);
  // 媒体上的字用 --aui-on-media，遮罩用 --aui-media-scrim*（不写死颜色）
  const badge = await gallery.locator('.aui-media-badge').first().evaluate((el) => {
    const s = getComputedStyle(el);
    const root = getComputedStyle(el.closest('.adminui'));
    return { color: s.color, onMedia: root.getPropertyValue('--aui-on-media').trim() };
  });
  assert.ok(badge.onMedia, '--aui-on-media 已定义');

  // ---- 大图预览：整屏沉浸、只用媒体 token、缩放（按钮 / + - 0 / Ctrl+滚轮）、拖动、旋转、信息、键盘、焦点回到触发按钮
  const opener = gallery.getByRole('button', { name: '预览 客厅-全景.jpg' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const lbName = dialog.locator('.aui-lb-name');
  assert.equal(await lbName.innerText(), '客厅-全景.jpg');
  assert.match(await dialog.locator('.aui-lb-sub').innerText(), /第 1 \/ 8 个/, '能看的 8 个（没权限的不进预览）');
  assert.equal(await dialog.locator('.aui-lightbox-thumb').count(), 8);
  const image = dialog.locator('img.aui-lightbox-image');
  await dialog.locator('img.aui-lightbox-image[data-ready]').waitFor();
  const cover = await dialog.boundingBox();
  assert.ok(cover && cover.x <= 0.5 && cover.y <= 0.5 && cover.width >= 1439 && cover.height >= 999, `整屏铺满视口 ${JSON.stringify(cover)}`);
  const look = await page.evaluate(() => {
    const box = document.querySelector('.aui-lightbox-dialog');
    const probe = document.createElement('span');
    box.appendChild(probe);
    const resolve = (prop, value) => {
      probe.style.cssText = `${prop}:${value}`;
      return getComputedStyle(probe)[prop === 'color' ? 'color' : 'backgroundColor'];
    };
    const out = {
      stage: resolve('background-color', 'var(--aui-media-stage)'),
      onMedia: resolve('color', 'var(--aui-on-media)'),
      scrimStrong: resolve('background-color', 'var(--aui-media-scrim-strong)'),
      bg: getComputedStyle(box).backgroundColor,
      radius: getComputedStyle(box).borderRadius,
      shadow: getComputedStyle(box).boxShadow,
      name: getComputedStyle(box.querySelector('.aui-lb-name')).color,
      nav: getComputedStyle(box.querySelector('.aui-lb-nav')).color,
      tools: getComputedStyle(box.querySelector('.aui-lb-tools')).backgroundColor,
      close: getComputedStyle(box.querySelector('.aui-dialog-close')).color,
      card: box.querySelector('.aui-dialog-header, .aui-lightbox-view') ? 'framed' : 'none',
    };
    probe.remove();
    return out;
  });
  assert.equal(look.bg, look.stage, '底色 = --aui-media-stage');
  assert.equal(look.radius, '0px', '没有弹框圆角');
  assert.equal(look.shadow, 'none', '没有弹框阴影');
  assert.equal(look.card, 'none', '没有弹框头 / 框中框');
  for (const key of ['name', 'nav', 'close']) assert.equal(look[key], look.onMedia, `${key} 的字用 --aui-on-media`);
  assert.equal(look.tools, look.scrimStrong, '工具条底 = --aui-media-scrim-strong');
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'lightbox-1440.png') });
  const pct = dialog.locator('.aui-lb-pct');
  const width = async () => (await image.boundingBox()).width;
  assert.equal(await pct.innerText(), '100%', '小图适应 = 原始大小，不放大糊掉');
  const fitWidth = await width();
  await page.keyboard.press('+');
  assert.equal(await pct.innerText(), '125%', '+ 放大');
  await dialog.getByRole('button', { name: '放大（+）' }).click();
  assert.equal(await pct.innerText(), '150%', '放大按钮');
  await page.waitForTimeout(350);
  assert.ok(Math.abs((await width()) - fitWidth * 1.5) < 3, `图片跟着变大 ${await width()} vs ${fitWidth}`);
  await page.keyboard.press('-');
  assert.equal(await pct.innerText(), '125%', '- 缩小');
  await dialog.getByRole('button', { name: '缩小（-）' }).click();
  assert.equal(await pct.innerText(), '100%');
  await page.keyboard.press('0');
  assert.equal(await dialog.getByRole('button', { name: '适应屏幕（0）' }).getAttribute('aria-pressed'), 'true', '0 = 适应');
  // Ctrl + 滚轮缩放
  const stage = dialog.locator('.aui-lb-stage');
  const sb = await stage.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2 - 30);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('Control');
  await page.waitForTimeout(100);
  assert.ok(Number((await pct.innerText()).replace('%', '')) > 100, `Ctrl + 滚轮放大（${await pct.innerText()}）`);
  // 放大到 300%：拖动平移
  await page.keyboard.press('0');
  for (let i = 0; i < 4; i++) await page.keyboard.press('+');
  assert.equal(await pct.innerText(), '300%');
  await page.waitForTimeout(350);
  assert.equal(await stage.getAttribute('data-pannable'), 'true', '放大后可以拖动');
  const panFrom = await image.boundingBox();
  const sx = sb.x + sb.width / 2;
  const sy = sb.y + sb.height / 2 - 30;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx - 120, sy - 60, { steps: 6 });
  await page.mouse.up();
  const after = await image.boundingBox();
  assert.ok(Math.abs(after.x - panFrom.x + 120) < 4 && Math.abs(after.y - panFrom.y + 60) < 4, `拖动平移 ${panFrom.x},${panFrom.y} → ${after.x},${after.y}`);
  assert.match(await lbName.innerText(), /客厅-全景\.jpg/, '放大时拖动不翻页');
  await dialog.getByRole('button', { name: '向右旋转 90°' }).click();
  assert.match(await image.getAttribute('style'), /rotate\(90deg\)/, '旋转');
  assert.equal(await pct.innerText(), '100%', '旋转后回到适应');
  await dialog.getByRole('button', { name: '信息' }).click();
  const infoPanel = dialog.getByRole('complementary', { name: '文件信息' });
  assert.match(await infoPanel.innerText(), /来自[\s\S]*李承恩[\s\S]*大小[\s\S]*3\.8 MB/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'lightbox-info-1440.png') });
  await dialog.getByRole('button', { name: '信息' }).click();
  await page.keyboard.press('ArrowRight');
  assert.match(await lbName.innerText(), /配电箱\.jpg/, '→ 下一个');
  await dialog.locator('img.aui-lightbox-image[data-ready]').waitFor();
  assert.equal(await pct.innerText(), '100%', '换图回到适应');
  assert.doesNotMatch(await image.getAttribute('style'), /rotate\(90deg\)/, '换图旋转归零');
  await page.keyboard.press('ArrowLeft');
  assert.match(await lbName.innerText(), /客厅-全景\.jpg/, '← 上一个');
  assert.ok(await dialog.getByRole('button', { name: '上一个' }).isDisabled(), '第一个没有上一个');
  await dialog.getByRole('button', { name: /第 4 个/ }).click();
  assert.match(await lbName.innerText(), /现场走一圈\.mp4/);
  assert.match(await dialog.innerText(), /还没有可预览的地址/, '视频没有地址时显示占位');
  assert.equal(await dialog.locator('.aui-lb-tools').count(), 0, '不是图片没有缩放工具条');
  await dialog.getByRole('button', { name: /第 5 个/ }).click();
  assert.equal(await dialog.locator('.aui-lightbox-audio .aui-audio').count(), 1, '音频在预览里直接播放');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  assert.match(await lbName.innerText(), /平面图-滨江区\.pdf/);
  await dialog.getByRole('button', { name: '下载' }).first().click();
  await page.getByText('开始下载：平面图-滨江区.pdf').waitFor();
  await page.keyboard.press('ArrowRight');
  assert.match(await lbName.innerText(), /报价单\.xlsx/);
  assert.ok(await dialog.getByRole('button', { name: '下一个' }).isDisabled(), '最后一个没有下一个');
  assert.match(await dialog.innerText(), /这个类型不能在线预览/);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '预览 客厅-全景.jpg', '关掉后焦点回到打开它的方块');

  // ---- 网格 ⇄ 列表、勾选 + 批量下载
  await gallery.getByRole('button', { name: '列表' }).click();
  assert.equal(await gallery.locator('.aui-media-row').count(), 9);
  await gallery.getByRole('checkbox', { name: '选择 配电箱.jpg' }).click();
  await gallery.getByRole('checkbox', { name: '选择 平面图-滨江区.pdf' }).click();
  assert.match(await gallery.locator('.aui-gallery-count').innerText(), /已选 2 个/);
  await gallery.getByRole('button', { name: '下载选中（2）' }).click();
  await page.getByText('开始下载：配电箱.jpg、平面图-滨江区.pdf').waitFor();
  await gallery.getByRole('button', { name: '取消选择' }).click();
  await gallery.getByRole('button', { name: '批量下载' }).click();
  await page.getByText(/开始下载：客厅-全景\.jpg、.*报价单\.xlsx$/).waitFor();
  assert.ok(!(await page.getByText(/开始下载：.*成本核算/).count()), '批量下载不含没权限的');
  await page.screenshot({ path: resolve(output, 'list-1440.png') });
  await gallery.getByRole('button', { name: '网格' }).click();

  // ---- 音频播放器
  const player = gallery.locator('.aui-audio').filter({ hasText: '客户来电-10-04.m4a' });
  await player.getByRole('button', { name: '播放 客户来电-10-04.m4a' }).click();
  await player.getByRole('button', { name: '暂停 客户来电-10-04.m4a' }).waitFor();
  await page.waitForTimeout(600);
  const slider = player.getByRole('slider');
  assert.ok(Number(await slider.getAttribute('aria-valuemax')) >= 22, '时长来自文件');
  assert.match(await player.locator('.aui-audio-time').innerText(), /^00:0\d \/ 00:23$/);
  const speed = player.getByRole('button', { name: /播放速度/ });
  assert.equal(await speed.innerText(), '1.0x');
  await speed.click();
  assert.equal(await speed.innerText(), '1.25x');
  assert.equal(await player.locator('audio').evaluate((a) => a.playbackRate), 1.25);
  await slider.focus();
  const before = Number(await slider.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  assert.ok(Number(await slider.getAttribute('aria-valuenow')) >= before + 4, '→ 快进 5 秒');
  assert.ok(await player.locator('.aui-wave > i[data-played]').count() > 0, '波形显示播放进度');
  const other = gallery.locator('.aui-audio').filter({ hasText: '现场口述-配电箱.m4a' });
  await other.getByRole('button', { name: '播放 现场口述-配电箱.m4a' }).click();
  await other.getByRole('button', { name: /^暂停/ }).waitFor();
  await player.getByRole('button', { name: '播放 客户来电-10-04.m4a' }).waitFor({ timeout: 3000 });
  await other.getByRole('button', { name: /^暂停/ }).click();
  assert.equal(await gallery.getByRole('button', { name: '转文字' }).first().isDisabled(), true, '转文字由宿主控制，可以先不可用');

  // ---- 表格格子里的迷你播放器
  const table = page.getByRole('table', { name: '客户通话录音' });
  const mini = table.locator('.aui-audio[data-variant=mini]').first();
  const miniBox = await mini.boundingBox();
  assert.ok(miniBox && miniBox.height <= 24, `迷你播放器 ≤24px 高（${miniBox?.height}）`);
  const rowHeights = await table.locator('tbody tr').evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().height)));
  assert.ok(rowHeights.every((h) => h === rowHeights[0] && h <= 40), `行高不被播放器撑高（紧凑 40） ${rowHeights}`);
  assert.equal(await table.locator('.aui-audio[data-variant=mini] .aui-audio-bar').count(), 1, '没有 peaks 时是普通进度条');
  assert.match(await table.locator('tbody tr').nth(1).innerText(), /00:12\s*\+1/);

  // ---- 记录详情附件行
  const strip = page.getByRole('group', { name: '附件行' });
  assert.equal(await strip.locator('.aui-media-chip').count(), 7, '6 个 + 「+3」');
  assert.equal(await strip.locator('[data-more]').innerText(), '+3');
  assert.equal(await strip.getByRole('button', { name: '添加附件' }).count(), 1);

  // ---- 上传队列（附件面板里的拖放区 + 队列卡）
  const zoneInput = gallery.locator('.aui-dropzone input[type=file]');
  const buf = (n) => Buffer.alloc(n, 1);
  await zoneInput.setInputFiles([
    { name: '主卧插座位置.mp4', mimeType: 'video/mp4', buffer: buf(4096) },
    { name: '配电箱-失败.jpg', mimeType: 'image/jpeg', buffer: buf(2048) },
    { name: '大文件-整屋.mp4', mimeType: 'video/mp4', buffer: buf(8192) },
    { name: '安装程序.exe', mimeType: 'application/x-msdownload', buffer: buf(100) },
  ]);
  const queue = gallery.getByRole('group', { name: '上传队列' });
  await queue.waitFor();
  assert.match(await queue.locator('h5').innerText(), /上传队列 · 4/);
  assert.match(await queue.locator('.aui-upq-item').filter({ hasText: '安装程序.exe' }).innerText(), /文件类型不支持/, '类型不符直接拒收并写原因');
  await page.waitForTimeout(1200);
  assert.match(await queue.locator('.aui-upq-item').filter({ hasText: '大文件-整屋.mp4' }).innerText(), /\d+% · 还要 \d+ (秒|分钟)/, '进度 + 剩余时间');
  const failed = queue.locator('.aui-upq-item').filter({ hasText: '配电箱-失败.jpg' });
  await failed.getByText('网络中断，已保留文件').waitFor({ timeout: 5000 });
  await queue.locator('.aui-upq-item').filter({ hasText: '主卧插座位置.mp4' }).getByText(/已上传/).waitFor({ timeout: 5000 });
  await page.getByText('主卧插座位置.mp4 上传成功').waitFor();
  await queue.getByRole('button', { name: '取消上传 大文件-整屋.mp4' }).click();
  assert.match(await queue.locator('.aui-upq-item').filter({ hasText: '大文件-整屋.mp4' }).innerText(), /已取消/);
  await page.screenshot({ path: resolve(output, 'upload-1440.png') });
  await failed.getByRole('button', { name: '重试' }).click();
  await failed.getByText(/已上传/).waitFor({ timeout: 5000 });
  assert.ok((await failed.locator('.aui-upq-status').innerText()).includes('已上传'), '重试从断点继续并完成');
  await queue.getByRole('button', { name: '从列表移除 安装程序.exe' }).click();
  assert.equal(await queue.locator('.aui-upq-item').count(), 3);

  // ---- 表单上传格：useUploadQueue 映射成方块（上传中遮罩、失败重试）
  const form = page.getByRole('group', { name: '上传户型图' });
  await page.locator('.aui-panel').filter({ has: form }).locator('.aui-dropzone input[type=file]').setInputFiles([
    { name: '大门口走一圈.mp4', mimeType: 'video/mp4', buffer: buf(4096) },
    { name: '主卧门口-失败.jpg', mimeType: 'image/jpeg', buffer: buf(1024) },
  ]);
  await form.locator('.aui-media-uploading').first().waitFor();
  assert.match(await form.locator('.aui-media-uploading').first().innerText(), /上传中 \d+%/);
  await form.locator('.aui-media-failed').waitFor({ timeout: 5000 });
  assert.match(await form.locator('.aui-media-tile[data-failed]').innerText(), /上传失败[\s\S]*网络中断，已保留文件/);
  await page.screenshot({ path: resolve(output, 'form-upload-1440.png') });
  await form.getByRole('button', { name: '重试' }).click();
  await form.locator('.aui-media-failed').waitFor({ state: 'detached', timeout: 5000 });

  // ---- 按住说话（假麦克风）
  const hold = page.getByRole('button', { name: /按住说话/ });
  const holdBox = await hold.boundingBox();
  assert.ok(holdBox && holdBox.height >= 44, `触屏尺寸 ≥44px（${holdBox?.height}）`);
  await hold.scrollIntoViewIfNeeded();
  const hb = await hold.boundingBox();
  const cx = hb.x + hb.width / 2;
  const cy = hb.y + hb.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const sheet = page.locator('.aui-hold-sheet');
  await sheet.getByText('正在录音').waitFor();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: resolve(output, 'hold-1440.png') });
  await page.mouse.up();
  await sheet.waitFor({ state: 'detached' });
  await page.getByText(/录好了：00:01/).waitFor({ timeout: 5000 });
  assert.match(await page.locator('.aui-panel').filter({ has: hold }).innerText(), /录好 1 段/);
  // 上滑取消
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await sheet.getByText('正在录音').waitFor();
  await page.waitForTimeout(800);
  await page.mouse.move(cx, cy - 100, { steps: 4 });
  await sheet.getByText('松开手指，取消发送').waitFor();
  await page.mouse.up();
  await page.getByText('已取消，没有发送').waitFor();
  // 太短
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await sheet.getByText('正在录音').waitFor();
  await page.mouse.up();
  await page.getByText('说话时间太短，没有发送').first().waitFor();
  assert.match(await page.locator('.aui-panel').filter({ has: hold }).innerText(), /录好 1 段/, '取消 / 太短都不发送');

  // ---- 录音（假麦克风）：录 → 暂停 → 继续 → 结束并保存
  const recorder = page.locator('.aui-recorder');
  await recorder.getByRole('button', { name: '开始录音' }).click();
  await recorder.getByText('正在录音').waitFor();
  await page.waitForTimeout(1500);
  assert.match(await recorder.locator('.aui-rec-timer').innerText(), /^00:0[1-9]$/, '大计时在走');
  assert.ok(await recorder.locator('.aui-wave > i').count() > 5, '实时波形');
  const recLook = await recorder.evaluate((el) => {
    const probe = document.createElement('i');
    el.appendChild(probe);
    const resolve = (v) => { probe.style.color = v; return getComputedStyle(probe).color; };
    const out = { red: resolve('var(--aui-record)'), line: resolve('var(--aui-line)'), border: getComputedStyle(el).borderTopColor, dot: getComputedStyle(el.querySelector('.aui-rec-dot')).backgroundColor,
      status: getComputedStyle(el.querySelector('.aui-rec-status')).color, label: getComputedStyle(el.querySelector('.aui-rec-main > small')).color,
      rest: getComputedStyle(el.querySelector('.aui-rec-rest')).backgroundImage, bar: getComputedStyle(el.querySelector('.aui-wave > i[data-played]')).backgroundColor };
    probe.remove();
    return out;
  });
  assert.equal(recLook.dot, recLook.red, '录音中小红点 = 录音红');
  assert.equal(recLook.status, recLook.red, '「正在录音」字 = 录音红');
  assert.equal(recLook.bar, recLook.red, '录音波形 = 录音红');
  assert.equal(recLook.border, recLook.line, '录音卡边框中性');
  assert.notEqual(recLook.label, recLook.red, '「结束并保存」字不用录音红');
  assert.ok(!recLook.rest.includes(recLook.red.replace(/\s/g, '')) && !recLook.rest.includes(recLook.red), `计时下面的虚线不是红的 ${recLook.rest}`);
  await page.screenshot({ path: resolve(output, 'recorder-1440.png') });
  await recorder.getByRole('button', { name: '暂停录音' }).click();
  await recorder.getByText('已暂停').waitFor();
  const paused = await recorder.locator('.aui-rec-timer').innerText();
  await page.waitForTimeout(1200);
  assert.equal(await recorder.locator('.aui-rec-timer').innerText(), paused, '暂停时不计时');
  await recorder.getByRole('button', { name: '继续录音' }).click();
  await recorder.getByText('正在录音').waitFor();
  await page.waitForTimeout(600);
  await recorder.getByRole('button', { name: '结束并保存' }).click();
  await recorder.locator('.aui-audio').waitFor();
  assert.match(await recorder.innerText(), /刚录的音频/);
  await page.getByText(/录好了：00:0[2-9] · \d/).waitFor();
  // 权限被拒
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await recorder.getByRole('button', { name: '重新录音' }).click();
  await recorder.getByText('浏览器没有麦克风权限').waitFor();
  assert.match(await recorder.locator('.aui-rec-problem-steps').innerText(), /点地址栏左侧的锁图标/, '写清楚怎么改权限');
  assert.equal(await recorder.locator('.aui-rec-problem-detail').innerText(), '浏览器原因：NotAllowedError: denied', '英文原因只在最后一行小字');
  assert.equal(await recorder.getByRole('button', { name: '改成上传录音文件' }).count(), 1, '给出别的办法');
  assert.equal(await recorder.locator('.aui-rec-problem :is(b, li, .aui-rec-problem-detail)').last().getAttribute('class'), 'aui-rec-problem-detail', '英文原因在最后一行');
  const problemLook = await recorder.evaluate((el) => {
    const s = getComputedStyle(el);
    const probe = document.createElement('i');
    probe.style.color = 'var(--aui-record)';
    el.appendChild(probe);
    const red = getComputedStyle(probe).color;
    probe.remove();
    return { border: s.borderTopColor, icon: getComputedStyle(el.querySelector('.aui-rec-problem-icon')).color, red };
  });
  assert.notEqual(problemLook.icon, problemLook.red, '麦克风打不开不是录音，不用录音红');
  // 麦克风被占用：中文说明怎么办，英文原话只进小字（审阅 07 实拍「Not supported」）
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Could not start audio source', 'NotReadableError'));
  });
  await recorder.getByRole('button', { name: '再试一次' }).click();
  await recorder.getByText('麦克风被别的程序占用').waitFor();
  // 浏览器不支持：没有「重试」，给别的办法
  await page.evaluate(() => {
    delete window.MediaRecorder;
  });
  await recorder.getByRole('button', { name: '再试一次' }).click();
  await recorder.getByText('这个浏览器打不开麦克风').waitFor();
  assert.equal(await recorder.getByRole('button', { name: '再试一次' }).count(), 0, '重试没用就不给重试');
  assert.equal(await recorder.getByRole('button', { name: '改成上传录音文件' }).count(), 1, '改成上传录音文件');
  await page.screenshot({ path: resolve(output, 'recorder-problem-1440.png') });

  // ---- 截图：1440 浅 / 深、390（先关掉通知，不挡内容）
  for (const close of await page.getByRole('button', { name: '关闭通知' }).all()) await close.click().catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await noOverflow(page, '1440');
  await page.screenshot({ path: resolve(output, 'media-1440.png'), fullPage: true });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'media-dark.png'), fullPage: true });
  await gallery.getByRole('button', { name: '预览 客厅-全景.jpg' }).click();
  await dialog.waitFor();
  await page.waitForTimeout(500);
  const darkLook = await page.evaluate(() => {
    const box = document.querySelector('.aui-lightbox-dialog');
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--aui-media-stage)';
    box.appendChild(probe);
    const out = { bg: getComputedStyle(box).backgroundColor, stage: getComputedStyle(probe).backgroundColor, img: getComputedStyle(box.querySelector('.aui-lightbox-image')) };
    probe.remove();
    return { bg: out.bg, stage: out.stage, filter: out.img.filter, opacity: out.img.opacity };
  });
  assert.equal(darkLook.bg, darkLook.stage, '深色下底色仍是 --aui-media-stage');
  assert.deepEqual([darkLook.filter, darkLook.opacity], ['none', '1'], '照片本身不随明暗变（没有滤镜 / 变淡）');
  await page.screenshot({ path: resolve(output, 'lightbox-dark.png') });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await noOverflow(page, '390');
  await page.screenshot({ path: resolve(output, 'media-390.png'), fullPage: true });
  await gallery.getByRole('button', { name: '预览 配电箱.jpg' }).click();
  await dialog.waitFor();
  await page.waitForTimeout(500);
  const box = await page.locator('.aui-dialog').boundingBox();
  assert.ok(box && box.width >= 389 && box.height >= 843, `手机上预览全屏 ${box?.width}×${box?.height}`);
  await noOverflow(page, '390 预览');
  await dialog.locator('img.aui-lightbox-image[data-ready]').waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(output, 'lightbox-390.png') });
  assert.equal(await dialog.locator('.aui-lb-nav').first().isVisible(), false, '手机上没有两侧圆钮（左右滑）');
  const tools = await dialog.locator('.aui-lb-tools').boundingBox();
  assert.ok(tools && tools.y + tools.height > 844 - 150, `工具条在底部 ${tools?.y}`);
  const swipe = async (from, to) => {
    await page.mouse.move(from, 420);
    await page.mouse.down();
    await page.mouse.move(to, 424, { steps: 4 });
    await page.mouse.up();
  };
  await swipe(320, 80);
  assert.match(await dialog.locator('.aui-lb-name').innerText(), /主卧窗帘盒\.jpg/, '左滑 = 下一个');
  await swipe(80, 320);
  assert.match(await dialog.locator('.aui-lb-name').innerText(), /配电箱\.jpg/, '右滑 = 上一个');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, [], errors.join('; '));
  await recoverySuite();
  console.log('PASS media: lightbox recovery (1080p video fits a wide short stage with controls, poster kept inside the stage, 「重新加载」, expired link → re-sign → resume, unsupported codec → message + 下载), AttachmentGallery (sections, cover / duration badges, lock, denied, tiles ⇄ list, select + batch download, strip), MediaLightbox (← → Esc, strip, focus return, phone full screen), AudioPlayer (play, one at a time, speed, keyboard seek, mini in 32px row), UploadQueue (progress + time left, failed reason, resumable retry, cancel, reject type), useUploadQueue tiles, AudioRecorder (record / pause / resume / done, denied, unsupported), HoldToTalk (send, slide-up cancel, too short, ≥44px), 1440 light / dark, 390');
} finally {
  await browser.close();
  await server.close();
}

/**
 * 8.0.1（宿主项目的「宝石开启中.mp4」）：宽而矮的舞台上 1920×1080 视频不溢出、控件看得见；没地址时海报不撑破舞台、
 * 「重新加载」；链接过期（403）→ 宿主重签 → 接着放；中途出错按原来的秒数续上；浏览器解不了的编码 → 说清楚 + 下载。
 */
async function recoverySuite() {
  const fixture = await createServer({ root, configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
  await fixture.listen();
  try {
    const webm = readFileSync(resolve(root, 'test/fixtures/wide-1080p.webm'));
    const context = await browser.newContext({ viewport: { width: 1920, height: 880 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const served = [];
    await page.route('**/signed/**', (route) => {
      const url = new URL(route.request().url());
      served.push(url.pathname + url.search);
      if (url.pathname.endsWith('/bad')) return route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('not a video at all, just bytes '.repeat(64)) });
      if (url.searchParams.get('v') === '0') return route.fulfill({ status: 403, contentType: 'application/xml', body: '<Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>' });
      // 像对象存储一样认 Range（不认的话浏览器不能跳到中间）
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '');
      if (!range) return route.fulfill({ status: 200, contentType: 'video/webm', headers: { 'accept-ranges': 'bytes' }, body: webm });
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), webm.length - 1) : webm.length - 1;
      return route.fulfill({ status: 206, contentType: 'video/webm', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${webm.length}` }, body: webm.subarray(start, end + 1) });
    });
    await page.goto(fixture.resolvedUrls.local[0] + 'test/media-recovery.html');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    const video = dialog.locator('video.aui-lightbox-video');
    // ① 打开时链接已经过期（403）：重签一次，换上新链接，放得出来
    await page.waitForFunction(() => document.querySelector('video.aui-lightbox-video')?.readyState >= 1, null, { timeout: 10000 });
    assert.equal(await video.getAttribute('src'), '/signed/wide?v=1', '过期链接换成了重签的');
    let calls = await page.evaluate(() => window.__calls);
    assert.equal(calls.length, 1, '只重签一次');
    assert.equal(calls[0].name, '宝石开启中.mp4');
    assert.equal(calls[0].code, 4, '首次加载就 403 = 不支持的源（所以先重签再判断编码）');
    // ② 1920×1080 在 1752×672 的画布里：不溢出、居中、控件在舞台里
    const fit = await page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON();
      return { canvas: box('.aui-lb-canvas'), video: box('video.aui-lightbox-video'), stage: box('.aui-lb-stage'), vw: document.querySelector('video.aui-lightbox-video').videoWidth };
    });
    assert.equal(fit.vw, 1920);
    for (const side of ['left', 'top']) assert.ok(fit.video[side] >= fit.canvas[side] - 0.5, `视频没越过画布 ${side} ${JSON.stringify(fit)}`);
    for (const side of ['right', 'bottom']) assert.ok(fit.video[side] <= fit.canvas[side] + 0.5, `视频没越过画布 ${side} ${JSON.stringify(fit)}`);
    assert.ok(fit.video.bottom <= fit.stage.bottom, '原生控件那条在舞台里');
    await page.screenshot({ path: resolve(output, 'lightbox-video-1920x880.png') });
    // ③ 播到一半链接失效：按原来的秒数续上、接着放
    await video.evaluate(async (el) => {
      el.muted = true;
      el.currentTime = 1.6;
      await new Promise((r) => el.addEventListener('seeked', r, { once: true }));
      await el.play();
      el.dispatchEvent(new Event('error'));
    });
    await page.waitForFunction(() => document.querySelector('video.aui-lightbox-video')?.getAttribute('src') === '/signed/wide?v=2');
    await page.waitForFunction(() => {
      const v = document.querySelector('video.aui-lightbox-video');
      return v.readyState >= 1 && v.currentTime >= 1.5 && !v.paused;
    }, null, { timeout: 10000 });
    calls = await page.evaluate(() => window.__calls);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].currentTime >= 1.5 && calls[1].currentTime < 3, `宿主拿到出错时的秒数 ${calls[1].currentTime}`);
    await video.evaluate((el) => el.pause());

    // ④ 没有地址：大海报不撑破舞台，名字 / 说明 / 按钮都在；「重新加载」→ 宿主补上地址 → 变成视频
    await dialog.getByRole('button', { name: '下一个' }).click();
    const card = dialog.locator('.aui-lb-card');
    await card.getByText('还没有可预览的地址').waitFor();
    const inside = async () => page.evaluate(() => {
      const box = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON();
      return { stage: box('.aui-lb-canvas'), poster: box('.aui-lightbox-poster'), card: box('.aui-lb-card'), reload: box('.aui-lb-card-actions button') };
    });
    const checkInside = (layout, what) => {
      for (const [name, part] of Object.entries(layout)) {
        if (name === 'stage') continue;
        assert.ok(part.left >= layout.stage.left - 0.5 && part.right <= layout.stage.right + 0.5 && part.top >= layout.stage.top - 0.5 && part.bottom <= layout.stage.bottom + 0.5, `${what}：${name} 在舞台里 ${JSON.stringify({ part, stage: layout.stage })}`);
      }
      assert.ok(Math.abs((layout.card.left + layout.card.right) / 2 - (layout.stage.left + layout.stage.right) / 2) < 2, `${what}：卡片水平居中`);
    };
    const wide = await inside();
    assert.ok(wide.poster.width <= 420 && wide.poster.height <= 300, `海报限在卡片里 ${JSON.stringify(wide.poster)}`);
    checkInside(wide, '1920×880');
    await page.screenshot({ path: resolve(output, 'lightbox-missing-url.png') });
    // 矮屏（横放手机）：海报先缩，名字 / 说明 / 按钮还在舞台里
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(200);
    checkInside(await inside(), '844×390');
    await page.screenshot({ path: resolve(output, 'lightbox-missing-url-844x390.png') });
    await page.setViewportSize({ width: 1920, height: 880 });
    const reload = card.getByRole('button', { name: '重新加载' });
    await reload.click();
    await dialog.getByRole('button', { name: '正在重新加载…' }).waitFor();
    await dialog.locator('video.aui-lightbox-video[src="/signed/wide?v=9"]').waitFor();
    assert.deepEqual(await page.evaluate(() => window.__reloads), ['没签到.mp4']);

    // ⑤ 浏览器解不了：重签一次还不行 → 「浏览器不支持这个视频编码，下载后播放」+ 下载
    await dialog.getByRole('button', { name: '下一个' }).click();
    const alert = dialog.getByRole('alert');
    await alert.waitFor({ timeout: 10000 });
    assert.equal(await alert.innerText(), '浏览器不支持这个视频编码，下载后播放');
    calls = await page.evaluate(() => window.__calls.filter((c) => c.name === '坏编码.mp4'));
    assert.equal(calls.length, 1, '坏文件只重签一次就停');
    assert.ok(served.includes('/signed/bad?v=1'), '坏文件也先重签了');
    assert.equal(await dialog.locator('.aui-lb-card').getByRole('button', { name: '重新加载' }).count(), 0, '编码问题不给「重新加载」');
    const download = dialog.locator('.aui-lb-card').getByRole('button', { name: '下载' });
    await download.click();
    assert.deepEqual(await page.evaluate(() => window.__downloads), ['坏编码.mp4']);
    await page.screenshot({ path: resolve(output, 'lightbox-unsupported.png') });
    assert.deepEqual(errors, [], errors.join('; '));
    await context.close();
  } finally {
    await fixture.close();
  }
}
