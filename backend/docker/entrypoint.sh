#!/bin/sh
set -e

echo "==> [DigiQA Backend] Initializing container..."

# Create framework storage directories if they do not exist
mkdir -p /var/www/backend/storage/framework/cache/data \
         /var/www/backend/storage/framework/sessions \
         /var/www/backend/storage/framework/views \
         /var/www/backend/storage/logs \
         /var/www/backend/storage/app/public \
         /var/www/backend/storage/app/backup-temp \
         /var/www/backend/bootstrap/cache

# Fix ownership and permissions for Laravel writable directories
chown -R www-data:www-data /var/www/backend/storage /var/www/backend/bootstrap/cache
chmod -R 775 /var/www/backend/storage /var/www/backend/bootstrap/cache

# Wait for MySQL database if DB_HOST is set
if [ -n "$DB_HOST" ]; then
    echo "==> [DigiQA Backend] Checking database connection at $DB_HOST:${DB_PORT:-3306}..."
    max_retries=30
    count=0
    until php -r "try { new PDO('mysql:host=' . getenv('DB_HOST') . ';port=' . (getenv('DB_PORT') ?: '3306'), getenv('DB_USERNAME'), getenv('DB_PASSWORD')); exit(0); } catch (Exception \$e) { exit(1); }" 2>/dev/null; do
        count=$((count+1))
        if [ $count -ge $max_retries ]; then
            echo "==> [DigiQA Backend] Warning: Database connection timeout after $max_retries attempts. Continuing anyway..."
            break
        fi
        sleep 2
    done
    if [ $count -lt $max_retries ]; then
        echo "==> [DigiQA Backend] Database connection established successfully!"
    fi
fi

# Run setup tasks only if this is the primary php-fpm container
if [ "$1" = "php-fpm" ]; then
    # Generate application key if not set
    if [ -z "$APP_KEY" ]; then
        echo "==> [DigiQA Backend] APP_KEY is empty. Generating new application key..."
        php artisan key:generate --force
    fi

    # Create public storage symlink if missing
    if [ ! -L /var/www/backend/public/storage ]; then
        echo "==> [DigiQA Backend] Creating public storage symlink..."
        php artisan storage:link || true
    fi

    # Run database migrations if enabled
    if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
        echo "==> [DigiQA Backend] Executing database migrations..."
        php artisan migrate --force || echo "==> [DigiQA Backend] Warning: Migration encountered an issue."
    fi

    # Optimize caches depending on environment
    if [ "${APP_ENV}" = "production" ]; then
        echo "==> [DigiQA Backend] Production mode detected. Caching configurations..."
        php artisan config:cache || true
        php artisan route:cache || true
        php artisan view:cache || true
    else
        echo "==> [DigiQA Backend] Non-production mode ($APP_ENV). Clearing runtime caches..."
        php artisan config:clear || true
        php artisan route:clear || true
        php artisan view:clear || true
    fi
fi

echo "==> [DigiQA Backend] Ready. Starting process: $@"
exec "$@"
