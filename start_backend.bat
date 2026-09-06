@echo off
title digiQA - Backend Laravel API Server
color 0A
cd /d %~dp0backend
echo Menjalankan Laravel API Server di port 8000...
php artisan serve --host=127.0.0.1 --port=8000
pause
