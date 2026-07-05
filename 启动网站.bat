@echo off
chcp 65001 >nul
title HYP星座研究网站
cd /d "%~dp0"

echo ╔════════════════════════════════════════╗
echo ║      HYP星座研究网站 启动中...          ║
echo ╚════════════════════════════════════════╝
echo.

:: 检查端口是否已被占用
netstat -ano | findstr ":8765" >nul 2>&1
if %errorlevel% equ 0 (
    echo [提示] 服务器已在运行，直接打开浏览器...
    start http://localhost:8765/index.html
    exit /b
)

:: 尝试用 Python 启动服务器
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [启动] 使用 Python HTTP 服务器...
    echo [访问] http://localhost:8765
    echo.
    echo 按 Ctrl+C 关闭服务器
    echo.
    start http://localhost:8765/index.html
    python -m http.server 8765
    exit /b
)

:: 尝试用 Python3
python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [启动] 使用 Python3 HTTP 服务器...
    start http://localhost:8765/index.html
    python3 -m http.server 8765
    exit /b
)

:: 如果没有 Python，直接用浏览器打开文件
echo [提示] 未检测到 Python，直接打开 HTML 文件...
echo [注意] 如遇白屏，请安装 Python 或使用 Chrome 浏览器
echo.
start index.html
pause
