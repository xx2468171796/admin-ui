// Browser check (8.10): no white flash for dark users, before or after hydration; a11y states render in a real browser.
//   node test/theme-boot.mjs   (PLAYWRIGHT_CHROMIUM_PATH / CHROMIUM_PATH pick the browser; screenshots → test/artifacts/theme-boot/)
// 1. client-only page: the stored mode / palette is on the FIRST committed .adminui (8.9 committed light, then switched in an effect);
// 2. SSR HTML + adminThemeBootScript, no JS app at all: the root is already dark / ocean (script before or after the root, and "system");
// 3. focus ring, switch, checkbox in light / dark / forced colours; spinner pulses under reduced motion.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('./artifacts/theme-boot/', import.meta.url));
mkdirSync(out, { recursive: true });
const server = await createServer({ root, configFile: false, plugins: [react()], server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null } });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROMIUM_PATH || chromium.executablePath() });
const stored = (values) => (entries) => { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v); };
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];

  // 1. client-only first frame
  {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('boot-test:mode', 'dark');
      localStorage.setItem('boot-test:palette', 'ocean');
      // records carry the old value, so a light → dark switch is seen even when both land before the callback runs
      window.__changes = [];
      new MutationObserver((records) => {
        for (const r of records) if (r.type === 'attributes' && r.target.classList.contains('adminui')) window.__changes.push(`${r.attributeName}: ${r.oldValue} → ${r.target.getAttribute(r.attributeName)}`);
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-aui-mode', 'data-aui-palette'], attributeOldValue: true });
    });
    await page.goto(base + 'test/theme-boot.html');
    await page.locator('.adminui .aui-button').waitFor();
    await page.waitForTimeout(300);
    const changes = await page.evaluate(() => window.__changes);
    const now = await page.locator('.adminui').evaluate((el) => `${el.getAttribute('data-aui-mode')}/${el.getAttribute('data-aui-palette')}`);
    assert.equal(now, 'dark/ocean');
    assert.deepEqual(changes, [], 'the root is inserted already dark / ocean — never re-themed after the first commit');
    assert.deepEqual(errors, []);
    await page.close();
  }

  // 2. SSR + boot script, no hydration
  const ssr = await server.ssrLoadModule('/src/index.ts');
  const { renderToString } = await import('react-dom/server');
  const { createElement } = await import('react');
  const html = renderToString(createElement(ssr.AdminProvider, { storageKey: 'boot-test', palette: 'forest', mode: 'system' }, createElement('p', null, 'server')));
  assert.match(html, /data-aui-mode="light"/, 'the server renders the defaults');
  const { createPalette, PALETTES } = await server.ssrLoadModule('/src/palette.ts');
  const ocean = createPalette(PALETTES[1], 'dark').vars;
  for (const where of ['head', 'after-root']) {
    for (const [scheme, store, want] of [['light', { 'boot-test:mode': 'dark', 'boot-test:palette': 'ocean' }, 'dark'], ['dark', {}, 'dark'], ['light', {}, 'light']]) {
      const page = await browser.newPage({ colorScheme: scheme });
      await page.addInitScript(stored(), store);
      const boot = `<script>${ssr.adminThemeBootScript('boot-test', { palette: 'forest', mode: 'system' })}</script>`;
      const doc = `<!doctype html><html><head>${where === 'head' ? boot : ''}<link rel="stylesheet" href="${base}src/styles.css"></head><body style="margin:0"><div id="root">${html}</div>${where === 'after-root' ? boot : ''}</body></html>`;
      await page.route('http://boot.test/', (route) => route.fulfill({ contentType: 'text/html', body: doc }));
      await page.goto('http://boot.test/');
      const got = await page.evaluate(() => { const el = document.querySelector('.adminui'); return { mode: el.getAttribute('data-aui-mode'), surface: el.style.getPropertyValue('--aui-surface') }; });
      assert.equal(got.mode, want, `${where} · system ${scheme} · ${JSON.stringify(store)}`);
      if (store['boot-test:palette']) assert.equal(got.surface, ocean.surface, 'stored palette painted before hydration');
      await page.close();
    }
  }

  // 3. focus ring / switch / checkbox screenshots; reduced-motion spinner
  for (const mode of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 760, height: 120 } });
    await page.addInitScript(stored(), { 'boot-test:mode': mode });
    await page.goto(base + 'test/theme-boot.html');
    await page.locator('.adminui .aui-button').waitFor();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    const ring = await page.locator('.aui-button').evaluate((el) => getComputedStyle(el).boxShadow);
    assert.match(ring, /0px 0px 0px 4px/, `${mode}: focused button shows the 4px outer ring (${ring})`);
    await page.screenshot({ path: `${out}${mode}-focus-button.png` });
    await page.locator('.aui-switch').first().focus();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}${mode}-focus-switch.png` });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 760, height: 120 } });
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(base + 'test/theme-boot.html');
    await page.locator('.adminui .aui-button').waitFor();
    const thumb = await page.locator('.aui-switch:not([data-state=checked]) .aui-switch-thumb').evaluate((el) => getComputedStyle(el).forcedColorAdjust);
    assert.equal(thumb, 'none', 'forced colours: the switch thumb keeps its CanvasText fill');
    await page.keyboard.press('Tab');
    await page.screenshot({ path: `${out}forced-colors.png` });
    await page.close();
  }
  {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.goto(base + 'test/theme-boot.html');
    await page.locator('.adminui .aui-spinner').waitFor();
    assert.equal(await page.locator('.aui-spinner').evaluate((el) => getComputedStyle(el).animationName), 'aui-busy-pulse', 'reduced motion: the spinner pulses, not frozen');
    await page.close();
  }
  console.log(`PASS theme-boot: first frame, SSR boot script, focus ring, forced colours, reduced motion (${out})`);
} finally {
  await browser.close();
  await server.close();
}
