@echo off
:: 防止中文乱码，如果有乱码请忽略，不影响功能
echo [DEBUG MODE] Starting...

:: 1. 锁定脚本所在目录
cd /d "%~dp0"
echo Current Directory: "%cd%"

:: 2. 确认 service 文件夹是否存在
if exist "service\package.json" (
    echo [CHECK] Backend folder found.
) else (
    echo [ERROR] Backend folder NOT found!
    echo Looking for: "%cd%\service\package.json"
    echo Please ensure the bat file is in the 'lxby' root folder.
    pause
    exit /b
)

:: 3. 确认 ui 文件夹是否存在
if exist "ui\package.json" (
    echo [CHECK] Frontend folder found.
) else (
    echo [ERROR] Frontend folder NOT found!
    echo Looking for: "%cd%\ui\package.json"
    pause
    exit /b
)

echo.
echo [ACTION] Attempting to start Backend...
:: 这里去掉了自动安装依赖的逻辑，防止 npm 报错导致闪退
start "Backend" /D "%~dp0service" cmd /k "node service.js"

echo.
echo [ACTION] Attempting to start Frontend...
start "Frontend" /D "%~dp0ui" cmd /k "npm run dev"

echo.
echo [DONE] Startup commands executed.
pause