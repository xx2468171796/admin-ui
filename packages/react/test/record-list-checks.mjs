// 记录详情列表展示（飞书式，默认）的浏览器检查，test:records（D11 客户）和 test:record-detail（合同）共用：
// 没有卡片套卡片、按钮只在悬停 / 聚焦时出现、点值就地编辑（编辑器在值那一格里、原值藏起来、Esc 不关详情、
// 焦点回到值上）、长文本 Enter 换行 / Ctrl+Enter 保存、选项列表挂在值下面、日期框 + 日历、保存失败留在编辑器、只读的锁。
import assert from 'node:assert/strict';

const rect = (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });

/** Inside a list-display record: no bordered rounded cards (tiles, section cards, comment / subtable frames). */
export async function checkFlatRecord(scope, label) {
  const found = await scope.evaluate((root) => {
    const layout = root.querySelector('.aui-record-layout[data-display=list]');
    if (!layout) return { missing: true };
    const tiles = layout.querySelectorAll('.aui-ftile, .aui-ftiles').length;
    const cards = [...layout.querySelectorAll('.aui-rsection, .aui-rsection > .aui-scard, .aui-rsection > .aui-comments, .aui-rfield, .aui-rfields')].filter((el) => {
      const s = getComputedStyle(el);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((side) => parseFloat(s[`border${side}Width`]) > 0).length;
      return sides >= 3 && parseFloat(s.borderTopLeftRadius) > 0;
    }).map((el) => el.className);
    const aside = layout.querySelector(':scope > .aui-record-aside');
    const asideLine = aside ? getComputedStyle(aside).borderLeftWidth : null;
    const bodyBg = getComputedStyle(layout.closest('.aui-record-expanded') ?? layout).backgroundColor;
    const asideBg = aside ? getComputedStyle(aside).backgroundColor : bodyBg;
    return { tiles, cards, asideLine, same: bodyBg === asideBg };
  });
  assert.ok(!found.missing, `${label}：默认是列表展示`);
  assert.equal(found.tiles, 0, `${label}：没有字段方块`);
  assert.deepEqual(found.cards, [], `${label}：没有带框圆角的卡片 ${found.cards.join(',')}`);
  if (found.asideLine !== null && found.asideLine !== '0px') assert.equal(found.asideLine, '1px', `${label}：右栏一条线`);
  assert.ok(found.same, `${label}：右栏和正文同一个底色`);
}

/** A field row: buttons hidden until hover, shown on hover. */
export async function checkHoverActions(page, row, label) {
  await page.mouse.move(2, 2);
  await page.waitForTimeout(200);
  const hidden = await row.locator('.aui-rfield-tools').evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(hidden, '0', `${label}：按钮平时不显示`);
  await row.hover();
  await page.waitForTimeout(250);
  const shown = await row.locator('.aui-rfield-tools').evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(shown, '1', `${label}：悬停时出现按钮`);
}

/** The D11 customer (starter 记录与字段): in-place editing of text, long text, select, date; failure; lock. */
export async function checkInPlaceEditing(page, rec, shot) {
  const row = (name) => rec.locator('.aui-rfield').filter({ has: page.locator('.aui-rfield-label', { hasText: new RegExp(`^${name}$`) }) });
  const value = (name) => row(name).locator('.aui-rfield-value');
  await checkFlatRecord(rec, 'D11 详情');
  // 进度一行：「n / m 已填 · 未填写：…」，不是卡片头
  const fill = rec.locator('.aui-rsection-fill').first();
  assert.match(await fill.innerText(), /\d+ \/ \d+ 已填/);
  assert.match(await fill.innerText(), /未填写：/);
  await checkHoverActions(page, row('预计金额'), '预计金额');
  // 只读：悬停时一把锁
  await row('最后跟进').hover();
  assert.equal(await row('最后跟进').getByRole('img', { name: /「最后跟进」按跟进记录自动算/ }).isVisible(), true, '只读字段悬停有锁');
  assert.equal(await row('最后跟进').getByRole('button', { name: /^编辑「最后跟进」/ }).count(), 0);

  // ① 文本：点值就地编辑
  const before = (await value('预计金额').innerText()).trim();
  await value('预计金额').click();
  const input = value('预计金额').locator('input');
  await input.waitFor();
  const cell = await rect(value('预计金额'));
  const box = await rect(input);
  assert.ok(box.left >= cell.left - 1 && box.right <= cell.right + 1 && box.top >= cell.top - 1 && box.bottom <= cell.bottom + 1, `编辑框在值那一格里 ${JSON.stringify({ cell, box })}`);
  assert.ok(box.width >= cell.width - 2, `编辑框占满值那一格：${box.width} / ${cell.width}`);
  assert.ok(!(await row('预计金额').innerText()).includes(before), '编辑时原值藏起来（不出现两份）');
  assert.equal(await row('预计金额').locator('.aui-rfield-tools').count(), 0, '编辑时没有按钮条');
  await shot('record-list-edit-text');
  // Esc：只取消这一格，不关详情，焦点回到值上
  await page.keyboard.press('Escape');
  await input.waitFor({ state: 'detached' });
  assert.ok(await rec.isVisible(), 'Esc 不关详情');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('aui-rfield-value')), true, 'Esc 后焦点回到值');
  // 回车（焦点在值上）再编辑；保存失败留在编辑器
  await page.keyboard.press('Enter');
  await input.waitFor();
  await input.fill('失败的金额');
  await page.keyboard.press('Enter');
  await row('预计金额').getByRole('alert').filter({ hasText: '保存失败' }).waitFor();
  assert.ok(await input.isVisible(), '失败后编辑器留着');
  await input.fill('¥2,300,000');
  await page.keyboard.press('Enter');
  await input.waitFor({ state: 'detached' });
  assert.equal((await value('预计金额').innerText()).trim(), '¥2,300,000', '保存后显示新值');

  // ② 长文本（空的「备注」留在原位可直接填）：Enter 换行，Ctrl+Enter 保存
  assert.equal((await value('备注').innerText()).trim(), '—', '空的可编辑字段留在原位');
  await value('备注').click();
  const area = value('备注').locator('textarea');
  await area.waitFor();
  const areaBox = await rect(area);
  const noteCell = await rect(value('备注'));
  assert.ok(areaBox.left >= noteCell.left - 1 && areaBox.right <= noteCell.right + 1, '多行框在值那一格里');
  await page.keyboard.type('第一行');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第二行');
  assert.equal(await area.inputValue(), '第一行\n第二行', 'Enter 换行');
  await shot('record-list-edit-longtext');
  await page.keyboard.press('Control+Enter');
  await area.waitFor({ state: 'detached' });
  assert.equal((await value('备注').innerText()).trim(), '第一行\n第二行', 'Ctrl+Enter 保存');

  // ③ 单选：值那一格变成选择框，选项列表挂在它下面
  await value('客户质量').click();
  const combo = value('客户质量').getByRole('combobox');
  await combo.waitFor();
  const list = page.getByRole('listbox', { name: '客户质量' });
  await list.waitFor();
  const qCell = await rect(value('客户质量'));
  const listBox = await rect(list);
  assert.ok(listBox.top >= qCell.bottom - 2 && listBox.top <= qCell.bottom + 16, `选项列表挂在值下面 ${JSON.stringify({ qCell, listBox })}`);
  await shot('record-list-edit-select');
  await list.getByRole('option', { name: 'B 观望' }).dispatchEvent('pointerdown');
  await combo.waitFor({ state: 'detached' });
  await row('客户质量').getByText('B 观望').waitFor();

  // ④ 日期：日期框在值里，日历挂在下面；打字保存
  await value('安装日期').click();
  const date = value('安装日期').locator('input');
  await date.waitFor();
  await page.locator('.aui-grid-datepop').waitFor();
  const dCell = await rect(value('安装日期'));
  const dBox = await rect(date);
  assert.ok(dBox.top >= dCell.top - 1 && dBox.bottom <= dCell.bottom + 1, '日期框在值那一格里');
  await shot('record-list-edit-date');
  await date.fill('2026/10/20');
  await page.keyboard.press('Enter');
  await date.waitFor({ state: 'detached' });
  assert.equal((await value('安装日期').innerText()).trim(), '2026-10-20');

  // ⑤ 「未填写」里点名字也能就地填（客户质量已填，剩下的里面没有可编辑的就跳过）
  assert.ok(!(await rec.locator('.aui-rsection-fill').first().innerText()).includes('客户质量'), '填了的不再列在未填写里');
  // ⑥ 键盘：编辑按钮在 Tab 顺序里，聚焦时按钮条出现
  await page.mouse.move(2, 2);
  await row('客户质量').getByRole('button', { name: '编辑「客户质量」' }).focus();
  await page.waitForTimeout(250);
  assert.equal(await row('客户质量').locator('.aui-rfield-tools').evaluate((el) => getComputedStyle(el).opacity), '1', '聚焦时按钮条出现');
  await page.keyboard.press('Enter');
  await value('客户质量').getByRole('combobox').waitFor();
  await page.keyboard.press('Escape');
  await value('客户质量').getByRole('combobox').waitFor({ state: 'detached' });
  assert.ok(await rec.isVisible(), '选择框 Esc 不关详情');
}
