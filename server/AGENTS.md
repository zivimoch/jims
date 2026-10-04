# JiMS development agreements

- Run PHP, Composer, Node and PostgreSQL through Docker; do not install a host PHP stack.
- Laravel Boost is already installed as a development dependency. Do not rerun initial installation on every task.
- Preserve the visual reference in `../prototype/` and Indonesian interface wording.
- Server authorization is authoritative: super admin > pengurus desa > pengurus kelompok > jamaah. Test cross-group and cross-village requests when changing access rules.
- Run `../scripts/test.sh` from the repository; tests must use `jims_testing`, never `jims` or production data.
- Use `vendor/bin/pint` in the PHP container for PHP formatting.
- Never commit `.env`, VAPID private keys, subscriptions, tokens, database dumps, or volumes.
- Document implemented behavior and verification honestly in the existing README.
