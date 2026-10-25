// =====================================================================
// Lapisan data ABSEN DIGITAL
//  - SupabaseBackend : satu-satunya penyimpanan produksi (PostgreSQL + Auth + RLS)
//  - Tidak ada database simulasi di build produksi. Backend uji lokal hanya ada
//    di folder dev/ dan tidak ikut di-deploy (lihat scripts/build.mjs).
// Semua mutasi menunggu konfirmasi backend sebelum cache UI diperbarui.
// =====================================================================
(function () {
  const SERVER_KEY = 'alatguru.server.v1';
  // Bersihkan sisa data mode demo versi lama di perangkat (bukan data server).
  try { localStorage.removeItem('alatguru.demo.data.v1'); localStorage.removeItem('alatguru.demo.session.v1'); } catch { /* */ }

  const TABLES = ['profiles','academic_years','semesters','classes','students','meetings','meeting_modules',
    'attendance_records','memorization_targets','memorization_records','assignments','assignment_records',
    'activity_records','student_notes','note_history','module_settings','semester_exemption_rules',
    'semester_exemption_reviews','learning_materials','attention_followups','audit_logs',
    'student_progress_notes','semester_exemption_documents'];
  // Tabel dari migration 0003. Bila belum dijalankan, aplikasi tetap berjalan dan
  // fitur terkait menampilkan pesan "perlu pembaruan database" — bukan data kosong palsu.
  const OPTIONAL_TABLES = ['student_progress_notes', 'semester_exemption_documents'];
  const isMissingTable = e => !!e && /does not exist|PGRST205|42P01|schema cache|PGRST204|column/i.test((e.message || '') + ' ' + (e.code || ''));

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const nowIso = () => new Date().toISOString();
  
  // ---------------- Konfigurasi server: HANYA dari Environment Variables ----------------
  // Di Next.js/Vercel nilai ini berasal dari NEXT_PUBLIC_SUPABASE_URL dan
  // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (atau NEXT_PUBLIC_SUPABASE_ANON_KEY untuk proyek lama).
  // Di prototipe ini nilainya dibaca dari app/config.js. Pengguna tidak pernah memasukkannya.
  try { localStorage.removeItem(SERVER_KEY); } catch { /* bersihkan konfigurasi lama per-perangkat */ }
  function getServer() {
    const env = window.__ABSEN_DIGITAL_ENV__ || window.__ALAT_GURU_ENV__ || {};
    const url = String(env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const key = String(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) return { missing: true, errors: { env: 'Environment Variables Supabase belum diatur.' } };
    const errors = validateServerInput(url, key);
    if (Object.keys(errors).length) return { invalid: true, errors };
    return { url: url.replace(/\/+$/, ''), key };
  }
  // Pemeriksaan tabel yang benar-benar dipakai aplikasi (bukan sekadar satu tabel).
  const REQUIRED_TABLES = ['profiles', 'academic_years', 'semesters', 'classes', 'students', 'meetings', 'attendance_records', 'module_settings', 'student_notes'];
  async function checkSchema(client) {
    const missing = [];
    let network = false;
    await Promise.all(REQUIRED_TABLES.map(async t => {
      const { error } = await client.from(t).select('id', { head: true, count: 'exact' }).limit(1);
      if (!error) return;
      if (/does not exist|PGRST205|42P01|schema cache/i.test((error.message || '') + ' ' + (error.code || ''))) missing.push(t);
      else if (/fetch|network/i.test(error.message || '')) network = true;
    }));
    return { ok: !missing.length && !network, missing, network };
  }

  function decodeJwtRole(key) {
    try {
      const p = key.split('.')[1];
      const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      return json.role || null;
    } catch { return null; }
  }
  function validateServerInput(url, key) {
    const errs = {};
    const u = (url || '').trim();
    const k = (key || '').trim();
    if (!u) errs.url = 'Project URL wajib diisi.';
    else {
      let parsed = null;
      try { parsed = new URL(u); } catch { /* */ }
      if (!parsed || parsed.protocol !== 'https:') errs.url = 'Gunakan URL https, contoh: https://abcd1234.supabase.co';
      else if (!/\.supabase\.(co|in)$/.test(parsed.hostname) && !/^(localhost|127\.0\.0\.1)$/.test(parsed.hostname))
        errs.url = 'URL harus berupa domain proyek Supabase (…supabase.co).';
      else if (parsed.pathname.replace(/\/+$/, '') !== '') errs.url = 'Masukkan URL proyek saja tanpa path tambahan.';
    }
    if (!k) errs.key = 'Publishable key / anon key wajib diisi.';
    else if (/^sb_secret_/.test(k)) errs.key = 'Ini adalah secret key. Jangan gunakan secret / service role key di browser.';
    else if (k.startsWith('eyJ')) {
      const role = decodeJwtRole(k);
      if (role === 'service_role') errs.key = 'Ini adalah service role key. Gunakan anon key atau publishable key.';
      else if (role && role !== 'anon') errs.key = 'Key tidak dikenali sebagai anon key.';
    } else if (!/^sb_publishable_/.test(k)) errs.key = 'Format key tidak dikenali. Gunakan publishable key (sb_publishable_…) atau anon key.';
    return errs;
  }

  function makeClient(url, key) {
    if (!window.supabase || !window.supabase.createClient) throw new Error('Library Supabase gagal dimuat. Periksa koneksi internet.');
    const host = new URL(url).hostname.split('.')[0];
    return window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'alatguru-auth-' + host },
    });
  }

  // Uji koneksi lewat permintaan nyata: endpoint Auth + keberadaan tabel aplikasi.
  async function testConnection(url, key) {
    const u = url.trim().replace(/\/+$/, ''), k = key.trim();
    const res = { ok: false, authOk: false, schemaOk: false, message: '' };
    if (!navigator.onLine) { res.message = 'Perangkat sedang offline.'; return res; }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const r = await fetch(u + '/auth/v1/settings', { headers: { apikey: k }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.status === 401 || r.status === 403) { res.message = 'Server merespons, tetapi key ditolak. Periksa kembali publishable/anon key.'; return res; }
      if (!r.ok) { res.message = 'Server merespons dengan status ' + r.status + '. Pastikan URL proyek benar.'; return res; }
      res.authOk = true;
    } catch (e) {
      res.message = e.name === 'AbortError' ? 'Koneksi habis waktu (10 detik). Periksa URL dan jaringan.' : 'Tidak dapat menjangkau server. Periksa URL proyek dan koneksi internet.';
      return res;
    }
    try {
      const client = makeClient(u, k);
      const { error } = await client.from('module_settings').select('id', { head: true, count: 'exact' });
      if (error) {
        if (/does not exist|PGRST205|42P01|schema cache/i.test(error.message + ' ' + (error.code || ''))) {
          res.message = 'Koneksi berhasil, tetapi tabel aplikasi belum ditemukan. Jalankan migration SQL terlebih dahulu.';
          res.ok = true; res.schemaOk = false; return res;
        }
        res.message = 'Koneksi berhasil, tetapi pemeriksaan tabel gagal: periksa migration.';
        res.ok = true; return res;
      }
      res.ok = true; res.schemaOk = true;
      res.message = 'Koneksi berhasil dan tabel aplikasi ditemukan.';
    } catch (e) {
      res.message = 'Koneksi Auth berhasil, tetapi pemeriksaan database gagal.';
      res.ok = true;
    }
    return res;
  }

  // Pesan kesalahan ramah — tanpa detail teknis/kredensial.
  function friendlyError(e) {
    const m = ((e && (e.message || e.error_description)) || '').toLowerCase();
    const code = (e && e.code) || '';
    if (!navigator.onLine || m.includes('failed to fetch') || m.includes('network')) return 'Koneksi terputus. Data belum tersimpan — coba lagi setelah online.';
    if (m.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
    if (m.includes('email not confirmed')) return 'Email belum diverifikasi. Periksa kotak masuk Anda.';
    if (m.includes('already registered') || m.includes('already been registered') || code === 'user_already_exists') return 'Email ini sudah terdaftar. Silakan masuk atau gunakan Lupa kata sandi.';
    if (m.includes('rate limit') || code === 'over_email_send_rate_limit') return 'Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.';
    if (m.includes('password should be') || code === 'weak_password') return 'Kata sandi belum memenuhi kebijakan keamanan server.';
    if (m.includes('jwt expired') || m.includes('session') && m.includes('expired')) return 'Sesi berakhir. Silakan masuk kembali.';
    if (code === '23505' || m.includes('duplicate')) return 'Data yang sama sudah ada (duplikat).';
    if (code === '23503') return 'Data masih terhubung dengan data lain sehingga tidak dapat diproses.';
    if (code === '42501' || m.includes('row-level security') || m.includes('bukan milik')) return 'Akses ditolak oleh kebijakan keamanan database (RLS): data ini bukan milik akun Anda.';
    if (m.includes('does not exist') || code === 'PGRST205') return 'Database belum siap (tabel belum tersedia). Hubungi pengelola aplikasi.';
    if (code === 'PGRST202' || m.includes('could not find the function')) return 'Fitur ini memerlukan pembaruan database (migration 0002). Hubungi pengelola aplikasi.';
    if (e && e.code === 'NOT_OWNED') return 'Data tidak ditemukan atau bukan milik akun Anda. Tidak ada yang diubah.';
    if (e && e.code === 'P0001' && e.message) return e.message;
    if (e && e.friendly) return e.message;
    return 'Terjadi kesalahan. Silakan coba lagi.';
  }

  // ---------------- Backend Supabase ----------------
  function SupabaseBackend(client) {
    const strip = r => { const { owner_id, ...rest } = r; return rest; };
    const chk = ({ data, error }) => { if (error) throw error; return data; };
    return {
      kind: 'supabase', client,
      async selectAll(table) {
        // Paginasi agar tidak terpotong batas 1000 baris.
        let all = [], from = 0; const size = 1000;
        for (;;) {
          const rows = chk(await client.from(table).select('*').range(from, from + size - 1));
          all = all.concat(rows); if (rows.length < size) break; from += size;
        }
        return all;
      },
      async insert(table, rows) { return chk(await client.from(table).insert([].concat(rows).map(strip)).select()); },
      async update(table, id, patch) {
        const rows = chk(await client.from(table).update(strip(patch)).eq('id', id).select());
        // RLS menyaring baris milik akun lain → 0 baris. Jangan anggap berhasil.
        if (!rows.length) throw Object.assign(new Error('not owned'), { code: 'NOT_OWNED' });
        return rows[0];
      },
      async upsert(table, rows, onConflict) {
        if (!rows.length) return [];
        return chk(await client.from(table).upsert(rows.map(strip), { onConflict }).select());
      },
      async remove(table, id) {
        const rows = chk(await client.from(table).delete().eq('id', id).select('id'));
        if (!rows.length) throw Object.assign(new Error('not owned'), { code: 'NOT_OWNED' });
        return true;
      },
      async removeMany(table, ids) {
        if (!ids.length) return 0;
        const rows = chk(await client.from(table).delete().in('id', ids).select('id'));
        if (rows.length !== ids.length) throw Object.assign(new Error('not owned'), { code: 'NOT_OWNED' });
        return rows.length;
      },
      // Penghapusan berelasi dijalankan sebagai fungsi database (satu transaksi, RLS tetap berlaku).
      async rpc(name, args) { return chk(await client.rpc(name, args)); },
    };
  }

  window.DB = {
    TABLES, uuid, nowIso, getServer, checkSchema, REQUIRED_TABLES, validateServerInput, makeClient, testConnection,
    friendlyError, SupabaseBackend, isMissingTable, OPTIONAL_TABLES,
  };
})();
