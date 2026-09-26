// The theme derives both the navbar brand and the browser tab title from
// theme.info.title, so the tab title is rewritten after rendering to keep the
// navbar brand ("GIn's notebook") while showing "GIn" in the tab.
const TAB_BRAND = 'GIn';

// EJS escapes <%= %> output, so the brand appears as "GIn&#39;s notebook" in the HTML.
const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&#34;')
  .replace(/'/g, '&#39;');

hexo.extend.filter.register('after_render:html', function (html) {
  const info = (hexo.theme && hexo.theme.config && hexo.theme.config.info) || {};
  const brand = info.title || hexo.config.title;
  if (!brand) return html;
  const escapedBrand = escapeHtml(brand);
  return html.replace(/<title>([\s\S]*?)<\/title>/i, (match, inner) => {
    const text = inner.replace(/\s+/g, ' ').trim();
    if (text === escapedBrand || text.startsWith(`${escapedBrand} - `)) {
      return `<title>${TAB_BRAND}</title>`;
    }
    const suffix = ` | ${escapedBrand}`;
    if (text.endsWith(suffix)) {
      return `<title>${text.slice(0, -suffix.length)} | ${TAB_BRAND}</title>`;
    }
    return match;
  });
});
