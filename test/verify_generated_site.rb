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
EXPECTED_TEXT = {
  "2023/10/10/hello-world/index.html" => "Welcome to Hexo",
  "2023/11/15/2023秋-关于当下和未来/index.html" => "关于当下和未来",
  "2023/11/15/数据结构复习/index.html" => "单链表",
  "2024/03/16/大二下EBU5213 Internet protocols and networks/index.html" => "计算机网络和因特网"
}.freeze
IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)\z/i
ATTRIBUTE_URL = /(?:content|data-src|href|src)=["']([^"']+)["']/
CSS_URL = /url\(["']?([^"')]+)["']?\)/
errors = []

EXPECTED_ROUTES.each { |route| errors << "missing route: #{route}" unless PUBLIC.join(route).file? }
EXPECTED_TEXT.each do |route, text|
  page = PUBLIC.join(route)
  contents = File.binread(page).force_encoding(Encoding::UTF_8) if page.file?
  errors << "missing recovered text in #{route}: #{text}" if contents && !contents.include?(text)
end
Dir.glob(PUBLIC.join("**", "*.{css,html}")).sort.each do |source|
  contents = File.binread(source).force_encoding(Encoding::UTF_8)
  relative = Pathname.new(source).relative_path_from(PUBLIC)
  errors << "unrendered Obsidian embed: #{relative}" if contents.include?("![[")
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

abort errors.uniq.join("\n") unless errors.empty?
puts "Generated-site contract passed."
