#!/usr/bin/env bash
set -e

echo "==> Menjalankan Migrasi Database..."
docker compose exec backend php artisan migrate --force

echo "==> Menjalankan Seeder Master Data..."
docker compose exec backend php artisan db:seed --force

echo "==> Menghubungkan Storage Symlink..."
docker compose exec backend php artisan storage:link

echo "==> Mengoptimasi Cache..."
docker compose exec backend php artisan optimize

echo "==> [SUKSES] Inisialisasi Database Selesai!"
