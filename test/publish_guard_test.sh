#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
temporary_dir=$(mktemp -d)
trap 'rm -rf "$temporary_dir"' EXIT

target="$temporary_dir/target"
git init -q "$target"
git -C "$target" checkout -q -b not-master

set +e
output=$(bash "$project_root/scripts/publish_to_master.sh" "$target" 2>&1)
status=$?
set -e

if [[ $status -eq 0 ]]; then
  echo 'publisher accepted a target on not-master' >&2
  exit 1
fi
if [[ "$output" != *'target must be on master'* ]]; then
  echo "expected branch guard, got: $output" >&2
  exit 1
fi

echo 'publisher branch guard passed'

assert_rejected() {
  local expected=$1
  shift
  local result
  local exit_status
  set +e
  result=$(bash "$project_root/scripts/publish_to_master.sh" "$@" 2>&1)
  exit_status=$?
  set -e
  if [[ $exit_status -eq 0 || "$result" != *"$expected"* ]]; then
    echo "expected rejection containing '$expected', got status $exit_status: $result" >&2
    exit 1
  fi
}

assert_rejected 'usage: publish_to_master.sh'
mkdir "$target/nested"
assert_rejected 'target must be a Git worktree root' "$target/nested"

git -C "$target" checkout -q -b master
git -C "$target" config user.name 'Publish Guard Test'
git -C "$target" config user.email 'publish-guard@example.invalid'
printf 'old page\n' > "$target/old.html"
mkdir "$target/.worktrees"
printf 'preserve\n' > "$target/.worktrees/marker"
git -C "$target" add old.html .worktrees/marker
git -C "$target" commit -qm 'Seed target'

printf 'changed\n' > "$target/old.html"
assert_rejected 'target worktree must be clean' "$target"
git -C "$target" restore old.html

printf 'staged\n' > "$target/old.html"
git -C "$target" add old.html
assert_rejected 'target worktree must be clean' "$target"
git -C "$target" restore --staged old.html
git -C "$target" restore old.html

printf 'untracked\n' > "$target/untracked.html"
assert_rejected 'target worktree must be clean' "$target"
rm "$target/untracked.html"

fixture_source="$temporary_dir/source"
mkdir -p "$fixture_source/scripts" "$fixture_source/public/.git" \
  "$fixture_source/public/.worktrees" "$temporary_dir/bin"
cp "$project_root/scripts/publish_to_master.sh" "$fixture_source/scripts/"
printf 'new page\n' > "$fixture_source/public/index.html"
printf 'fresh page\n' > "$fixture_source/public/fresh.html"
printf 'do not copy\n' > "$fixture_source/public/.git/injected"
printf 'do not copy\n' > "$fixture_source/public/.worktrees/injected"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" > "$PUBLISH_TEST_MARKER"\nif [[ ${PUBLISH_TEST_FAIL:-0} == 1 ]]; then exit 1; fi\n' > "$temporary_dir/bin/npm"
chmod +x "$temporary_dir/bin/npm"

set +e
PUBLISH_TEST_FAIL=1 PUBLISH_TEST_MARKER="$temporary_dir/failed-npm-arguments" \
  PATH="$temporary_dir/bin:$PATH" \
  bash "$fixture_source/scripts/publish_to_master.sh" "$target" \
  > "$temporary_dir/failed-publish-output" 2>&1
failed_status=$?
set -e
[[ $failed_status -ne 0 && -f "$target/old.html" && ! -e "$target/index.html" ]]

PUBLISH_TEST_MARKER="$temporary_dir/npm-arguments" PATH="$temporary_dir/bin:$PATH" \
  bash "$fixture_source/scripts/publish_to_master.sh" "$target" > "$temporary_dir/publish-output"

[[ $(cat "$temporary_dir/npm-arguments") == test ]]
[[ -f "$target/index.html" && -f "$target/fresh.html" ]]
[[ ! -e "$target/old.html" ]]
[[ -f "$target/.git/HEAD" && -f "$target/.worktrees/marker" ]]
[[ ! -e "$target/.git/injected" && ! -e "$target/.worktrees/injected" ]]
[[ -f "$target/.nojekyll" ]]

linked_origin="$temporary_dir/linked-origin"
linked_target="$temporary_dir/linked-master"
git init -q "$linked_origin"
git -C "$linked_origin" checkout -q -b source
git -C "$linked_origin" config user.name 'Publish Guard Test'
git -C "$linked_origin" config user.email 'publish-guard@example.invalid'
printf 'old page\n' > "$linked_origin/old.html"
git -C "$linked_origin" add old.html
git -C "$linked_origin" commit -qm 'Seed linked worktree'
git -C "$linked_origin" worktree add -q -b master "$linked_target"

PUBLISH_TEST_MARKER="$temporary_dir/linked-npm-arguments" PATH="$temporary_dir/bin:$PATH" \
  bash "$fixture_source/scripts/publish_to_master.sh" "$linked_target" \
  > "$temporary_dir/linked-publish-output"

[[ -f "$linked_target/.git" && -f "$linked_target/index.html" ]]
[[ $(cat "$temporary_dir/linked-npm-arguments") == test ]]
git -C "$linked_target" status --short > /dev/null

echo 'publisher safety cases passed'
