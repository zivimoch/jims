#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace composer:2 php -r '
  $p=".env";$s=file_get_contents($p);
  foreach(["APP_KEY"=>"base64:".base64_encode(random_bytes(32)),"DB_PASSWORD"=>bin2hex(random_bytes(24)),"REVERB_APP_KEY"=>bin2hex(random_bytes(16)),"REVERB_APP_SECRET"=>bin2hex(random_bytes(32)),"DEMO_PASSWORD"=>"JiMS-demo-2026!"] as $k=>$v){$s=preg_replace("/^".$k."=.*$/m",$k."=".$v,$s);}file_put_contents($p,$s);'
fi
docker compose build
docker compose up -d db app
# A separate command makes migrations and seed actions explicit and repeatable.
docker compose exec -T app php artisan migrate --force
docker compose exec -T app php artisan jims:vapid
docker compose up -d
echo 'JiMS siap di http://localhost:8080. Isi data contoh: docker compose exec app php artisan db:seed'
