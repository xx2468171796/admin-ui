// WorkspaceLayout narrow="card" | "flush", Breadcrumbs separator spacing and the .aui-neutral-text document area.
// Used by test:page-templates (系统 → 工作区贴边: 客户表 = default card, 文档 = narrow="flush" + Breadcrumbs + neutral
// text) and test:design (Breadcrumbs on 后台工作流).
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { assertFlush, flushFacts, openFlush } from './flush-checks.mjs';

/**
 * Gaps between each slash and the crumb text on its left / right (text boxes, not element boxes, so a link button's
 * padding would show up), plus the accessible text of the nav.
 */
export async function crumbGaps(nav) {
  const gaps = await nav.evaluate((el) => {
    const textBox = (node) => { const range = document.createRange(); range.selectNodeContents(node); return range.getBoundingClientRect(); };
    // 分隔是小箭头（svg，aria-hidden），量图标自己的框
    // 手机上面包屑只留「← 上一级」（分隔藏起来）：只量看得见的分隔
    return [...el.querySelectorAll(':scope > .aui-crumb-sep')].filter((sep) => sep.getBoundingClientRect().width > 0).map((sep) => {
      const s = sep.getBoundingClientRect();
      return { left: s.left - textBox(sep.previousElementSibling).right, right: textBox(sep.nextElementSibling).left - s.right, hidden: sep.getAttribute('aria-hidden'), sameRow: Math.abs(textBox(sep.previousElementSibling).top - textBox(sep.nextElementSibling).top) < 2 };
    });
  });
  return { gaps, aria: await nav.ariaSnapshot() };
}

/** Breadcrumb invariants: one aria-hidden slash between crumbs, the same gap on both sides, no slash read out. */
export async function assertCrumbs(nav, label) {
  const { gaps, aria } = await crumbGaps(nav);
  const back = await nav.locator('.aui-crumb-back').isVisible().catch(() => false);
  assert.ok(gaps.length >= 1 || back, `${label}：面包屑有分隔符（手机上是「← 上一级」）`);
  for (const [i, g] of gaps.entries()) {
    assert.equal(g.hidden, 'true', `${label}：第 ${i + 1} 个斜杠 aria-hidden`);
    if (!g.sameRow) continue;
    assert.ok(g.left >= 3 && g.right >= 3, `${label}：斜杠两边都有间距（左 ${g.left.toFixed(1)} / 右 ${g.right.toFixed(1)}）`);
    assert.ok(Math.abs(g.left - g.right) <= 1, `${label}：斜杠左右间距相等（左 ${g.left.toFixed(1)} / 右 ${g.right.toFixed(1)}）`);
  }
  assert.ok(!aria.includes('/'), `${label}：读屏不读斜杠（${aria}）`);
  assert.equal(await nav.locator('[aria-current=page]').count(), 1, `${label}：当前页 aria-current=page`);
}

/** Text colours inside / outside the 文档 section's .aui-neutral-text areas (normalised to rgb). */
function neutralFacts(p) {
  return p.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    const rgb = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const lum = (v) => v.map((x) => x / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y); return (hi + 0.05) / (lo + 0.05); };
    const root = document.querySelector('.adminui');
    const token = (name) => rgb(getComputedStyle(root).getPropertyValue(name).trim());
    const panel = document.querySelector('#aui-page-flush .aui-tabbed-panel:not([hidden])');
    const body = panel.querySelector('[data-demo=doc-body]');
    const surface = rgb(getComputedStyle(panel.querySelector('.aui-pane')).backgroundColor);
    const color = (el) => rgb(getComputedStyle(el).color);
    const steps = [...panel.querySelectorAll('[data-demo=neutral-steps] > div')].map(color);
    return {
      neutral: [1, 2, 3, 4].map((i) => token(`--aui-neutral-${i}`)),
      text: token('--aui-text'),
      body: color(body), note: color(body.querySelector('.aui-note')), title: color(body.querySelector('h2')),
      steps, ratios: steps.map((c) => ratio(c, surface)),
    };
  });
}

/** 390 / 900 × light / dark: 客户表 keeps the bordered card, 文档 (narrow="flush") sits edge to edge; screenshots. */
export async function checkNarrowModes(browser, url, output) {
  for (const width of [390, 900]) {
    for (const dark of [false, true]) {
      for (const [section, mode] of [['客户表', 'card'], ['文档', 'flush']]) {
        const p = await browser.newPage();
        const errors = [];
        p.on('pageerror', (e) => errors.push(e.message));
        try {
          const area = await openFlush(p, url, section, { width, dark });
          const label = `窄屏 ${mode}（${section} ${width}${dark ? ' 深色' : ''}）`;
          const facts = await flushFacts(p);
          assertFlush(facts, label, { wide: false });
          const geo = await p.evaluate(() => {
            const content = document.querySelector('#aui-page-flush').closest('.aui-content').getBoundingClientRect();
            const ws = document.querySelector('#aui-page-flush .aui-tabbed-panel:not([hidden]) .aui-workspace');
            return { contentLeft: Math.round(content.left), contentRight: Math.round(content.right), narrow: ws.dataset.narrow ?? null, panes: [...ws.children].map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left), right: Math.round(r.right) }; }) };
          });
          const ws = facts.workspace;
          assert.ok(facts.cols.length >= 2, `${label}：上下排至少两栏`);
          for (const [i, pane] of geo.panes.entries()) assert.ok(pane.x === ws.left + ws.border && pane.right === ws.right - ws.border, `${label}：第 ${i + 1} 栏占满工作区宽（${pane.x}–${pane.right}，工作区 ${ws.left}–${ws.right}）`);
          if (mode === 'card') {
            assert.equal(geo.narrow, null, `${label}：默认不加 data-narrow`);
            assert.ok(facts.contentPadding > 0, `${label}：卡片模式外壳内容区保留内边距`);
            assert.ok(ws.radius > 0 && ws.border === 1, `${label}：卡片模式有外框和圆角（r=${ws.radius} b=${ws.border}）`);
          } else {
            assert.equal(geo.narrow, 'flush', `${label}：data-narrow=flush`);
            assert.equal(facts.contentPadding, 0, `${label}：外壳内容区没有内边距`);
            assert.ok(ws.radius === 0 && ws.border === 0, `${label}：没有外框和圆角（r=${ws.radius} b=${ws.border}）`);
            assert.ok(ws.left === geo.contentLeft && ws.right === geo.contentRight, `${label}：工作区贴着内容区左右边（${ws.left}–${ws.right}，内容区 ${geo.contentLeft}–${geo.contentRight}）`);
            assert.equal(ws.top, facts.tabsBottom, `${label}：工作区紧贴分区标签条`);
            assert.equal(facts.tabsBarMargin, 0, `${label}：分区标签条下不留缝`);
            assert.equal(facts.tabsLines, 1, `${label}：分区标签行只有一条底线`);
            const doc = await p.evaluate(() => {
              const ws = document.querySelector('#aui-page-flush .aui-tabbed-panel:not([hidden]) .aui-workspace');
              const panes = [...ws.querySelectorAll(':scope > .aui-pane')].map((x) => getComputedStyle(x).maxHeight);
              return { bg: getComputedStyle(ws).backgroundColor, surface: getComputedStyle(document.querySelector('.adminui')).getPropertyValue('--aui-surface').trim(), panes, bottom: Math.round(ws.getBoundingClientRect().bottom), fill: parseFloat(getComputedStyle(ws).minHeight) || 0, top: Math.round(ws.getBoundingClientRect().top) };
            });
            assert.ok(doc.panes.every((m) => m === 'none'), `${label}：贴边模式栏不限高（${doc.panes.join(',')}）`);
            assert.ok(doc.bg !== 'rgba(0, 0, 0, 0)' && doc.bg !== 'transparent', `${label}：贴边模式工作区铺底色（${doc.bg}）`);
            assert.ok(doc.bottom - doc.top >= Math.floor(doc.fill), `${label}：工作区至少铺到可用高度（${doc.bottom - doc.top} / ${doc.fill}）`);
            assert.ok(facts.tabsLeft === geo.contentLeft && facts.tabsRight === geo.contentRight, `${label}：分区标签行贴着内容区左右边`);
            await assertCrumbs(area.locator('.aui-tabbed-panel:not([hidden]) nav[aria-label="面包屑"]'), label);
            const n = await neutralFacts(p);
            assert.deepEqual(n.body, n.neutral[0], `${label}：文档正文用中性 1`);
            assert.deepEqual(n.title, n.neutral[0], `${label}：文档标题用中性 1`);
            assert.deepEqual(n.note, n.neutral[1], `${label}：文档里的备注用中性 2`);
            assert.deepEqual(n.steps, n.neutral, `${label}：灰阶示例四级`);
            assert.ok(n.ratios[0] >= 7 && n.ratios[1] >= 4.5 && n.ratios[2] >= 3, `${label}：中性灰对比度 ${n.ratios.map((r) => r.toFixed(2)).join(' / ')}`);
            assert.notDeepEqual(n.text, n.neutral[0], `${label}：文档区外的正文色不变（带主色调）`);
          }
          await p.screenshot({ path: resolve(output, `narrow-${mode}-${width}${dark ? '-dark' : ''}.png`), animations: 'disabled', fullPage: true });
          assert.deepEqual(errors, [], `${label}：页面脚本错误`);
        } finally {
          await p.close();
        }
      }
    }
  }
}
