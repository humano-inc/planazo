#!/usr/bin/env bash
# Prints the value for `eas update --platform`: the platforms where a finished
# build on this channel can run the current code. An update only reaches a binary
# with the same runtime version, so a native change leaves that platform behind
# until its next build. Warns about a platform left behind, and refuses when the
# update would reach nobody.
#
# Run from apps/mobile, where `expo-updates` resolves.
#
#   ship-platforms.sh <channel>

set -euo pipefail

channel=${1:?usage: ship-platforms.sh <channel>}

runtime_version() {
  expo-updates runtimeversion:resolve --platform "$1" | python3 -c '
import json, sys
print(json.load(sys.stdin)["runtimeVersion"])
'
}

build_count() {
  eas build:list --platform "$1" --channel "$channel" --runtime-version "$2" \
    --status finished --limit 1 --json --non-interactive | python3 -c '
import json, sys
print(len(json.load(sys.stdin)))
'
}

reachable=()
missing=""
for platform in ios android; do
  runtime=$(runtime_version "$platform")
  count=$(build_count "$platform" "$runtime")
  if [ "$count" -gt 0 ]; then
    reachable+=("$platform")
  else
    missing="$missing $platform"
    # On stderr: stdout carries the answer, and GitHub reads commands from both.
    echo "::warning::No finished $channel build of $platform has runtime $runtime. This update will not reach $platform until a new build ships." >&2
  fi
done

case ${#reachable[@]} in
  0)
    echo "::error::Not shipping: no finished $channel build can run this code (missing:$missing). A native change needs a new store build first." >&2
    exit 1
    ;;
  1) echo "${reachable[0]}" ;;
  *) echo "all" ;;
esac
