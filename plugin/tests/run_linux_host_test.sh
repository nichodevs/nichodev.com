#!/usr/bin/env bash
set -euo pipefail

# Xvfb supplies a display, while JUCE's hosted windows also need desktop window-manager atoms.
openbox --sm-disable >8bituner-window-manager.log 2>&1 &
manager_pid=$!
trap 'kill "$manager_pid" 2>/dev/null || true' EXIT

for ((attempt = 0; attempt < 100; ++attempt)); do
  if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q 'window id # 0x'; then
    "$@"
    exit 0
  fi
  if ! kill -0 "$manager_pid" 2>/dev/null; then
    cat 8bituner-window-manager.log >&2
    exit 1
  fi
  sleep 0.1
done

cat 8bituner-window-manager.log >&2
echo 'The virtual desktop window manager did not become ready.' >&2
exit 1
