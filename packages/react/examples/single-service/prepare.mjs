// Copies a packed SDK into the standalone frontend and embeds the fresh output in Go.
// Also works after npm install: all paths resolve relative to this script, not the cwd.
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sdk = resolve(here, '../..');
const npm = process.env.npm_execpath;
if (!npm) throw Error('请通过 npm run prepare:single-service 调用（需要 npm_execpath）');
const run = (args, cwd) => execFileSync(process.execPath, [npm, ...args], { cwd, stdio: 'inherit' });
const temp = await mkdtemp(join(tmpdir(), 'adminui-sdk-'));
try {
  const pack = JSON.parse(execFileSync(process.execPath, [npm, 'pack', sdk, '--json', '--pack-destination', temp], { encoding: 'utf8' }))[0];
  await cp(join(temp, pack.filename), join(here, 'web/adminui-sdk.tgz'));
  run(['install', './adminui-sdk.tgz', '--no-audit', '--no-fund'], join(here, 'web'));
  run(['run', 'build'], join(here, 'web'));
  // A fixed, task-owned directory. Remove old hashed assets before copying the new build.
  await rm(join(here, 'go/web/dist'), { recursive: true, force: true });
  await cp(join(here, 'web/dist'), join(here, 'go/web/dist'), { recursive: true });
  const installed = JSON.parse(await readFile(join(here, 'web/node_modules/@adminui/react/package.json'), 'utf8'));
  console.log(`Ready: AdminUI ${installed.version}. Build Go or Rust next; both embed this frontend.`);
} finally { await rm(temp, { recursive: true, force: true }); }
