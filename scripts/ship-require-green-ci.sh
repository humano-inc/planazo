#!/usr/bin/env bash
# Refuses to ship a commit unless its CI run on main passed. That run's `deploy`
# job pushes the migrations, so green also means the database is already ahead
# of the JavaScript about to go out.
#
#   ship-require-green-ci.sh <commit>

set -euo pipefail

commit=${1:?usage: ship-require-green-ci.sh <commit>}

refuse() {
  echo "::error::Not shipping $commit: $1"
  exit 1
}

runs=$(gh run list --workflow ci.yml --branch main --event push --commit "$commit" \
  --limit 1 --json status,conclusion,url)

# One field per line: a run in progress has an empty conclusion, and `read` would
# collapse an empty field out of a single delimited line.
fields=$(printf '%s' "$runs" | python3 -c '
import json, sys
runs = json.load(sys.stdin)
if runs:
    print("\n".join([runs[0]["status"], runs[0]["conclusion"], runs[0]["url"]]))
')

[ -n "$fields" ] || refuse "CI has no run for it on main. Only a commit on main can ship."

{
  read -r status
  read -r conclusion
  read -r url
} <<< "$fields"

[ "$status" = "completed" ] || refuse "CI is still running. Press Ship again when it finishes. $url"
[ "$conclusion" = "success" ] || refuse "CI finished as '$conclusion'. Fix main first. $url"

echo "CI passed for $commit: $url"
