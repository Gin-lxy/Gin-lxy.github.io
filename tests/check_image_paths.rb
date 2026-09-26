# frozen_string_literal: true

require "pathname"
require "uri"

ROOT = Pathname.new(__dir__).parent
IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)\z/i
ATTRIBUTE_URL = /(?:content|data-src|href|src)=["']([^"']+)["']/
CSS_URL = /url\(["']?([^"')]+)["']?\)/

missing = []
unrendered_embeds = []

Dir.glob(ROOT.join("**", "*.{css,html}")).sort.each do |source|
  contents = File.binread(source).force_encoding(Encoding::UTF_8)
  unrendered_embeds << Pathname.new(source).relative_path_from(ROOT) if contents.include?("![[")
  urls = contents.scan(ATTRIBUTE_URL).flatten + contents.scan(CSS_URL).flatten

  urls.each do |url|
    if url.start_with?("https://gin-lxy.github.io/")
      url = URI(url).path
    elsif url.start_with?("data:", "http://", "https://", "//", "#")
      next
    end

    path = URI::DEFAULT_PARSER.unescape(url.split(/[?#]/, 2).first)
    next unless path.match?(IMAGE_EXTENSION)

    target = if path.start_with?("/")
               ROOT.join(path.delete_prefix("/"))
             else
               Pathname.new(source).dirname.join(path)
             end

    missing << [Pathname.new(source).relative_path_from(ROOT), url] unless target.file?
  end
end

html_files = Dir.glob(ROOT.join("**", "*.html"))
abort "Expected generated HTML pages" if html_files.empty?

if missing.empty? && unrendered_embeds.empty?
  puts "All local image references resolve to files."
  exit 0
end

unless missing.empty?
  warn "Missing local image references:"
  missing.uniq.each { |source, url| warn "  #{source}: #{url}" }
end

unless unrendered_embeds.empty?
  warn "Unrendered Obsidian image embeds:"
  unrendered_embeds.uniq.each { |source| warn "  #{source}" }
end
exit 1
