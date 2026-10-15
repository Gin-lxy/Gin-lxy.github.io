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
  writeFileSync(join(wiki, 'tag-vocabulary.json'), JSON.stringify({labels: [{name: 'Agent Harness', aliases: ['harness', 'Agent harness design']}]}));
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
    '# 测试报告\n\n分析范围：全文。\n\n标签：Agentic RL，Credit Assignment；GRPO。\n\n## 0. 一句话结论\n\n正文。\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /标签: Agentic RL、Credit Assignment、GRPO/);
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
    '# 测试报告\n\n标签：Agentic RL、Agentic RL；GRPO、Tool Use。\n\n## 0. 一句话结论\n\n正文。\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /标签: Agentic RL、GRPO、Tool Use\n/);
});

// These cases prevent non-English labels and alias fragmentation from returning.
test('rejects Chinese tag values', (t) => {
  const result = fixture(t, '# Report\n\n标签：强化学习、GRPO、Tool Use。\n\n## 0. Conclusion\n');
  assert.equal(result.status, 9, result.stderr);
});

test('rejects too few or too many tags after deduplication', (t) => {
  for (const tags of ['GRPO、GRPO、Tool Use', 'A、B、C、D、E、F、G']) {
    const result = fixture(t, `# Report\n\n标签：${tags}。\n\n## 0. Conclusion\n`);
    assert.equal(result.status, 9, result.stderr);
  }
});

test('rejects a known alias and suggests its canonical name', (t) => {
  const result = fixture(t, '# Report\n\n标签：harness、Multimodal Agents、Visual Memory。\n\n## 0. Conclusion\n');
  assert.equal(result.status, 9, result.stderr);
  assert.match(result.stderr, /Agent Harness/);
});

test('accepts new English topics without imposing a closed vocabulary', (t) => {
  const result = fixture(t, '# Report\n\n标签：New Research Topic、Multimodal Agents、Visual Memory。\n\n## 0. Conclusion\n');
  assert.equal(result.status, 0, result.stderr);
});
