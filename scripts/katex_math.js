// hexo-renderer-marked mangles LaTeX before any math renderer could see it
// (underscores become <em> emphasis, "=" becomes &#x3D;), so math is extracted
// from the raw Markdown up front, swapped for placeholder tokens, and rendered
// to KaTeX HTML after the Markdown pass.
const katex = require('katex');

const TOKEN = /qxmath([di])([0-9a-f]+)qxend/g;
// Prose that quotes a literal dollar sign ("use '$' to terminate") is not math.
const QUOTES = /['"‘’“”`]/;

function encodeToken(tex, displayMode) {
  return `qxmath${displayMode ? 'd' : 'i'}${Buffer.from(tex, 'utf8').toString('hex')}qxend`;
}

function renderToken(mode, hex) {
  return katex.renderToString(Buffer.from(hex, 'hex').toString('utf8'), {
    displayMode: mode === 'd',
    throwOnError: false,
    strict: false
  });
}

function isEscaped(content, index) {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && content[i] === '\\'; i -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function findClosingDollar(content, from, accepts) {
  for (let i = from; i < content.length; i += 1) {
    if (content[i] === '$' && !isEscaped(content, i) && accepts(i)) return i;
  }
  return -1;
}

function runLength(content, from, char) {
  let end = from;
  while (end < content.length && content[end] === char) end += 1;
  return end - from;
}

// Inline math must close on the same line, before a dollar that is not
// followed by a digit (pandoc's currency guard), and must not have swallowed
// an earlier dollar (that would mean "$2.41 ... $3.06" was read as math).
function findInlineClose(content, from) {
  const lineEnd = content.indexOf('\n', from);
  const limit = lineEnd === -1 ? content.length : lineEnd;
  for (let i = from; i < limit; i += 1) {
    if (content[i] !== '$' || isEscaped(content, i)) continue;
    if (content[i + 1] === '$') break;
    if (/\s/.test(content[i - 1]) || /\d/.test(content[i + 1] || '')) continue;
    let swallowed = false;
    for (let j = from; j < i; j += 1) {
      if (content[j] === '$' && !isEscaped(content, j)) swallowed = true;
    }
    if (swallowed) continue;
    return i;
  }
  return -1;
}

function findFenceClose(content, from, char, run) {
  const pattern = new RegExp(`^ {0,3}${char}{${run},}[ \\t]*$`, 'm');
  const match = pattern.exec(content.slice(from));
  return match ? from + match.index + match[0].length : -1;
}

function findBacktickClose(content, from, run) {
  for (let i = from; i < content.length; i += 1) {
    if (content[i] !== '`') continue;
    const length = runLength(content, i, '`');
    if (length === run) return i;
    i += length - 1;
  }
  return -1;
}

function protectMath(content) {
  let out = '';
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    const linePrefix = content.slice(content.lastIndexOf('\n', i - 1) + 1, i);

    if (/^ {0,3}$/.test(linePrefix) && (char === '`' || char === '~')) {
      const run = runLength(content, i, char);
      if (run >= 3) {
        const newline = content.indexOf('\n', i + run);
        const close = findFenceClose(content, newline === -1 ? content.length : newline + 1, char, run);
        const end = close === -1 ? content.length : close;
        out += content.slice(i, end);
        i = end;
        continue;
      }
    }

    if (char === '`') {
      const run = runLength(content, i, '`');
      const close = findBacktickClose(content, i + run, run);
      const end = close === -1 ? i + run : close + run;
      out += content.slice(i, end);
      i = end;
      continue;
    }

    if (char === '\\') {
      out += content.slice(i, i + 2);
      i += 2;
      continue;
    }

    if (char === '$' && content[i + 1] === '$') {
      const close = findClosingDollar(content, i + 2, (index) => content[index + 1] === '$');
      if (close !== -1) {
        out += encodeToken(content.slice(i + 2, close), true);
        i = close + 2;
        continue;
      }
    }

    if (char === '$' && content[i + 1] && !/\s/.test(content[i + 1]) && !QUOTES.test(content[i + 1])) {
      const close = findInlineClose(content, i + 1);
      if (close !== -1) {
        out += encodeToken(content.slice(i + 1, close), false);
        i = close + 1;
        continue;
      }
    }

    out += char;
    i += 1;
  }
  return out;
}

hexo.extend.filter.register('before_post_render', (data) => {
  data.content = protectMath(data.content);
  return data;
});

hexo.extend.filter.register('after_post_render', (data) => {
  // Markdown builds heading ids from the placeholder text; drop the token there.
  let content = data.content.replace(/(<[^>]*\bid="[^"]*?)qxmath[di][0-9a-f]*qxend([^"]*")/g, '$1$2');
  content = content.replace(/<p>\s*(qxmathd[0-9a-f]+qxend)\s*<\/p>/g, (match, token) => {
    const [, mode, hex] = token.match(/qxmath([di])([0-9a-f]+)qxend/);
    return renderToken(mode, hex);
  });
  data.content = content.replace(TOKEN, (match, mode, hex) => renderToken(mode, hex));
  return data;
});

hexo.extend.filter.register('after_render:html', (html) => {
  if (!html.includes('class="katex')) return html;
  const href = `${hexo.config.root || '/'}css/katex/katex.min.css`;
  return html.replace('</head>', `<link rel="stylesheet" href="${href}"></head>`);
});

module.exports = { protectMath };
