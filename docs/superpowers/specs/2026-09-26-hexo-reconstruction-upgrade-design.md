# Hexo Source Reconstruction and Upgrade Design

## Objective

Reconstruct a maintainable Hexo source project from the published static site, upgrade it in controlled stages from Hexo 6.3.0 and Redefine 2.5.0 to Hexo 8 and Redefine 2.9.0, preserve the existing public URLs and content, and publish the verified result to `Gin-lxy/Gin-lxy.github.io`.

## Known Constraints

- The original Hexo source tree, Markdown files, `package.json`, and configuration files are unavailable.
- The only recoverable source of truth is the generated site in the repository and its Git history.
- The current GitHub Pages site is served from the `master` branch root and must remain available without requiring a repository-settings change.
- Existing public article URLs, dates, tags, categories, article text, code samples, and local images must remain available.
- The image-path fixes already present in the working tree must survive regeneration.
- Hexo 8 requires Node.js 20.19.0 or newer.

## Selected Architecture

The repository will use two branches with separate responsibilities:

- `source`: the maintainable Hexo project. It contains the site configuration, recovered posts, assets, dependency lockfile, tests, and CI workflow.
- `master`: generated static files only. It remains the branch served by GitHub Pages.

Work will be performed in isolated worktrees so the current dirty `master` checkout and its image fixes are not lost. The source branch will be created as a clean branch rather than copying all generated assets into the source project.

## Source Reconstruction

The published HTML is the authoritative recovery input. Reconstruction will:

1. Recover one source post for every published article.
2. Preserve each article's published date, title, tags, category, and permalink.
3. Recover the article body from `.article-content` and convert it into maintainable Markdown where conversion is lossless.
4. Preserve complex generated HTML blocks as explicit raw HTML when automatic Markdown conversion would damage code, lists, tables, or equations.
5. Copy all referenced local media into the Hexo source asset tree and rewrite references to stable `/img/...` URLs.
6. Replace leaked Obsidian `![[...]]` embeds with standard Markdown or HTML image syntax.
7. Reconstruct the site identity and navigation from the generated pages, using Redefine defaults for configuration that cannot be inferred safely.

The reconstruction will not invent unavailable prose or images. The missing historical `/image-5.png` reference will remain omitted unless a real asset can be recovered.

## Staged Upgrade

The build will advance through three independently verified stages:

1. **Recovered baseline:** Hexo 6.3.0 with Redefine 2.5.0. This proves that the recovered sources and configuration can generate the known routes.
2. **Intermediate framework upgrade:** Hexo 7.3.x. This isolates Hexo 7 migration issues, especially syntax-highlighter and removed built-in tag behavior.
3. **Final supported stack:** Hexo 8.x with Redefine 2.9.0 on Node.js 20.19.0 or newer. Theme configuration will be migrated to the current schema, including any deprecated social-link and writing-module settings.

Each stage must generate successfully before the next dependency change is made. Dependency versions will be locked in `package-lock.json`.

## Build and Deployment Flow

The source branch will expose deterministic npm commands:

- `npm run clean`: remove generated output through Hexo.
- `npm run build`: generate the complete static site.
- `npm test`: run structural, route, image-reference, and leaked-embed checks against the generated output.
- `npm run verify`: run a clean build followed by all checks.

A repository-owned deployment script will update a checked-out `master` worktree from the verified generated directory. It will replace generated files while preserving Git metadata, create a normal commit, and never force-push.

GitHub Actions on `source` will install the locked dependencies with Node.js 20, run the clean build, and execute the same verification suite. Automatic cross-branch commits will not be enabled initially; this avoids granting broader workflow write permissions than necessary. The first verified deployment will be committed and pushed to `master` during this task.

## Verification

The final upgrade is accepted only when all of the following are true:

- `npm ci` succeeds with the committed lockfile on the required Node version.
- `npm run verify` exits successfully from a clean source checkout.
- Every previously published article, archive, tag, category, and 404 route is generated.
- Every local HTML and CSS image reference resolves to a generated file.
- No Obsidian `![[...]]` image embeds remain in generated pages.
- Representative PNG, JPEG/WebP, and SVG assets return HTTP 200 with appropriate content types from a local server.
- Generated pages identify the final Hexo and Redefine versions.
- `git diff --check` passes on both branches.
- The `source` branch and updated `master` branch are pushed successfully to `origin`.

## Failure Handling and Rollback

- Existing `master` files will not be deleted or overwritten until the reconstructed source passes a clean build and verification.
- The current published commit remains in Git history and can be restored without a force-push.
- If Hexo 8 or Redefine 2.9 introduces an unresolved compatibility failure, the last passing upgrade stage will be retained and documented rather than publishing an unverified site.
- Pushes will be normal fast-forward pushes. Authentication or branch-protection failures will be reported without bypassing protections.

## Out of Scope

- Recovering prose or images that never existed in the repository or published pages.
- Redesigning the site's visual identity or navigation beyond changes required by the supported Redefine configuration.
- Changing GitHub Pages repository settings.
- Adding third-party analytics, comments, accounts, or secrets.
