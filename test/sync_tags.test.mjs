import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TOOL = fileURLToPath(new URL('../tools/sync_dailypapers_to_blog.mjs', import.meta.url));
const DATE = '2026-09-28';
const REPORT_STEM = '0000.00000v1_sync_tags_fixture';
const SPEC = '# 测试用规范\n\n正文。\n';

function fixture(t, report) {
  const wiki = mkdtempSync(join(tmpdir(), 'sync-tags-'));
  t.after(() => rmSync(wiki, { recursive: true, force: true }));
  writeFileSync(join(wiki, 'daily-paper-prompt.md'), SPEC, 'utf8');
  const hash = createHash('sha256').update(SPEC).digest('hex').slice(0, 16);
  const dateDir = join(wiki, DATE);
  mkdirSync(dateDir);
  writeFileSync(join(dateDir, `${REPORT_STEM}.md`), report, 'utf8');
  writeFileSync(
    join(dateDir, 'index.md'),
    `# 索引\n\n- 规范版本指纹：daily-paper-prompt.md sha256:${hash}（mtime 2026-09-28 00:00:00）\n`,
    'utf8',
  );
  return spawnSync(process.execPath, [TOOL, '--wiki', wiki, '--since', DATE, '--dry-run'], { encoding: 'utf8' });
}

test('dry-run reports the planned tags parsed from the header', (t) => {
  const result = fixture(
    t,
    '# 测试报告\n\n分析范围：全文。\n\n标签：强化学习，信用分配；GRPO。\n\n## 0. 一句话结论\n\n正文。\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /标签: 强化学习、信用分配、GRPO/);
});

test('rejects a report without a tag line', (t) => {
  const result = fixture(t, '# 测试报告\n\n分析范围：全文。\n\n## 0. 一句话结论\n\n正文。\n');
  assert.equal(result.status, 9, result.stderr);
  assert.match(result.stderr, /标签/);
});

test('rejects a report with an empty tag line', (t) => {
  const result = fixture(t, '# 测试报告\n\n标签：。\n\n## 0. 一句话结论\n\n正文。\n');
  assert.equal(result.status, 9, result.stderr);
  assert.match(result.stderr, /标签/);
});

test('deduplicates repeated tags and trims the trailing period', (t) => {
  const result = fixture(
    t,
    '# 测试报告\n\n标签：强化学习、强化学习；LLM。\n\n## 0. 一句话结论\n\n正文。\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /标签: 强化学习、LLM\n/);
});
