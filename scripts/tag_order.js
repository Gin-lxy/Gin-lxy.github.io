// The theme's tags page renders tags in creation order. Patch its view at
// build time to sort by post count (descending, ties by name) instead of
// editing files inside node_modules. The cloud style branch (if enabled via
// theme.page_templates.tags_style) also gets count-ordered.
//
// scripts/ run before theme.process() registers views, so setView must be
// deferred to the before_generate filter (after load, before rendering).
hexo.extend.filter.register('before_generate', function () {
  const path = 'pages/tag/tags.ejs';
  const view = hexo.theme.getView(path);
  if (!view) {
    hexo.log.warn('[tag_order] view not found: ' + path + '; tags page order unchanged');
    return;
  }
  const content = view.data._content;
  let updated = content;
  const listFrom = 'site.tags.forEach(function(tag){';
  const listTo = "site.tags.sort('-length name').forEach(function(tag){";
  const cloudFrom = 'tagcloud({ min_font: 1, max_font: 5, unit: \'rem\', amount: 100 })';
  const cloudTo = 'tagcloud({ min_font: 1, max_font: 5, unit: \'rem\', amount: 100, orderby: \'length\', order: -1 })';
  if (updated.includes(listFrom)) updated = updated.replace(listFrom, listTo);
  if (updated.includes(cloudFrom)) updated = updated.replace(cloudFrom, cloudTo);
  if (updated === content) {
    hexo.log.warn('[tag_order] no known patterns matched; tags page order unchanged');
    return;
  }
  hexo.theme.setView(path, updated);
});
