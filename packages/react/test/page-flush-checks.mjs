// 8.6 page flush: ordinary pages (card flow) sit edge to edge like a workspace. checkPageFlush() opens a starter page
// (menu entry + optional TabbedPage section) at 1440 light, 1440 dark and 390 and asserts: the first block starts
// right under the tab row (work tabs, or the section tabs when shown), every top-level block is flat (no border, radius,
// shadow) and spans the content area, neighbouring blocks touch with exactly one 1px line between them, tables run
// edge to edge, and no canvas-coloured pixel shows between / around the blocks (real screenshot pixels). Options:
// `title` = the page / section name that must not be repeated as visible text in the content (single-block pages),
// `titles` = block titles that must stay visible (stacked blocks), `noTabs` = a single-section TabbedPage shows no tab
// row, `columns` = a list | detail page: one vertical line between the columns and both reach the bottom.
// Used by test:page-templates (系统 → 页面贴边 / 租户成员 / 单块数量 / 工作区贴边 · 卡片流, T01 / T05 / T06 / T08 / T12),
// test:dashboards (dashboards keep their tiles on a canvas band), test:access (权限控制台) and test:access-governance (权限申请).
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

/** Decodes a PNG screenshot (8-bit RGB / RGBA, not interlaced — what Chromium writes) into { width, height, rgba }. */
export function decodePng(buf) {
  let pos = 8, width = 0, height = 0, channels = 4;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : 3; }
    else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      line[i] = (line[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]) & 255;
    }
    for (let x = 0; x < width; x++) for (let k = 0; k < 4; k++) out[(y * width + x) * 4 + k] = k < channels ? line[x * channels + k] : 255;
    prev = line;
  }
  return { width, height, rgba: out };
}

/** Opens a starter page by its menu name (and a section tab), in the given mode; returns the visible work page. */
export async function openPage(p, url, menu, section, { width = 1440, dark = false } = {}) {
  await p.setViewportSize({ width, height: width > 500 ? 900 : 844 });
  await p.goto(url);
  await p.locator('tbody tr, .aui-table-card').first().waitFor();
  if (dark) await p.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  if (width < 761) { await p.getByRole('button', { name: '打开菜单', exact: true }).click(); await p.waitForTimeout(300); }
  await p.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: menu, exact: true }).click();
  const page = p.locator('.aui-content > :not([hidden])');
  await page.locator('section, .aui-workspace, .aui-listdetail').first().waitFor();
  if (section) await page.getByRole('tab', { name: section, exact: true }).click();
  await p.waitForTimeout(600);
  await p.mouse.move(width - 5, 5);
  return page;
}

/** Geometry of the visible page: content box, the row the content starts under, the top-level blocks and their seams. */
export function pageFlushFacts(p, { title } = {}) {
  return p.evaluate(({ title }) => {
    const r = (el) => el.getBoundingClientRect();
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;
    const visible = (el) => { const b = r(el); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.classList.contains('aui-sr-only'); };
    const name = (el) => `${el.className}`.split(' ').find((c) => c.startsWith('aui-')) ?? el.tagName.toLowerCase();
    const content = document.querySelector('.aui-content');
    const page = content.querySelector(':scope > :not([hidden])');
    const tabbed = page.querySelector('.aui-tabbed-page');
    const tabsRow = tabbed?.querySelector(':scope > .aui-tabbed-tabs-row');
    const root = tabbed ? tabbed.querySelector(':scope > .aui-tabbed-panel:not([hidden])') : page;
    // Top-level blocks: descend through pure stacking wrappers (PageBody, class-less divs), keep the rest.
    // 8.6.1: any element marked data-aui-flow="stack" (a host wrapper with its own class) is a stacking wrapper too.
    const flow = (el) => el.matches('.aui-page-body, .aui-stack, [data-aui-flow=stack]') || (el.tagName === 'DIV' && !el.getAttribute('class'));
    const blocks = [];
    const walk = (el) => { for (const k of el.children) { if (!visible(k) || k.matches('.aui-page-header')) continue; if (flow(k)) walk(k); else blocks.push(k); } };
    walk(root);
    const c = r(content);
    // The row the content starts under: the section tabs when shown, else the work tabs (desktop) or the top bar (phones).
    const above = tabsRow && visible(tabsRow) ? tabsRow : [...document.querySelectorAll('.aui-tabs-strip, .aui-topbar')].filter(visible).sort((x, y) => r(y).bottom - r(x).bottom)[0];
    const probe = document.createElement('div');
    probe.style.background = 'var(--aui-canvas)';
    document.querySelector('.adminui').append(probe);
    const canvas = getComputedStyle(probe).backgroundColor.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    probe.remove();
    const facts = {
      viewport: { w: innerWidth, h: innerHeight },
      overflowX: document.documentElement.scrollWidth - innerWidth,
      content: { left: Math.round(c.left), right: Math.round(c.right) },
      tabsRow: tabsRow ? { visible: visible(tabsRow), bottom: Math.round(r(tabsRow).bottom), lines: px(tabsRow, 'borderBottomWidth'), barMargin: px(tabsRow.querySelector('.aui-section-tabs-bar') ?? tabsRow, 'marginBottom') } : null,
      startBottom: Math.round(r(above).bottom),
      blocks: blocks.map((b) => { const x = r(b); const s = getComputedStyle(b); return { name: name(b), left: Math.round(x.left), right: Math.round(x.right), top: Math.round(x.top), bottom: Math.round(x.bottom), radius: parseFloat(s.borderTopLeftRadius) || 0, shadow: s.boxShadow, bl: px(b, 'borderLeftWidth'), br: px(b, 'borderRightWidth'), bt: px(b, 'borderTopWidth'), bb: px(b, 'borderBottomWidth') }; }),
      // Tables of the top-level blocks (a table inside a split column only reaches that column's edges).
      tables: blocks.filter((b) => b.matches('.aui-resource, .aui-panel')).flatMap((b) => [...b.querySelectorAll(':scope > .aui-table-panel')]).filter(visible).map((t) => ({ left: Math.round(r(t).left), right: Math.round(r(t).right), radius: px(t, 'borderTopLeftRadius'), bl: px(t, 'borderLeftWidth') })),
      canvas,
      dpr: devicePixelRatio,
    };
    if (title) {
      // Visible text that only repeats the page / section name inside the content (the sr-only heading is fine).
      facts.repeats = [...root.querySelectorAll('h1, h2, h3, .aui-panel-title, .aui-panel-header')].filter((el) => visible(el) && el.textContent.trim().replace(/\s*\(\d+\)$/, '') === title).map(name);
      facts.srHeading = [...root.querySelectorAll('h2.aui-sr-only')].some((h) => h.textContent.startsWith(title));
    }
    const cols = root.querySelector('.aui-listdetail, .aui-split, .aui-sidenav-layout, .aui-access-split');
    if (cols) facts.columns = { bottom: Math.round(r(cols).bottom), kids: [...cols.children].filter(visible).map((k) => ({ name: name(k), left: Math.round(r(k).left), right: Math.round(r(k).right), bl: px(k, 'borderLeftWidth'), br: px(k, 'borderRightWidth') })) };
    return facts;
  }, { title });
}

const isTiles = (name) => /kpi|metrics|dash/.test(name);

/** Canvas-coloured pixels at the seams (between blocks, under the tab row) and along the left / right edges. */
export function canvasLeaks(png, facts) {
  const { rgba, width } = png;
  const d = facts.dpr;
  const at = (x, y) => { const i = (Math.round(y * d) * width + Math.round(x * d)) * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
  const isCanvas = (px) => px.every((v, k) => Math.abs(v - facts.canvas[k]) <= 2);
  const leaks = [];
  const xs = (b) => [b.left + 3, (b.left + b.right) / 2, b.right - 4];
  const probe = (label, x, y) => { if (y > 0 && y < facts.viewport.h - 1 && isCanvas(at(x, y))) leaks.push(`${label} @${Math.round(x)},${Math.round(y)}`); };
  const first = facts.blocks[0];
  if (first && !isTiles(first.name)) for (const x of xs(first)) { probe('标签行下', x, facts.startBottom + 1); probe('标签行下', x, facts.startBottom + 3); }
  for (const [i, b] of facts.blocks.entries()) {
    if (isTiles(b.name)) continue;
    const mid = (Math.max(b.top, facts.startBottom) + Math.min(b.bottom, facts.viewport.h)) / 2;
    if (mid > b.top && mid < b.bottom) {
      probe(`${b.name} 左边`, facts.content.left + 1, mid);
      probe(`${b.name} 右边`, facts.content.right - 2, mid);
    }
    const next = facts.blocks[i + 1];
    if (next && !isTiles(next.name)) for (const x of xs(b)) for (const dy of [-2, 0, 2]) probe(`${b.name} ↕ ${next.name}`, x, next.top + dy);
  }
  return leaks;
}

/** The shared assertions of an ordinary (non-workspace) page. */
export function assertPageFlush(facts, label, { noTabs = false } = {}) {
  assert.ok(facts.overflowX <= 0, `${label}：横向溢出 ${facts.overflowX}px`);
  assert.ok(facts.blocks.length > 0, `${label}：页面上有块`);
  if (noTabs) assert.ok(!facts.tabsRow?.visible, `${label}：只有一个分区时不出分区标签行`);
  else if (facts.tabsRow?.visible) {
    assert.equal(facts.tabsRow.lines, 1, `${label}：分区标签行一条底线`);
    assert.equal(facts.tabsRow.barMargin, 0, `${label}：分区标签条下不留缝`);
  }
  const first = facts.blocks[0];
  if (!first.name.match(/inline-alert/)) assert.equal(first.top, facts.startBottom, `${label}：第一块紧贴标签行（标签行底 ${facts.startBottom}，${first.name} 顶 ${first.top}）`);
  for (const b of facts.blocks) {
    if (b.name.match(/inline-alert|aui-note|savebar/)) continue;
    assert.ok(b.left === facts.content.left && b.right === facts.content.right, `${label}：${b.name} 横向贴满内容区（${b.left}–${b.right}，内容区 ${facts.content.left}–${facts.content.right}）`);
    if (isTiles(b.name)) continue;
    assert.ok(b.radius === 0 && b.shadow === 'none' && b.bl === 0 && b.br === 0, `${label}：${b.name} 是平的（r=${b.radius} 阴影=${b.shadow} 左右框=${b.bl}/${b.br}）`);
  }
  for (const [i, b] of facts.blocks.slice(1).entries()) {
    const a = facts.blocks[i];
    if (a.name.match(/inline-alert/) || b.name.match(/inline-alert/)) continue;
    // A transparent wrapper between the two blocks may carry the line itself (its border-top): then the 1px between them
    // is that line (the pixel check below makes sure it is not canvas).
    const gap = b.top - a.bottom;
    const wrapperLine = gap === 1 && a.bb + b.bt === 0 && !isTiles(a.name) && !isTiles(b.name);
    assert.ok(gap === 0 || wrapperLine, `${label}：${a.name} 和 ${b.name} 之间有 ${gap}px 缝`);
    if (isTiles(a.name) && isTiles(b.name)) continue;
    assert.equal(gap + a.bb + b.bt, 1, `${label}：${a.name} 和 ${b.name} 之间应只有一条线（实际 ${gap + a.bb + b.bt}）`);
  }
  for (const t of facts.tables) assert.ok(t.left === facts.content.left && t.right === facts.content.right && t.radius === 0 && t.bl === 0, `${label}：表格贴着内容区两边（${JSON.stringify(t)}）`);
  if (facts.columns) {
    const kids = facts.columns.kids;
    const stacked = kids.length > 1 && kids[1].left === kids[0].left;
    if (!stacked) for (const [i, k] of kids.slice(1).entries()) {
      assert.equal(k.left, kids[i].right, `${label}：${kids[i].name} | ${k.name} 之间没有缝`);
      assert.equal(kids[i].br + k.bl, 1, `${label}：${kids[i].name} | ${k.name} 之间一条竖线`);
    }
  }
}

/** 1440 light, 1440 dark, 390: assertPageFlush + canvas pixel check + extra(p, page, facts, mode) + screenshot. */
export async function checkPageFlush(browser, url, menu, section, output, slug, opts = {}, extra = async () => {}) {
  for (const mode of [{ width: 1440, dark: false }, { width: 1440, dark: true }, { width: 390, dark: false }]) {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    try {
      const page = await openPage(p, url, menu, section, mode);
      const label = `${menu}${section ? ` · ${section}` : ''}（${mode.width}${mode.dark ? ' 深色' : ''}）`;
      const facts = await pageFlushFacts(p, { title: opts.title });
      assertPageFlush(facts, label, opts);
      const file = `${output}/page-flush-${slug}${mode.width < 500 ? '-390' : ''}${mode.dark ? '-dark' : ''}.png`;
      const shot = await p.screenshot({ path: file, animations: 'disabled' });
      assert.deepEqual(canvasLeaks(decodePng(shot), facts), [], `${label}：块之间 / 两边露出灰色画布`);
      if (opts.title) {
        assert.deepEqual(facts.repeats, [], `${label}：内容区里不再重复页面名「${opts.title}」`);
        assert.ok(facts.srHeading, `${label}：标题还在（读屏用的 h2）`);
      }
      for (const t of opts.titles ?? []) assert.ok(await page.locator('.aui-panel-header h2:not(.aui-sr-only)', { hasText: t }).first().isVisible(), `${label}：叠放的块保留标题「${t}」`);
      if (opts.columns && mode.width > 1100) {
        const cols = facts.columns;
        assert.ok(cols && cols.bottom >= facts.viewport.h - 1, `${label}：列表 | 详情撑到窗口底（${cols?.bottom} / ${facts.viewport.h}）`);
      }
      await extra(p, page, facts, { ...mode, label });
      assert.deepEqual(errors, [], `${label}：页面脚本错误`);
    } finally {
      await p.close();
    }
  }
}

/**
 * 8.6.1: toolbar / title rows of the visible page or section that hold nothing but a 「?」 (`help`) or nothing visible at all
 * (`empty`) — both waste a row. Returns the class names of the offending rows.
 */
export function bareRows(p) {
  return p.evaluate(() => {
    const page = document.querySelector('.aui-content > :not([hidden])');
    const root = page.querySelector('.aui-tabbed-panel:not([hidden])') ?? page;
    const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const out = { help: [], empty: [] };
    for (const row of root.querySelectorAll('.aui-panel-header, .aui-resource-filters, .aui-page-header')) {
      if (!shown(row) || row.closest('.aui-dialog, [hidden]')) continue;
      const text = [...row.querySelectorAll('*')].filter((el) => shown(el) && !el.closest('.aui-sr-only') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).length;
      const controls = [...row.querySelectorAll('button, input, select, [role=combobox]')].filter(shown);
      const helps = controls.filter((c) => c.closest('.aui-help-tip'));
      if (!text && controls.length && helps.length === controls.length) out.help.push(row.className);
      else if (!text && !controls.length) out.empty.push(row.className);
    }
    return out;
  });
}
