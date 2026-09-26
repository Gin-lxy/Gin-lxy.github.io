import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const script = fileURLToPath(new URL('../scripts/recover_posts.mjs', import.meta.url));
const routes = [
  '2023/10/10/hello-world/index.html',
  '2023/11/15/2023秋-关于当下和未来/index.html',
  '2023/11/15/数据结构复习/index.html',
  '2024/03/16/大二下EBU5213 Internet protocols and networks/index.html',
];

test('stays inert when Hexo loads scripts as CommonJS plugins', () => {
  // This is the wrapper used by Hexo 6, with no recovery inputs available.
  const plugin = runInNewContext(`(function(exports, require, module, __filename, __dirname, hexo) {${readFileSync(script, 'utf8')}\n})`);
  assert.doesNotThrow(() => plugin({}, undefined, {}, script, dirname(script), {}));
});

function fixture(t, html) {
  const root = mkdtempSync(join(tmpdir(), 'recover-posts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const published = join(root, 'published');
  for (const route of routes) {
    const page = join(published, route);
    mkdirSync(dirname(page), { recursive: true });
    writeFileSync(page, html);
  }
  return {
    root,
    published,
    run: () => spawnSync(process.execPath, [script], {
      cwd: root, env: { ...process.env, PUBLISHED_ROOT: published }, encoding: 'utf8',
    }),
  };
}

test('recovers four deterministic posts with prose, media and intact code HTML', (t) => {
  const f = fixture(t, `<div class="article-content"><h2>Recovered heading</h2>
    <p>Body text <img data-src="/old/图 1.png" src="data:image/gif;base64,placeholder" alt="figure"><img src="/image-5.png"></p>
    <div class="highlight-container"><figure class="highlight"><table><tr><td class="code"><pre><span class="line">if (a &lt; b) { return 1; }</span></pre></td></tr></table></figure></div>
    <table><tr><td class="code"><pre>standalone code</pre></td></tr></table></div>`);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const posts = join(f.root, 'source/_posts');
  const names = readdirSync(posts).sort();
  assert.equal(names.length, 4);
  const contents = names.map((name) => readFileSync(join(posts, name), 'utf8'));
  const hello = readFileSync(join(posts, 'hello-world.md'), 'utf8');
  assert.match(hello, /date: 2023-10-10 20:06:25/);
  assert.match(hello, /## Recovered heading/);
  assert.match(hello, /Body text/);
  assert.match(hello, /\/img\/%E5%9B%BE%201\.png/);
  assert.doesNotMatch(hello, /image-5\.png|data:image/);
  assert.match(hello, /<div class="highlight-container">/);
  assert.match(hello, /if \(a &lt; b\) \{ return 1; \}/);
  assert.match(hello, /<table>.*standalone code.*<\/table>/s);
  assert.equal(f.run().status, 0);
  assert.deepEqual(names.map((name) => readFileSync(join(posts, name), 'utf8')), contents);
});

test('fails when a published page is missing', (t) => {
  const f = fixture(t, '<div class="article-content">Body</div>');
  rmSync(join(f.published, routes[0]));
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing published page/i);
});

test('fails when an article content container is missing', (t) => {
  const f = fixture(t, '<main>No article</main>');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing \.article-content/i);
});

test('generated-site verifier rejects a route whose recovered body text is missing', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'verify-site-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const verifier = join(root, 'test/verify_generated_site.rb');
  mkdirSync(dirname(verifier), { recursive: true });
  copyFileSync(fileURLToPath(new URL('verify_generated_site.rb', import.meta.url)), verifier);
  const pages = {
    'index.html': '',
    '404.html': '',
    'archives/index.html': '',
    'categories/blog/index.html': '',
    'tags/漫谈/index.html': '',
    'tags/课内/index.html': '',
    [routes[0]]: 'First post body is missing',
    [routes[1]]: '关于当下和未来',
    [routes[2]]: '单链表',
    [routes[3]]: '计算机网络和因特网',
  };
  for (const [route, contents] of Object.entries(pages)) {
    const page = join(root, 'public', route);
    mkdirSync(dirname(page), { recursive: true });
    writeFileSync(page, contents);
  }
  const result = spawnSync('ruby', [verifier], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing recovered text in 2023\/10\/10\/hello-world\/index\.html: Welcome to Hexo/);
});
