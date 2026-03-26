@echo off
title Orbit PRM
cd /d "%~dp0"
if exist ".\runtime\node\node.exe" (
    "%~dp0runtime\node\node.exe" bin/orbit.js
) else (
    node bin/orbit.js
)
pause
