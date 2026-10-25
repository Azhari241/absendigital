// =====================================================================
// HANYA UNTUK PENGEMBANGAN / PENGUJIAN LOKAL — TIDAK IKUT BUILD PRODUKSI.
// Backend tiruan di localStorage agar UI bisa diuji tanpa server Supabase.
// File ini dimuat oleh "dev/ABSEN DIGITAL (uji lokal).html" saja.
// scripts/build.mjs tidak menyalin folder dev/ ke hasil deploy.
// =====================================================================
(function () {
  const TABLES = DB.TABLES;
  const DEMO_KEY = 'absendigital.dev.data.v1';
  const SESSION = 'absendigital.dev.session.v1';
  const uuid = DB.uuid, nowIso = DB.nowIso;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function DemoBackend() {
    let store = null;
    const load = () => {
      if (store) return store;
      try { store = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { store = null; }
      if (!store) { store = {}; TABLES.forEach(t => store[t] = []); }
      TABLES.forEach(t => store[t] = store[t] || []);
      return store;
    };
    const persist = () => localStorage.setItem(DEMO_KEY, JSON.stringify(store));
    const net = async () => { await sleep(160 + Math.random() * 180); if (!navigator.onLine) { const e = new Error('Failed to fetch'); throw e; } };
    const stamp = r => ({ id: uuid(), owner_id: 'dev-user', created_at: nowIso(), updated_at: nowIso(), ...r });
    const UNIQUE = {
      attendance_records: ['meeting_id','student_id'], memorization_records: ['meeting_id','student_id'],
      activity_records: ['meeting_id','student_id'], assignment_records: ['assignment_id','student_id'],
      meetings: ['class_id','semester_id','number'], meeting_modules: ['meeting_id','module'],
      semester_exemption_reviews: ['semester_id','student_id'], attention_followups: ['student_id','category'],
      semester_exemption_rules: ['owner_id','semester_id'],
    };
    const conflictFor = (table, row, data) => {
      const keys = UNIQUE[table]; if (!keys) return null;
      return data.find(x => keys.every(k => (k === 'owner_id' ? true : x[k] === row[k])));
    };
    return {
      kind: 'demo',
      async selectAll(table) { await sleep(20); return JSON.parse(JSON.stringify(load()[table] || [])); },
      async insert(table, rows) {
        await net(); const s = load(); const out = [];
        for (const r of [].concat(rows)) {
          const row = stamp(r);
          if (conflictFor(table, row, s[table])) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
          if (table === 'students' && row.nis && s.students.some(x => x.nis && x.nis === row.nis)) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
          s[table].push(row); out.push(row);
        }
        persist(); return JSON.parse(JSON.stringify(out));
      },
      async update(table, id, patch) {
        await net(); const s = load(); const i = s[table].findIndex(x => x.id === id);
        if (i < 0) { const e = new Error('not found'); throw e; }
        if (table === 'students' && patch.nis && s.students.some(x => x.id !== id && x.nis && x.nis === patch.nis)) { const e = new Error('duplicate key'); e.code = '23505'; throw e; }
        s[table][i] = { ...s[table][i], ...patch, id, updated_at: nowIso() }; persist();
        return JSON.parse(JSON.stringify(s[table][i]));
      },
      async upsert(table, rows) {
        await net(); const s = load(); const out = [];
        for (const r of rows) {
          const ex = (r.id && s[table].find(x => x.id === r.id)) || conflictFor(table, r, s[table]);
          if (ex) { Object.assign(ex, r, { id: ex.id, updated_at: nowIso() }); out.push(ex); }
          else { const row = stamp(r); s[table].push(row); out.push(row); }
        }
        persist(); return JSON.parse(JSON.stringify(out));
      },
      async remove(table, id) {
        await net(); const s = load();
        if (!s[table].some(x => x.id === id)) { const e = new Error('not owned'); e.code = 'NOT_OWNED'; throw e; }
        // Tiru FK: restrict untuk siswa yang punya riwayat
        if (table === 'students' && ['attendance_records', 'memorization_records', 'activity_records', 'assignment_records', 'student_notes', 'semester_exemption_reviews'].some(t => s[t].some(r => r.student_id === id))) { const e = new Error('fk'); e.code = '23503'; throw e; }
        if (table === 'assignments') { s.assignment_records = s.assignment_records.filter(r => r.assignment_id !== id); s.student_notes.forEach(n => { if (n.related_assignment_id === id) n.related_assignment_id = null; }); }
        if (table === 'student_notes') s.note_history = s.note_history.filter(h => h.note_id !== id);
        if (table === 'memorization_targets') s.memorization_records.forEach(r => { if (r.target_id === id) r.target_id = null; });
        if (table === 'students') s.attention_followups = s.attention_followups.filter(f => f.student_id !== id);
        s[table] = s[table].filter(x => x.id !== id); persist(); return true;
      },
      async removeMany(table, ids) { await net(); const s = load(); const set = new Set(ids); s[table] = s[table].filter(x => !set.has(x.id)); persist(); return ids.length; },
      async rpc(name, args) {
        await net(); const s = load();
        const err = (msg, code) => { const e = new Error(msg); e.code = code; throw e; };
        if (name === 'delete_meeting') {
          const id = args.p_meeting_id;
          if (!s.meetings.some(m => m.id === id)) err('Pertemuan tidak ditemukan atau bukan milik Anda', 'NOT_OWNED');
          const cnt = t => s[t].filter(r => r.meeting_id === id).length;
          const out = { attendance: cnt('attendance_records'), memorization: cnt('memorization_records'), activity: cnt('activity_records') };
          ['attendance_records', 'memorization_records', 'activity_records', 'meeting_modules'].forEach(t => s[t] = s[t].filter(r => r.meeting_id !== id));
          s.assignments.forEach(a => { if (a.meeting_id === id) a.meeting_id = null; });
          s.student_notes.forEach(n => { if (n.origin_meeting_id === id) n.origin_meeting_id = null; });
          s.meetings = s.meetings.filter(m => m.id !== id);
          s.audit_logs.push(stamp({ action: 'hapus', entity: 'meetings', entity_id: id, detail: out }));
          persist(); return out;
        }
        if (name === 'delete_class') {
          const id = args.p_class_id;
          if (!s.classes.some(c => c.id === id)) err('Kelas tidak ditemukan atau bukan milik Anda', 'NOT_OWNED');
          if (s.students.some(x => x.class_id === id) || s.meetings.some(m => m.class_id === id) || s.student_notes.some(n => n.class_id === id)) err('Kelas masih memiliki siswa, pertemuan, atau catatan. Arsipkan kelas sebagai gantinya.', 'P0001');
          s.assignments = s.assignments.filter(a => !(a.class_id === id && !s.assignment_records.some(r => r.assignment_id === a.id)));
          s.memorization_targets = s.memorization_targets.filter(t => t.class_id !== id);
          s.classes = s.classes.filter(c => c.id !== id);
          persist(); return null;
        }
        err('Could not find the function', 'PGRST202');
      },
      reset() { localStorage.removeItem(DEMO_KEY); store = null; },
      hasData() { const s = load(); return s.classes.length > 0; },
      seed(seedObj) { store = {}; TABLES.forEach(t => store[t] = seedObj[t] || []); persist(); },
    };
  }


  let inst = null;
  const backend = () => {
    if (inst) return inst;
    inst = DemoBackend(); inst.kind = 'dev';
    // Jaringan putus disimulasikan: window.__AD_DEV_OFFLINE__ = true
    const wrap = fn => async (...a) => { if (window.__AD_DEV_OFFLINE__) { await sleep(200); throw new Error('Failed to fetch'); } return fn(...a); };
    ['insert', 'update', 'upsert', 'remove', 'removeMany', 'rpc'].forEach(k => { inst[k] = wrap(inst[k]); });
    return inst;
  };
  window.__AD_DEV_BACKEND__ = {
    session: () => localStorage.getItem(SESSION) === '1',
    logout: () => localStorage.removeItem(SESSION),
    user: () => ({ id: 'dev-user', email: 'pengembang@lokal.test', name: 'Guru Uji Lokal' }),
    backend,
    login(withSeed) {
      const b = backend();
      if (withSeed && !b.hasData() && window.buildDemoSeed) b.seed(window.buildDemoSeed(DB, L, 'Guru Uji Lokal', 'pengembang@lokal.test'));
      localStorage.setItem(SESSION, '1');
    },
    reset() { backend().reset(); inst = null; },
    LoginPage: null,
  };
})();
