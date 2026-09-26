// Hexo 6 evaluates every file in scripts/ as a CommonJS plugin. Dynamic
// imports keep this one-off ESM recovery command inert in that loader.
async function recoverPosts() {
const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
const { basename, dirname, resolve } = await import('node:path');
const { load } = await import('cheerio');
const { default: TurndownService } = await import('turndown');

const posts = [
  ["2023/10/10/hello-world/index.html", "source/_posts/hello-world.md", "Hello World", "2023-10-10 20:06:25", [], []],
  ["2023/11/15/2023秋-关于当下和未来/index.html", "source/_posts/2023秋-关于当下和未来.md", "2023秋-关于当下和未来", "2023-11-15 21:48:20", ["漫谈"], []],
  ["2023/11/15/数据结构复习/index.html", "source/_posts/数据结构复习.md", "数据结构复习", "2023-11-15 21:48:20", ["课内"], []],
  ["2024/03/16/大二下EBU5213 Internet protocols and networks/index.html", "source/_posts/大二下EBU5213 Internet protocols and networks.md", "EBU5213 Internet protocols and networks", "2024-03-16 18:56:00", [], ["blog"]]
];

  if (!process.env.PUBLISHED_ROOT) throw new Error('PUBLISHED_ROOT is required');
  const publishedRoot = resolve(process.env.PUBLISHED_ROOT);
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  // Code tables include line numbers and syntax spans; ordinary tables can
  // contain layout or equations that plain Markdown cannot faithfully express.
  turndown.addRule('preserveComplexHTML', {
    filter: (node) => node.classList.contains('highlight-container') || node.nodeName === 'TABLE',
    replacement: (_content, node) => `\n\n${node.outerHTML}\n\n`,
  });

  // Validate and convert every input before replacing any recovered source.
  const recovered = posts.map(([route, output, title, date, tags, categories]) => {
    const input = resolve(publishedRoot, route);
    if (!existsSync(input)) throw new Error(`Missing published page: ${input}`);
    const $ = load(readFileSync(input, 'utf8'));
    const article = $('.article-content').first();
    if (!article.length) throw new Error(`Missing .article-content: ${input}`);
    article.find('a.headerlink').remove();
    article.find('img').each((_index, element) => {
      const image = $(element);
      const source = image.attr('data-src') || image.attr('src');
      if (!source) return;
      const url = new URL(source, 'https://gin-lxy.github.io/');
      if (url.origin !== 'https://gin-lxy.github.io') return;
      const filename = basename(decodeURIComponent(url.pathname));
      if (filename === 'image-5.png') {
        image.remove();
        return;
      }
      image.attr('src', `/img/${encodeURIComponent(filename)}`);
      image.removeAttr('data-src');
    });
    const frontMatter = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${date}`,
      // An explicit permalink preserves the historical route's literal spaces.
      `permalink: ${JSON.stringify(route.replace(/index\.html$/, ''))}`,
      `tags: ${JSON.stringify(tags)}`,
      `categories: ${JSON.stringify(categories)}`,
      '---',
    ].join('\n');
    return [output, `${frontMatter}\n\n${turndown.turndown(article.html())}\n`];
  });
  for (const [output, contents] of recovered) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, contents);
    console.log(`Recovered ${output}`);
  }
}

if (typeof hexo === 'undefined') {
  recoverPosts().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
