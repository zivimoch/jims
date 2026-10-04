# JiMS — Template absensi

Kegiatan mendukung kelas pilihan atau isian bebas, materi multi-pilih (surat/ayat Al-Quran, kitab dan halaman Hadist, halaman CAI, Nasehat, Asad, dan Lainnya), keterangan materi, serta keterangan kegiatan. Status kegiatan mengikuti tanggal/jam lokal perangkat dan diperbarui setiap 30 detik.

Menu Shodakoh berisi contoh rekening dan ilustrasi QRIS untuk Kelompok 1–3 dan Desa; semuanya dummy, bukan untuk pembayaran. Menu Kelas memuat ketercapaian dari kegiatan yang tercatat dihadiri akun demo (offline/online, satu kegiatan satu pertemuan), serta riwayat catatan Shodakoh kategori Kas dan Tabungan Jalan-jalan. Catatan tersebut disimpan lokal dan tidak memverifikasi transfer.

Template responsif HTML, CSS, dan JavaScript murni berdasarkan referensi mobile dan desktop. Tanpa framework, paket npm, font eksternal, atau CDN. Ikon dan dekorasi berupa SVG lokal.

## Menjalankan dengan Docker

```sh
docker compose up -d --build
```

Buka http://localhost:8080. Untuk menghentikan: `docker compose down`.

Alternatif tanpa Docker: `python3 -m http.server 8080`, lalu buka alamat yang sama.

## Membuka JiMS melalui ngrok

Buat file `.env.ngrok` dari `.env.ngrok.example`, kemudian isi `NGROK_AUTHTOKEN` dengan authtoken akun dari https://dashboard.ngrok.com/get-started/your-authtoken. Jangan membagikan file token ini.

```sh
docker compose -f compose.yaml -f compose.ngrok.yaml up -d
docker compose -f compose.yaml -f compose.ngrok.yaml logs ngrok
```

URL HTTPS publik muncul pada log setelah tunnel tersambung. Komputer harus tetap menyala, tidak sleep, dan tersambung internet. Tunnel menampilkan website JiMS; tidak menyediakan kendali Codex. Data demo tetap tersimpan per browser, tidak tersinkron antar perangkat.

Setelah perubahan kode, jalankan `docker compose -f compose.yaml -f compose.ngrok.yaml up -d --build jims` agar hasil terbaru tersedia melalui tunnel. Untuk menghentikan tunnel saja, jalankan `docker compose -f compose.yaml -f compose.ngrok.yaml stop ngrok`.

## Fitur demo

- AMI menampilkan agenda per tanggal atau tabel, dengan filter rentang tanggal, level, kelas, dan lokasi. Pilih satu atau beberapa kegiatan untuk menyalin teks pengumuman, membuka WhatsApp dengan teks siap dibagikan, atau menggunakan mode baca berhuruf besar. Pilihan tetap tersimpan sementara ketika filter berubah; gunakan Hapus pilihan untuk mengosongkannya.

- Pilih kegiatan; kartu dapat digeser pada perangkat mobile.
- Hadir offline dengan tombol sidik jari atau tombol offline; tarik tombol sidik jari ke kiri dengan mouse atau sentuhan.
- Pilih hadir online atau izin melalui dialog; tarik tombol sidik jari ke kanan dengan mouse atau sentuhan.
- Absenkan jamaah lain, cari nama, dan filter status.
- Buat kegiatan, edit nama profil demo, dan lihat riwayat.
- Data tersimpan melalui localStorage pada browser/perangkat yang sama. Jumlah jamaah dihitung dari data, bukan angka dekoratif pada referensi.

Ini template frontend, belum memiliki backend, autentikasi, sinkronisasi antar pengguna, atau pembacaan biometrik. Tombol sidik jari hanya tombol absensi demo. Data contoh tidak dianggap sebagai absensi akun demo; absensi pertama menambahkan nama profil demo. Menghapus data situs akan mengembalikan data contoh.

## Struktur

- `index.html`: markup dan ikon SVG.
- `style.css`: tampilan desktop/mobile dan aksesibilitas fokus.
- `app.js`: interaksi serta penyimpanan data demo.
- `features.js`, `ami.js`: formulir kegiatan, halaman tambahan, agenda, berbagi teks, dan mode baca.
- `assets/skyline.svg`: dekorasi masjid ringan.
- `Dockerfile`, `compose.yaml`, `nginx.conf`: server statis Nginx dengan gzip.

Tanggal contoh memakai 25 September 2026; nama hari dihitung secara otomatis agar sesuai kalender. Ubah array `initial.events` dan `initial.people` pada `app.js` untuk data awal. Jika pernah membuka demo, hapus kunci `jims-demo-v1` dari localStorage untuk memuat ulang data awal.

Tombol sidik jari memancarkan gelombang saat diam. Saat ditarik, warna dan sorotan mengikuti arah; lepaskan setelah melewati 65% jarak untuk memilih. Tombol menetap di ujung kiri untuk offline dan ujung kanan untuk online/izin, termasuk setelah refresh. Keterangan muncul di sisi seberang. Geser balik ke tengah untuk cancel; tarikan pendek kembali ke posisi terakhir tanpa mengubah status. Efek mengunci menggunakan animasi pantulan dan getaran singkat jika perangkat mendukung. Tombol panah kiri/kanan pada keyboard juga didukung. Animasi gelombang dinonaktifkan jika perangkat memilih pengurangan gerakan.
