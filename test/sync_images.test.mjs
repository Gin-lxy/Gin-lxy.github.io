import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TOOL = fileURLToPath(new URL('../tools/sync_dailypapers_to_blog.mjs', import.meta.url));
const DATE = '2026-10-01';
const REPORT_STEM = '0000.00000v1_sync_images_fixture';
const SPEC = '# 测试用规范\n\n正文。\n';

// 把脚本复制到临时“站点根”下运行，使写入落在临时目录而不是真实仓库。
function fixture(t, report) {
  const root = mkdtempSync(join(tmpdir(), 'sync-images-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tools'), { recursive: true });
  mkdirSync(join(root, 'source', '_posts'), { recursive: true });
  copyFileSync(TOOL, join(root, 'tools', 'sync_dailypapers_to_blog.mjs'));
  const wiki = join(root, 'wiki');
  const dateDir = join(wiki, DATE);
  mkdirSync(dateDir, { recursive: true });
  writeFileSync(join(wiki, 'daily-paper-prompt.md'), SPEC, 'utf8');
  const hash = createHash('sha256').update(SPEC).digest('hex').slice(0, 16);
  writeFileSync(join(dateDir, `${REPORT_STEM}.md`), report, 'utf8');
  writeFileSync(
    join(dateDir, 'index.md'),
    `# 索引\n\n- 规范版本指纹：daily-paper-prompt.md sha256:${hash}（mtime 2026-10-01 00:00:00）\n`,
    'utf8',
  );
  const result = spawnSync(
    process.execPath,
    [join(root, 'tools', 'sync_dailypapers_to_blog.mjs'), '--wiki', wiki, '--since', DATE],
    { encoding: 'utf8' },
  );
  const post = join(root, 'source', '_posts', `${REPORT_STEM}.md`);
  return { result, post, written: existsSync(post) ? readFileSync(post, 'utf8') : null };
}

test('rewrites image links whose alt text contains square brackets', (t) => {
  const { result, written } = fixture(
    t,
    '# 测试报告\n\n分析范围：全文。\n\n标签：测试、图片改写。\n\n## 0. 一句话结论\n\n'
      + '![普通说明](images/0000.00000_fig1.png)\n\n'
      + '![含引用 [33] 与 Var[ρ] 的说明](images/0000.00000_fig2.png)\n\n正文。\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(written, '文章未写入');
  assert.ok(written.includes(`/images/dailypaper/${DATE}/0000.00000_fig1.png`), written);
  assert.ok(written.includes(`/images/dailypaper/${DATE}/0000.00000_fig2.png`), written);
  assert.ok(!written.includes('(images/'), `存在未改写的图片链接：\n${written}`);
});
