@echo off
title DigiQA Enterprise - Stop Docker Services
color 0E

echo ==============================================================================
echo             PENGHENTIAN LAYANAN DIGIQA DOCKER
echo ==============================================================================
echo.

cd /d %~dp0

echo Menghentikan seluruh kontainer DigiQA...
docker compose down

echo.
echo [OK] Seluruh kontainer DigiQA telah dihentikan dengan aman.
echo Volume data (MySQL & Redis & Uploads) tetap tersimpan dengan aman di Docker.
echo.
pause
