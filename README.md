# JiMS — Jipi Management System

Aplikasi jamaah berbasis **Laravel 13, PHP 8.4, PostgreSQL 17, Docker Compose, Laravel Reverb, dan PWA**. Tampilan mengadaptasi prototype JiMS di `prototype/`. Data aplikasi disimpan di PostgreSQL dan terhubung antar perangkat setelah login.

## Jalankan lokal

Prasyarat: Docker Engine dan Docker Compose. PHP/Composer/Node tidak perlu dipasang di host.

```sh
./scripts/setup.sh
docker compose exec app php artisan db:seed
```

Buka **http://127.0.0.1:8080**. Gunakan alamat yang sama secara konsisten; `localhost` dan `127.0.0.1` memiliki cookie/izin notifikasi berbeda. Port aplikasi hanya dibuka pada loopback. Database, PHP, queue, dan Reverb berada di jaringan internal Docker.

`setup.sh` membuat `.env` lokal dengan APP_KEY, password database, dan rahasia Reverb acak, membangun image, menjalankan migrasi, dan menyiapkan kunci Web Push di volume privat. Kunci tidak dicetak atau dimasukkan ke Git. Data dummy dibuat hanya ketika perintah `db:seed` dijalankan, dan seeder menolak lingkungan production.

| Peran dummy | Email |
| --- | --- |
| Super admin | `admin@jims.test` |
| Pengurus desa | `desa@jims.test` |
| Pengurus kelompok 1–3 | `kelompok1@jims.test`, `kelompok2@jims.test`, `kelompok3@jims.test` |
| Jamaah kelompok 1–3 | `jamaah1@jims.test`, `jamaah2@jims.test`, `jamaah3@jims.test` |

Password contoh lokal: **`JiMS-demo-2026!`** (nilai awal `DEMO_PASSWORD` pada `.env`). Ada total 35 akun, satu desa, tiga kelompok, kegiatan, absensi, rekening dummy, catatan shodakoh, dan notifikasi. Jangan gunakan kredensial demo untuk situs publik. Mengganti `DEMO_PASSWORD` tidak mengganti password akun yang sudah dibuat.

Tanggal kegiatan dummy mengikuti tanggal saat seed pertama kali dijalankan. Untuk mencoba absensi pada hari berikutnya, jalankan:

```sh
docker compose exec app php artisan jims:demo-today
```

Perintah itu hanya mengubah tanggal kegiatan bertanda contoh; tidak mengubah kegiatan buatan pengurus.

## Hak akses

| Kemampuan | Super admin | Pengurus desa | Pengurus kelompok | Jamaah |
| --- | --- | --- | --- | --- |
| Kelola semua akun dan fitur | Ya | Tidak | Tidak | Tidak |
| Kelola pengurus kelompok | Semua | Di desanya | Tidak | Tidak |
| Kelola akun jamaah | Semua | Di desanya | Kelompok sendiri | Tidak |
| Buat/edit/hapus AMI dan rekening | Semua | Desa dan kelompok di bawahnya | Kelompok sendiri | Tidak |
| Lihat AMI | Semua | Seluruh desa sendiri | Desa + kelompok sendiri | Desa + kelompok sendiri |
| Catat absensi orang lain | Semua | Lingkup yang dikelola | Jamaah kelompok sendiri | Tidak |
| Profil, absensi, riwayat pribadi | Ya | Ya | Ya | Ya |
| Catatan shodakoh | Semua | Lingkup desa | Lingkup kelompok | Milik sendiri |
| Log aktivitas | Ya | Tidak | Tidak | Tidak |

Pemeriksaan dilakukan pada **server**, termasuk kanal WebSocket privat; menyembunyikan tombol bukan satu-satunya pembatas. Pengurus tidak dapat menaikkan dirinya menjadi super admin. Menonaktifkan/mengubah akun mengakhiri sesi masuk akun tersebut. Super admin aktif terakhir tidak dapat dinonaktifkan. Penonaktifan dipakai agar riwayat akun tidak hilang.

## Fitur

- AMI: kegiatan, kelas, lokasi, materi multi-pilih, tanggal/jam WIB, catatan, link HTTPS Zoom, filter, berbagi teks ke WhatsApp, dan mode baca.
- Absen: pilih kegiatan/lokasi secara eksplisit, hadir offline, online atau izin beserta alasan, batalkan absensi selama jendela waktu berlangsung. Tombol sidik jari adalah kontrol tap/geser, bukan pembaca biometrik.
- Absensi dibuka dua jam sebelum mulai hingga dua jam sesudah selesai. Kunci unik database mencegah duplikasi; identitas pencatat terpisah dari identitas jamaah.
- Riwayat dan ketercapaian materi dari absensi offline/online. Catatan shodakoh kategori Kas dan Tabungan Jalan-jalan; tidak memverifikasi transfer. Rekening/QRIS contoh diberi label dummy.
- Realtime: perubahan data memicu pesan ringan melalui kanal privat Reverb, lalu klien memuat ulang data yang diizinkan. Queue worker mengirim broadcast dan push tanpa menahan respons pencatatan.
- PWA: manifest, ikon 192/512, service worker, tombol pemasangan, halaman offline, dan Web Push berbasis VAPID. API dan HTML berisi sesi **tidak di-cache**. Perubahan/absensi membutuhkan internet; tidak ada antrean offline yang diam-diam dianggap tersimpan.
- Responsif: sidebar desktop, navigasi bawah dan menu pada mobile. CSS/aset lokal tanpa font atau UI CDN, bundling Vite, gzip, PHP OPcache, indeks PostgreSQL dan pagination.

## PWA dan notifikasi

1. Buka aplikasi pada browser yang mendukung PWA; pilih **Pasang aplikasi**, atau menu browser → **Tambahkan ke layar utama**.
2. Buka **Notifikasi → Aktifkan notifikasi**, lalu izinkan pada perangkat.
3. Pilih **Kirim uji** untuk memasukkan notifikasi uji ke antrean.

HTTPS diperlukan pada domain publik (loopback localhost/127.0.0.1 diperbolehkan untuk development). Pada iPhone gunakan aplikasi yang telah ditambahkan ke layar utama. Dukungan instalasi dan pengiriman push bergantung pada browser/OS dan izin pengguna. Reverb harus tetap hidup untuk realtime; queue worker untuk broadcast dan push. Kunci VAPID disimpan di `app-storage:/var/www/html/storage/app/vapid.json`; cadangkan bersama database dan jangan ganti sembarangan setelah pengguna berlangganan.

## Perintah sehari-hari

```sh
# Status dan log
docker compose ps
docker compose logs --tail=100 app queue reverb

# Setelah mengubah kode (image produksi lokal tidak memakai bind mount)
docker compose up -d --build

# Hentikan tanpa menghapus data
docker compose down

# Hidupkan kembali
docker compose up -d
```

**`docker compose down -v` menghapus volume database dan storage aplikasi.** Jangan gunakan untuk restart biasa. Compose ini untuk development/preview lokal. Belum dideploy ke VPS, Kubernetes, atau `jims.zivi.zip`.

Untuk HTTPS reverse proxy nantinya: atur `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `SESSION_SECURE_COOKIE=true`, `REVERB_ALLOWED_ORIGINS` ke hostname yang digunakan, dan konfigurasi trusted proxy secara terbatas. Siapkan akun sungguhan dan hapus/nonaktifkan data contoh. Jangan seed dummy di production. Domain, TLS, backup, dan pemulihan harus diuji saat deployment.

## Pengujian

```sh
# Dependensi development di volume checkout
docker build --target php -t jims-php .
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/server:/var/www/html" jims-php composer install

# Tes backend memakai PostgreSQL terpisah bernama jims_testing
./scripts/test.sh
```

Runner menolak koneksi selain `jims_testing` sebelum migrasi pengujian. Data dummy pada database `jims` tetap dipertahankan. Cakupan mencakup hak akses, isolasi kelompok/desa, anti-escalation, jendela absensi, duplikasi, kerahasiaan alasan, kanal privat, dan endpoint push.

## Struktur

- `server/`: aplikasi Laravel, migration, seeder, API, views, aset frontend, PWA, dan tes.
- `prototype/`: salinan prototype statis asli sebagai referensi tampilan; penyimpanan localStorage lama tidak otomatis dimigrasikan.
- `Dockerfile`, `compose.yaml`, `nginx.conf`, `docker/`: runtime dan build.
- `scripts/setup.sh`, `scripts/test.sh`: langkah setup dan pengujian yang bisa dibaca/dijalankan manual.

Referensi implementasi: [Laravel Reverb](https://laravel.com/docs/13.x/reverb), [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Web Push PHP](https://github.com/web-push-libs/web-push-php).

## Status verifikasi lokal

- Tes backend dijalankan dengan PostgreSQL terpisah (21 tes setelah menghapus tes bawaan yang hanya memeriksa `true`).
- Login jamaah, absensi tersimpan, kontrol AMI baca-saja untuk jamaah, dan layout 390 piksel diperiksa melalui browser.
- Agenda baru dari sesi admin terpisah muncul pada sesi jamaah lewat WebSocket tanpa reload manual; notifikasi dalam aplikasi juga tersimpan.
- Request login tanpa CSRF token ditolak HTTP 419.
- Sampel 10 request API agenda pada Docker lokal: median sekitar **86 ms**, maksimum **111 ms**. Ini pengukuran lokal dengan data dummy, bukan jaminan kecepatan pada VPS atau beban banyak pengguna.
- Web Push sudah terimplementasi; browser pengujian tidak memberikan izin notifikasi. Pengiriman notifikasi OS ketika aplikasi ditutup masih perlu verifikasi pada perangkat/browser yang mengizinkannya, termasuk Android/iPhone dan HTTPS publik.
