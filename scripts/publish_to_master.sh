#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo 'usage: publish_to_master.sh TARGET_MASTER_WORKTREE' >&2
  exit 1
fi

target=$(cd "$1" && pwd -P)
target_root=$(git -C "$target" rev-parse --show-toplevel)
if [[ "$target_root" != "$target" ]]; then
  echo 'target must be a Git worktree root' >&2
  exit 1
fi

if [[ $(git -C "$target" branch --show-current) != master ]]; then
  echo 'target must be on master' >&2
  exit 1
fi

if ! git -C "$target" diff --quiet || ! git -C "$target" diff --cached --quiet ||
  [[ -n $(git -C "$target" ls-files --others --exclude-standard) ]]; then
  echo 'target worktree must be clean' >&2
  exit 1
fi

source_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
if [[ ! -f "$source_root/public/index.html" ]]; then
  echo 'public/index.html is missing' >&2
  exit 1
fi

(cd "$source_root" && npm test)

rsync -a --delete --exclude='.git/' --exclude='.git' --exclude='.worktrees/' \
  "$source_root/public/" "$target/"
touch "$target/.nojekyll"
git -C "$target" status --short
