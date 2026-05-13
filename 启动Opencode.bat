@echo off
set "WORK_DIR=%~dp0packages\opencode"
cd /d "%WORK_DIR%"
bun run dev
if %ERRORLEVEL% neq 0 (
    pause
)
