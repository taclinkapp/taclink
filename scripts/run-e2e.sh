#!/usr/bin/env bash
# Run Playwright E2E tests using nix-provided browsers (sandbox-friendly).
# In CI / local dev with system Chromium installed, run `bunx playwright test` directly.
set -euo pipefail

if command -v nix-shell >/dev/null 2>&1; then
  exec nix-shell -p playwright-driver.browsers --run '
    BROWSERS_PATH=$(echo $buildInputs | tr " " "\n" | grep playwright-browsers | head -1)
    PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_PATH" bunx playwright test "$@"
  ' -- "$@"
else
  exec bunx playwright test "$@"
fi
