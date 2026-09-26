# Hexo Reconstruction and Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruct the missing Hexo source project, upgrade it through Hexo 7 to Hexo 8 with Redefine 2.9.0, regenerate the site without broken images or routes, and push the source and published branches to GitHub.

**Architecture:** Keep maintainable source on a `source` branch and generated GitHub Pages output on `master`. Build and test in an isolated source worktree, then use a guarded local publishing script to synchronize a verified `public/` directory into the clean `master` worktree without force-pushing.

**Tech Stack:** Node.js 20.19+, npm, Hexo 6.3.0 → 7.3.0 → 8.0.0, hexo-theme-redefine 2.5.0 → 2.9.0, Ruby standard library for generated-site verification, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-hexo-reconstruction-upgrade-design.md`

## Global Constraints

- Preserve the four existing public article routes, dates, tags, category, article text, code samples, and all recoverable local images.
- Use Node.js 20.19.0 or newer; the current machine's Node.js 24.14.1 satisfies this floor.
- Finish on exactly Hexo 8.0.0 and hexo-theme-redefine 2.9.0 with a committed `package-lock.json`.
- Keep `master` as generated static output and `source` as the maintainable Hexo project.
- Do not change GitHub Pages settings, do not force-push, and do not invent the unavailable `/image-5.png`.
- Preserve the existing image-path corrections and reject generated `![[...]]` embeds.

---

### Task 1: Preserve and Commit the Corrected Published Baseline

**Files:**
- Create: `.gitignore`
- Modify: existing generated HTML files with current image corrections
- Test: `tests/check_image_paths.rb`

**Interfaces:**
- Consumes: the current dirty `master` working tree and commit `89ea308`
- Produces: a clean, committed `master` baseline safe to use as reconstruction input

- [ ] **Step 1: Extend the regression check with a non-empty-site assertion**

Add before the success branch in `tests/check_image_paths.rb`:

```ruby
html_files = Dir.glob(ROOT.join("**", "*.html"))
abort "Expected generated HTML pages" if html_files.empty?
```

- [ ] **Step 2: Ignore project-local worktrees**

Create `.gitignore`:

```gitignore
.worktrees/
```

- [ ] **Step 3: Verify the baseline**

Run:

```bash
ruby -c tests/check_image_paths.rb
ruby tests/check_image_paths.rb
git diff --check
git check-ignore -q .worktrees/probe
```

Expected: Ruby syntax is valid, all image references resolve, the diff has no whitespace errors, and `.worktrees/probe` is ignored.

- [ ] **Step 4: Commit only the baseline corrections and guards**

Run:

```bash
git add .gitignore tests 2023 2024 404.html archives categories index.html tags
git commit -m "fix: restore published image rendering"
```

Expected: the image corrections and regression test are committed without adding `.worktrees/`.

### Task 2: Create the Isolated Source Branch and Project Shell

**Files:**
- Create on `source`: `package.json`
- Create on `source`: `.nvmrc`
- Create on `source`: `.gitignore`
- Copy on `source`: the approved spec and this plan

**Interfaces:**
- Consumes: the clean committed `master` baseline
- Produces: `/Users/mac/Gin-lxy.github.io/.worktrees/source` checked out on branch `source`

- [ ] **Step 1: Confirm repository isolation state**

Run:

```bash
git rev-parse --git-dir
git rev-parse --git-common-dir
git rev-parse --show-superproject-working-tree
git branch --show-current
```

Expected: Git dir and common dir both resolve to `.git`, there is no superproject, and the branch is `master`.

- [ ] **Step 2: Create the source worktree**

Run:

```bash
git worktree add .worktrees/source -b source
```

Expected: the new worktree is on branch `source`.

- [ ] **Step 3: Remove generated files from the source branch only**

From `.worktrees/source`, list and then remove the exact tracked set:

```bash
git ls-files
git ls-files -z | xargs -0 git rm --
```

Expected: files are staged as deleted only in the `source` worktree; the `master` worktree remains unchanged.

- [ ] **Step 4: Create the source shell**

Create `.nvmrc` containing `20`, and `.gitignore` containing:

```gitignore
node_modules/
public/
.deploy_git/
.DS_Store
```

Create `package.json`:

```json
{
  "name": "gin-lxy-hexo-site",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": ">=20.19.0" },
  "scripts": {
    "clean": "hexo clean",
    "build": "hexo generate",
    "test": "ruby test/verify_generated_site.rb",
    "verify": "npm run clean && npm run build && npm test",
    "server": "hexo server"
  }
}
```

- [ ] **Step 5: Restore the approved documentation**

Copy the spec and plan from the `master` worktree into matching paths in the source worktree. Run `shasum -a 256` on both copies and require matching hashes.

- [ ] **Step 6: Commit the source shell**

```bash
git add .
git commit -m "chore: initialize Hexo source branch"
```

### Task 3: Add the Failing Generated-Site Contract

**Files:**
- Create: `test/verify_generated_site.rb`

**Interfaces:**
- Consumes: generated files under `public/`
- Produces: one exit-code contract for routes, local images, and leaked embeds

- [ ] **Step 1: Create the verifier**

Create `test/verify_generated_site.rb`:

```ruby
# frozen_string_literal: true
require "pathname"
require "uri"

ROOT = Pathname.new(__dir__).parent
PUBLIC = ROOT.join("public")
EXPECTED_ROUTES = [
  "index.html", "404.html", "archives/index.html",
  "categories/blog/index.html", "tags/漫谈/index.html", "tags/课内/index.html",
  "2023/10/10/hello-world/index.html",
  "2023/11/15/2023秋-关于当下和未来/index.html",
  "2023/11/15/数据结构复习/index.html",
  "2024/03/16/大二下EBU5213 Internet protocols and networks/index.html"
].freeze
IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)\z/i
ATTRIBUTE_URL = /(?:content|data-src|href|src)=["']([^"']+)["']/
CSS_URL = /url\(["']?([^"')]+)["']?\)/
errors = []

EXPECTED_ROUTES.each { |route| errors << "missing route: #{route}" unless PUBLIC.join(route).file? }
Dir.glob(PUBLIC.join("**", "*.{css,html}")).sort.each do |source|
  contents = File.binread(source).force_encoding(Encoding::UTF_8)
  relative = Pathname.new(source).relative_path_from(PUBLIC)
  errors << "unrendered Obsidian embed: #{relative}" if contents.include?("![[")
  urls = contents.scan(ATTRIBUTE_URL).flatten + contents.scan(CSS_URL).flatten
  urls.each do |url|
    if url.start_with?("https://gin-lxy.github.io/")
      url = URI(url).path
    elsif url.start_with?("data:", "http://", "https://", "//", "#")
      next
    end
    path = URI::DEFAULT_PARSER.unescape(url.split(/[?#]/, 2).first)
    next unless path.match?(IMAGE_EXTENSION)
    target = path.start_with?("/") ? PUBLIC.join(path.delete_prefix("/")) : Pathname.new(source).dirname.join(path)
    errors << "missing image from #{relative}: #{url}" unless target.file?
  end
end

abort errors.uniq.join("\n") unless errors.empty?
puts "Generated-site contract passed."
```

- [ ] **Step 2: Observe the expected failure**

Run `ruby test/verify_generated_site.rb`.

Expected: non-zero exit with `missing route: index.html` because `public/` does not exist.

- [ ] **Step 3: Commit the failing contract**

```bash
git add test/verify_generated_site.rb
git commit -m "test: define generated site contract"
```

### Task 4: Reconstruct the Hexo 6.3 / Redefine 2.5 Baseline

**Files:**
- Create: `_config.yml`, `_config.redefine.yml`, `scripts/recover_posts.mjs`
- Create: four files under `source/_posts/`
- Create: `source/img/**`, `package-lock.json`
- Modify: `package.json`, `test/verify_generated_site.rb`

**Interfaces:**
- Consumes: the committed published pages through `PUBLISHED_ROOT`
- Produces: four recovered posts and a passing Hexo 6.3 baseline

- [ ] **Step 1: Install exact baseline dependencies**

```bash
npm install --save-exact hexo@6.3.0 hexo-generator-archive@2.0.0 hexo-generator-category@2.0.0 hexo-generator-index@3.0.0 hexo-generator-tag@2.0.0 hexo-renderer-ejs@2.0.0 hexo-renderer-marked@6.3.0 hexo-renderer-stylus@3.0.1 hexo-server@3.0.0 hexo-theme-redefine@2.5.0
npm install --save-dev --save-exact cheerio@1.1.2 turndown@7.2.0
```

- [ ] **Step 2: Create `_config.yml` with recovered settings**

Use these exact values, plus Hexo defaults for unspecified keys:

```yaml
title: GIn's notebook
subtitle: The world is my oyster.
description: GIn's notebook
author: GIn
language: zh-CN
timezone: Asia/Shanghai
url: https://gin-lxy.github.io
root: /
permalink: :year/:month/:day/:title/
source_dir: source
public_dir: public
tag_dir: tags
archive_dir: archives
category_dir: categories
new_post_name: :title.md
default_layout: post
future: true
highlight:
  enable: true
  line_number: true
  wrap: true
  hljs: false
index_generator:
  path: ""
  per_page: 10
  order_by: -date
theme: redefine
```

- [ ] **Step 3: Create `_config.redefine.yml` from published runtime settings**

```yaml
colors:
  primary: "#8f7ff4"
  secondary: "#8587a7"
global:
  content_max_width: 1000px
  sidebar_width: 210px
  single_page: true
  open_graph: true
home_banner:
  enable: true
  style: fixed
  title: GIn's notebook
  subtitle:
    text: [The world is my oyster.]
navbar:
  links:
    Home:
      path: /
      icon: fa-regular fa-house
home:
  sidebar:
    enable: true
    position: left
    first_item: menu
articles:
  word_count:
    enable: true
    count: true
    min2read: true
  toc:
    enable: true
    max_depth: 3
  copyright: true
  lazyload: true
```

- [ ] **Step 4: Implement deterministic post recovery**

Create `scripts/recover_posts.mjs` with this literal route mapping:

```javascript
const posts = [
  ["2023/10/10/hello-world/index.html", "source/_posts/hello-world.md", "Hello World", "2023-10-10 20:06:25", [], []],
  ["2023/11/15/2023秋-关于当下和未来/index.html", "source/_posts/2023秋-关于当下和未来.md", "2023秋-关于当下和未来", "2023-11-15 21:48:20", ["漫谈"], []],
  ["2023/11/15/数据结构复习/index.html", "source/_posts/数据结构复习.md", "数据结构复习", "2023-11-15 21:48:20", ["课内"], []],
  ["2024/03/16/大二下EBU5213 Internet protocols and networks/index.html", "source/_posts/大二下EBU5213 Internet protocols and networks.md", "EBU5213 Internet protocols and networks", "2024-03-16 18:56:00", [], ["blog"]]
];
```

Use Cheerio to require `.article-content`, Turndown for simple headings/paragraphs/lists/images, and a custom rule that preserves `.highlight-container` and code tables as raw HTML. Normalize media to `/img/<encoded filename>`, remove `/image-5.png`, and emit YAML front matter from the mapping. Exit non-zero when an input page or content container is missing.

- [ ] **Step 5: Recover posts and assets**

```bash
PUBLISHED_ROOT=/Users/mac/Gin-lxy.github.io node scripts/recover_posts.mjs
mkdir -p source/img
rsync -a /Users/mac/Gin-lxy.github.io/img/ source/img/
```

- [ ] **Step 6: Generate and verify the baseline**

Run `npm run verify`.

Expected: Hexo 6.3.0 generates all literal routes and the contract passes.

- [ ] **Step 7: Add recovered-text assertions**

Add to the verifier:

```ruby
EXPECTED_TEXT = {
  "2023/10/10/hello-world/index.html" => "Welcome to Hexo",
  "2023/11/15/2023秋-关于当下和未来/index.html" => "关于当下和未来",
  "2023/11/15/数据结构复习/index.html" => "单链表",
  "2024/03/16/大二下EBU5213 Internet protocols and networks/index.html" => "计算机网络和因特网"
}.freeze
EXPECTED_TEXT.each do |route, text|
  page = PUBLIC.join(route)
  errors << "missing recovered text in #{route}: #{text}" if page.file? && !page.read.include?(text)
end
```

Run `npm test`; expected: pass.

- [ ] **Step 8: Commit the recovered baseline**

```bash
git add package.json package-lock.json _config.yml _config.redefine.yml scripts source test
git commit -m "feat: reconstruct Hexo 6 source site"
```

### Task 5: Upgrade the Framework to Hexo 7.3

**Files:**
- Modify: `package.json`, `package-lock.json`, `_config.yml`
- Test: `test/verify_generated_site.rb`

**Interfaces:**
- Consumes: the passing Hexo 6.3 baseline
- Produces: the same generated-site contract on Hexo 7.3.0

- [ ] **Step 1: Record the passing baseline**

```bash
npm run verify
npx hexo version
```

Expected: verification passes and Hexo reports 6.3.0.

- [ ] **Step 2: Upgrade only Hexo**

```bash
npm install --save-exact hexo@7.3.0
```

Expected: Redefine remains pinned to 2.5.0.

- [ ] **Step 3: Apply the Hexo 7 highlighting migration**

Add this top-level key to `_config.yml` while retaining the existing `highlight` options:

```yaml
syntax_highlighter: highlight.js
```

- [ ] **Step 4: Verify the intermediate version**

```bash
npm run verify
npx hexo version
npm ls hexo hexo-theme-redefine
```

Expected: tests pass, Hexo is 7.3.0, and Redefine is 2.5.0.

- [ ] **Step 5: Commit the checkpoint**

```bash
git add package.json package-lock.json _config.yml
git commit -m "chore: upgrade Hexo to 7.3"
```

### Task 6: Upgrade to Hexo 8 and Redefine 2.9

**Files:**
- Modify: `package.json`, `package-lock.json`, `_config.yml`, `_config.redefine.yml`
- Test: `test/verify_generated_site.rb`

**Interfaces:**
- Consumes: the passing Hexo 7.3 checkpoint
- Produces: the final Hexo 8.0.0 / Redefine 2.9.0 site

- [ ] **Step 1: Add a failing final-version assertion**

Add before the verifier's final abort:

```ruby
if PUBLIC.join("index.html").file?
  index = PUBLIC.join("index.html").read
  errors << "expected Hexo 8.0.0 metadata" unless index.include?('content="Hexo 8.0.0"')
  errors << "expected Redefine 2.9.0 metadata" unless index.include?('"version":"2.9.0"')
end
```

Run `npm test`.

Expected: fail because output still identifies Hexo 7.3.0 and Redefine 2.5.0.

- [ ] **Step 2: Upgrade framework and theme**

```bash
npm install --save-exact hexo@8.0.0 hexo-theme-redefine@2.9.0
```

- [ ] **Step 3: Migrate the Redefine 2.9 social-link schema**

Keep the feature disabled and use arrays:

```yaml
home_banner:
  social_links:
    enable: false
    links: []
    qrs: []
```

Keep recovered colors, banner title, subtitle, sidebar, article layout, and `/img/...` paths. Do not add comments, analytics, accounts, or secrets.

- [ ] **Step 4: Verify the final stack**

```bash
npm run verify
npx hexo version
npm ls hexo hexo-theme-redefine
npm audit --omit=dev
```

Expected: contract and version checks pass; dependencies identify Hexo 8.0.0 and Redefine 2.9.0. Resolve compatible production audit findings before continuing.

- [ ] **Step 5: Commit the final upgrade**

```bash
git add package.json package-lock.json _config.yml _config.redefine.yml test/verify_generated_site.rb
git commit -m "chore: upgrade to Hexo 8 and Redefine 2.9"
```

### Task 7: Add CI and a Guarded Publisher

**Files:**
- Create: `.github/workflows/verify.yml`
- Create: `scripts/publish_to_master.sh`
- Create: `test/publish_guard_test.sh`
- Modify: `package.json`

**Interfaces:**
- Consumes: verified `public/` and an explicit clean `master` worktree
- Produces: deterministic CI and guarded local synchronization

- [ ] **Step 1: Write the failing publishing guard test**

Create `test/publish_guard_test.sh`. It must initialize a temporary Git repository on branch `not-master`, invoke `scripts/publish_to_master.sh` with that repository, and require non-zero exit plus `target must be on master`.

Run `bash test/publish_guard_test.sh`.

Expected: fail because the publisher does not exist.

- [ ] **Step 2: Implement `scripts/publish_to_master.sh`**

Use `set -euo pipefail` and implement these checks in order:

1. Require exactly one target path.
2. Resolve `git -C "$target" rev-parse --show-toplevel` and require it to equal the resolved target.
3. Require `git -C "$target" branch --show-current` to equal `master`, otherwise print `target must be on master`.
4. Require both unstaged and staged diffs to be empty.
5. Require `public/index.html`, then run `npm test`.
6. Synchronize with `rsync -a --delete --exclude='.git/' --exclude='.worktrees/' public/ "$target/"`.
7. Create `"$target/.nojekyll"` and print `git -C "$target" status --short`.

The script must not commit or push.

- [ ] **Step 3: Verify the guard and generated site**

```bash
bash test/publish_guard_test.sh
npm run verify
```

Expected: both pass.

- [ ] **Step 4: Add source-branch CI**

Create `.github/workflows/verify.yml`:

```yaml
name: Verify Hexo source
on:
  push:
    branches: [source]
  pull_request:
    branches: [source]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20.19.0"
          cache: npm
      - run: npm ci
      - run: npm run verify
```

- [ ] **Step 5: Include the guard test in npm scripts**

Set:

```json
{
  "test": "ruby test/verify_generated_site.rb && bash test/publish_guard_test.sh",
  "verify": "npm run clean && npm run build && npm test"
}
```

- [ ] **Step 6: Commit automation**

```bash
git add .github package.json scripts/publish_to_master.sh test/publish_guard_test.sh
git commit -m "ci: verify and prepare Hexo publication"
```

### Task 8: Perform Final Source Verification

**Files:**
- Verify only; change files only when a failing check identifies a source defect

**Interfaces:**
- Consumes: the complete `source` branch
- Produces: fresh evidence that publication is safe

- [ ] **Step 1: Reinstall only locked dependencies**

Remove the exact generated directory `.worktrees/source/node_modules`, then run:

```bash
npm ci
```

Expected: installation succeeds from the lockfile.

- [ ] **Step 2: Run the complete clean verification**

```bash
npm run verify
git diff --check
git status --short
```

Expected: checks pass and the source worktree is clean apart from ignored `node_modules/` and `public/`.

- [ ] **Step 3: Probe representative local HTTP resources**

Serve `public/` on localhost and request:

```text
/img/20210207164532306.png
/img/大二下EBU5213%20Internet%20protocols%20and%20networks_image_40.png
/images/redefine-avatar.svg
/2023/11/15/数据结构复习/
```

Expected: HTTP 200 for every request and appropriate PNG or SVG content types.

- [ ] **Step 4: Inspect dependency identity**

```bash
node --version
npm --version
npx hexo version
npm ls --depth=0
```

Expected: Node satisfies the floor, Hexo is 8.0.0, Redefine is 2.9.0, and no dependency is invalid.

### Task 9: Publish, Commit, and Push Both Branches

**Files:**
- Replace on `master`: generated static site files
- Preserve on `source`: the complete Hexo source project

**Interfaces:**
- Consumes: verified `source/public/` and clean local branches
- Produces: fast-forward `origin/source` and `origin/master`

- [ ] **Step 1: Fetch without overwriting local work**

```bash
git fetch origin
git merge-base --is-ancestor origin/master master
```

Expected: exit 0. If the remote advanced, integrate it before publishing.

- [ ] **Step 2: Synchronize verified output into master**

From `.worktrees/source`:

```bash
bash scripts/publish_to_master.sh /Users/mac/Gin-lxy.github.io
```

Expected: only generated-site changes appear in the `master` worktree; `.git/` and `.worktrees/` remain intact.

- [ ] **Step 3: Confirm target equality before commit**

Run an `rsync --dry-run --delete` comparison from `source/public/` to the master worktree with the same `.git/` and `.worktrees/` exclusions.

Expected: no content differences other than the deliberate `.nojekyll` marker.

- [ ] **Step 4: Commit generated output**

```bash
git add -A
git commit -m "build: publish Hexo 8 site"
```

- [ ] **Step 5: Push source, then master, without force**

From the source worktree:

```bash
git push -u origin source
```

From the master worktree:

```bash
git push origin master
```

- [ ] **Step 6: Verify remote branch tips and live Pages output**

```bash
git ls-remote --heads origin master source
```

Require the remote SHAs to match the local tips. Request `https://gin-lxy.github.io/`, one encoded Chinese article route, and representative images until GitHub Pages serves Hexo 8 metadata and HTTP 200 responses.
