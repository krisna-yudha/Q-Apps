#!/usr/bin/env bash
set -e

echo "=============================================================================="
echo "            DigiQA ENTERPRISE - DOCKER CONTAINER LAUNCHER"
echo "=============================================================================="
echo ""

# Copy .env.docker if not present
if [ ! -f ".env.docker" ]; then
    echo "[INFO] File .env.docker belum ditemukan. Menyalin dari .env.docker.example..."
    cp .env.docker.example .env.docker
    echo "[OK] File .env.docker berhasil dibuat!"
fi

echo "[1/3] Memeriksa Docker Daemon..."
docker info >/dev/null 2>&1 || { echo "[ERROR] Docker tidak berjalan!"; exit 1; }

echo "[2/3] Membangun dan Menjalankan Kontainer Docker..."
docker compose up -d --build

echo ""
echo "[3/3] Menunggu service Backend & Database siap..."
sleep 5

echo ""
echo "=============================================================================="
echo "            LAYANAN DIGIQA DOCKER BERHASIL DIJALANKAN!"
echo "=============================================================================="
echo "- Aplikasi Web DigiQA   : http://localhost"
echo "- Backend API Health    : http://localhost/api/health"
echo "- phpMyAdmin (DB GUI)   : http://localhost:8081"
echo ""
echo "Akun Login Default:"
echo "- Supervisor: Username: supervisor | Password: password"
echo "=============================================================================="
