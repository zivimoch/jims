# JiMS on a shared Docker VPS

Use `compose.yaml` with a private `.env` in `/srv/jims`. This is a separate Compose project with its own PostgreSQL and storage volumes. No application/database port is published on the host. Only the shared Caddy gateway accepts public connections.

1. Add DNS A `jims` to the VPS IPv4; leave existing root-domain records untouched.
2. Build and tag the `app` and `web` Dockerfile targets with the same tested Git commit; transfer via a private image registry or `docker save` / `docker load`.
3. Set `JIMS_APP_IMAGE`, `JIMS_WEB_IMAGE`, `APP_ENV=production`, `APP_DEBUG=false`, unique `APP_KEY`, database/Reverb secrets, `APP_URL=https://jims.zivi.zip`, `SESSION_SECURE_COOKIE=true`, `REVERB_ALLOWED_ORIGINS=jims.zivi.zip`. `TRUSTED_PROXIES` must contain only the gateway IP on `jims-ingress` (or a tightly controlled proxy subnet). Never copy the local development database or secrets implicitly.
4. Create `jims-ingress` as an internal Docker network; attach the Caddy gateway and persist that network in its Compose file. Keep the existing Zivizip network.
5. Start `db app`; run `php artisan migrate --force` and `php artisan jims:vapid`. Start all JiMS services. Add `Caddyfile.jims` to the gateway config, validate and reload Caddy. DNS must resolve to the VPS for automatic certificates.
6. Confirm HTTPS, login, a private WebSocket subscription, PWA manifest and queue. Recheck the root Zivizip site after updating the shared gateway.

Dummy data is optional and must be explicitly chosen. The seeder refuses production by default; for an explicitly disposable demo use a one-off `APP_ENV=local` seeder process, then keep all serving processes in production mode. Never replace a real database with a dummy seed.

Backups: protect both `pg_dump` of the JiMS database and `app-storage` (VAPID private key). Copy backups off the VPS separately. Before upgrading, back up; record image tags, run migrations, recreate services, and restart JiMS web if the app/reverb container IP changes. Restore previous images for code rollback only when their schema is compatible. Never run `down -v` as an update procedure.

The current phone-only login has no ownership verification. It is intended for the requested demo phase; public availability does not make it safe for real private jamaah data. Add OTP or another verified authentication step before that use.
