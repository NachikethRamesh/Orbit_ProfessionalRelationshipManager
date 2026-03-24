@echo off
title Orbit CRM - Installer
color 0F

echo.
echo   ==============================
echo     Orbit CRM - Installation
echo   ==============================
echo.

:: Check Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js is not installed.
    echo   Please download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Show Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo   Found Node.js %NODE_VER%
echo.

:: Navigate to script directory (where the repo was cloned)
cd /d "%~dp0"

echo   Installing dependencies...
echo   (This may take a few minutes)
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo   [WARNING] npm install had issues. Trying to build native modules...
    echo.
    cd node_modules\better-sqlite3
    call npx --yes node-gyp@latest rebuild --release
    cd /d "%~dp0"
)

:: Run first-time setup (creates ~/.orbit/.env and database)
echo.
echo   Running first-time setup...
echo.
node bin/setup-only.js
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Setup failed or was cancelled.
    pause
    exit /b 1
)

echo.
echo   Building Orbit...
echo.
call npx next build
if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Build failed. Check the errors above.
    pause
    exit /b 1
)

:: Create the launcher
echo @echo off > "%~dp0Launch Orbit.bat"
echo title Orbit CRM >> "%~dp0Launch Orbit.bat"
echo cd /d "%%~dp0" >> "%~dp0Launch Orbit.bat"
echo node bin/orbit.js >> "%~dp0Launch Orbit.bat"
echo pause >> "%~dp0Launch Orbit.bat"

echo.
echo   ==============================
echo     Installation Complete!
echo   ==============================
echo.
echo   A "Launch Orbit.bat" file has been created.
echo   Double-click it anytime to start Orbit.
echo.
echo   Or run: node bin/orbit.js
echo.
pause
