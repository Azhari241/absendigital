# ABSEN DIGITAL — Paket perbaikan

## Perbaikan yang dilakukan
- Menambahkan `app/pages-bebas.jsx` yang sebelumnya dirujuk oleh `index.html` tetapi tidak ada pada paket sumber.
- Menambahkan `app/pages-progress.jsx` yang sebelumnya dirujuk oleh `index.html` tetapi tidak ada pada paket sumber.
- Menambahkan error boundary pada aplikasi supaya kesalahan runtime tidak hanya tampil sebagai halaman putih.
- Menambahkan `package.json`, `scripts/build.mjs`, dan `vercel.json` agar proses build Vercel menyalin file aplikasi ke `dist` dan mengisi konfigurasi Supabase dari environment variable.
- Memastikan build gagal lebih awal jika ada referensi script lokal yang tidak tersedia.
- Menggunakan build React production.

## Sebelum deploy
Di Vercel Project → Settings → Environment Variables, tambahkan untuk Production (serta Preview/Development bila diperlukan):
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL dari proyek Supabase `absendigital`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable Key dari proyek Supabase `absendigital`

Jangan gunakan `service_role` atau `sb_secret_` key pada aplikasi browser.

Setelah kedua variabel tersedia, commit/push file ke branch yang digunakan Vercel atau upload folder sumber ke repository, lalu lakukan deployment baru. Periksa Build Logs. Jangan memasukkan isi key ke GitHub.

## Catatan
Build lokal tanpa Environment Variables tetap dapat selesai, tetapi aplikasi akan menampilkan petunjuk konfigurasi Supabase. Paket ini tidak mengubah atau menghapus data database dan tidak menonaktifkan RLS.

Halaman Bebas Semester dan Perkembangan Siswa yang ditambahkan menyediakan fungsi dasar yang aman; periksa kembali fitur di browser setelah deployment.
