@echo off
title digiQA - Quality Assurance & Monitoring Contact Center
color 0B

echo ==============================================================================
echo             digiQA - CONTACT CENTER MONITORING ^& QUALITY ASSURANCE
echo ==============================================================================
echo.
echo [1/3] Menyiapkan Backend Laravel (REST API)...
start "digiQA - Laravel API Backend (Port 8000)" cmd /k "cd /d %~dp0backend && php artisan serve --host=127.0.0.1 --port=8000"

echo [2/3] Menyiapkan Frontend React JS (Vite)...
start "digiQA - React Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && node ./node_modules/vite/bin/vite.js --port=5173 --host"

echo.
echo ==============================================================================
echo Aplikasi digiQA BERHASIL DIJALANKAN!
echo - Frontend URL : http://localhost:5173
echo - Backend API  : http://127.0.0.1:8000/api
echo.
echo Akun Login Default (3 Role Utama):
echo 1. Supervisor        : Username: supervisor  ^| Password: password
echo 2. Quality Assurance : Username: qa          ^| Password: password
echo 3. Team Leader       : Username: team_leader ^| Password: password
echo ==============================================================================
echo.
echo [PETUNJUK PENGHENTIAN SERVICE]:
echo  - Anda dapat menekan TOMBOL APA SAJA di jendela ini untuk MENGHENTIKAN service,
echo    ATAU jalankan file 'stop_digiqa.bat' kapan saja.
echo.
pause
