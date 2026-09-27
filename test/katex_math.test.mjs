import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.hexo = { extend: { filter: { register() {} } }, config: { root: '/' } };
const require = createRequire(import.meta.url);
const { protectMath } = require('../scripts/katex_math.js');

const TOKEN = /qxmath([di])([0-9a-f]+)qxend/g;

function scan(content) {
  const text = protectMath(content);
  const segments = [];
  const rest = text.replace(TOKEN, (match, mode, hex) => {
    segments.push({ display: mode === 'd', tex: Buffer.from(hex, 'hex').toString('utf8') });
    return '';
  });
  return { rest, segments };
}

test('extracts inline math and keeps TeX specials intact', () => {
  const { rest, segments } = scan('前$k^{95}_{c}$后');
  assert.equal(rest, '前后');
  assert.deepEqual(segments, [{ display: false, tex: 'k^{95}_{c}' }]);
});

test('extracts display math written on one line', () => {
  const { rest, segments } = scan('$$e_t=\\tfrac{1}{2}\\bigl(E(x_t)+E(y_t)\\bigr)$$');
  assert.equal(segments.length, 1);
  assert.equal(segments[0].display, true);
  assert.equal(segments[0].tex, 'e_t=\\tfrac{1}{2}\\bigl(E(x_t)+E(y_t)\\bigr)');
  assert.equal(rest.includes('$'), false);
});

test('extracts display math spanning multiple lines', () => {
  const { segments } = scan('$$\na + b\n$$');
  assert.deepEqual(segments, [{ display: true, tex: '\na + b\n' }]);
});

test('leaves currency amounts as prose', () => {
  const source = 'Qwen-Planner-Agent 为 **$2.41 / 千任务**，对比其他模型 $3.06–$67.76。';
  const { rest, segments } = scan(source);
  assert.equal(segments.length, 0);
  assert.equal(rest, source);
});

test('leaves quoted dollar signs as prose', () => {
  const source = '以‘$’结束，以‘#’结束；printf("use \'$\' for decimal")';
  const { rest, segments } = scan(source);
  assert.equal(segments.length, 0);
  assert.equal(rest, source);
});

test('loses no closers that are followed by a digit', () => {
  const { segments } = scan('$x$5');
  assert.equal(segments.length, 0);
});

test('keeps digit-leading formulas when they are real math', () => {
  const { segments } = scan('学习率 $5\\times10^{-5}$ 后余弦退火');
  assert.deepEqual(segments, [{ display: false, tex: '5\\times10^{-5}' }]);
});

test('keeps CJK inside text mode', () => {
  const { segments } = scan('三个阶段（$\\text{进度塑造}$、$\\text{结果巩固}$）');
  assert.deepEqual(segments.map((s) => s.tex), ['\\text{进度塑造}', '\\text{结果巩固}']);
});

test('ignores inline code spans', () => {
  const source = '文件名 `$not_math$` 保持原样';
  const { rest, segments } = scan(source);
  assert.equal(segments.length, 0);
  assert.equal(rest, source);
});

test('ignores fenced code blocks', () => {
  const source = '```bash\necho $$PATH$$\n```\n正文 $x$';
  const { rest, segments } = scan(source);
  assert.deepEqual(segments, [{ display: false, tex: 'x' }]);
  assert.match(rest, /echo \$\$PATH\$\$/);
});

test('ignores escaped dollar signs', () => {
  const source = '价格 \\$5 与 $x$';
  const { segments } = scan(source);
  assert.deepEqual(segments, [{ display: false, tex: 'x' }]);
});

test('extracts multiple inline formulas from one line', () => {
  const { segments } = scan('$a$ 与 $b$ 都是');
  assert.deepEqual(segments.map((s) => s.tex), ['a', 'b']);
});
