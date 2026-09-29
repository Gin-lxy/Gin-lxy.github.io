# frozen_string_literal: true
require "cgi"
require "json"
require "pathname"
require "uri"

ROOT = Pathname.new(__dir__).parent
PUBLIC = ROOT.join("public")
EXPECTED_ROUTES = [
  "index.html", "404.html", "archives/index.html",
  "categories/index.html", "tags/index.html", "about/index.html",
  "categories/本科/index.html", "categories/漫谈/index.html", "categories/daily-paper/index.html", "categories/笔记/index.html",
  "tags/数据结构/index.html", "tags/计算机网络/index.html", "tags/随笔/index.html", "tags/强化学习/index.html", "tags/LLM/index.html",
  "search.xml",
  "2023/11/15/2023秋-关于当下和未来/index.html",
  "2023/11/15/数据结构复习/index.html",
  "2024/03/16/大二下EBU5213 Internet protocols and networks/index.html",
  "2026/09/01/agentic-rl-infra-conversation-notes/index.html",
  "2026/09/29/rl-algorithms-ppo-dpo-grpo-gspo-credit-assignment/index.html"
].freeze
EXPECTED_TEXT = {
  "2023/11/15/2023秋-关于当下和未来/index.html" => "题记:秋季已完,我仍未得救",
  "2023/11/15/数据结构复习/index.html" => "单链表",
  "2024/03/16/大二下EBU5213 Internet protocols and networks/index.html" => "计算机网络和因特网",
  "2026/09/01/agentic-rl-infra-conversation-notes/index.html" => "有效训练收益",
  "2026/09/29/rl-algorithms-ppo-dpo-grpo-gspo-credit-assignment/index.html" => "细粒度信用分配"
}.freeze
EXPECTED_TITLES = {
  "index.html" => "GIn",
  "2023/11/15/数据结构复习/index.html" => "数据结构复习 | GIn"
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
EXPECTED_TITLES.each do |route, title|
  page = PUBLIC.join(route)
  contents = File.binread(page).force_encoding(Encoding::UTF_8) if page.file?
  found = contents[/<title>\s*(.*?)\s*<\/title>/m, 1] if contents
  errors << "expected tab title #{title.inspect} in #{route}, got #{found.inspect}" unless found == title
end
Dir.glob(PUBLIC.join("**", "*.{css,html}")).sort.each do |source|
  contents = File.binread(source).force_encoding(Encoding::UTF_8)
  relative = Pathname.new(source).relative_path_from(PUBLIC).to_s.force_encoding(Encoding::UTF_8)
  errors << "unrendered Obsidian embed: #{relative}" if contents.include?("![[")
  errors << "theme default branding in #{relative}" if contents.include?("Theme Redefine") || contents.include?("Redefine Your Hexo Journey")
  errors << "site brand leaked into tab title in #{relative}" if contents.match?(/<title>[^<]*GIn(?:&#39;|')s notebook/m)
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
  errors << "expected avatar favicon link" unless index.include?('href="/images/favicon.png"')
  errors << "expected code block override stylesheet link" unless index.include?('href="/css/codeblock.css"')
  theme_json = index[/window\.theme\s*=\s*(\{[^\n]*\});/, 1]
  if theme_json
    theme = JSON.parse(theme_json)
    social = theme.fetch("home_banner").fetch("social_links")
    errors << "expected disabled social links" unless social.fetch("enable") == false
    errors << "expected empty effective social links" unless social.fetch("links") == []
    errors << "expected empty effective social QR codes" unless social.fetch("qrs") == []
    errors << "expected disabled visitor counter" unless theme.fetch("global").fetch("website_counter").fetch("enable") == false
    errors << "expected simple code block style" unless theme.fetch("articles").fetch("code_block").fetch("style") == "simple"
  else
    errors << "missing generated theme config"
  end
end

# Math rendering contract: LaTeX in daily-paper reports is rendered to KaTeX HTML at build time.
DAILY_PAPER_ROUTE = "2026/09/27/2609.29845v1_Your_Transformer_Can_Hold_Two_Thoughts_at_Once_Evidence_of_Linear_Superposition_in_LLMs/index.html"
Dir.glob(PUBLIC.join("**", "*.html").to_s).sort.each do |page|
  relative = Pathname.new(page).relative_path_from(PUBLIC).to_s.force_encoding(Encoding::UTF_8)
  contents = File.binread(page).force_encoding(Encoding::UTF_8)
  errors << "leaked math placeholder in #{relative}" if contents.include?("qxmath")
  next unless contents.include?('class="katex')
  errors << "katex formula error in #{relative}" if contents.include?("katex-error")
  next unless relative.start_with?("2026/")
  body = article_body(contents)
  errors << "missing article body in #{relative}" unless body
  errors << "unrendered display math in #{relative}" if body && body.include?("$$")
end
known_page = PUBLIC.join(DAILY_PAPER_ROUTE)
if known_page.file?
  contents = File.binread(known_page).force_encoding(Encoding::UTF_8)
  errors << "expected KaTeX-rendered math in #{DAILY_PAPER_ROUTE}" unless contents.include?('class="katex"')
  errors << "expected source TeX preserved in #{DAILY_PAPER_ROUTE}" unless contents.include?('\mathcal{R}_{\mathcal{D}}')
  errors << "expected local KaTeX stylesheet link in #{DAILY_PAPER_ROUTE}" unless contents.include?('href="/css/katex/katex.min.css"')
else
  errors << "missing route: #{DAILY_PAPER_ROUTE}"
end
errors << "missing route: css/katex/katex.min.css" unless PUBLIC.join("css/katex/katex.min.css").file?
errors << "missing KaTeX font: css/katex/fonts/KaTeX_Main-Regular.woff2" unless PUBLIC.join("css/katex/fonts/KaTeX_Main-Regular.woff2").file?
codeblock_css = PUBLIC.join("css/codeblock.css")
errors << "missing route: css/codeblock.css" unless codeblock_css.file?
if codeblock_css.file?
  css = File.binread(codeblock_css).force_encoding(Encoding::UTF_8)
  errors << "expected code label hidden in css/codeblock.css" unless css.include?(".code-container::before") && css.include?("content: none")
end

abort errors.uniq.join("\n") unless errors.empty?
puts "Generated-site contract passed."
