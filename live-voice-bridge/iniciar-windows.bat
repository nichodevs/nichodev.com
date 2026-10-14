@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo NICHODEVS LIVE VOICE - ponte local
node --version >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale Node.js LTS em https://nodejs.org/ e tente novamente.
  pause
  exit /b 1
)
node server.js
pause
