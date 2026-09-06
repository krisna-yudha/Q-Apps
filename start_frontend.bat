@echo off
title digiQA - Frontend React Vite Server
color 09
cd /d %~dp0frontend
echo Menjalankan Frontend React Vite Server di port 5173...
node ./node_modules/vite/bin/vite.js --port=5173 --host
pause
