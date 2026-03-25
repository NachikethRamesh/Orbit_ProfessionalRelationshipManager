@echo off
setlocal EnableDelayedExpansion
title Orbit CRM - Installer
color 0F

echo.
echo   ==============================
echo     Orbit CRM - Installation
echo   ==============================
echo.

:: Navigate to script directory (where the repo was cloned)
cd /d "%~dp0"

:: --- Locate or download Node.js ---

:: 1. Check system PATH
where node >nul 2>nul
if %errorlevel% equ 0 (
    :: Resolve the full path to the system node so we can find npm beside it
    for /f "tokens=*" %%i in ('where node') do (
        set "SYS_NODE=%%i"
        goto :found_system_node
    )
)
goto :check_portable

:found_system_node
for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"
echo   Found Node.js !NODE_VER! on your system.
set "NODE=node"
:: Use the npm that lives next to the system node executable (avoids local shims)
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
    echo   Found portable Node.js in runtime folder.
    set "NODE=%~dp0runtime\node\node.exe"
    set "NPM=%~dp0runtime\node\npm.cmd"
    goto :node_ready
)

:: 3. Download portable Node.js
echo   Node.js is not installed. Downloading portable Node.js v20.18.1...
echo   (This is a one-time download of ~30 MB)
echo.

set "NODE_URL=https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip"
set "NODE_ZIP=%TEMP%\node-v20.18.1-win-x64.zip"

:: Download using PowerShell
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

:: Extract
echo   Extracting...
if not exist ".\runtime" mkdir ".\runtime"
powershell -NoProfile -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '.\runtime' -Force"
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Extraction failed.
    pause
    exit /b 1
)

:: Move extracted folder to runtime\node
if exist ".\runtime\node" rmdir /s /q ".\runtime\node"
move ".\runtime\node-v20.18.1-win-x64" ".\runtime\node" >nul
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Could not set up Node.js runtime folder.
    pause
    exit /b 1
)

:: Clean up zip
del "%NODE_ZIP%" >nul 2>nul

echo   Portable Node.js installed successfully.
echo.

set "NODE=%~dp0runtime\node\node.exe"
set "NPM=%~dp0runtime\node\npm.cmd"

:node_ready

:: Show version
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

:: Run first-time setup (creates ~/.orbit/.env and database)
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

:: Create the launcher with portable node support
(
echo @echo off
echo title Orbit CRM
echo cd /d "%%~dp0"
echo if exist ".\runtime\node\node.exe" ^(
echo     "%%~dp0runtime\node\node.exe" bin/orbit.js
echo ^) else ^(
echo     node bin/orbit.js
echo ^)
echo pause
) > "%~dp0Launch Orbit.bat"

echo.
echo   ==============================
echo     Installation Complete!
echo   ==============================
echo.
echo   A "Launch Orbit.bat" file has been created.
echo   Double-click it anytime to start Orbit.
echo.
pause
