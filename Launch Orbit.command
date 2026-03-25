#!/usr/bin/env bash
#
# Orbit PRM — Launcher (macOS)
#
# Double-click this file to start Orbit.
#

cd "$(dirname "$0")"

if [ -x "./runtime/node/bin/node" ]; then
    ./runtime/node/bin/node bin/orbit.js
else
    node bin/orbit.js
fi
