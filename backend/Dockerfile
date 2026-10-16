FROM php:8.3-fpm-bookworm

# Set working directory
WORKDIR /var/www/backend

# Prevent debconf interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies & libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    default-mysql-client \
    ca-certificates \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Configure & install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        opcache

# Install Redis extension
RUN pecl install redis \
    && docker-php-ext-enable redis

# Install Composer from official image
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Copy custom php.ini configuration
COPY docker/php.ini /usr/local/etc/php/conf.d/99-custom.ini

# Copy entrypoint script and normalize line endings for Windows host safety
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy backend application source code
COPY . /var/www/backend

# Prepare storage directories and set permissions for www-data
RUN mkdir -p storage/framework/cache/data \
             storage/framework/sessions \
             storage/framework/views \
             storage/logs \
             storage/app/public \
             storage/app/backup-temp \
             bootstrap/cache \
    && chown -R www-data:www-data /var/www/backend/storage /var/www/backend/bootstrap/cache \
    && chmod -R 775 /var/www/backend/storage /var/www/backend/bootstrap/cache

# Install PHP dependencies without dev packages
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress --prefer-dist

ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 9000

CMD ["php-fpm"]
