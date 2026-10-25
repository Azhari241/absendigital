// =====================================================================
// Konfigurasi publik Supabase ABSEN DIGITAL — diatur SATU kali oleh pengelola.
//
// PRODUKSI (Vercel): JANGAN edit file ini. Isi Environment Variables:
//     NEXT_PUBLIC_SUPABASE_URL              = https://<ref>.supabase.co
//     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  = sb_publishable_...   (atau anon key eyJ...)
// lalu Redeploy. `npm run build` (scripts/build.mjs) MENULIS ULANG file ini di folder
// dist/ dengan nilai dari Environment Variables, sehingga browser benar-benar membacanya.
// (Environment Variables Vercel tidak otomatis tersedia di browser tanpa langkah build.)
//
// LOKAL: boleh diisi sementara untuk pengujian, tetapi jangan di-commit.
// Hanya URL + publishable/anon key (aman di browser bila RLS aktif).
// JANGAN PERNAH menaruh service_role key / secret key (sb_secret_...) di sini.
// =====================================================================
window.__ABSEN_DIGITAL_ENV__ = {
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
};
