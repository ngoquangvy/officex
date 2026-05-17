@echo off
chcp 65001 >nul
title OfficeX Installer

set "SCRIPT_DIR=%~dp0"

echo =====================================
echo       OfficeX — Cài đặt
echo =====================================
echo.
echo 1. Giao diện đồ họa (GUI)
echo 2. Dòng lệnh (CLI)
echo.
set /p choice="Chọn (1 hoặc 2): "

if "%choice%"=="1" (
    echo.
    echo Dang mo giao dien cai dat...
    start /b "" powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-gui.ps1" -Action setup
) else (
    echo.
    node "%SCRIPT_DIR%src\index.js" --setup
    echo.
    echo Nhan phim bat ky de dong...
    pause > nul
)
