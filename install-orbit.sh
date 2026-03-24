#!/usr/bin/env bash
#
# Orbit CRM — Installer (macOS / Linux)
#
# Usage:
#   chmod +x install-orbit.sh
#   ./install-orbit.sh
#

set -e

echo ""
echo "  =============================="
echo "    Orbit CRM — Installation"
echo "  =============================="
echo ""

# Check Node.js is installed
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Please download it from https://nodejs.org"
    echo ""
    exit 1
fi

NODE_VER=$(node -v)
echo "  Found Node.js $NODE_VER"
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

echo "  Installing dependencies..."
echo "  (This may take a few minutes)"
echo ""
npm install

# Run first-time setup (creates ~/.orbit/.env and database)
echo ""
echo "  Running first-time setup..."
echo ""
node bin/setup-only.js
if [ $? -ne 0 ]; then
    echo ""
    echo "  [ERROR] Setup failed or was cancelled."
    exit 1
fi

echo ""
echo "  Building Orbit..."
echo ""
npx next build
if [ $? -ne 0 ]; then
    echo ""
    echo "  [ERROR] Build failed. Check the errors above."
    exit 1
fi

# Make launcher executable
chmod +x "$(dirname "$0")/launch-orbit.sh"

echo ""
echo "  =============================="
echo "    Installation Complete!"
echo "  =============================="
echo ""
echo "  Run ./launch-orbit.sh to start Orbit."
echo "  Or run: node bin/orbit.js"
echo ""
