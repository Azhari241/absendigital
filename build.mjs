import { cp, mkdir, readFile, rm, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const required = ['index.html', 'app'];
for (const item of required) {
  try { await stat(path.join(root, item)); }
  catch { throw new Error(`File/folder wajib tidak ditemukan: ${item}`); }
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(out, 'index.html'));
await cp(path.join(root, 'app'), path.join(out, 'app'), { recursive: true });

// Environment variables are embedded only into the generated public config.
// Never use service_role or sb_secret keys in a browser build.
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = String(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
).trim();
if (key.startsWith('sb_secret_') || (() => {
  try {
    if (key.startsWith('eyJ')) {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const role = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')).role;
      return role === 'service_role';
    }
  } catch {}
  return false;
})()) {
  throw new Error('Build dihentikan: jangan gunakan secret/service_role key di frontend. Gunakan Publishable Key atau anon key.');
}
const config = `// Dibuat otomatis oleh scripts/build.mjs. Jangan masukkan secret key ke build publik.\nwindow.__ABSEN_DIGITAL_ENV__ = ${JSON.stringify({
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key
}, null, 2)};\n`;
await writeFile(path.join(out, 'app', 'config.js'), config, 'utf8');

const html = await readFile(path.join(out, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
for (const src of scripts) {
  if (/^https?:\/\//i.test(src) || src.startsWith('data:')) continue;
  try { await stat(path.join(out, src)); }
  catch { throw new Error(`Script lokal dirujuk oleh index.html tetapi tidak ditemukan: ${src}`); }
}
if (!html.includes('app/pages-bebas.jsx') || !html.includes('app/pages-progress.jsx')) {
  throw new Error('Entry point tidak memuat halaman Bebas Semester dan Perkembangan Siswa.');
}
for (const file of ['app/pages-bebas.jsx', 'app/pages-progress.jsx']) {
  try { await stat(path.join(out, file)); }
  catch { throw new Error(`Modul wajib belum tersedia: ${file}`); }
}
console.log('Build ABSEN DIGITAL selesai.');
console.log(`Output: ${out}`);
console.log(`Supabase URL tersedia: ${Boolean(url)}`);
console.log(`Supabase key tersedia: ${Boolean(key)}`);
if (!url || !key) console.warn('PERINGATAN: Environment Variables Supabase belum lengkap. Deployment akan menampilkan petunjuk konfigurasi.');
