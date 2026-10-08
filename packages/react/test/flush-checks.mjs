// bt/flush: shared checks for the starter page 「工作区贴边」 (examples/starter/src/FlushWorkspaceShowcase.tsx).
// A TabbedPage whose sections are full-height workspaces (WorkspaceLayout + Pane) plus one card-flow section.
// test:page-templates / test:views / test:access / test:records / test:form-builder each open their own section
// and call flushFacts(): no gap between the tab bar, the sidebar, the columns and the window edge, exactly one line
// between columns, no rounded / shadowed card inside the workspace, no doubled lines between stacked blocks.
import assert from 'node:assert/strict';

/** Blocks that sit flush inside a workspace: never rounded, never shadowed. */
export const FLAT = ['.aui-pane', '.aui-table-panel', '.aui-resource', '.aui-grid-panel', '.aui-query', '.aui-fb', '.aui-gallery-view', '.aui-taccess-roles', '.aui-taccess-scope', '.aui-taccess-fields', '.aui-access-profile', '.aui-rhead'];
/** Block-level pieces whose borders the double-line check looks at. */
const BLOCKS = /^aui-(pane|pane-head|pane-body|pane-notice|query|table-panel|table-toolbar|table-scroll|pagination|resource|panel-header|resource-filters|resource-feedback|grid-toolbar|grid-panel|gallery-view|fb|fb-top|fb-cols|taccess|taccess-bar|taccess-impact|taccess-body|taccess-roles|scard|access-profile|access-effective|access-filters|rhead|tabbed-tabs-row|section-tabs-bar|inline-alert)$/;

/** Opens 系统 → 工作区贴边 (once per page load) and the given section tab. */
export async function openFlush(p, url, section, { width = 1440, dark = false } = {}) {
  await p.setViewportSize({ width, height: width > 500 ? 900 : 844 });
  await p.goto(url);
  await p.locator('tbody tr, .aui-table-card').first().waitFor(); // 手机上 DataTable 是卡片
  if (dark) await p.getByRole('button', { name: '切换到深色模式', exact: true }).click();
  if (width < 761) { await p.getByRole('button', { name: '打开菜单', exact: true }).click(); await p.waitForTimeout(300); }
  await p.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '工作区贴边', exact: true }).click();
  const page = p.locator('#aui-page-flush');
  await page.locator('.aui-tabbed-page').waitFor();
  await page.getByRole('tab', { name: section, exact: true }).click();
  if (section !== '卡片流') await page.locator('.aui-tabbed-panel:not([hidden]) .aui-workspace').waitFor();
  await p.waitForTimeout(500);
  await p.mouse.move(width - 5, 5);
  return page;
}

/** Geometry and style facts of the visible section of the 工作区贴边 page. */
export function flushFacts(p) {
  return p.evaluate(({ flat, blocks }) => {
    const BLOCK = new RegExp(blocks);
    const page = document.querySelector('#aui-page-flush');
    const panel = page.querySelector('.aui-tabbed-panel:not([hidden])');
    const ws = panel.querySelector('.aui-workspace');
    const rect = (el) => el.getBoundingClientRect();
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;
    const visible = (el) => { const r = rect(el); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const name = (el) => `${el.className}`.split(' ').find((c) => c.startsWith('aui-')) ?? el.tagName.toLowerCase();
    const row = page.querySelector('.aui-tabbed-tabs-row');
    const content = page.closest('.aui-content');
    const facts = {
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      contentPadding: content ? px(content, 'paddingLeft') + px(content, 'paddingTop') : null,
      tabsBottom: Math.round(rect(row).bottom),
      tabsLeft: Math.round(rect(row).left),
      tabsRight: Math.round(rect(row).right),
      tabsBarMargin: px(row.querySelector('.aui-section-tabs-bar'), 'marginBottom'),
      tabsLines: [row, row.querySelector('.aui-section-tabs-bar')].filter((el) => px(el, 'borderBottomWidth') > 0).length,
      sidebarRight: Math.round(rect(document.querySelector('.aui-sidebar')).right),
      viewport: { w: innerWidth, h: innerHeight },
    };
    if (!ws) return facts;
    const w = rect(ws);
    const cols = [...ws.children].filter(visible);
    facts.workspace = { top: Math.round(w.top), left: Math.round(w.left), right: Math.round(w.right), bottom: Math.round(w.bottom), radius: px(ws, 'borderTopLeftRadius'), border: px(ws, 'borderTopWidth') };
    // Stacked screens with a Pane fill: the space left on the page under the card (should be only the content padding).
    const fillPane = ws.querySelector(':scope > .aui-pane[data-fill]');
    if (fillPane) facts.fill = { below: document.documentElement.scrollHeight - (w.bottom + scrollY), contentPadBottom: content ? px(content, 'paddingBottom') : 0, paneBottom: rect(fillPane).bottom, wsInnerBottom: w.bottom - px(ws, 'borderBottomWidth'), last: fillPane === [...ws.children].filter(visible).at(-1) };
    facts.cols = cols.map((c) => { const r = rect(c); return { name: name(c), x: r.left, right: r.right, top: r.top, bottom: r.bottom, bl: px(c, 'borderLeftWidth'), br: px(c, 'borderRightWidth'), bt: px(c, 'borderTopWidth') }; });
    // Gaps / overlaps between neighbouring columns and how many lines separate them.
    facts.seams = cols.slice(1).map((c, i) => {
      const a = rect(cols[i]); const b = rect(c);
      const stacked = Math.abs(a.left - b.left) < 1;
      return stacked
        ? { gap: Math.round(b.top - a.bottom), lines: px(cols[i], 'borderBottomWidth') + px(c, 'borderTopWidth') }
        : { gap: Math.round(b.left - a.right), lines: px(cols[i], 'borderRightWidth') + px(c, 'borderLeftWidth') };
    });
    facts.rounded = [...ws.querySelectorAll(flat.join(','))].filter(visible)
      .filter((el) => px(el, 'borderTopLeftRadius') > 0 || px(el, 'borderBottomRightRadius') > 0 || getComputedStyle(el).boxShadow !== 'none')
      .map((el) => `${name(el)} r=${getComputedStyle(el).borderRadius} s=${getComputedStyle(el).boxShadow}`);
    // Two lines on top of each other: a block's bottom line touching the next block's top line, or a parent's
    // bottom line under a last child that has its own bottom line (and the same for top lines).
    const doubles = [];
    for (const el of ws.querySelectorAll('*')) {
      if (!visible(el) || ![...el.classList].some((c) => BLOCK.test(c))) continue;
      const r = rect(el);
      const next = [...el.parentElement.children].slice([...el.parentElement.children].indexOf(el) + 1).find(visible);
      if (next && px(el, 'borderBottomWidth') > 0 && px(next, 'borderTopWidth') > 0 && Math.abs(rect(next).top - r.bottom) < 1 && Math.abs(rect(next).left - r.left) < 2) doubles.push(`${name(el)} ↕ ${name(next)}`);
      for (const kid of [...el.children].filter(visible)) {
        if (px(el, 'borderBottomWidth') > 0 && px(kid, 'borderBottomWidth') > 0 && Math.abs(rect(kid).bottom - (r.bottom - px(el, 'borderBottomWidth'))) < 1) doubles.push(`${name(el)} ⊔ ${name(kid)}`);
        if (px(el, 'borderTopWidth') > 0 && px(kid, 'borderTopWidth') > 0 && Math.abs(rect(kid).top - (r.top + px(el, 'borderTopWidth'))) < 1) doubles.push(`${name(el)} ⊓ ${name(kid)}`);
      }
    }
    facts.doubles = doubles;
    return facts;
  }, { flat: FLAT, blocks: BLOCKS.source });
}

/** The shared assertions; `label` names the section in failure messages. */
export function assertFlush(facts, label, { wide = true } = {}) {
  assert.ok(facts.overflowX <= 0, `${label}：横向溢出 ${facts.overflowX}px`);
  assert.deepEqual(facts.rounded, [], `${label}：工作区里还有圆角 / 阴影卡片`);
  assert.deepEqual(facts.doubles, [], `${label}：两条线叠在一起`);
  for (const [i, seam] of facts.seams.entries()) {
    assert.equal(seam.gap, 0, `${label}：第 ${i + 1} / ${i + 2} 栏之间有 ${seam.gap}px 缝`);
    assert.equal(seam.lines, 1, `${label}：第 ${i + 1} / ${i + 2} 栏之间应只有一条线（实际 ${seam.lines}）`);
  }
  if (!wide) {
    // 窄屏上下排：有 Pane fill 的工作区（卡片）到外壳内容区底，下面除了内容区内边距没有灰条；撑满的栏是最后一栏时长到卡片底。
    if (facts.fill) {
      assert.ok(Math.abs(facts.fill.below - facts.fill.contentPadBottom) <= 1, `${label}：卡片下面只留内容区内边距 ${facts.fill.contentPadBottom}px（实际 ${facts.fill.below}px，灰条）`);
      if (facts.fill.last) assert.ok(Math.abs(facts.fill.paneBottom - facts.fill.wsInnerBottom) <= 1, `${label}：Pane fill 长到卡片底（栏底 ${facts.fill.paneBottom}，卡片底 ${facts.fill.wsInnerBottom}）`);
    }
    return;
  }
  assert.ok(facts.overflowY <= 0, `${label}：整页不能滚（多出 ${facts.overflowY}px）`);
  assert.equal(facts.contentPadding, 0, `${label}：外壳内容区内边距应为 0`);
  assert.equal(facts.tabsBarMargin, 0, `${label}：分区标签条下不留缝`);
  assert.equal(facts.tabsLines, 1, `${label}：分区标签行只有一条底线`);
  assert.equal(facts.tabsLeft, facts.sidebarRight, `${label}：分区标签行贴着侧栏`);
  assert.equal(facts.tabsRight, facts.viewport.w, `${label}：分区标签行到窗口右边`);
  const ws = facts.workspace;
  assert.equal(ws.top, facts.tabsBottom, `${label}：工作区紧贴分区标签条（标签条底 ${facts.tabsBottom}，工作区顶 ${ws.top}）`);
  assert.equal(ws.left, facts.sidebarRight, `${label}：工作区贴着侧栏`);
  assert.equal(ws.right, facts.viewport.w, `${label}：工作区贴到窗口右边`);
  assert.ok(Math.abs(ws.bottom - facts.viewport.h) <= 1, `${label}：工作区到窗口底（底边 ${ws.bottom}）`);
  for (const col of facts.cols) assert.ok(Math.abs(col.top - ws.top) <= 1 && Math.abs(col.bottom - ws.bottom) <= 1, `${label}：${col.name} 一栏从上到下撑满（${col.top}–${col.bottom}）`);
}

/** Edges of an element, rounded; `ix` / `iright` = inside its left / right border (where flush children start / end). */
export const edges = (locator) => locator.first().evaluate((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); const bl = parseFloat(s.borderLeftWidth) || 0; const br = parseFloat(s.borderRightWidth) || 0; return { x: Math.round(r.left), ix: Math.round(r.left + bl), iright: Math.round(r.right - br), y: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(s.borderTopLeftRadius) || 0, shadow: s.boxShadow, bl: parseFloat(s.borderLeftWidth) || 0, bb: parseFloat(s.borderBottomWidth) || 0, pl: parseFloat(s.paddingLeft) || 0, image: s.backgroundImage, scroll: el.scrollHeight - el.clientHeight }; });

/**
 * One section at 1440 light, 1440 dark and 390: shared flush assertions + `extra(p, page, mode)` + a screenshot
 * `${output}/flush-${slug}[-dark|-390].png`. A fresh page per run; page errors fail the run.
 */
export async function checkFlushSection(browser, url, section, output, slug, extra = async () => {}) {
  for (const mode of [{ width: 1440, dark: false }, { width: 1440, dark: true }, { width: 390, dark: false }]) {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    try {
      const page = await openFlush(p, url, section, mode);
      const label = `${section}（${mode.width}${mode.dark ? ' 深色' : ''}）`;
      assertFlush(await flushFacts(p), label, { wide: mode.width > 1100 });
      await extra(p, page, { ...mode, label });
      await p.screenshot({ path: `${output}/flush-${slug}${mode.width < 500 ? '-390' : ''}${mode.dark ? '-dark' : ''}.png`, animations: 'disabled' });
      assert.deepEqual(errors, [], `${label}：页面脚本错误`);
    } finally {
      await p.close();
    }
  }
}
