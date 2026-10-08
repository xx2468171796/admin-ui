import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('..', import.meta.url));
assert.ok(!process.argv[2] || ['go', 'rust'].includes(process.argv[2]), 'optional backend must be go or rust');
const suffix = process.platform === 'win32' ? '.exe' : '';
const output = await mkdtemp(join(tmpdir(), 'adminui-single-service-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true });
const evidence = [];
async function port() {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const value = socket.address().port; await new Promise(resolve => socket.close(resolve)); return value;
}
try {
  for (const [language, source] of [
    ['go', process.env.ADMINUI_GO_BIN || join(root, `examples/single-service/go/tool${suffix}`)],
    ['rust', process.env.ADMINUI_RUST_BIN || join(root, `examples/single-service/rust/target/release/adminui-tool${suffix}`)],
  ]) {
    if (process.argv[2] && process.argv[2] !== language) continue;
    const directory = await mkdtemp(join(output, `${language}-`));
    const binary = join(directory, `tool${suffix}`);
    await cp(resolve(source), binary); // No dist, source tree or Node process accompanies the service.
    const number = await port(); const base = `http://127.0.0.1:${number}`;
    let child; let logs = '';
    const stop = async () => { if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } };
    const start = async () => {
      child = spawn(binary, [], { cwd: directory, env: { ...process.env, PORT: String(number), DB_PATH: join(directory, 'data/tool.sqlite') }, windowsHide: true });
      child.on('error', error => { logs += error.message; });
      child.stderr.on('data', chunk => { logs += chunk; });
      for (let attempt = 0; attempt < 150; attempt++) {
        if (child.exitCode !== null) throw Error(logs);
        try { if ((await fetch(`${base}/api/admin/items`)).ok) return; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw Error(`Service did not start: ${logs}`);
    };
    const request = (path, options) => fetch(`${base}${path}`, options);
    const create = (name, headers = {}) => request('/api/admin/items', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AdminUI-Request': '1', ...headers }, body: JSON.stringify({ name }) });
    try {
      await start();
      assert.deepEqual(await (await request('/api/admin/items')).json(), { rows: [], total: 0 });
      assert.equal((await request('/admin', { redirect: 'manual' })).status, 308);
      const html = await (await request('/admin/')).text();
      const asset = html.match(/src="([^"]+\.js)"/)[1];
      const script = await request(asset); assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/);
      assert.match(script.headers.get('cache-control'), /immutable/);
      for (const path of ['/admin/assets/missing.js', '/api/admin/missing', '/data/tool.sqlite', '/admin/deep-link']) assert.equal((await request(path)).status, 404);
      // fetch may normalize Host; node:http sends the actual hostile authority on the wire.
      assert.equal(await new Promise((resolve, reject) => {
        const req = httpRequest(`${base}/api/admin/items`, {headers:{Host:'attacker.invalid'}}, res => {res.resume(); resolve(res.statusCode);});
        req.on('error', reject); req.end();
      }), 403);
      assert.equal((await create('forbidden', { Origin: 'https://attacker.invalid' })).status, 403);
      assert.equal((await create('forbidden', { 'X-AdminUI-Request': '' })).status, 403);
      assert.equal((await create('   ')).status, 400);
      assert.equal((await create('x'.repeat(81))).status, 400);
      assert.equal((await request('/api/admin/items', { method: 'DELETE' })).status, 405);
      for (const query of ['page=0', 'pageSize=101', 'sort=name%3BDROP%20TABLE%20items', 'direction=oops']) assert.equal((await request(`/api/admin/items?${query}`)).status, 400);
      const literal = "工具'_%中文";
      const created = await create(literal); assert.equal(created.status, 201); assert.equal(typeof (await created.json()).id, 'string');
      assert.equal((await create(literal)).status, 409);
      for (let index = 0; index < 13; index++) assert.equal((await create(`示例工具${String(index).padStart(2, '0')}`)).status, 201);
      const filtered = await (await request(`/api/admin/items?search=${encodeURIComponent(literal)}`)).json(); assert.equal(filtered.total, 1); assert.equal(filtered.rows[0].name, literal);
      const sorted = await (await request('/api/admin/items?sort=name&direction=asc&pageSize=5&page=2')).json(); assert.equal(sorted.total, 14); assert.equal(sorted.rows.length, 5);
      await stop(); await start();
      assert.equal((await (await request('/api/admin/items')).json()).total, 14, 'SQLite survives process restart');
      const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      for (const [index, width] of [360, 390, 1440].entries()) {
        await page.setViewportSize({ width, height: 900 }); await page.goto(`${base}/admin/`);
        // 手机（≤ 760px）上 DataTable 默认是卡片列表，一行一张卡
        const rows = width <= 760 ? '.aui-table-card' : 'tbody tr';
        await page.locator(rows).first().waitFor();
        if (width < 600) { await page.getByRole('button', { name: '打开菜单', exact: true }).click(); await page.getByRole('navigation').getByRole('button', { name: '工具清单' }).click(); await page.getByRole('button', { name: '关闭菜单', exact: true }).waitFor({state:'hidden'}); }
        assert.equal(await page.locator(rows).count(), 10);
        await page.getByRole('button', {name:'下一页',exact:true}).click();
        await page.waitForFunction(([selector, expected]) => document.querySelectorAll(selector).length === expected, [rows, 4 + index]);
        await page.getByRole('button', {name:'上一页',exact:true}).click();
        await page.getByLabel('搜索关键词').fill(literal); await page.getByLabel('搜索关键词').press('Enter');
        await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 1, rows);
        await page.getByRole('button', { name: '新增记录', exact: true }).click(); await page.locator('#item-name').fill(literal);
        await page.getByRole('button', { name: '保存', exact: true }).click(); await page.getByText('名称已存在', {exact:true}).waitFor();
        assert.equal(await page.locator('#item-name').inputValue(), literal);
        await page.locator('#item-name').fill(`手机新增${width}`);
        await page.getByRole('button', { name: '保存', exact: true }).click(); await page.getByRole('dialog').waitFor({state:'hidden'});
        await page.getByLabel('搜索关键词').fill(`手机新增${width}`); await page.getByLabel('搜索关键词').press('Enter');
        await (width <= 760 ? page.locator(rows, { hasText: `手机新增${width}` }).first() : page.getByRole('cell', {name:`手机新增${width}`,exact:true})).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} ${width}px overflow`);
        await page.screenshot({ path: join(output, `${language}-${width}.png`), fullPage: true });
      }
      assert.deepEqual(errors, []); await page.close();
      evidence.push({language, api: 'pass', persistence: 'pass', standaloneBinary: 'pass', viewports: [360,390,1440]});
    } finally { await stop(); }
  }
} finally { await browser.close(); }
await writeFile(join(output, 'results.json'), JSON.stringify(evidence, null, 2));
console.log(`PASS ${evidence.map(row => row.language).join('/')} single-service API, SQLite persistence and mobile UI: ${output}`);
