// Penyedia data aplikasi: memuat semua tabel milik pengguna, dan menyediakan mutasi
// yang hanya memperbarui UI SETELAH backend mengonfirmasi penyimpanan.
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

function DataProvider({ backend, user, onLogout, children }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [syncAt, setSyncAt] = useState(null);
  const online = useOnline();
  const toast = useToast();

  const load = useCallback(async (silent) => {
    if (!silent) setLoadErr(null);
    try {
      const out = {};
      await Promise.all(DB.TABLES.map(async t => { out[t] = await backend.selectAll(t); }));
      // Akun lama yang dibuat sebelum migration: lengkapi baris profil miliknya sendiri.
      if (!out.profiles.length && backend.kind === 'supabase') {
        out.profiles = await backend.insert('profiles', [{ id: user.id, email: user.email, full_name: user.name || '' }]);
      }
      setData(out); setSyncAt(new Date());
    } catch (e) { if (!silent) setLoadErr(DB.friendlyError(e)); else toast(DB.friendlyError(e), 'err'); }
  }, [backend]);
  useEffect(() => { load(); }, [load]);

  // Sinkronisasi antarperangkat (Supabase): muat ulang saat tab kembali aktif & berkala.
  useEffect(() => {
    if (backend.kind !== 'supabase') return;
    const vis = () => document.visibilityState === 'visible' && navigator.onLine && load(true);
    document.addEventListener('visibilitychange', vis);
    const iv = setInterval(() => document.visibilityState === 'visible' && navigator.onLine && load(true), 60000);
    return () => { document.removeEventListener('visibilitychange', vis); clearInterval(iv); };
  }, [backend, load]);

  const merge = (table, rows) => setData(d => {
    const list = [...d[table]];
    for (const r of rows) { const i = list.findIndex(x => x.id === r.id); if (i >= 0) list[i] = r; else list.push(r); }
    return { ...d, [table]: list };
  });

  const guard = () => { if (!navigator.onLine) { const e = new Error('Failed to fetch'); throw e; } };
  const audit = async (action, entity, entity_id, detail) => {
    try { const rows = await backend.insert('audit_logs', [{ action, entity, entity_id: entity_id || null, detail: detail || {} }]); merge('audit_logs', rows); } catch { /* audit gagal tidak membatalkan aksi utama */ }
  };

  const api = useMemo(() => ({
    async insert(table, rows, auditMsg) {
      guard(); const out = await backend.insert(table, rows); merge(table, out);
      if (auditMsg) audit('tambah', table, out[0] && out[0].id, { info: auditMsg });
      return out;
    },
    async update(table, id, patch, auditMsg) {
      guard(); const out = await backend.update(table, id, patch); merge(table, [out]);
      if (auditMsg) audit('ubah', table, id, { info: auditMsg });
      return out;
    },
    async upsert(table, rows, onConflict, auditMsg) {
      guard(); const out = await backend.upsert(table, rows, onConflict); merge(table, out);
      if (auditMsg) audit('simpan', table, null, { info: auditMsg, count: rows.length });
      return out;
    },
    async remove(table, id, auditMsg) {
      guard(); await backend.remove(table, id);
      setData(d => ({ ...d, [table]: d[table].filter(x => x.id !== id) }));
      if (auditMsg) audit('hapus', table, id, { info: auditMsg });
    },
    audit,
  }), [backend]);

  if (loadErr) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card card-pad" style={{ maxWidth: 440, width: '100%' }}>
        <div className="alert err"><Icon n="wifiOff" s={16} /><div><b>Gagal memuat data.</b><br />{loadErr}</div></div>
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onLogout}>Keluar</button>
          <button className="btn btn-dark" onClick={() => load()}><Icon n="refresh" s={15} />Coba lagi</button>
        </div>
      </div>
    </div>
  );
  if (!data) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner label="Memuat data dari server…" /></div>;

  const ctx = L.activeContext(data);
  return <AppCtx.Provider value={{ backend, user, data, ctx, api, online, syncAt, reload: () => load(true), onLogout }}>{children}</AppCtx.Provider>;
}

// Penyiapan awal untuk akun baru (tahun ajaran, semester, identitas, modul).
function SetupWizard() {
  const { api, user, data, onLogout } = useApp();
  const toast = useToast();
  const y = new Date().getFullYear(), m = new Date().getMonth();
  const startY = m >= 6 ? y : y - 1;
  const [f, setF] = useState({ year: `${startY}/${startY + 1}`, sem: m >= 6 || m === 0 ? 'Ganjil' : 'Genap', full_name: (data.profiles[0] && data.profiles[0].full_name) || user.name || '', subject: '', school: '' });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState({});
  const submit = async e => {
    e.preventDefault();
    const er = {};
    if (!/^\d{4}\/\d{4}$/.test(f.year) || +f.year.slice(5) !== +f.year.slice(0, 4) + 1) er.year = 'Format tahun ajaran: 2026/2027';
    if (f.full_name.trim().length < 2) er.full_name = 'Nama guru wajib diisi.';
    setErr(er); if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const [yr] = await api.insert('academic_years', [{ name: f.year, is_active: true }]);
      await api.insert('semesters', [{ academic_year_id: yr.id, name: 'Ganjil', is_active: f.sem === 'Ganjil' }, { academic_year_id: yr.id, name: 'Genap', is_active: f.sem === 'Genap' }]);
      if (!data.module_settings.length) await api.insert('module_settings', [{ absensi: true, hafalan: true, tugas: true, keaktifan: true, bebas_semester: false, attendance_threshold: 80, passing_grade: 75, activity_scale_max: 5, report_prefs: {} }]);
      const p = data.profiles[0];
      if (p) await api.update('profiles', p.id, { full_name: f.full_name.trim(), teacher_subject: f.subject.trim(), school_name: f.school.trim() });
      await api.audit('setup', 'academic_years', yr.id, { year: f.year });
      toast('Penyiapan awal tersimpan di server.');
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 520, padding: 28 }}>
        <Logo />
        <h2 style={{ fontSize: 20, marginTop: 16 }}>Penyiapan awal</h2>
        <p className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>Akun Anda belum memiliki tahun ajaran. Isi data berikut sekali saja — semuanya dapat diubah nanti di Pengaturan.</p>
        <div className="fg" style={{ marginTop: 18 }}>
          <Field label="Tahun ajaran" error={err.year}><input className="input" value={f.year} onChange={set('year')} placeholder="2026/2027" /></Field>
          <Field label="Semester aktif"><select className="select" value={f.sem} onChange={set('sem')}><option>Ganjil</option><option>Genap</option></select></Field>
          <Field label="Nama guru" error={err.full_name} className="full"><input className="input" value={f.full_name} onChange={set('full_name')} /></Field>
          <Field label="Mata pelajaran"><input className="input" value={f.subject} onChange={set('subject')} placeholder="mis. Bahasa Arab" /></Field>
          <Field label="Nama sekolah"><input className="input" value={f.school} onChange={set('school')} placeholder="mis. MTs Negeri 1" /></Field>
        </div>
        <div className="row" style={{ marginTop: 22, justifyContent: 'space-between' }}>
          <button type="button" className="link" onClick={onLogout}>Keluar</button>
          <button className="btn btn-dark" disabled={busy}>{busy && <span className="spin" />}Simpan & lanjutkan</button>
        </div>
      </form>
    </div>
  );
}

Object.assign(window, { AppCtx, useApp, useOnline, DataProvider, SetupWizard });
