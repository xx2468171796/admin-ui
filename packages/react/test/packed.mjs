import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build, createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
// npm is a .cmd launcher on Windows; spawnSync('npm') cannot execute it.
const npmCli = process.env.npm_execpath || (process.platform === 'win32'
  ? join(dirname(execFileSync('where.exe', ['npm.cmd'], {encoding:'utf8'}).trim().split(/\r?\n/)[0]), 'node_modules/npm/bin/npm-cli.js')
  : null);
const npm = (args, options) => npmCli ? execFileSync(process.execPath, [npmCli, ...args], options) : execFileSync('npm', args, options);
// Canonicalize Windows 8.3 TEMP paths before Vite creates its HTML proxy module ids.
const destination = await realpath(await mkdtemp(join(tmpdir(), 'adminui-pack-')));
const pack = JSON.parse(npm([
  'pack', root, '--json', '--pack-destination', destination,
], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }))[0];
const packageName = pack.filename;
const packagedFiles = pack.files.map(file => file.path).join('\n');
assert.doesNotMatch(packagedFiles, /node_modules|\/dist\/|\.vite\//);
assert.match(packagedFiles, /skills\/admin-ui\/SKILL\.md/);
assert.match(packagedFiles, /AI-RULES\.md/);
assert.ok(!pack.files.some((file) => file.path.startsWith('design')), 'review material (the design folder) is not published');
for (const path of ['scripts/ui-audit.mjs', 'scripts/ui-audit.d.mts'])
  assert.ok(pack.files.some(file => file.path === path), `missing audit tool file: ${path}`);
assert.equal(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).bin['admin-ui-audit'], 'scripts/ui-audit.mjs');
for (const doc of ['README', 'INTEGRATION', 'DESIGN', 'TABLES', 'GRID', 'ACCESS', 'DASHBOARDS', 'AGENTS', 'THIRD-PARTY'])
  assert.ok(packagedFiles.split('\n').includes(`${doc}.md`), `missing doc: ${doc}.md`);
assert.match(packagedFiles, /examples\/starter\/src\/MotionShowcase\.tsx/);
assert.match(packagedFiles, /examples\/starter\/src\/WorkflowShowcase\.tsx/);
assert.match(packagedFiles, /WORKFLOWS\.md/);
for (const path of ['src/grid.tsx', 'src/grid-core.ts', 'src/grid-engine.ts', 'src/record-expand.tsx', 'examples/starter/src/BitableShowcase.tsx'])
  assert.ok(packagedFiles.split('\n').includes(path), `missing grid file: ${path}`);
for (const path of ['src/access/index.ts', 'src/access/contracts.ts', 'src/access/tree-core.ts', 'src/access/permission-matrix.tsx', 'src/access/audit-diff.tsx', 'examples/starter/src/AccessShowcase.tsx', 'src/access/governance/index.ts', 'src/access/governance/api.ts', 'examples/starter/src/GovernanceAccessShowcase.tsx', 'CHANGELOG.md'])
  assert.ok(packagedFiles.split('\n').includes(path), `missing access file: ${path}`);
for (const path of ['ACCESS.md', 'src/governance.tsx', 'src/governance-core.ts', 'examples/governance/sqlite-store.mjs', 'examples/governance/README.md', 'examples/starter/src/governance-demo.ts'])
  assert.ok(packagedFiles.split('\n').includes(path), `missing governance contract or example: ${path}`);
const starter = join(destination, 'starter');
await cp(resolve(root, 'examples/starter'), starter, { recursive: true });
await cp(join(destination, packageName), join(destination, 'adminui-sdk.tgz'));
npm(['install', '--no-audit', '--no-fund'], {
  cwd: starter, stdio: 'pipe', timeout: 300_000, maxBuffer: 8 * 1024 * 1024,
});
npm(['run', 'build'], {
  cwd: starter, stdio: 'pipe', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
});
const installed = JSON.parse(await readFile(join(starter, 'node_modules/@adminui/react/package.json'), 'utf8'));
assert.equal(installed.version, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version);
// The drift gate ships as a bin and the starter passes it from the installed package.
assert.ok(existsSync(join(starter, 'node_modules/.bin', process.platform === 'win32' ? 'admin-ui-audit.cmd' : 'admin-ui-audit')), 'bin admin-ui-audit is linked');
execFileSync(process.execPath, [join(starter, 'node_modules/@adminui/react/scripts/ui-audit.mjs'), join(starter, 'src')], { stdio: 'pipe' });
for (const path of ['go/main.go', 'go/go.sum', 'rust/src/main.rs', 'rust/Cargo.lock', 'web/src/api.ts', 'README.md', 'AGENTS.md'])
  assert.ok(packagedFiles.includes(`examples/single-service/${path}`), `missing single-service example: ${path}`);
// Prove another AI can prepare the new example using only an installed package.
const isolatedSdk = join(starter, 'node_modules/@adminui/react');
npm(['run', 'prepare:single-service'], { cwd: isolatedSdk, stdio: 'pipe', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
const example = join(isolatedSdk, 'examples/single-service');
assert.equal(await readFile(join(example, 'web/dist/index.html'), 'utf8'), await readFile(join(example, 'go/web/dist/index.html'), 'utf8'));
assert.equal(installed.exports['./styles.css'].default, './src/styles.css');
// 2026-10 起 TS 入口分发编译产物（scripts/build-dist.mjs）：types / default 指 dist，source 指回源码
assert.deepEqual(installed.exports['./grid'], { types: './dist/src/grid.d.ts', source: './src/grid.tsx', default: './dist/src/grid.js' });
assert.deepEqual(installed.exports['./access'], { types: './dist/src/access/index.d.ts', source: './src/access/index.ts', default: './dist/src/access/index.js' });
assert.ok(existsSync(join(starter, 'node_modules/@adminui/react/dist/src/grid.js')), 'dist ships in the package');

// ./vite (Node only): adminUiLocale zh-Hant rewrites the kit's own text in the build, never the host's.
assert.deepEqual(installed.exports['./vite'], { types: './dist/src/vite.d.ts', source: './src/vite.ts', default: './dist/src/vite.js' });
npm(['install', '--no-save', '--no-audit', '--no-fund', 'opencc-js@1.4.2'], { cwd: starter, stdio: 'pipe', timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
const { adminUiLocale } = await import(pathToFileURL(join(starter, 'node_modules/@adminui/react/dist/src/vite.js')).href);
await build({ root: starter, configFile: join(starter, 'vite.config.ts'), logLevel: 'silent', plugins: [adminUiLocale({ locale: 'zh-Hant' })], build: { outDir: 'dist-zh-hant', emptyOutDir: true } });
const unescape = (text) => text.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
const bundleText = async (dir) => (await Promise.all((await readdir(dir, { recursive: true })).filter((f) => /\.(js|css)$/.test(f)).map((f) => readFile(join(dir, f), 'utf8')))).map(unescape).join('\n');
const simplified = await bundleText(join(starter, 'dist'));
const traditional = await bundleText(join(starter, 'dist-zh-hant'));
assert.ok(simplified.includes('带 * 的为必填项') && !simplified.includes('標 * 為必填'), 'no plugin: the kit text is as written');
assert.ok(traditional.includes('標 * 為必填') && !traditional.includes('带 * 的为必填项'), 'zh-Hant: FormDialog footer converted');
assert.ok(traditional.includes('送出中…') && !traditional.includes('提交中…'), 'zh-Hant: busy text converted');
assert.ok(traditional.includes('项目适配层负责账号权限和保存接口'), 'zh-Hant: host text stays as written');

const server = await createServer({ root: join(starter, 'dist'), configFile: false, server: { host: '127.0.0.1', port: 7100 + Math.floor(Math.random() * 600), hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  const cached = '/home/admin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
  const browserPath = process.env.CHROMIUM_PATH || (existsSync(cached) ? cached : chromium.executablePath());
  browser = await chromium.launch({ headless: true, executablePath: browserPath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('tbody tr[data-row-key]').first().waitFor();
  assert.equal(await page.locator('tbody tr[data-row-key]').count(), 10);
  assert.equal(await page.locator('.adminui').evaluate(node => getComputedStyle(node).getPropertyValue('--aui-primary')), '#357450');
  // 5.0 look by default: palette-tinted sidebar rail and 36px controls without opting in.
  assert.equal(await page.locator('.aui-sidebar').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(30, 58, 54)');
  assert.equal(await page.getByRole('button', { name: '新增用户' }).evaluate(node => getComputedStyle(node).height), '36px');
  await page.getByRole('button', { name: '新增用户' }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('navigation').getByRole('button',{name:'动效示例',exact:true}).click();
  await page.getByRole('heading',{name:'动效示例',exact:true}).waitFor();
  await page.getByRole('switch',{name:'启用轻动效'}).click();
  assert.equal(await page.locator('.aui-skeleton-line').first().evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  await page.getByRole('navigation').getByRole('button',{name:'后台工作流',exact:true}).click();
  await page.getByLabel('工作流搜索').fill('U001');
  await page.getByRole('region',{name:'演示用户，宽表可横向滚动'}).getByRole('button',{name:'U001',exact:true}).waitFor();
  await page.getByRole('button',{name:'表格设置',exact:true}).click();
  await page.getByRole('dialog',{name:'表格设置',exact:true}).waitFor();await page.keyboard.press('Escape');
  // Optional grid subpath from the installed package: lazy chunk with TanStack, 2000 virtualized rows.
  await page.getByRole('navigation').getByRole('button',{name:'多维表格',exact:true}).click();
  await page.getByRole('grid',{name:'合同台账'}).locator('[data-row-key]').first().waitFor();
  assert.ok(await page.getByRole('grid',{name:'合同台账'}).locator('[data-row-key]').count() < 80);
  // Optional access subpath: permission matrix renders from the installed package.
  await page.getByRole('navigation').getByRole('button',{name:'权限组件',exact:true}).click();
  await page.getByRole('checkbox',{name:'联系人 · 导出',exact:true}).click();
  await page.getByText('已修改 1 处，未保存').waitFor();
  assert.deepEqual(errors, []);
  await page.close();
} finally {
  await browser?.close();
  await server.close();
}
console.log(`PASS packed consumer: npm tarball -> isolated install -> starter browser + single-service TypeScript/Vite/embedded assets (${destination})`);
