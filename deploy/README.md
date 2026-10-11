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

The current phone-only login has no ownership verification. This deployment deliberately uses phone-only access as requested by the operator. Anyone who knows a registered number can access that account, including administrative accounts; this mode does not verify ownership.


## Verified deployment, 6 October 2026

- Public URL: https://jims.zivi.zip, with automatic HTTPS through the shared Caddy gateway. The root Zivizip site remained available after the change.
- Application images: `jims/app:9713550` and `jims/web:9713550`, built from the same public repository commit. GitHub CI and 35 local Laravel tests (116 assertions) passed.
- Fourteen accounts were privately provisioned; super-admin login was checked over HTTPS. No local database or demo activities were imported.
- Database and storage backup archives were created on the VPS; the database archive listing was checked. Off-site backup and a full restore exercise remain future operational work.
- The browser confirmed login, AMI and realtime connection. Manifest and service worker are served over HTTPS; OS push delivery was not verified.
