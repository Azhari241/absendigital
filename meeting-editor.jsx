// Editor pertemuan dengan SIMPAN OTOMATIS ke Supabase.
// - Memilih status kehadiran → langsung disimpan (upsert per siswa, kunci unik meeting_id+student_id → tanpa duplikasi).
// - Input teks (materi, catatan, menit, nilai) → disimpan setelah jeda mengetik (debounce).
// - Pertemuan baru dibuat SEKALI (promise di-cache) sebelum catatan pertama yang mengacu padanya.
// - Status yang belum dipilih TIDAK pernah diubah menjadi Alpa.
function MeetingEditor({ cls, initialMeetingId }) {
  const { data, ctx, api, v3 } = useApp();
  const toast = useToast();
  const as = useAutosave();
  const s = ctx.settings;
  const meetings = L.sortMeetings(data.meetings.filter(m => m.class_id === cls.id && m.semester_id === ctx.sem.id));
  const todays = meetings.filter(m => m.date === L.today());
  const [mid, setMid] = useState(() => initialMeetingId || (todays.length ? todays[todays.length - 1].id : 'new'));
  const meeting = meetings.find(m => m.id === mid) || null;
  const students = data.students.filter(x => x.class_id === cls.id && x.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));

  const nextNum = (meetings.length ? Math.max(...meetings.map(m => m.number)) : 0) + 1;
  const [form, setForm] = useState(null);
  const [rows, setRows] = useState({});
  const [asgId, setAsgId] = useState('');
  const [q, setQ] = useState('');
  const [noteFor, setNoteFor] = useState(null);
  const [newAsg, setNewAsg] = useState(false);
  const [editMeeting, setEditMeeting] = useState(false); const [delMeeting, setDelMeeting] = useState(false);
  const [ver, setVer] = useState(0);

  // Ref selalu berisi nilai terbaru agar job antrean membaca data paling akhir.
  const rowsRef = useRef({}); const formRef = useRef(null); const dataRef = useRef(data); const asgRef = useRef('');
  const meetingRef = useRef(null); const creating = useRef(null); const skipInit = useRef(false);
  dataRef.current = data; asgRef.current = asgId;
  if (meeting && (!meetingRef.current || meetingRef.current.id === meeting.id)) meetingRef.current = meeting;

  // Inisialisasi form & baris dari data tersimpan (hanya saat ganti pertemuan/kelas)
  useEffect(() => {
    if (skipInit.current) { skipInit.current = false; return; }
    const m = meeting;
    creating.current = null; meetingRef.current = m;
    const mods = m ? Object.fromEntries(window.MODS.map(x => { const mm = data.meeting_modules.find(r => r.meeting_id === m.id && r.module === x.k); return [x.k, mm ? mm.enabled : false]; }))
      : Object.fromEntries(window.MODS.map(x => [x.k, !!s[x.k]]));
    const f = m ? { date: m.date, number: m.number, topic: m.topic || '', notes: m.notes || '', mods } : { date: L.today(), number: nextNum, topic: '', notes: '', mods };
    setForm(f); formRef.current = f;
    const probe = m || { class_id: cls.id, date: f.date, number: f.number };
    const notes = L.activeNotesFor(data, probe);
    const r = {};
    for (const st of students) {
      const a = m && data.attendance_records.find(x => x.meeting_id === m.id && x.student_id === st.id);
      const h = m && data.memorization_records.find(x => x.meeting_id === m.id && x.student_id === st.id);
      const k = m && data.activity_records.find(x => x.meeting_id === m.id && x.student_id === st.id);
      const bebasH = notes.some(n => n.student_id === st.id && n.type === 'bebas_hafalan');
      r[st.id] = {
        status: a ? a.status : '', late: a && a.late_minutes != null ? String(a.late_minutes) : '', note: a ? a.note || '' : '',
        mem: h ? h.status : (bebasH ? 'bebas' : ''), memScore: h && h.score != null ? String(h.score) : '', memComment: h ? h.comment || '' : '',
        act: k && k.score != null ? String(k.score) : '', actNote: k ? k.note || '' : '', asg: '', asgScore: '',
      };
    }
    setRows(r); rowsRef.current = r;
    const relevant = data.assignments.filter(a => a.class_id === cls.id && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
    const due = relevant.find(a => a.due_date <= f.date) || relevant[0];
    setAsgId(due ? due.id : '');
  }, [mid, cls.id, ver]);

  // Isi kolom tugas dari rekaman tersimpan (saat tugas yang diperiksa diganti)
  useEffect(() => {
    if (!asgId) return;
    setRows(prev => {
      const r = { ...prev };
      for (const st of students) {
        if (as.isPending('asg:' + st.id)) continue; // jangan timpa perubahan yang belum terkirim
        const rec = data.assignment_records.find(x => x.assignment_id === asgId && x.student_id === st.id);
        const bebasT = data.student_notes.some(n => n.student_id === st.id && n.type === 'bebas_tugas' && n.related_assignment_id === asgId && n.status === 'aktif');
        if (r[st.id]) r[st.id] = { ...r[st.id], asg: rec ? rec.status : (bebasT ? 'bebas' : ''), asgScore: rec && rec.score != null ? String(rec.score) : '' };
      }
      rowsRef.current = r;
      return r;
    });
  }, [asgId, mid]);

  if (!form) return <Spinner />;
  const probe = meeting || { class_id: cls.id, date: form.date, number: Number(form.number) };
  const activeNotes = L.activeNotesFor(data, probe).filter(n => students.some(st => st.id === n.student_id));
  const noteBy = sid => activeNotes.filter(n => n.student_id === sid);
  const asgOptions = data.assignments.filter(a => a.class_id === cls.id && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const assignment = asgOptions.find(a => a.id === asgId);
  const asgTargets = assignment ? (assignment.target === 'kelas' ? null : new Set(assignment.student_ids || [])) : null;
  const useMod = k => s[k] && form.mods[k];

  // ---------- Validasi ----------
  const vErr = msg => Object.assign(new Error(msg), { validation: true, friendly: true });
  const meetingRow = () => {
    const f = formRef.current; const n = Number(f.number);
    if (!f.date) throw vErr('Tanggal pertemuan wajib diisi.');
    if (!Number.isInteger(n) || n < 1) throw vErr('Nomor pertemuan harus bilangan bulat ≥ 1.');
    const cur = meetingRef.current;
    if (dataRef.current.meetings.some(m => m.class_id === cls.id && m.semester_id === ctx.sem.id && m.number === n && (!cur || m.id !== cur.id))) throw vErr('Nomor pertemuan ' + n + ' sudah dipakai di kelas ini.');
    return { class_id: cls.id, semester_id: ctx.sem.id, date: f.date, number: n, topic: f.topic.trim(), notes: f.notes.trim() };
  };
  const modRows = m => [{ meeting_id: m.id, module: 'absensi', enabled: true }, ...window.MODS.map(x => ({ meeting_id: m.id, module: x.k, enabled: !!formRef.current.mods[x.k] }))];

  // ---------- Pertemuan dibuat tepat satu kali ----------
  const ensureMeeting = async () => {
    if (meetingRef.current) return meetingRef.current;
    if (!creating.current) {
      creating.current = (async () => {
        const row = meetingRow();
        const [m] = await api.insert('meetings', [row], 'Pertemuan baru ' + row.number + ' ' + cls.name);
        meetingRef.current = m; skipInit.current = true; setMid(m.id);
        await api.upsert('meeting_modules', modRows(m), 'meeting_id,module');
        return m;
      })().catch(e => { creating.current = null; throw e; });
    }
    return creating.current;
  };

  // ---------- Job simpan per jenis data ----------
  const findRec = (table, mId, sid) => dataRef.current[table].find(r => r.meeting_id === mId && r.student_id === sid);
  const saveAtt = sid => async () => {
    const r = rowsRef.current[sid]; if (!r) return;
    if (r.late && !(+r.late >= 0 && +r.late <= 600)) throw vErr('Menit terlambat harus 0–600.');
    const m = await ensureMeeting();
    if (!r.status) { const ex = findRec('attendance_records', m.id, sid); if (ex) await api.removeMany('attendance_records', [ex.id]); return; }
    await api.upsert('attendance_records', [{ meeting_id: m.id, student_id: sid, status: r.status, late_minutes: r.status === 'terlambat' && r.late !== '' ? Number(r.late) : null, note: r.note.trim() }], 'meeting_id,student_id');
  };
  const saveMem = sid => async () => {
    const r = rowsRef.current[sid]; if (!r) return;
    if (r.memScore && !(+r.memScore >= 0 && +r.memScore <= 100)) throw vErr('Nilai hafalan harus 0–100.');
    const m = await ensureMeeting();
    if (!r.mem) { const ex = findRec('memorization_records', m.id, sid); if (ex) await api.removeMany('memorization_records', [ex.id]); return; }
    const f = formRef.current;
    const target = dataRef.current.memorization_targets.find(t => t.class_id === cls.id && t.semester_id === ctx.sem.id && t.title === f.topic);
    await api.upsert('memorization_records', [{ meeting_id: m.id, student_id: sid, target_id: target ? target.id : null, status: r.mem, score: r.mem === 'setor' && r.memScore !== '' ? Number(r.memScore) : null, comment: r.memComment.trim() }], 'meeting_id,student_id');
  };
  const saveAct = sid => async () => {
    const r = rowsRef.current[sid]; if (!r) return;
    if (r.act && !(+r.act >= 0 && +r.act <= s.activity_scale_max)) throw vErr('Nilai keaktifan harus 0–' + s.activity_scale_max + '.');
    const m = await ensureMeeting();
    if (r.act === '' && !r.actNote) { const ex = findRec('activity_records', m.id, sid); if (ex) await api.removeMany('activity_records', [ex.id]); return; }
    await api.upsert('activity_records', [{ meeting_id: m.id, student_id: sid, score: r.act !== '' ? Number(r.act) : null, note: r.actNote.trim() }], 'meeting_id,student_id');
  };
  const saveAsg = (sid, aId) => async () => {
    const r = rowsRef.current[sid]; if (!r || !aId) return;
    if (r.asgScore && !(+r.asgScore >= 0 && +r.asgScore <= 100)) throw vErr('Nilai tugas harus 0–100.');
    if (!r.asg) { const ex = dataRef.current.assignment_records.find(x => x.assignment_id === aId && x.student_id === sid); if (ex) await api.removeMany('assignment_records', [ex.id]); return; }
    const done = L.ASG_DONE.includes(r.asg);
    await api.upsert('assignment_records', [{ assignment_id: aId, student_id: sid, status: r.asg, score: done && r.asgScore !== '' ? Number(r.asgScore) : null, submitted_at: done ? formRef.current.date : null, comment: '' }], 'assignment_id,student_id');
  };
  const saveMeeting = async () => {
    const row = meetingRow();
    const cur = meetingRef.current;
    if (!cur) { await ensureMeeting(); return; }
    const m = await api.update('meetings', cur.id, row);
    meetingRef.current = m;
    await api.upsert('meeting_modules', modRows(m), 'meeting_id,module');
  };

  // ---------- Perubahan dari UI ----------
  const upd = (sid, patch) => { const n = { ...rowsRef.current, [sid]: { ...rowsRef.current[sid], ...patch } }; rowsRef.current = n; setRows(n); };
  const TEXT = 900;
  const setStatus = (sid, st) => {
    const cur = rowsRef.current[sid];
    // Klik status yang sama → kosongkan (catatan tersimpan dihapus; tidak diubah menjadi Alpa).
    if (cur.status === st) { upd(sid, { status: '', late: '' }); as.queue('att:' + sid, saveAtt(sid)); return; }
    const patch = { status: st };
    if (st !== 'terlambat') patch.late = '';
    let memCh = false, actCh = false;
    if (!['hadir', 'terlambat'].includes(st)) {
      if (cur.mem !== 'bebas') { const nm = (st === 'izin' || st === 'sakit') ? (useMod('hafalan') ? 'izin' : cur.mem) : (cur.mem === 'setor' ? '' : cur.mem); if (nm !== cur.mem) { patch.mem = nm; memCh = true; if (nm !== 'setor') patch.memScore = ''; } }
      if (cur.act !== '') { patch.act = ''; actCh = true; }
    }
    upd(sid, patch);
    as.queue('att:' + sid, saveAtt(sid));
    if (memCh && useMod('hafalan')) as.queue('mem:' + sid, saveMem(sid));
    if (actCh && useMod('keaktifan')) as.queue('act:' + sid, saveAct(sid));
  };
  const setAttText = (sid, patch) => { upd(sid, patch); as.queue('att:' + sid, saveAtt(sid), { delay: TEXT }); };
  const setMem = (sid, patch, delay) => { upd(sid, patch); as.queue('mem:' + sid, saveMem(sid), { delay }); };
  const setAct = (sid, patch, delay) => { upd(sid, patch); as.queue('act:' + sid, saveAct(sid), { delay }); };
  const setAsg = (sid, patch, delay) => { upd(sid, patch); const aId = asgRef.current; as.queue('asg:' + sid, saveAsg(sid, aId), { delay }); };
  const bulk = st => { for (const x of students) { if (rowsRef.current[x.id].status !== st) { upd(x.id, { status: st, late: st === 'terlambat' ? rowsRef.current[x.id].late : '' }); as.queue('att:' + x.id, saveAtt(x.id)); } } };
  const fillEmpty = () => { for (const x of students) if (!rowsRef.current[x.id].status) { upd(x.id, { status: 'hadir' }); as.queue('att:' + x.id, saveAtt(x.id)); } };
  const setF = (k, v) => {
    const f = { ...formRef.current, [k]: v }; formRef.current = f; setForm(f);
    // Pertemuan baru dibuat otomatis saat ada isi bermakna (materi/catatan/status), bukan karena ganti tanggal saja.
    if (!meetingRef.current && !(f.topic.trim() || f.notes.trim())) return;
    as.queue('meeting', saveMeeting, { delay: k === 'mods' ? 0 : TEXT });
  };

  const filled = students.filter(x => rows[x.id] && rows[x.id].status).length;
  const counts = L.attCounts(students.map(x => rows[x.id]).filter(r => r && r.status));
  const filtered = students.filter(x => x.full_name.toLowerCase().includes(q.toLowerCase()));

  const doPrint = () => {
    const mods = [useMod('hafalan') && 'Hafalan', useMod('tugas') && assignment && 'Tugas', useMod('keaktifan') && 'Keaktifan'].filter(Boolean);
    EXP.print({
      title: 'DAFTAR HADIR SISWA', subtitle: `Pertemuan ${form.number} · ${L.fmtDate(form.date)}${form.topic ? ' · ' + form.topic : ''}`,
      meta: docMeta(ctx, { className: cls.name, period: L.fmtDate(form.date, false) }),
      columns: [{ h: 'No', w: .5, align: 'center' }, { h: 'Nama Siswa', w: 3 }, { h: 'L/P', w: .5, align: 'center' }, { h: 'Kehadiran', w: 1.4, align: 'center' }, ...mods.map(m => ({ h: m, w: 1.2, align: 'center' })), { h: 'Keterangan', w: 2 }],
      rows: students.map((x, i) => { const r = rows[x.id]; return [i + 1, x.full_name, x.gender, r.status ? L.ATT_MAP[r.status].label + (r.late ? ` (${r.late} mnt)` : '') : '—', ...(useMod('hafalan') ? [(L.MEM[r.mem] || '—') + (r.memScore ? ' · ' + r.memScore : '')] : []), ...(useMod('tugas') && assignment ? [(L.ASG[r.asg] || '—') + (r.asgScore ? ' · ' + r.asgScore : '')] : []), ...(useMod('keaktifan') ? [r.act || '—'] : []), r.note]; }),
      foot: ['', 'Jumlah', '', L.ATT.map(a => a.short + ':' + counts[a.k]).join(' '), ...mods.map(() => ''), 'Hadir ' + L.fmtPct(counts.pct)],
      signatures: docSigs(ctx, { teacher: true }), filename: L.fileSafe(['Daftar_Hadir', cls.name, 'P' + form.number, form.date]),
    });
  };
  const idxM = meetings.findIndex(m => m.id === mid);
  const goMeeting = async id => {
    if (as.hasPending()) { await as.flush(); if (as.hasPending() && !confirm('Sebagian perubahan gagal disimpan. Tetap pindah pertemuan?')) return; }
    setMid(id);
  };
  const flushNow = async () => {
    try { meetingRow(); } catch (e) { toast(e.message, 'err'); return; }
    if (!meetingRef.current) as.queue('meeting', saveMeeting);
    await as.flush();
  };
  const ATTS = L.ATT;
  const idle = meeting ? 'Tersimpan di database' : 'Simpan otomatis aktif';

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="row wrap" style={{ gap: 8, minWidth: 0 }}>
            <button className="btn btn-icon" aria-label="Pertemuan sebelumnya" disabled={mid === 'new' ? !meetings.length : idxM <= 0} onClick={() => goMeeting(mid === 'new' ? meetings[meetings.length - 1].id : meetings[idxM - 1].id)}><Icon n="chevL" /></button>
            <select className="select" style={{ width: 'auto', minWidth: 0, maxWidth: 'calc(100vw - 140px)' }} value={mid} onChange={e => goMeeting(e.target.value)} aria-label="Pilih pertemuan">
              <option value="new">+ Pertemuan baru (ke-{nextNum})</option>
              {[...meetings].reverse().map(m => <option key={m.id} value={m.id}>Pertemuan {m.number} · {L.fmtDate(m.date)}</option>)}
            </select>
            <button className="btn btn-icon" aria-label="Pertemuan berikutnya" disabled={mid === 'new' || idxM === meetings.length - 1} onClick={() => goMeeting(meetings[idxM + 1].id)}><Icon n="chevR" /></button>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <AutosaveIndicator s={as} idleText={idle} />
            {meeting && <>
              <button className="btn btn-icon desk-only" title="Edit pertemuan" aria-label="Edit pertemuan" onClick={() => setEditMeeting(true)}><Icon n="edit" s={15} /></button>
              <button className="btn btn-icon btn-danger desk-only" title="Hapus pertemuan" aria-label="Hapus pertemuan" onClick={() => setDelMeeting(true)}><Icon n="trash" s={15} /></button>
              <span className="mobile-only"><ActionMenu items={[{ label: 'Edit pertemuan', icon: 'edit', onClick: () => setEditMeeting(true) }, { label: 'Hapus pertemuan', icon: 'trash', danger: true, onClick: () => setDelMeeting(true) }]} /></span>
            </>}
            <button className="btn" onClick={doPrint}><Icon n="print" s={15} />Cetak</button>
            <button className="btn btn-teal desk-only" title="Opsional — perubahan sudah tersimpan otomatis" onClick={flushNow} disabled={as.status === 'saving'}><Icon n="save" s={15} />Simpan sekarang</button>
          </div>
        </div>
        <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 14, gap: 10 }}>
          <Field label="Tanggal"><input type="date" className="input" value={form.date} onChange={e => setF('date', e.target.value)} /></Field>
          <Field label="Nomor pertemuan"><input type="number" min="1" className="input" value={form.number} onChange={e => setF('number', e.target.value)} /></Field>
          <Field label="Materi"><input className="input" value={form.topic} onChange={e => setF('topic', e.target.value)} placeholder="mis. Mufradat: Al-Usrah" style={{ minWidth: 0 }} /></Field>
          <Field label="Catatan umum"><input className="input" value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="opsional" /></Field>
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <span className="lbl" style={{ marginRight: 4 }}>Modul pertemuan:</span>
          <span className="chip on" style={{ '--c': 'var(--ink)', cursor: 'default' }}>Absensi</span>
          {window.MODS.filter(x => s[x.k]).map(x => <button key={x.k} className={'chip ' + (form.mods[x.k] ? 'on' : '')} style={{ '--c': 'var(--teal)' }} onClick={() => setF('mods', { ...form.mods, [x.k]: !form.mods[x.k] })}>{form.mods[x.k] ? '✓ ' : ''}{x.l}</button>)}
          {useMod('tugas') && <>
            <span className="lbl" style={{ marginLeft: 8 }}>Tugas diperiksa:</span>
            <select className="select input-sm" style={{ width: 'auto', minWidth: 160, maxWidth: '100%' }} value={asgId} onChange={async e => { const v = e.target.value; await as.flush(); setAsgId(v); }}>
              <option value="">— tidak ada —</option>
              {asgOptions.map(a => <option key={a.id} value={a.id}>{a.title} · {L.fmtShort(a.due_date)}</option>)}
            </select>
            <button className="btn btn-sm" onClick={() => setNewAsg(true)}><Icon n="plus" s={13} />Tugas</button>
          </>}
        </div>
        {!meeting && <p className="tiny muted" style={{ marginTop: 10 }}>Pertemuan baru dibuat otomatis begitu Anda memilih status kehadiran pertama atau mengisi materi. Tidak perlu menekan Simpan.</p>}
      </div>

      <ActiveNotesBanner notes={activeNotes} />

      {!students.length ? <div className="card"><Empty icon="users" title="Belum ada siswa di kelas ini" text="Tambahkan siswa melalui menu Data Siswa." /></div> : <>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="toolbar">
            <div className="search" style={{ width: 220, maxWidth: '100%' }}><Icon n="search" s={15} /><input className="input" placeholder="Cari nama siswa…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <button className="btn btn-sm" onClick={() => bulk('hadir')}><Icon n="check" s={14} />Semua Hadir</button>
            <button className="btn btn-sm" onClick={fillEmpty} title="Isi siswa yang belum diisi dengan Hadir"><Icon n="zap" s={14} />Isi yang kosong: Hadir</button>
          </div>
          <span className="small muted">{filled}/{students.length} terisi · yang belum dipilih tidak dianggap Alpa · klik status terpilih untuk mengosongkan</span>
        </div>

        <div className="card att-desk" style={{ overflow: 'hidden' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th className="c" style={{ width: 40 }}>No</th><th>Nama Siswa</th><th className="c">L/P</th>
                {ATTS.map(a => <th key={a.k} className="c" style={{ width: 66 }}>{a.label}</th>)}
                {useMod('hafalan') && <th>Hafalan</th>}
                {useMod('tugas') && assignment && <th>Tugas</th>}
                {useMod('keaktifan') && <th className="c">Aktif</th>}
                <th style={{ minWidth: 170 }}>Catatan</th>
              </tr></thead>
              <tbody>
                {filtered.map(x => {
                  const r = rows[x.id]; if (!r) return null; const i = students.indexOf(x);
                  const nn = noteBy(x.id);
                  const absent = r.status && !['hadir', 'terlambat'].includes(r.status);
                  const tgt = !asgTargets || asgTargets.has(x.id);
                  return (
                    <tr key={x.id}>
                      <td className="c muted">{i + 1}</td>
                      <td style={{ minWidth: 170 }}>
                        <div className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }}>{x.full_name}</span>
                          {r.status === 'bolos' && <span className="badge" title="Status lama — pilih status baru untuk mengganti">Bolos</span>}
                          {nn.length > 0 && <span className="badge purple" title={nn.map(n => L.NOTE_TYPES[n.type].label + ': ' + n.reason).join('\n')} style={{ height: 19 }}><Icon n="note" s={11} />{nn.length}</span>}</div>
                      </td>
                      <td className="c muted">{x.gender}</td>
                      {ATTS.map(a => <td key={a.k} className="c"><button className={'sr ' + (r.status === a.k ? 'on' : '')} style={{ '--c': a.hex }} onClick={() => setStatus(x.id, a.k)} aria-label={a.label + ' ' + x.full_name} aria-pressed={r.status === a.k} title={a.label} /></td>)}
                      {useMod('hafalan') && <td>
                        <div className="row" style={{ gap: 5 }}>
                          <select className="select input-sm" style={{ width: 112, color: r.mem === 'bebas' ? '#6d28d9' : undefined }} value={r.mem} onChange={e => setMem(x.id, { mem: e.target.value, memScore: e.target.value === 'setor' ? r.memScore : '' })}>
                            <option value="">—</option>{Object.entries(L.MEM).map(([k, v]) => <option key={k} value={k} disabled={k === 'setor' && absent}>{v}</option>)}
                          </select>
                          {r.mem === 'setor' && <input className="input input-sm" style={{ width: 56 }} inputMode="numeric" placeholder="Nilai" value={r.memScore} onChange={e => setMem(x.id, { memScore: e.target.value }, TEXT)} />}
                        </div>
                      </td>}
                      {useMod('tugas') && assignment && <td>{tgt ? <div className="row" style={{ gap: 5 }}>
                        <select className="select input-sm" style={{ width: 136 }} value={r.asg} onChange={e => setAsg(x.id, { asg: e.target.value, asgScore: L.ASG_DONE.includes(e.target.value) ? r.asgScore : '' })}>
                          <option value="">—</option>{L.asgOptions(v3).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        {L.ASG_DONE.includes(r.asg) && <input className="input input-sm" style={{ width: 56 }} inputMode="numeric" placeholder="Nilai" value={r.asgScore} onChange={e => setAsg(x.id, { asgScore: e.target.value }, TEXT)} />}
                      </div> : <span className="tiny muted">bukan target</span>}</td>}
                      {useMod('keaktifan') && <td className="c"><input className="input input-sm" style={{ width: 52, textAlign: 'center' }} inputMode="numeric" disabled={absent} placeholder={'0–' + s.activity_scale_max} value={r.act} onChange={e => setAct(x.id, { act: e.target.value }, TEXT)} /></td>}
                      <td>
                        <div className="row" style={{ gap: 5 }}>
                          {r.status === 'terlambat' && <input className="input input-sm" style={{ width: 62 }} inputMode="numeric" placeholder="mnt" value={r.late} onChange={e => setAttText(x.id, { late: e.target.value })} title="Menit keterlambatan" />}
                          <input className="input input-sm" style={{ minWidth: 110 }} value={r.note} disabled={!r.status} title={!r.status ? 'Pilih status kehadiran terlebih dahulu' : ''} onChange={e => setAttText(x.id, { note: e.target.value })} placeholder={r.status === 'terlambat' ? 'Alasan terlambat' : ''} />
                          <button className="btn btn-ghost btn-sm btn-icon" title="Catatan khusus antarpertemuan" onClick={() => setNoteFor(x.id)}><Icon n="note" s={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td></td><td>Jumlah</td><td className="c">{filled}</td>
                {ATTS.map(a => <td key={a.k} className="c" style={{ color: a.hex }}>{counts[a.k]}</td>)}
                {useMod('hafalan') && <td className="small">{students.filter(x => rows[x.id] && rows[x.id].mem === 'setor').length} setor</td>}
                {useMod('tugas') && assignment && <td className="small">{students.filter(x => rows[x.id] && L.ASG_DONE.includes(rows[x.id].asg)).length} kumpul</td>}
                {useMod('keaktifan') && <td></td>}
                <td className="small muted">Kehadiran {L.fmtPct(counts.pct)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        <div className="att-mobile">
          <div className="att-sticky"><AutosaveIndicator s={as} idleText={idle} /><span className="tiny muted">{filled}/{students.length} terisi · Hadir {L.fmtPct(counts.pct)}</span></div>
          {filtered.map(x => {
            const r = rows[x.id]; if (!r) return null; const nn = noteBy(x.id);
            const absent = r.status && !['hadir', 'terlambat'].includes(r.status);
            return (
              <div key={x.id} className="att-card col" style={{ gap: 10 }}>
                <div className="row between"><div className="col"><b>{students.indexOf(x) + 1}. {x.full_name}</b><span className="tiny muted">{x.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span></div>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setNoteFor(x.id)} aria-label="Catatan khusus"><Icon n="note" s={16} /></button></div>
                {nn.map(n => <div key={n.id} className="tiny" style={{ background: '#faf8ff', border: '1px solid #ede7fb', padding: '6px 8px', borderRadius: 8, color: '#5b21b6' }}><b>{L.NOTE_TYPES[n.type].label}:</b> {n.reason}</div>)}
                <div className="g" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 5 }}>
                  {ATTS.map(a => <button key={a.k} className={'chip ' + (r.status === a.k ? 'on' : '')} style={{ '--c': a.hex, height: 44, padding: 0, fontSize: 11.5 }} onClick={() => setStatus(x.id, a.k)} aria-pressed={r.status === a.k}>{a.label}</button>)}
                </div>
                {r.status === 'terlambat' && <input className="input" inputMode="numeric" placeholder="Menit terlambat" value={r.late} onChange={e => setAttText(x.id, { late: e.target.value })} />}
                {(useMod('hafalan') || useMod('keaktifan') || (useMod('tugas') && assignment)) && <div className="g" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {useMod('hafalan') && <Field label="Hafalan"><select className="select" value={r.mem} onChange={e => setMem(x.id, { mem: e.target.value, memScore: e.target.value === 'setor' ? r.memScore : '' })}><option value="">—</option>{Object.entries(L.MEM).map(([k, v]) => <option key={k} value={k} disabled={k === 'setor' && absent}>{v}</option>)}</select></Field>}
                  {useMod('hafalan') && r.mem === 'setor' && <Field label="Nilai hafalan"><input className="input" inputMode="numeric" value={r.memScore} onChange={e => setMem(x.id, { memScore: e.target.value }, TEXT)} /></Field>}
                  {useMod('tugas') && assignment && (!asgTargets || asgTargets.has(x.id)) && <Field label="Tugas"><select className="select" value={r.asg} onChange={e => setAsg(x.id, { asg: e.target.value })}><option value="">—</option>{L.asgOptions(v3).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
                  {useMod('keaktifan') && <Field label={'Keaktifan (0–' + s.activity_scale_max + ')'}><input className="input" inputMode="numeric" disabled={absent} value={r.act} onChange={e => setAct(x.id, { act: e.target.value }, TEXT)} /></Field>}
                </div>}
                <input className="input" placeholder="Keterangan" value={r.note} disabled={!r.status} onChange={e => setAttText(x.id, { note: e.target.value })} />
              </div>
            );
          })}
        </div>
      </>}
      {noteFor && <NoteModal classId={cls.id} studentId={noteFor} originMeeting={meeting} onClose={() => setNoteFor(null)} />}
      {editMeeting && <MeetingEditModal meeting={meeting} onClose={changed => { setEditMeeting(false); if (changed) setVer(v => v + 1); }} />}
      {delMeeting && <MeetingDeleteConfirm meeting={meeting} onClose={() => setDelMeeting(false)} onDeleted={() => { setMid('new'); setVer(v => v + 1); }} />}
      {newAsg && <AssignmentModal classId={cls.id} meetingId={meeting && meeting.id} onClose={a => { setNewAsg(false); if (a) setAsgId(a.id); }} />}
    </div>
  );
}

Object.assign(window, { MeetingEditor });
