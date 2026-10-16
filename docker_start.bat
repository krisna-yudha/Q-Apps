@echo off
title DigiQA Enterprise - Docker Production Stack
color 0B

echo ==============================================================================
echo             DigiQA ENTERPRISE - DOCKER CONTAINER LAUNCHER
echo ==============================================================================
echo.

cd /d %~dp0

:: Cek apakah file .env.docker sudah ada
if not exist ".env.docker" (
    echo [INFO] File .env.docker belum ditemukan.
    echo [INFO] Menyalin dari .env.docker.example...
    copy ".env.docker.example" ".env.docker" >nul
    echo [OK] File .env.docker berhasil dibuat!
    echo.
)

echo [1/3] Memeriksa Docker Desktop Service...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Docker Engine tidak terdeteksi atau belum berjalan!
    echo Pastikan aplikasi Docker Desktop sudah dibuka dan statusnya "Running".
    echo.
    pause
    exit /b 1
)

echo [2/3] Membangun dan Menjalankan Kontainer Docker...
echo (Frontend, Backend PHP 8.3, Queue Worker, Scheduler, MySQL 8.0, Redis, phpMyAdmin)
docker compose up -d --build

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Terjadi kegagalan saat menjalankan Docker Compose!
    pause
    exit /b 1
)

echo.
echo [3/3] Menunggu service Backend & Database siap...
timeout /t 5 /nobreak >nul

echo.
echo ==============================================================================
echo             LAYANAN DIGIQA DOCKER BERHASIL DIJALANKAN!
echo ==============================================================================
echo - Aplikasi Web DigiQA   : http://localhost (Port 80)
echo - Backend API Health    : http://localhost/api/health
echo - phpMyAdmin (DB GUI)   : http://localhost:8081
echo.
echo Akun Login Default Sistem:
echo - Supervisor  : Username: supervisor  ^| Password: password
echo.
echo Tips Operasional:
echo - Inisialisasi Database / Seeder : Jalankan 'docker_setup.bat'
echo - Matikan Semua Service          : Jalankan 'docker_stop.bat'
echo - Lihat Log Backend              : docker compose logs -f backend
echo - Masuk ke Shell Backend         : docker compose exec backend bash
echo ==============================================================================
echo.
pause
