import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TOOL = fileURLToPath(new URL('../tools/sync_dailypapers_to_blog.mjs', import.meta.url));
const DATE = '2026-09-28';
const REPORT_STEM = '0000.00000v1_sync_gate_fixture';
const SPEC = '# 测试用规范\n\n正文。\n';
const REPORT = '# 测试报告\n\n正文。\n';

function fixture(t, indexContent) {
  const wiki = mkdtempSync(join(tmpdir(), 'sync-spec-check-'));
  t.after(() => rmSync(wiki, { recursive: true, force: true }));
  writeFileSync(join(wiki, 'daily-paper-prompt.md'), SPEC, 'utf8');
  const hash = createHash('sha256').update(SPEC).digest('hex').slice(0, 16);
  const dateDir = join(wiki, DATE);
  mkdirSync(dateDir);
  writeFileSync(join(dateDir, `${REPORT_STEM}.md`), REPORT, 'utf8');
  if (indexContent !== null) {
    writeFileSync(join(dateDir, 'index.md'), indexContent(hash), 'utf8');
  }
  return {
    hash,
    run: (extra = []) => spawnSync(process.execPath, [TOOL, '--wiki', wiki, '--since', DATE, '--dry-run', ...extra], { encoding: 'utf8' }),
  };
}

const fingerprintLine = (hash) => `# 索引\n\n- 规范版本指纹：daily-paper-prompt.md sha256:${hash}（mtime 2026-09-28 00:00:00）\n`;

test('dry-run passes when index.md carries the current spec fingerprint', (t) => {
  const f = fixture(t, (hash) => fingerprintLine(hash));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /新增 1 篇/);
});

test('rejects when index.md is missing the fingerprint line', (t) => {
  const f = fixture(t, () => '# 索引\n\n- 执行时间：2026-09-28。\n');
  const result = f.run();
  assert.equal(result.status, 8, result.stderr);
  assert.match(result.stderr, /规范版本指纹/);
});

test('rejects when the fingerprint does not match the current spec', (t) => {
  const f = fixture(t, () => fingerprintLine('0123456789abcdef'));
  const result = f.run();
  assert.equal(result.status, 8, result.stderr);
  assert.match(result.stderr, /不匹配/);
});

test('rejects when index.md does not exist', (t) => {
  const f = fixture(t, null);
  const result = f.run();
  assert.equal(result.status, 8, result.stderr);
});

test('--skip-spec-check bypasses the gate', (t) => {
  const f = fixture(t, () => '# 索引\n');
  const result = f.run(['--skip-spec-check']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /新增 1 篇/);
});
