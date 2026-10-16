#!/usr/bin/env bash
set -e

echo "Menghentikan seluruh kontainer DigiQA..."
docker compose down

echo "[OK] Seluruh kontainer telah dihentikan. Volume data tetap tersimpan."
