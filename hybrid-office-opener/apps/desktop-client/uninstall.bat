@echo off
chcp 65001 >nul
title OfficeX Uninstaller

set "SCRIPT_DIR=%~dp0"

powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-gui.ps1" -Action uninstall

echo.
echo Nhan phim bat ky de dong...
pause > nul
