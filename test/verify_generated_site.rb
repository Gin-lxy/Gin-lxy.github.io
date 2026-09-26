# frozen_string_literal: true
require "cgi"
require "json"
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
EXPECTED_TEXT = {
  "2023/10/10/hello-world/index.html" => "Welcome to Hexo",
  "2023/11/15/2023秋-关于当下和未来/index.html" => "题记:秋季已完,我仍未得救",
  "2023/11/15/数据结构复习/index.html" => "单链表",
  "2024/03/16/大二下EBU5213 Internet protocols and networks/index.html" => "计算机网络和因特网"
}.freeze
IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)\z/i
ATTRIBUTE_URL = /(?:content|data-src|href|src)=["']([^"']+)["']/
CSS_URL = /url\(["']?([^"')]+)["']?\)/

def article_body(html)
  opening = html.match(/<div\b[^>]*\bclass\s*=\s*["'](?:[^"']*\s)?article-content(?:\s|["'])[^>]*>/i)
  return unless opening

  depth = 1
  rest = html[opening.end(0)..]
  rest.scan(/<\/?div\b[^>]*>/i) do |tag|
    match = Regexp.last_match
    depth += tag.start_with?("</") ? -1 : 1
    return rest[0...match.begin(0)] if depth.zero?
  end
  nil
end

errors = []

EXPECTED_ROUTES.each { |route| errors << "missing route: #{route}" unless PUBLIC.join(route).file? }
EXPECTED_TEXT.each do |route, text|
  page = PUBLIC.join(route)
  contents = File.binread(page).force_encoding(Encoding::UTF_8) if page.file?
  body = article_body(contents) if contents
  errors << "missing article body in #{route}" if contents && !body
  visible_text = CGI.unescapeHTML(body.gsub(/<[^>]*>/u, " ").gsub(/\s+/u, " ")) if body
  errors << "missing recovered text in #{route}: #{text}" if visible_text && !visible_text.include?(text)
end
Dir.glob(PUBLIC.join("**", "*.{css,html}")).sort.each do |source|
  contents = File.binread(source).force_encoding(Encoding::UTF_8)
  relative = Pathname.new(source).relative_path_from(PUBLIC).to_s.force_encoding(Encoding::UTF_8)
  errors << "unrendered Obsidian embed: #{relative}" if contents.include?("![[")
  errors << "visitor counter script in #{relative}" if contents.match?(/<script\b[^>]*\bsrc=["']https:\/\/(?:cn\.)?vercount\.one\/js["']/i)
  errors << "visitor counter markup in #{relative}" if contents.include?("busuanzi_container_") || contents.include?("busuanzi_value_")
  errors << "visitor counter endpoint in #{relative}" if contents.include?("vercount.one")
  urls = contents.scan(ATTRIBUTE_URL).flatten + contents.scan(CSS_URL).flatten
  urls.each do |url|
    if url.start_with?("https://gin-lxy.github.io/")
      # Published routes contain literal Unicode and spaces, which URI() rejects.
      url = url.delete_prefix("https://gin-lxy.github.io")
    elsif url.start_with?("data:", "http://", "https://", "//", "#")
      next
    end
    path = URI::DEFAULT_PARSER.unescape(url.split(/[?#]/, 2).first)
    next unless path.match?(IMAGE_EXTENSION)
    target = path.start_with?("/") ? PUBLIC.join(path.delete_prefix("/")) : Pathname.new(source).dirname.join(path)
    errors << "missing image from #{relative}: #{url}" unless target.file?
  end
end

if PUBLIC.join("index.html").file?
  index = File.binread(PUBLIC.join("index.html")).force_encoding(Encoding::UTF_8)
  errors << "expected Hexo 8.0.0 metadata" unless index.include?('content="Hexo 8.0.0"')
  errors << "expected Redefine 2.9.0 metadata" unless index.include?('"version":"2.9.0"')
  errors << "expected site Open Graph description" unless index.include?('property="og:description" content="GIn&#39;s notebook"')
  theme_json = index[/window\.theme\s*=\s*(\{[^\n]*\});/, 1]
  if theme_json
    theme = JSON.parse(theme_json)
    social = theme.fetch("home_banner").fetch("social_links")
    errors << "expected disabled social links" unless social.fetch("enable") == false
    errors << "expected empty effective social links" unless social.fetch("links") == []
    errors << "expected empty effective social QR codes" unless social.fetch("qrs") == []
    errors << "expected disabled visitor counter" unless theme.fetch("global").fetch("website_counter").fetch("enable") == false
  else
    errors << "missing generated theme config"
  end
end

abort errors.uniq.join("\n") unless errors.empty?
puts "Generated-site contract passed."
