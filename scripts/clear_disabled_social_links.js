// Hexo merges theme arrays by index, so YAML [] retains Redefine's examples.
// Apply the site's empty arrays after theme processing and before rendering.
hexo.extend.filter.register('before_generate', function (data) {
  const social = hexo.theme.config.home_banner?.social_links;
  if (social?.enable === false) {
    social.links = [];
    social.qrs = [];
  }
  return data;
});
