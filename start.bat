@echo off
cd /d "%~dp0"
title Vocal Timer Bot
node src\index.js
echo.
echo Le bot s'est arrete. Appuie sur une touche pour fermer.
pause >nul
