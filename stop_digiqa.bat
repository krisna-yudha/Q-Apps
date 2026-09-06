@echo off
title digiQA - Stop Services
color 0C

echo ==============================================================================
echo             digiQA - MENGHENTIKAN SEMUA SERVICE (BACKEND ^& FRONTEND)
echo ==============================================================================
echo.

:: 1. Menghentikan proses di Port 8000 (Laravel Backend)
echo [1/2] Mencari ^& menghentikan Laravel Backend di Port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo    -^> Mematikan PID %%a (Port 8000)
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Menghentikan proses di Port 5173 (React Frontend)
echo [2/2] Mencari ^& menghentikan React Frontend di Port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo    -^> Mematikan PID %%a (Port 5173)
    taskkill /F /PID %%a >nul 2>&1
)

:: Menutup jendela console dengan judul spesifik
taskkill /FI "WINDOWTITLE eq digiQA - Laravel API Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq digiQA - React Frontend*" /F >nul 2>&1

echo.
echo ==============================================================================
echo [BERHASIL] Semua service digiQA (Backend ^& Frontend) telah dimatikan.
echo ==============================================================================
echo.
timeout /t 3
