@echo off
cd /d "%~dp0"
if not exist "demo-data\Film\Una sera a colori (2026).mp4" (
  echo Prima genera i file finti con: npm run demo:crea
  pause
  exit /b 1
)
echo Apri http://127.0.0.1:8871 nel browser. Per fermare: Ctrl+C.
node scripts/demo.js
pause
