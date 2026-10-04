FROM php:8.4-fpm-alpine AS php
RUN apk add --no-cache icu-libs libpq libzip oniguruma && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS icu-dev postgresql-dev libzip-dev oniguruma-dev linux-headers && docker-php-ext-install pdo_pgsql intl zip mbstring bcmath pcntl opcache && apk del .build-deps
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY docker/php.ini /usr/local/etc/php/conf.d/jims.ini
FROM php AS dependencies
COPY server/composer.json server/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-scripts --no-interaction
FROM node:22-alpine AS frontend
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/resources ./resources
COPY server/vite.config.js ./
RUN npm run build
FROM php AS app
COPY server ./
COPY --from=dependencies /var/www/html/vendor ./vendor
COPY --from=frontend /app/public/build ./public/build
RUN composer dump-autoload --optimize --no-dev && chown -R www-data:www-data storage bootstrap/cache
USER www-data
CMD ["php-fpm"]
FROM nginx:stable-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY server/public /var/www/html/public
COPY --from=frontend /app/public/build /var/www/html/public/build
