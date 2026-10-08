import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// A box that scrolls on one axis must say what the other axis does. With only `overflow-x: auto`
// the browser computes `overflow-y: auto` as well, so a 1px negative margin, an underline or a
// focus ring that sticks out turns into a vertical scrollbar (with arrows on Windows) next to a
// tab bar. The same holds for inline style objects (`overflowX` without `overflowY`).
const root = join(import.meta.dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.name === 'node_modules' || entry.name === 'dist' ? [] : entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const files = [...walk(join(root, 'src')), ...walk(join(root, 'examples'))];

export function singleAxisOverflow(source: string, css: boolean): string[] {
  const x = css ? /(?<![-\w])overflow-x\s*:/ : /\boverflowX\s*:/;
  const y = css ? /(?<![-\w])overflow-y\s*:/ : /\boverflowY\s*:/;
  const found: string[] = [];
  for (const match of source.matchAll(/\{([^{}]*)\}/g)) {
    const body = match[1]!;
    if (x.test(body) !== y.test(body)) found.push(body.replace(/\s+/g, ' ').trim().slice(0, 120));
  }
  return found;
}

test('the checker flags one-axis overflow and accepts both axes or the shorthand', () => {
  assert.equal(singleAxisOverflow('.a { overflow-x: auto; }', true).length, 1);
  assert.equal(singleAxisOverflow('.a { overflow-y:auto }', true).length, 1);
  assert.deepEqual(singleAxisOverflow('.a { overflow-x: auto; overflow-y: hidden; }', true), []);
  assert.deepEqual(singleAxisOverflow('.a { overflow: auto; text-overflow: ellipsis; overflow-wrap: anywhere; }', true), []);
  assert.equal(singleAxisOverflow('<div style={{ overflowX: "auto" }} />', false).length, 1);
  assert.deepEqual(singleAxisOverflow('<div style={{ overflowX: "auto", overflowY: "hidden" }} />', false), []);
});

test('every scroll container in styles and examples declares both axes', () => {
  const problems = files.flatMap(file => {
    const css = file.endsWith('.css');
    if (!css && !/\.(tsx|ts|html)$/.test(file)) return [];
    return singleAxisOverflow(readFileSync(file, 'utf8'), css).map(body => `${relative(root, file)}: { ${body} }`);
  });
  assert.deepEqual(problems, [], 'write overflow-x and overflow-y together (e.g. overflow-x:auto; overflow-y:hidden)');
});
