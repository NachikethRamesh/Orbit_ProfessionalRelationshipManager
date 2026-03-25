#!/usr/bin/env bash
#
# Orbit PRM — Installer (macOS)
#
# Double-click this file to install Orbit.
#

set -e

echo ""
echo "  =============================="
echo "    Orbit PRM — Installation"
echo "  =============================="
echo ""

# Navigate to script directory
cd "$(dirname "$0")"

# --- Locate or download Node.js ---

# 1. Check system PATH
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    echo "  Found Node.js $NODE_VER on your system."
    NODE="node"
    NPM="npm"

# 2. Check portable install
elif [ -x "./runtime/node/bin/node" ]; then
    echo "  Found portable Node.js in runtime folder."
    NODE="./runtime/node/bin/node"
    NPM="./runtime/node/bin/npm"

# 3. Download portable Node.js
else
    echo "  Node.js is not installed. Downloading portable Node.js v20.18.1..."
    echo "  (This is a one-time download of ~30 MB)"
    echo ""

    # Detect architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        NODE_TARBALL="node-v20.18.1-darwin-arm64.tar.gz"
    else
        NODE_TARBALL="node-v20.18.1-darwin-x64.tar.gz"
    fi
    NODE_URL="https://nodejs.org/dist/v20.18.1/$NODE_TARBALL"

    echo "  Downloading ($ARCH)..."
    mkdir -p ./runtime
    curl -fSL "$NODE_URL" -o "./runtime/$NODE_TARBALL"
    if [ $? -ne 0 ]; then
        echo ""
        echo "  [ERROR] Download failed. Please check your internet connection."
        echo "  You can also install Node.js manually from https://nodejs.org"
        exit 1
    fi

    echo "  Extracting..."
    tar -xzf "./runtime/$NODE_TARBALL" -C ./runtime
    # Move extracted folder to runtime/node
    rm -rf ./runtime/node
    mv "./runtime/${NODE_TARBALL%.tar.gz}" ./runtime/node

    # Clean up tarball
    rm -f "./runtime/$NODE_TARBALL"

    echo "  Portable Node.js installed successfully."
    echo ""

    NODE="./runtime/node/bin/node"
    NPM="./runtime/node/bin/npm"
fi

# Show version
echo "  Using Node.js $($NODE -v)"
echo ""

echo "  Installing dependencies..."
echo "  (This may take a few minutes)"
echo ""
$NPM install

# Run first-time setup (creates ~/.orbit/.env and database)
echo ""
echo "  Running first-time setup..."
echo ""
$NODE bin/setup-only.js
if [ $? -ne 0 ]; then
    echo ""
    echo "  [ERROR] Setup failed or was cancelled."
    exit 1
fi

echo ""
echo "  Building Orbit..."
echo ""
$NPM exec -- next build
if [ $? -ne 0 ]; then
    echo ""
    echo "  [ERROR] Build failed. Check the errors above."
    exit 1
fi

# Make launcher executable
chmod +x "$(dirname "$0")/Launch Orbit.command"

echo ""
echo "  =============================="
echo "    Installation Complete!"
echo "  =============================="
echo ""
echo "  Double-click \"Launch Orbit.command\" to start Orbit."
echo "  Or run: $NODE bin/orbit.js"
echo ""
