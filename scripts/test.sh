#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '\''jims_testing'\''" | grep -q 1 || createdb -U "$POSTGRES_USER" jims_testing'
docker build --target php -t jims-php . >/dev/null
docker run --rm --user "$(id -u):$(id -g)" --network jims_default --env-file .env -e APP_ENV=testing -e DB_DATABASE=jims_testing -e SESSION_DRIVER=array -e CACHE_STORE=array -e QUEUE_CONNECTION=sync -v "$PWD/server:/var/www/html" jims-php php artisan test
