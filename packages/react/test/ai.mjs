// AI 审阅与提示词设置浏览器验收：starter「系统 → AI 分析」（样稿 D27 建议更新 / 话术建议、D28 AI 分析设置）。
// 提示词编辑器：行号、变量高亮、对比 v3 的改动标记和「改了 N 处」、插入变量到光标处、字数 / token、未知变量提醒、键盘输入；
// 版本历史：对比高亮、回退；试跑对比：切样本、选更好的一版、胜负统计、再跑一次；建议更新：采用 / 忽略 / 撤销 / 全部采用；
// 有出处的回答：编号出处按钮打开来源、折叠 / 展开；1440 浅 / 深色、390 手机不横向溢出，截图在 test/artifacts/ai/。
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

const executablePath = () => { const cached = '/home/admin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'; return process.env.CHROMIUM_PATH || (existsSync(cached) ? cached : chromium.executablePath()); };
const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'test/artifacts/ai');
mkdirSync(output, { recursive: true });
const server = await createServer({ root: resolve(root, 'examples/starter'), configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: executablePath(), args: ['--no-sandbox'] });
const minContrast = (page, selectors) => page.evaluate((sels) => {
  const rgb = (s) => { const n = (s.match(/[\d.]+/g) || []).map(Number); return s.startsWith('color(srgb') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : n; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bg = (el) => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; } return [255, 255, 255]; };
  const ratio = (el) => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const out = {};
  for (const sel of sels) { const els = [...document.querySelectorAll(sel)].filter((el) => el.getBoundingClientRect().width > 2 && el.textContent.trim()).slice(0, 8); out[sel] = els.length ? Math.min(...els.map(ratio)) : null; }
  return out;
}, selectors);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text()); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: 'AI 分析', exact: true }).click();
  const area = page.locator('#aui-page-ai');

  // ---- PromptEditor
  const editor = area.getByRole('region', { name: '跟进分析' });
  await editor.waitFor();
  assert.equal(await editor.locator('.aui-prompt-line').count(), 12, '12 行，每行有行号');
  assert.match(await editor.innerText(), /草稿 · 改了 2 处/);
  assert.deepEqual(await editor.locator('.aui-prompt-line[data-added] .aui-prompt-no').allInnerTexts(), ['9', '10'], '改过的两行带标记');
  assert.equal(await editor.locator('.aui-prompt-lines .aui-prompt-var').count(), 4, '变量高亮');
  assert.match(await editor.locator('.aui-prompt-foot').innerText(), /共 \d+ 字 · 约 [\d,]+ token/);
  await editor.getByRole('button', { name: '对比 v3' }).click();
  assert.equal(await editor.locator('.aui-prompt-line[data-added]').count(), 0, '关掉对比标记');
  await editor.getByRole('button', { name: '对比 v3' }).click();
  // the overlay lines up with the mirror (same line height, wrapped lines included)
  const geometry = await editor.evaluate((el) => {
    const area = el.querySelector('textarea');
    const lines = el.querySelector('.aui-prompt-lines');
    return { area: Math.round(area.scrollHeight), lines: Math.round(lines.getBoundingClientRect().height) };
  });
  assert.ok(Math.abs(geometry.area - geometry.lines) <= 2, `输入层和显示层一样高 ${JSON.stringify(geometry)}`);
  // type at the end and insert a variable at the caret (keyboard)
  const box = editor.getByRole('textbox', { name: '跟进分析' });
  await box.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n客户叫 ');
  await editor.getByRole('combobox', { name: '插入变量' }).click();
  await page.getByRole('option', { name: /\{\{业务线名称\}\}/ }).click();
  assert.match(await box.inputValue(), /客户叫 \{\{业务线名称\}\}$/, '插到光标处');
  assert.equal(await editor.locator('.aui-prompt-line').count(), 13);
  assert.match(await editor.innerText(), /改了 3 处/);
  await page.keyboard.type('，{{不存在}}');
  await editor.locator('.aui-prompt-warn').waitFor();
  assert.match(await editor.locator('.aui-prompt-warn').innerText(), /没有这个变量：不存在/);
  assert.equal(await editor.locator('.aui-prompt-var[data-unknown]').count() >= 1, true);
  for (let i = 0; i < '，{{不存在}}'.length; i += 1) await page.keyboard.press('Backspace');
  await editor.locator('.aui-prompt-warn').waitFor({ state: 'detached' });

  // ---- VersionList
  const versions = area.getByRole('list', { name: '版本历史' });
  assert.equal(await versions.locator('li').count(), 4);
  assert.match(await versions.locator('li').nth(1).innerText(), /v3[\s\S]*话术必须标出处[\s\S]*当前/);
  assert.equal(await versions.getByRole('button', { name: /^回退到/ }).count(), 2, '当前和草稿不能回退');
  await versions.getByRole('button', { name: '对比 v2' }).click();
  assert.equal(await versions.locator('li[aria-current=true]').count(), 1);
  await versions.getByRole('button', { name: '回退到 v2' }).click();
  await page.getByText('已生成 v5 = v2 的内容（演示）').waitFor();

  // ---- CompareGrid
  const compare = area.getByRole('region', { name: '试跑对比' });
  assert.deepEqual(await compare.locator('thead th').allInnerTexts().then((t) => t.map((x) => x.split('\n')[0])), ['v2', 'v3']);
  assert.equal(await compare.locator('td[data-flag=bad]').count(), 1, '编造的话术标红');
  assert.match(await compare.locator('.aui-compare-tally').innerText(), /v2 胜 0 · v3 胜 1 · 还没看 2/);
  await compare.getByRole('group', { name: '样本' }).getByRole('button', { name: '陈雅婷 · 电话' }).click();
  assert.match(await compare.locator('tbody').innerText(), /周六 10:00/);
  await compare.getByRole('button', { name: '选这个' }).nth(1).click();
  assert.match(await compare.locator('.aui-compare-tally').innerText(), /v3 胜 2 · 还没看 1/);
  const sampleGroup = compare.getByRole('group', { name: '样本' });
  await sampleGroup.getByRole('button', { name: '陈雅婷 · 电话' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.match(await compare.locator('tbody').innerText(), /人脸辨识门锁/, '方向键 + 回车换样本');
  await compare.getByRole('button', { name: '再跑一次' }).click();
  await page.getByText('已重新试跑（演示）').waitFor();

  // ---- SuggestionReview
  const sug = area.getByRole('region', { name: '建议更新' });
  assert.equal(await sug.locator('.aui-sug-row').count(), 4);
  assert.match(await sug.locator('.aui-sug-row').first().innerText(), /意向[\s\S]*已采用[\s\S]*撤销/);
  assert.equal(await sug.getByRole('button', { name: '采用：阶段' }).evaluate((el) => el.classList.contains('aui-button-outline') && !el.classList.contains('aui-button-primary')), true, '采用是描边按钮');
  assert.equal(await sug.locator('.aui-change-value-before').first().evaluate((el) => getComputedStyle(el).textDecorationLine), 'line-through', '旧值删除线');
  await sug.getByRole('button', { name: '采用：阶段' }).click();
  await sug.locator('.aui-sug-row[data-state=applied]').nth(1).waitFor();
  await sug.getByRole('button', { name: '忽略：预计金额' }).click();
  assert.equal(await sug.locator('.aui-sug-row[data-state=ignored]').count(), 1);
  // 忽略的写「恢复」；「采用」是描边（一屏一个实心主按钮）
  await sug.getByRole('button', { name: '恢复：预计金额' }).click();
  assert.equal(await sug.locator('.aui-sug-row[data-state=pending]').count(), 2);
  await sug.getByRole('button', { name: '全部采用' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.aui-sug-row[data-state=applied]').length === 4);
  assert.equal(await sug.getByRole('button', { name: '全部采用' }).count(), 0, '没有待处理的就不显示全部采用');

  // ---- SourcedAnswer + CitationChips
  const answer = area.locator('.aui-answer').first();
  assert.match(await answer.innerText(), /「窗帘电机和门锁都是本地控制/);
  assert.equal(await answer.locator('.aui-answer-cite').count(), 3, '[1] [1,2] → 三个编号按钮');
  await answer.getByRole('button', { name: '出处 2：成功案例 · 徐汇区别墅' }).first().click();
  await page.getByText('打开「成功案例 · 徐汇区别墅」（演示）').first().waitFor();
  assert.equal(await answer.getByRole('list', { name: '出处' }).locator('.aui-cite-no').count(), 2, '出处小签带编号');
  const folded = area.locator('.aui-answer').nth(1);
  const expand = folded.getByRole('button', { name: /展开/ });
  assert.equal(await expand.getAttribute('aria-expanded'), 'false');
  assert.equal(await folded.locator('.aui-answer-text').count(), 0, '折叠时只露标题和第一个出处');
  await expand.focus();
  await page.keyboard.press('Enter');
  assert.match(await folded.locator('.aui-answer-text').innerText(), /分两期施工/);

  await page.mouse.move(0, 0);
  for (const close of await page.locator('.aui-notice button').all()) await close.click().catch(() => undefined);
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(output, 'ai-1440.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  await page.waitForTimeout(400);
  for (const [sel, v] of Object.entries(await minContrast(page, ['.aui-prompt-no', '.aui-prompt-var', '.aui-prompt-badge', '.aui-sug-field', '.aui-sug-done', '.aui-cite-label', '.aui-answer-title', '.aui-compare-note', '.aui-version-text small']))) assert.ok(v === null || v >= 4.5, `深色 ${sel} 对比度 ${v?.toFixed(2)}`);
  await page.screenshot({ path: resolve(output, 'ai-1440-dark.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '切换到浅色模式', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  assert.ok((await overflow(page)) <= 0, `390 页面横向溢出 ${await overflow(page)}px`);
  const narrow = await editor.evaluate((el) => {
    const area = el.querySelector('textarea');
    const lines = el.querySelector('.aui-prompt-lines');
    return { area: Math.round(area.scrollHeight), lines: Math.round(lines.getBoundingClientRect().height) };
  });
  assert.ok(Math.abs(narrow.area - narrow.lines) <= 2, `手机上折行后两层仍对齐 ${JSON.stringify(narrow)}`);
  await page.screenshot({ path: resolve(output, 'ai-390.png'), fullPage: true, animations: 'disabled' });

  assert.deepEqual(errors, [], errors.join('; '));
  console.log(`PASS ai: prompt editor (line numbers, variable chips, diff marks + places, insert at caret, counts, unknown variable, overlay aligned incl. 390), versions (compare, rollback), compare grid (samples by keys, winner, tally, re-run), suggestions (accept / ignore / undo / accept all), sourced answer (numbered citations open sources, fold), 1440 light / dark, 390 (${output})`);
} finally {
  await browser.close();
  await server.close();
}
