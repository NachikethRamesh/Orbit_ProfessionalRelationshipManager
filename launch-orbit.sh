#!/usr/bin/env bash
#
# Orbit CRM — Launcher (macOS / Linux)
#
# Usage:
#   chmod +x launch-orbit.sh
#   ./launch-orbit.sh
#

cd "$(dirname "$0")"
node bin/orbit.js
