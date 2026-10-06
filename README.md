# JiMS — Sistem Jamaah Daerah, Desa, dan Kelompok

Aplikasi jamaah berbasis **Laravel 13, PHP 8.4, PostgreSQL 17, Docker Compose, Laravel Reverb, dan PWA**. Tampilan mengadaptasi prototype JiMS di `prototype/`. Data aplikasi disimpan di PostgreSQL dan terhubung antar perangkat setelah login.

## Digunakan oleh jamaah di wilayah lain

JiMS berawal dari kebutuhan Desa Jipi. Nama tersebut adalah identitas awal, **bukan batas wilayah sistem**. Satu instalasi dapat melayani satu desa, seluruh daerah, atau beberapa daerah. Jumlah desa dan kelompok tidak dikunci menjadi tiga; Kelompok 1–3 hanya data contoh.

```text
Daerah
├── Desa 9
│   ├── Kelompok 1
│   ├── Kelompok 2
│   └── Kelompok 3
└── Desa lainnya
    ├── Kelompok A
    └── Kelompok B
```

Super admin dapat menggunakan **Master data → Ubah identitas aplikasi** untuk mengganti nama, deskripsi, dan desa default AMI. Nama diterapkan pada halaman masuk, navigasi, footer, judul browser, dan manifest PWA. Saat nama bukan JiMS, logo tulisan JiMS diganti nama aplikasi. Ikon PWA 192/512 dan aset logo masih berupa aset lokal; untuk mengganti gambar, ganti berkas di `server/public/icons/` dan `server/public/assets/jims-logo.png`, lalu build ulang. Browser dapat menunda pembaruan identitas aplikasi yang sudah terpasang.

Langkah memakai sistem untuk wilayah sendiri:

1. Jalankan lokal dengan data contoh untuk mempelajari fitur.
2. Masuk sebagai super admin. Pada **Master data**, tambahkan daerah, kemudian desa dengan daerah induknya, dan kelompok dengan desa induknya. Nama boleh sama di induk yang berbeda.
3. Tambahkan jenis **Dapukan**, misalnya Kiyai, Mubalegh, Kepala Sekolah Karakter, atau Keuangan.
4. Pada **Kelola Akun → Tambah akun**, isi nama, nomor WA, peran, dan wilayah asal. Untuk pengurus, tambahkan satu atau beberapa dapukan beserta wilayah tugasnya.
5. Pengurus membuka **Kelas → Kelola kelas** untuk menambah kelas dalam lingkup tugasnya. Setelah itu buat AMI dan pilih kelas yang wajib hadir.
6. Tentukan nama/desa default instalasi. Nonaktifkan akun demo sebelum penggunaan sungguhan. Mode login tanpa OTP ini belum membuktikan kepemilikan nomor; jangan memperlakukannya sebagai autentikasi siap produksi.

Wilayah asal pengguna (`region_id`, `village_id`, `group_id`) **terpisah** dari penugasan (`user_dapukans`). Contoh: satu pengguna tinggal di Kelompok 1, memiliki dapukan **Kiyai Kelompok** di kelompok itu dan **Keuangan Daerah** di daerah yang sama. Setiap dapukan memiliki jenis dan lingkup sendiri; label tidak disimpan sebagai teks gabungan yang sulit dipisahkan. Master jenis dapukan dan penetapan dapukan hanya dapat diubah super admin.

Pengurus daerah mendapat hak kelola di seluruh desa/kelompok daerah tersebut. Pengurus desa mendapat hak di desa dan kelompok di bawahnya. Pengurus kelompok terbatas pada kelompok yang ditugaskan. Beberapa dapukan menggabungkan lingkup tersebut, tanpa memberi akses daerah lain. Nama jenis dapukan saat ini merupakan label tugas; belum ada matriks izin fitur terpisah untuk Kiyai versus Keuangan. Peran akses tetap tiga: `super_admin`, `pengurus`, `jamaah`.

## AMI dan pilihan cerdas

Tabel AMI menampilkan **Tanggal, Jam, Tempat, Agenda, Wajib Hadir**. Catatan tampil sebagai **NB : ...** di bawah judul agenda. Formulir menyediakan judul, tanggal/jam mulai-selesai, tempat, beberapa kelas wajib hadir, desa, kelompok, materi, NB, opsi Zoom, dan centang **Buatkan Absennya**. Materi: Al-Quran, Hadist, Nasehat, ASAD, Musyawarah, Lainnya. Desa awal contoh adalah **Desa 9**; desa default bisa diganti dan hanya ditampilkan jika pengguna memiliki akses. Kelompok kosong berarti kegiatan tingkat desa. Centang absensi mati berarti kegiatan tetap ada di AMI tetapi tidak menerima pencatatan absensi. Wajib Hadir adalah sasaran kelas, bukan keanggotaan kelas pengguna atau larangan bagi jamaah lain untuk hadir.

Pilihan master memiliki pencarian dengan **PostgreSQL `pg_trgm` + indeks GIN**: kecocokan persis/prefix diprioritaskan, potongan nama dan kemiripan ejaan disertakan. Contoh `Caberwit` dapat menemukan `Caberawit`. Pencarian dikirim setelah jeda mengetik, dibatasi 50 hasil, dan selalu dibatasi wilayah pengguna. Pencarian pilihan tetap seperti peran/status menggunakan pencocokan lokal. Ini pencarian kemiripan teks, bukan AI semantik. Lihat [dokumentasi resmi pg_trgm](https://www.postgresql.org/docs/17/pgtrgm.html).

Jika nama master belum tersedia, tombol **Tambahkan** muncul bagi pengguna yang berwenang. Daerah/desa/kelompok/dapukan hanya super admin; kelas/tempat/judul untuk pengurus sesuai lingkup. Judul dan tempat baru juga disimpan sebagai pilihan saat agenda disimpan. Pilihan peran/status tidak dapat ditambah karena merupakan aturan aplikasi. Kelas dapat dicari dan dipilih lebih dari satu. Nama duplikat dalam lingkup sama digunakan ulang. Induk master tidak dapat dipindahkan setelah dibuat; data yang masih direferensikan tidak dapat dihapus.

Elasticsearch belum diperlukan untuk kebutuhan pilihan nama saat ini: pencarian tetap di database yang sama sehingga tidak perlu layanan tambahan dan sinkronisasi indeks terpisah. Evaluasi mesin pencarian terpisah jika ukuran data, bahasa, atau kebutuhan ranking berkembang berdasarkan pengukuran.

## Jalankan lokal

Prasyarat: Docker Engine dan Docker Compose. PHP/Composer/Node tidak perlu dipasang di host.

```sh
./scripts/setup.sh
docker compose exec app php artisan db:seed
```

Buka **http://127.0.0.1:8080**. Gunakan alamat yang sama secara konsisten; `localhost` dan `127.0.0.1` memiliki cookie/izin notifikasi berbeda. Port aplikasi hanya dibuka pada loopback. Database, PHP, queue, dan Reverb berada di jaringan internal Docker.

`setup.sh` membuat `.env` lokal dengan APP_KEY, password database, dan rahasia Reverb acak, membangun image, menjalankan migrasi, dan menyiapkan kunci Web Push di volume privat. Kunci tidak dicetak atau dimasukkan ke Git. Data dummy dibuat hanya ketika perintah `db:seed` dijalankan, dan seeder menolak lingkungan production.

| Peran dummy | Nomor WhatsApp sintetis |
| --- | --- |
| Super admin | `080000000001` |
| Pengurus desa | `080000000002` |
| Pengurus kelompok 1–3 | `080000000003`, `080000000014`, `080000000025` |
| Jamaah kelompok 1–3 | `080000000004`, `080000000015`, `080000000026` |

Login sementara hanya menggunakan nomor WA terdaftar, tanpa email, password, atau OTP. Karena belum memverifikasi kepemilikan nomor, siapa pun yang mengetahui nomor tersebut dapat masuk; termasuk akun pengurus/admin. Nomor harus berawalan `08` sepanjang 10–13 digit; spasi dan strip dibersihkan otomatis di formulir dan server, awalan `62` ditolak. Pengurus mengisi nomor unik saat membuat/mengelola akun; email tidak diperlukan.

Login otomatis diingat menggunakan cookie remember-me terenkripsi, HttpOnly, dengan durasi yang diminta 10 tahun. Cookie diperbarui saat memulihkan sesi yang kedaluwarsa. Sesi server boleh kedaluwarsa tanpa meminta login ulang selama cookie masih berlaku. Browser dapat membatasi usia cookie; menghapus data browser, memilih Keluar, atau perubahan/nonaktif akun oleh pengurus mengakhiri akses tersimpan. Ini tidak menjanjikan login abadi di luar kontrol browser. Nomor WA bukan data localStorage. Gunakan HTTPS saat deployment.

Tersedia 35 akun dummy dan data contoh. Migrasi mengisi nomor sintetis hanya pada akun demo `@jims.test`; akun lain perlu diberi nomor oleh pengurus. Password internal acak untuk akun baru tidak digunakan pada alur login ini. `DEMO_PASSWORD` tetap dipakai oleh seeder lama untuk kolom internal, bukan untuk masuk.

Tanggal kegiatan dummy mengikuti tanggal saat seed pertama kali dijalankan. Untuk mencoba absensi pada hari berikutnya, jalankan:

```sh
docker compose exec app php artisan jims:demo-today
```

Perintah itu hanya mengubah tanggal kegiatan bertanda contoh; tidak mengubah kegiatan buatan pengurus.

## Hak akses

| Kemampuan | Super admin | Pengurus | Jamaah |
| --- | --- | --- | --- |
| Master wilayah, identitas aplikasi, jenis/penetapan dapukan | Semua | Tidak | Tidak |
| Membuat/mengelola akun jamaah | Semua | Lingkup dapukan | Tidak |
| Menetapkan peran pengurus/super admin | Ya | Tidak | Tidak |
| AMI, kelas, tempat, dan rekening | Semua | Lingkup dapukan | Baca yang diizinkan |
| Absensi orang lain | Semua | Jamaah dalam lingkup tugas dan kegiatan | Tidak |
| Profil, absensi, riwayat pribadi | Ya | Ya | Ya |
| Catatan shodakoh | Semua | Lingkup tugas | Milik sendiri |
| Log aktivitas | Ya | Tidak | Tidak |

Pada **Profil saya**, pengguna dapat mengganti nama, WA, email opsional, dan alamat. Wilayah, peran, status aktif, dan dapukan tidak dapat diubah sendiri melalui endpoint profil. Akun pengurus lama tanpa penugasan masih membaca lingkup lama sebagai kompatibilitas; akun pengurus baru wajib mempunyai dapukan.

Pemeriksaan dilakukan pada **server**, termasuk kanal WebSocket privat; menyembunyikan tombol bukan satu-satunya pembatas. Pengurus tidak dapat menaikkan dirinya menjadi super admin. Menonaktifkan/mengubah akun mengakhiri sesi masuk akun tersebut. Super admin aktif terakhir tidak dapat dinonaktifkan. Penonaktifan dipakai agar riwayat akun tidak hilang.

## Fitur

- AMI: tabel ringkas sesuai prototype, tanpa checkbox. Klik/tap dua kali atau Enter pada baris untuk edit/hapus bagi pengurus yang berwenang. Mendukung jumlah baris, urutan tanggal, pencarian, filter, Copy, PDF/Cetak, berbagi halaman ke WhatsApp, dan mode baca. Kegiatan memuat kelas wajib hadir, tempat, materi multi-pilih, jam WIB, NB, dan link HTTPS Zoom.
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
docker compose exec app php artisan migrate --force
docker compose restart jims

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

Runner menolak koneksi selain `jims_testing` sebelum migrasi pengujian. Data dummy pada database `jims` tetap dipertahankan. Cakupan mencakup multi-dapukan, isolasi daerah/desa/kelompok, master dan pencarian toleran salah ketik, profil yang mengunci wilayah, branding/PWA, kelas wajib hadir, penutupan absensi, anti-escalation, jendela absensi, duplikasi, kerahasiaan alasan, kanal privat, dan endpoint push.

## Struktur

- `server/`: aplikasi Laravel, migration, seeder, API, views, aset frontend, PWA, dan tes.
- `prototype/`: salinan prototype statis asli sebagai referensi tampilan; penyimpanan localStorage lama tidak otomatis dimigrasikan.
- `Dockerfile`, `compose.yaml`, `nginx.conf`, `docker/`: runtime dan build.
- `scripts/setup.sh`, `scripts/test.sh`: langkah setup dan pengujian yang bisa dibaca/dijalankan manual.

Referensi implementasi: [Laravel Reverb](https://laravel.com/docs/13.x/reverb), [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Web Push PHP](https://github.com/web-push-libs/web-push-php).

## Status verifikasi lokal

- Tes backend dijalankan dengan PostgreSQL terpisah; mencakup login WA, pemulihan sesi, hierarki daerah, multi-dapukan, profil, master, dan AMI.
- Formulir dua dapukan pada tingkat berbeda, pencarian `Caberwit` → `Caberawit`, dan penyimpanan AMI dengan dua kelas wajib hadir sudah diperiksa di browser.
- Login jamaah, absensi tersimpan, kontrol AMI baca-saja untuk jamaah, dan layout 390 piksel diperiksa melalui browser.
- Agenda baru dari sesi admin terpisah muncul pada sesi jamaah lewat WebSocket tanpa reload manual; notifikasi dalam aplikasi juga tersimpan.
- Request login tanpa CSRF token ditolak HTTP 419.
- Sampel 10 request API agenda pada Docker lokal: median sekitar **86 ms**, maksimum **111 ms**. Ini pengukuran lokal dengan data dummy, bukan jaminan kecepatan pada VPS atau beban banyak pengguna.
- Web Push sudah terimplementasi; browser pengujian tidak memberikan izin notifikasi. Pengiriman notifikasi OS ketika aplikasi ditutup masih perlu verifikasi pada perangkat/browser yang mengizinkannya, termasuk Android/iPhone dan HTTPS publik.

## Deploy ke VPS bersama

Konfigurasi Compose terpisah dan panduan Caddy ada di [deploy/README.md](deploy/README.md). Target JiMS adalah `jims.zivi.zip`; DNS A bernama `jims` mengarah ke VPS. Status online harus diverifikasi setelah DNS dan HTTPS siap.
