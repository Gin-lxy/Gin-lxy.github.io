#!/usr/bin/env node
// 把 dailypaper 精读报告同步为博客文章（source/_posts），可用 --publish 构建并上线。
// 幂等：已存在的文章跳过，不覆盖；可安全重复运行。

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = join(ROOT, 'source', '_posts');
const IMAGES_ROOT = join(ROOT, 'source', 'images', 'dailypaper');
const DEFAULT_WIKI = '/Users/mac/Documents/llm wiki/raw/dailypaper';
const DEFAULT_MASTER = '/Users/mac/Gin-lxy.github.io';
const CATEGORY = 'daily paper';
const DATE_DIR = /^\d{4}-\d{2}-\d{2}$/;

function usage() {
  console.log(`用法: node tools/sync_dailypapers_to_blog.js [--wiki DIR] [--master DIR] [--publish] [--dry-run] [--limit N] [--since YYYY-MM-DD]`);
}

const args = { wiki: DEFAULT_WIKI, master: DEFAULT_MASTER, publish: false, dryRun: false, limit: Infinity, since: null };
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--wiki') args.wiki = resolve(process.argv[++i]);
  else if (arg === '--master') args.master = resolve(process.argv[++i]);
  else if (arg === '--publish') args.publish = true;
  else if (arg === '--dry-run') args.dryRun = true;
  else if (arg === '--limit') args.limit = Number.parseInt(process.argv[++i], 10);
  else if (arg === '--since') args.since = process.argv[++i];
  else if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
  else { usage(); process.exit(2); }
}

if (!existsSync(args.wiki)) {
  console.error(`wiki 目录不存在: ${args.wiki}`);
  process.exit(2);
}
if (!Number.isInteger(args.limit) && args.limit !== Infinity) {
  console.error('--limit 需要整数');
  process.exit(2);
}

function splitTitle(content, stem) {
  const lines = content.split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first !== -1 && lines[first].startsWith('# ')) {
    return { title: lines[first].slice(2).trim(), body: lines.slice(first + 1).join('\n') };
  }
  const fallback = stem.replace(/^[0-9.]+v?\d*_/, '').replaceAll('_', ' ');
  return { title: fallback, body: content };
}

function rewriteImages(body, date) {
  const prefix = `/images/dailypaper/${date}/`;
  return body
    .replace(/!\[([^\]]*)\]\((?:\.\/)?images\/([^)\s]+)((?:\s+"[^"]*")?)\)/g, `![$1](${prefix}$2)$3`)
    .replace(/(src=["'])(?:\.\/)?images\//g, `$1${prefix}`);
}

const newPosts = [];
const skipped = [];
const errors = [];
let remaining = 0;

const dateDirs = readdirSync(args.wiki)
  .filter((name) => DATE_DIR.test(name) && statSync(join(args.wiki, name)).isDirectory())
  .sort()
  .filter((name) => !args.since || name >= args.since);

for (const date of dateDirs) {
  const dateDir = join(args.wiki, date);
  const reports = readdirSync(dateDir)
    .filter((name) => name.endsWith('.md') && name !== 'index.md' && !name.includes('合集'))
    .sort();
  let wroteThisDate = false;

  for (const name of reports) {
    const stem = name.slice(0, -3);
    const dest = join(POSTS_DIR, `${stem}.md`);
    if (existsSync(dest)) {
      skipped.push(`${date}/${name}`);
      continue;
    }
    if (newPosts.length >= args.limit) {
      remaining += 1;
      continue;
    }
    const content = readFileSync(join(dateDir, name), 'utf8');
    if (content.includes('![[')) {
      errors.push(`${date}/${name}: 含 Obsidian 嵌入 ![[，verifier 会拒绝，需先改为标准 Markdown`);
      continue;
    }
    const { title, body } = splitTitle(content, stem);
    const post = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${date} 12:00:00`,
      `categories: ["${CATEGORY}"]`,
      'tags: []',
      '---',
      '',
      rewriteImages(body, date),
    ].join('\n');
    if (!args.dryRun) {
      writeFileSync(dest, post, 'utf8');
    }
    newPosts.push({ date, source: `${date}/${name}`, dest });
    wroteThisDate = true;
  }

  const imagesDir = join(dateDir, 'images');
  if (wroteThisDate && existsSync(imagesDir) && statSync(imagesDir).isDirectory() && !args.dryRun) {
    const target = join(IMAGES_ROOT, date);
    mkdirSync(target, { recursive: true });
    cpSync(imagesDir, target, { recursive: true, force: true });
  }
}

const dates = [...new Set(newPosts.map((p) => p.date))].sort();
console.log(`${args.dryRun ? '[dry-run] ' : ''}新增 ${newPosts.length} 篇，跳过已存在 ${skipped.length} 篇，待续(超过 limit) ${remaining} 篇，格式问题 ${errors.length} 篇`);
if (dates.length) console.log(`涉及日期: ${dates.join(', ')}`);
for (const e of errors) console.log(`  跳过: ${e}`);
if (args.dryRun) process.exit(errors.length ? 3 : 0);

if (errors.length) {
  console.error('存在格式问题文件，未构建未发布。修复后重跑。');
  process.exit(3);
}
if (!args.publish) process.exit(0);
if (newPosts.length === 0) {
  console.log('没有需要同步的新报告，跳过构建与发布。');
  process.exit(0);
}

function run(cmd, cmdArgs, cwd) {
  return spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' }).status;
}

console.log('== npm run verify ==');
if (run('npm', ['run', 'verify'], ROOT) !== 0) {
  console.error('构建或测试失败，未提交未发布。');
  process.exit(4);
}

const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim();
if (branch !== 'source') {
  console.error(`博客源码 worktree 当前分支是 ${branch}，期望 source，中止。`);
  process.exit(5);
}

console.log('== 提交并推送 source 分支 ==');
const rel = (p) => p.split(sep).join('/');
if (run('git', ['add', '--', ...newPosts.map((p) => rel(p.dest)), ...(existsSync(IMAGES_ROOT) ? [rel(IMAGES_ROOT)] : [])], ROOT) !== 0) process.exit(5);
if (run('git', ['commit', '-m', `Sync daily paper reports: ${newPosts.length} posts (${dates.join(', ')})`], ROOT) !== 0) process.exit(5);
if (run('git', ['push', 'origin', 'source'], ROOT) !== 0) {
  console.error('push source 失败（提交已在本地），后续步骤中止。');
  process.exit(5);
}

console.log('== 发布到 master ==');
if (run('bash', ['scripts/publish_to_master.sh', args.master], ROOT) !== 0) {
  console.error('发布脚本失败，master 未更新。');
  process.exit(6);
}
if (run('git', ['add', '-A'], args.master) !== 0) process.exit(7);
if (run('git', ['commit', '-m', `Publish daily paper reports: ${newPosts.length} posts (${dates.join(', ')})`], args.master) !== 0) process.exit(7);
if (run('git', ['push', 'origin', 'master'], args.master) !== 0) {
  console.error('push master 失败（提交已在本地），线上未更新。');
  process.exit(7);
}

console.log(`完成：${newPosts.length} 篇已上线（${dates.join(', ')}）。`);
