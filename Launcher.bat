@echo off
setlocal EnableDelayedExpansion
title Orbit PRM
color 0F

:: Navigate to script directory
cd /d "%~dp0"

:: --- Locate or download Node.js ---

:: 1. Check system PATH
where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('where node') do (
        set "SYS_NODE=%%i"
        goto :found_system_node
    )
)
goto :check_portable

:found_system_node
for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"

:: Extract major version number (e.g. "v22.16.0" -> "22")
set "VER_STR=!NODE_VER:~1!"
for /f "tokens=1 delims=." %%m in ("!VER_STR!") do set "MAJOR=%%m"

:: Only accept LTS versions: 18, 20, 22
if "!MAJOR!"=="18" goto :system_node_ok
if "!MAJOR!"=="20" goto :system_node_ok
if "!MAJOR!"=="22" goto :system_node_ok

:: Unsupported version
echo.
echo   Found Node.js !NODE_VER! but this version is not supported.
echo   Orbit requires Node.js 18, 20, or 22 LTS.
echo   A compatible version will be downloaded automatically.
echo.
goto :check_portable

:system_node_ok
set "NODE=node"
for %%F in ("!SYS_NODE!") do set "NODE_DIR=%%~dpF"
if exist "!NODE_DIR!npm.cmd" (
    set "NPM=!NODE_DIR!npm.cmd"
) else (
    set "NPM=npm"
)
goto :node_ready

:check_portable
:: 2. Check portable install
if exist ".\runtime\node\node.exe" (
    set "NODE=%~dp0runtime\node\node.exe"
    set "NPM=%~dp0runtime\node\npm.cmd"
    goto :node_ready
)

:: 3. Download portable Node.js
echo.
echo   Node.js is not installed. Downloading portable Node.js v22.16.0...
echo   (This is a one-time download of ~30 MB)
echo.

set "NODE_URL=https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip"
set "NODE_ZIP=%TEMP%\node-v22.16.0-win-x64.zip"

echo   Downloading...
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Download failed. Please check your internet connection.
    echo   You can also install Node.js manually from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo   Extracting...
if not exist ".\runtime" mkdir ".\runtime"
powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '.\runtime' -Force"
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Extraction failed.
    pause
    exit /b 1
)

if exist ".\runtime\node" rmdir /s /q ".\runtime\node"
move ".\runtime\node-v22.16.0-win-x64" ".\runtime\node" >nul
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Could not set up Node.js runtime folder.
    pause
    exit /b 1
)

del "%NODE_ZIP%" >nul 2>nul
echo   Portable Node.js installed successfully.
echo.

set "NODE=%~dp0runtime\node\node.exe"
set "NPM=%~dp0runtime\node\npm.cmd"

:node_ready

:: Prepend portable Node to PATH so npm and child processes use the correct version
for %%F in ("!NODE!") do set "NODE_BIN_DIR=%%~dpF"
set "PATH=!NODE_BIN_DIR!;!PATH!"

:: --- First-run install (only if node_modules is missing) ---

if exist ".\node_modules" goto :launch

echo.
echo   ==============================
echo     Orbit PRM - First Run Setup
echo   ==============================
echo.
for /f "tokens=*" %%i in ('"%NODE%" -v') do echo   Using Node.js %%i
echo.

echo   Installing dependencies...
echo   (This may take a few minutes)
echo.
call "%NPM%" install
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] npm install failed. Check the errors above.
    pause
    exit /b 1
)

echo.
echo   Running first-time setup...
echo.
"%NODE%" bin/setup-only.js
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Setup failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo   Building Orbit...
echo.
call "%NPM%" exec -- next build
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Build failed. Check the errors above.
    pause
    exit /b 1
)

echo.
echo   Setup complete!
echo.

:: --- Launch Orbit ---

:launch
"%NODE%" bin/orbit.js
pause
