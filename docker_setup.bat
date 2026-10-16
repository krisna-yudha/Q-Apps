@echo off
title DigiQA Enterprise - Database Migration & Seeder
color 0A

echo ==============================================================================
echo        DigiQA ENTERPRISE - INISIALISASI DATABASE & SEEDER MASTER
echo ==============================================================================
echo.

cd /d %~dp0

echo [1/4] Menjalankan Migrasi Database...
docker compose exec backend php artisan migrate --force

echo.
echo [2/4] Menjalankan Seeder Master Data (Sites, Services, Parameters, Admin Users)...
docker compose exec backend php artisan db:seed --force

echo.
echo [3/4] Menghubungkan Storage Symlink...
docker compose exec backend php artisan storage:link

echo.
echo [4/4] Mengoptimasi Cache Konfigurasi & Route...
docker compose exec backend php artisan optimize

echo.
echo ==============================================================================
echo [SUKSES] Inisialisasi Database & Seeder Selesai!
echo Akun Default Supervisor:
echo - Username : supervisor
echo - Password : password
echo ==============================================================================
echo.
pause
