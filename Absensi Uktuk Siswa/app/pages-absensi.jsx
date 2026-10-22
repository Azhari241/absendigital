// Absensi & Pertemuan — tab Pertemuan, Siswa (catatan khusus), Rekap.
const MODS = [{ k: 'hafalan', l: 'Hafalan' }, { k: 'tugas', l: 'Tugas' }, { k: 'keaktifan', l: 'Keaktifan' }];

function AbsensiPage({ params }) {
  const { data, ctx } = useApp();
  const [cid, setCid, classes] = useClassPicker(params.classId);
  const [tab, setTab] = useState(params.tab || 'pertemuan');
  if (!classes.length) return <NoClasses />;
  const cls = data.classes.find(c => c.id === cid);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="toolbar">
          <ClassSelect value={cid} onChange={setCid} classes={classes} />
          <span className="small muted">{data.students.filter(s => s.class_id === cid && s.status === 'aktif').length} siswa aktif</span>
        </div>
        <div className="seg">
          {[['pertemuan', 'Pertemuan'], ['siswa', 'Siswa & Catatan'], ['rekap', 'Rekap']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </div>
      {tab === 'pertemuan' && <MeetingEditor key={cid + (params.meetingId || '')} cls={cls} initialMeetingId={params.meetingId} />}
      {tab === 'siswa' && <ClassNotesTab cls={cls} />}
      {tab === 'rekap' && <ClassRekapTab cls={cls} />}
    </div>
  );
}

function MeetingEditor({ cls, initialMeetingId }) {
  const { data, ctx, api } = useApp();
  const { dirtyRef } = useNav();
  const toast = useToast();
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
  const [dirty, setDirtyS] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [errs, setErrs] = useState({});
  const [noteFor, setNoteFor] = useState(null);
  const [newAsg, setNewAsg] = useState(false);
  const setDirty = v => { setDirtyS(v); dirtyRef.current = v; };
  useEffect(() => () => { dirtyRef.current = false; }, []);

  // Inisialisasi form & baris dari data tersimpan
  useEffect(() => {
    const m = meeting;
    const mods = m ? Object.fromEntries(MODS.map(x => { const mm = data.meeting_modules.find(r => r.meeting_id === m.id && r.module === x.k); return [x.k, mm ? mm.enabled : false]; }))
      : Object.fromEntries(MODS.map(x => [x.k, !!s[x.k]]));
    const f = m ? { date: m.date, number: m.number, topic: m.topic || '', notes: m.notes || '', mods } : { date: L.today(), number: nextNum, topic: '', notes: '', mods };
    setForm(f);
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
    setRows(r);
    const relevant = data.assignments.filter(a => a.class_id === cls.id && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
    const due = relevant.find(a => a.due_date <= f.date) || relevant[0];
    setAsgId(due ? due.id : '');
    setDirty(false); setErrs({});
  }, [mid, cls.id]);

  // Isi kolom tugas dari rekaman tersimpan
  useEffect(() => {
    if (!asgId) return;
    const probe = meeting || (form && { class_id: cls.id, date: form.date, number: form.number });
    setRows(prev => {
      const r = { ...prev };
      for (const st of students) {
        const rec = data.assignment_records.find(x => x.assignment_id === asgId && x.student_id === st.id);
        const bebasT = probe && data.student_notes.some(n => n.student_id === st.id && n.type === 'bebas_tugas' && n.related_assignment_id === asgId && L.noteState(n, data.meetings) !== 'dicabut' && n.status === 'aktif');
        if (r[st.id]) r[st.id] = { ...r[st.id], asg: rec ? rec.status : (bebasT ? 'bebas' : ''), asgScore: rec && rec.score != null ? String(rec.score) : '' };
      }
      return r;
    });
  }, [asgId, mid, data.assignment_records]);

  if (!form) return <Spinner />;
  const probe = meeting || { class_id: cls.id, date: form.date, number: Number(form.number) };
  const activeNotes = L.activeNotesFor(data, probe).filter(n => students.some(st => st.id === n.student_id));
  const noteBy = sid => activeNotes.filter(n => n.student_id === sid);
  const asgOptions = data.assignments.filter(a => a.class_id === cls.id && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const assignment = asgOptions.find(a => a.id === asgId);
  const asgTargets = assignment ? (assignment.target === 'kelas' ? null : new Set(assignment.student_ids || [])) : null;
  const useMod = k => s[k] && form.mods[k];

  const upd = (sid, patch) => { setRows(r => ({ ...r, [sid]: { ...r[sid], ...patch } })); setDirty(true); };
  const setStatus = (sid, st) => {
    const cur = rows[sid];
    const patch = { status: st };
    if (st !== 'terlambat') patch.late = '';
    // Siswa tidak hadir: hafalan "izin" untuk izin/sakit, kosongkan keaktifan.
    if (!['hadir', 'terlambat'].includes(st)) { if (cur.mem !== 'bebas') patch.mem = (st === 'izin' || st === 'sakit') ? 'izin' : (cur.mem === 'setor' ? '' : cur.mem); patch.act = ''; if (patch.mem !== 'setor') patch.memScore = ''; }
    upd(sid, patch);
  };
  const bulk = st => { setRows(r => { const n = { ...r }; for (const x of students) n[x.id] = { ...n[x.id], status: st, late: st === 'terlambat' ? n[x.id].late : '' }; return n; }); setDirty(true); };
  const fillEmpty = () => { setRows(r => { const n = { ...r }; for (const x of students) if (!n[x.id].status) n[x.id] = { ...n[x.id], status: 'hadir' }; return n; }); setDirty(true); };
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  const filled = students.filter(x => rows[x.id] && rows[x.id].status).length;
  const counts = L.attCounts(students.map(x => rows[x.id]).filter(r => r && r.status));
  const filtered = students.filter(x => x.full_name.toLowerCase().includes(q.toLowerCase()));

  const validate = () => {
    const e = {};
    if (!form.date) e.date = 'Tanggal wajib diisi.';
    const n = Number(form.number);
    if (!Number.isInteger(n) || n < 1) e.number = 'Nomor pertemuan harus bilangan bulat ≥ 1.';
    else if (meetings.some(m => m.number === n && m.id !== mid)) e.number = 'Nomor pertemuan ' + n + ' sudah dipakai.';
    for (const x of students) {
      const r = rows[x.id];
      if (r.late && !(+r.late >= 0 && +r.late <= 600)) e['late' + x.id] = true;
      if (r.memScore && !(+r.memScore >= 0 && +r.memScore <= 100)) e['ms' + x.id] = true;
      if (r.act && !(+r.act >= 0 && +r.act <= s.activity_scale_max)) e['act' + x.id] = true;
      if (r.asgScore && !(+r.asgScore >= 0 && +r.asgScore <= 100)) e['as' + x.id] = true;
    }
    setErrs(e);
    if (Object.keys(e).length) { toast(e.number || e.date || 'Ada nilai di luar rentang yang diizinkan (ditandai merah).', 'err'); return false; }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      let m = meeting;
      const mrow = { class_id: cls.id, semester_id: ctx.sem.id, date: form.date, number: Number(form.number), topic: form.topic.trim(), notes: form.notes.trim() };
      if (m) m = await api.update('meetings', m.id, mrow, 'Ubah pertemuan ' + mrow.number + ' ' + cls.name);
      else [m] = await api.insert('meetings', [mrow], 'Pertemuan baru ' + mrow.number + ' ' + cls.name);
      await api.upsert('meeting_modules', [{ meeting_id: m.id, module: 'absensi', enabled: true }, ...MODS.map(x => ({ meeting_id: m.id, module: x.k, enabled: !!form.mods[x.k] }))], 'meeting_id,module');
      // Hanya baris yang diisi guru yang disimpan — tidak ada Alpha otomatis.
      const att = students.filter(x => rows[x.id].status).map(x => ({ meeting_id: m.id, student_id: x.id, status: rows[x.id].status, late_minutes: rows[x.id].status === 'terlambat' && rows[x.id].late !== '' ? Number(rows[x.id].late) : null, note: rows[x.id].note.trim() }));
      await api.upsert('attendance_records', att, 'meeting_id,student_id', 'Absensi ' + cls.name + ' pertemuan ' + m.number);
      if (useMod('hafalan')) {
        const target = data.memorization_targets.find(t => t.class_id === cls.id && t.semester_id === ctx.sem.id && t.title === form.topic);
        const mem = students.filter(x => rows[x.id].mem).map(x => ({ meeting_id: m.id, student_id: x.id, target_id: target ? target.id : null, status: rows[x.id].mem, score: rows[x.id].mem === 'setor' && rows[x.id].memScore !== '' ? Number(rows[x.id].memScore) : null, comment: rows[x.id].memComment.trim() }));
        await api.upsert('memorization_records', mem, 'meeting_id,student_id');
      }
      if (useMod('keaktifan')) {
        const act = students.filter(x => rows[x.id].act !== '' || rows[x.id].actNote).map(x => ({ meeting_id: m.id, student_id: x.id, score: rows[x.id].act !== '' ? Number(rows[x.id].act) : null, note: rows[x.id].actNote.trim() }));
        await api.upsert('activity_records', act, 'meeting_id,student_id');
      }
      if (useMod('tugas') && assignment) {
        const ar = students.filter(x => rows[x.id].asg && (!asgTargets || asgTargets.has(x.id))).map(x => ({ assignment_id: assignment.id, student_id: x.id, status: rows[x.id].asg, score: ['sudah', 'terlambat'].includes(rows[x.id].asg) && rows[x.id].asgScore !== '' ? Number(rows[x.id].asgScore) : null, submitted_at: ['sudah', 'terlambat'].includes(rows[x.id].asg) ? form.date : null, comment: '' }));
        await api.upsert('assignment_records', ar, 'assignment_id,student_id');
      }
      setDirty(false);
      toast(`Tersimpan di server: pertemuan ${m.number}, ${att.length} absensi.`);
      if (!meeting) setMid(m.id);
    } catch (e) { toast(DB.friendlyError(e) + ' Data belum tersimpan.', 'err'); }
    setBusy(false);
  };

  const doPrint = () => {
    const mods = [useMod('hafalan') && 'Hafalan', useMod('tugas') && assignment && 'Tugas', useMod('keaktifan') && 'Keaktifan'].filter(Boolean);
    L.printReport({
      title: `Daftar Hadir ${cls.name} — Pertemuan ${form.number}`,
      meta: { school: ctx.profile.school_name, address: ctx.profile.school_address, teacher: ctx.profile.full_name, subject: ctx.profile.teacher_subject, sub: `${L.fmtDate(form.date)} · ${form.topic || 'Materi belum diisi'} · Semester ${ctx.sem.name} ${ctx.year.name}` },
      header: ['No', 'Nama Siswa', 'L/P', 'Kehadiran', ...mods, 'Keterangan'],
      rows: students.map((x, i) => { const r = rows[x.id]; return [i + 1, x.full_name, x.gender, r.status ? L.ATT_MAP[r.status].label + (r.late ? ` (${r.late} mnt)` : '') : '—', ...(useMod('hafalan') ? [(L.MEM[r.mem] || '—') + (r.memScore ? ' · ' + r.memScore : '')] : []), ...(useMod('tugas') && assignment ? [(L.ASG[r.asg] || '—') + (r.asgScore ? ' · ' + r.asgScore : '')] : []), ...(useMod('keaktifan') ? [r.act || '—'] : []), r.note]; }),
      foot: ['', 'Jumlah', '', L.ATT.map(a => a.short + ':' + counts[a.k]).join(' '), ...mods.map(() => ''), ''],
    });
  };
  const idxM = meetings.findIndex(m => m.id === mid);
  const goMeeting = id => { if (dirty && !confirm('Ada perubahan yang belum disimpan. Pindah pertemuan?')) return; setMid(id); };

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* Bar pertemuan */}
      <div className="card" style={{ padding: 14 }}>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-icon" aria-label="Pertemuan sebelumnya" disabled={mid === 'new' ? !meetings.length : idxM <= 0} onClick={() => goMeeting(mid === 'new' ? meetings[meetings.length - 1].id : meetings[idxM - 1].id)}><Icon n="chevL" /></button>
            <select className="select" style={{ width: 'auto', minWidth: 230 }} value={mid} onChange={e => goMeeting(e.target.value)} aria-label="Pilih pertemuan">
              <option value="new">+ Pertemuan baru (ke-{nextNum})</option>
              {[...meetings].reverse().map(m => <option key={m.id} value={m.id}>Pertemuan {m.number} · {L.fmtDate(m.date)}</option>)}
            </select>
            <button className="btn btn-icon" aria-label="Pertemuan berikutnya" disabled={mid === 'new' || idxM === meetings.length - 1} onClick={() => goMeeting(meetings[idxM + 1].id)}><Icon n="chevR" /></button>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {dirty ? <span className="unsaved"><span className="dot" />Belum tersimpan</span> : meeting ? <span className="saved"><Icon n="cloud" s={14} />Tersimpan</span> : null}
            <button className="btn" onClick={doPrint}><Icon n="print" s={15} />Cetak</button>
            <button className="btn btn-teal" disabled={busy || (!dirty && !!meeting)} onClick={save}>{busy ? <span className="spin" /> : <Icon n="save" s={15} />}{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </div>
        <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 14, gap: 10 }}>
          <Field label="Tanggal" error={errs.date}><input type="date" className="input" value={form.date} onChange={e => setF('date', e.target.value)} /></Field>
          <Field label="Nomor pertemuan" error={errs.number}><input type="number" min="1" className={'input ' + (errs.number ? 'err' : '')} value={form.number} onChange={e => setF('number', e.target.value)} /></Field>
          <Field label="Materi" className="" ><input className="input" value={form.topic} onChange={e => setF('topic', e.target.value)} placeholder="mis. Mufradat: Al-Usrah" style={{ minWidth: 0 }} /></Field>
          <Field label="Catatan umum"><input className="input" value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="opsional" /></Field>
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <span className="lbl" style={{ marginRight: 4 }}>Modul pertemuan:</span>
          <span className="chip on" style={{ '--c': 'var(--ink)', cursor: 'default' }}>Absensi</span>
          {MODS.filter(x => s[x.k]).map(x => <button key={x.k} className={'chip ' + (form.mods[x.k] ? 'on' : '')} style={{ '--c': 'var(--teal)' }} onClick={() => setF('mods', { ...form.mods, [x.k]: !form.mods[x.k] })}>{form.mods[x.k] ? '✓ ' : ''}{x.l}</button>)}
          {useMod('tugas') && <>
            <span className="lbl" style={{ marginLeft: 8 }}>Tugas diperiksa:</span>
            <select className="select input-sm" style={{ width: 'auto', minWidth: 160 }} value={asgId} onChange={e => setAsgId(e.target.value)}>
              <option value="">— tidak ada —</option>
              {asgOptions.map(a => <option key={a.id} value={a.id}>{a.title} · {L.fmtShort(a.due_date)}</option>)}
            </select>
            <button className="btn btn-sm" onClick={() => setNewAsg(true)}><Icon n="plus" s={13} />Tugas</button>
          </>}
        </div>
      </div>

      <ActiveNotesBanner notes={activeNotes} />

      {!students.length ? <div className="card"><Empty icon="users" title="Belum ada siswa di kelas ini" text="Tambahkan siswa melalui menu Data Siswa." /></div> : <>
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="toolbar">
            <div className="search" style={{ width: 220 }}><Icon n="search" s={15} /><input className="input" placeholder="Cari nama siswa…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <button className="btn btn-sm" onClick={() => bulk('hadir')}><Icon n="check" s={14} />Semua Hadir</button>
            <button className="btn btn-sm" onClick={() => bulk('alpha')}>Semua Alpha</button>
            <button className="btn btn-sm" onClick={fillEmpty} title="Isi siswa yang belum diisi dengan Hadir"><Icon n="zap" s={14} />Isi cepat</button>
          </div>
          <span className="small muted">{filled}/{students.length} terisi{filled < students.length && ' · sisanya tidak disimpan'}</span>
        </div>

        {/* Desktop table */}
        <div className="card att-desk" style={{ overflow: 'hidden' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th className="c" style={{ width: 40 }}>No</th><th>Nama Siswa</th><th className="c">L/P</th>
                {L.ATT.map(a => <th key={a.k} className="c" style={{ width: 62 }}>{a.label}</th>)}
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
                          {nn.length > 0 && <span className="badge purple" title={nn.map(n => L.NOTE_TYPES[n.type].label + ': ' + n.reason).join('\n')} style={{ height: 19 }}><Icon n="note" s={11} />{nn.length}</span>}</div>
                      </td>
                      <td className="c muted">{x.gender}</td>
                      {L.ATT.map(a => <td key={a.k} className="c"><button className={'sr ' + (r.status === a.k ? 'on' : '')} style={{ '--c': a.hex }} onClick={() => setStatus(x.id, a.k)} aria-label={a.label + ' ' + x.full_name} title={a.label} /></td>)}
                      {useMod('hafalan') && <td>
                        <div className="row" style={{ gap: 5 }}>
                          <select className="select input-sm" style={{ width: 112, color: r.mem === 'bebas' ? '#6d28d9' : undefined }} value={r.mem} onChange={e => upd(x.id, { mem: e.target.value, memScore: e.target.value === 'setor' ? r.memScore : '' })}>
                            <option value="">—</option>{Object.entries(L.MEM).map(([k, v]) => <option key={k} value={k} disabled={k === 'setor' && absent}>{v}</option>)}
                          </select>
                          {r.mem === 'setor' && <input className={'input input-sm ' + (errs['ms' + x.id] ? 'err' : '')} style={{ width: 56 }} inputMode="numeric" placeholder="Nilai" value={r.memScore} onChange={e => upd(x.id, { memScore: e.target.value })} />}
                        </div>
                      </td>}
                      {useMod('tugas') && assignment && <td>{tgt ? <div className="row" style={{ gap: 5 }}>
                        <select className="select input-sm" style={{ width: 116 }} value={r.asg} onChange={e => upd(x.id, { asg: e.target.value, asgScore: ['sudah', 'terlambat'].includes(e.target.value) ? r.asgScore : '' })}>
                          <option value="">—</option>{Object.entries(L.ASG).map(([k, v]) => <option key={k} value={k}>{k === 'belum' ? 'Belum' : k === 'sudah' ? 'Sudah' : v}</option>)}
                        </select>
                        {['sudah', 'terlambat'].includes(r.asg) && <input className={'input input-sm ' + (errs['as' + x.id] ? 'err' : '')} style={{ width: 56 }} inputMode="numeric" placeholder="Nilai" value={r.asgScore} onChange={e => upd(x.id, { asgScore: e.target.value })} />}
                      </div> : <span className="tiny muted">bukan target</span>}</td>}
                      {useMod('keaktifan') && <td className="c"><input className={'input input-sm ' + (errs['act' + x.id] ? 'err' : '')} style={{ width: 52, textAlign: 'center' }} inputMode="numeric" disabled={absent} placeholder={'0–' + s.activity_scale_max} value={r.act} onChange={e => upd(x.id, { act: e.target.value })} /></td>}
                      <td>
                        <div className="row" style={{ gap: 5 }}>
                          {r.status === 'terlambat' && <input className={'input input-sm ' + (errs['late' + x.id] ? 'err' : '')} style={{ width: 62 }} inputMode="numeric" placeholder="mnt" value={r.late} onChange={e => upd(x.id, { late: e.target.value })} title="Menit keterlambatan" />}
                          <input className="input input-sm" style={{ minWidth: 110 }} value={r.note} onChange={e => upd(x.id, { note: e.target.value })} placeholder={r.status === 'terlambat' ? 'Alasan terlambat' : ''} />
                          <button className="btn btn-ghost btn-sm btn-icon" title="Catatan khusus antarpertemuan" onClick={() => setNoteFor(x.id)}><Icon n="note" s={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td></td><td>Jumlah</td><td className="c">{filled}</td>
                {L.ATT.map(a => <td key={a.k} className="c" style={{ color: a.hex }}>{counts[a.k]}</td>)}
                {useMod('hafalan') && <td className="small">{students.filter(x => rows[x.id] && rows[x.id].mem === 'setor').length} setor</td>}
                {useMod('tugas') && assignment && <td className="small">{students.filter(x => rows[x.id] && ['sudah', 'terlambat'].includes(rows[x.id].asg)).length} kumpul</td>}
                {useMod('keaktifan') && <td></td>}
                <td className="small muted">Kehadiran {L.fmtPct(counts.pct)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="att-mobile">
          {filtered.map(x => {
            const r = rows[x.id]; if (!r) return null; const nn = noteBy(x.id);
            const absent = r.status && !['hadir', 'terlambat'].includes(r.status);
            return (
              <div key={x.id} className="att-card col" style={{ gap: 10 }}>
                <div className="row between"><div className="col"><b>{students.indexOf(x) + 1}. {x.full_name}</b><span className="tiny muted">{x.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span></div>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setNoteFor(x.id)} aria-label="Catatan khusus"><Icon n="note" s={16} /></button></div>
                {nn.map(n => <div key={n.id} className="tiny" style={{ background: '#faf8ff', border: '1px solid #ede7fb', padding: '6px 8px', borderRadius: 8, color: '#5b21b6' }}><b>{L.NOTE_TYPES[n.type].label}:</b> {n.reason}</div>)}
                <div className="g" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {L.ATT.map(a => <button key={a.k} className={'chip ' + (r.status === a.k ? 'on' : '')} style={{ '--c': a.hex, height: 40 }} onClick={() => setStatus(x.id, a.k)}>{a.label}</button>)}
                </div>
                {r.status === 'terlambat' && <input className="input" inputMode="numeric" placeholder="Menit terlambat" value={r.late} onChange={e => upd(x.id, { late: e.target.value })} />}
                {(useMod('hafalan') || useMod('keaktifan') || (useMod('tugas') && assignment)) && <div className="g" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {useMod('hafalan') && <Field label="Hafalan"><select className="select" value={r.mem} onChange={e => upd(x.id, { mem: e.target.value })}><option value="">—</option>{Object.entries(L.MEM).map(([k, v]) => <option key={k} value={k} disabled={k === 'setor' && absent}>{v}</option>)}</select></Field>}
                  {useMod('hafalan') && r.mem === 'setor' && <Field label="Nilai hafalan"><input className="input" inputMode="numeric" value={r.memScore} onChange={e => upd(x.id, { memScore: e.target.value })} /></Field>}
                  {useMod('tugas') && assignment && (!asgTargets || asgTargets.has(x.id)) && <Field label="Tugas"><select className="select" value={r.asg} onChange={e => upd(x.id, { asg: e.target.value })}><option value="">—</option>{Object.entries(L.ASG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
                  {useMod('keaktifan') && <Field label={'Keaktifan (0–' + s.activity_scale_max + ')'}><input className="input" inputMode="numeric" disabled={absent} value={r.act} onChange={e => upd(x.id, { act: e.target.value })} /></Field>}
                </div>}
                <input className="input" placeholder="Keterangan" value={r.note} onChange={e => upd(x.id, { note: e.target.value })} />
              </div>
            );
          })}
          <div style={{ position: 'sticky', bottom: 10, zIndex: 5 }}>
            <button className="btn btn-teal btn-block btn-lg" disabled={busy || (!dirty && !!meeting)} onClick={save} style={{ boxShadow: '0 8px 24px rgba(15,118,110,.3)' }}>{busy ? <span className="spin" /> : <Icon n="save" s={16} />}{dirty ? 'Simpan perubahan' : meeting ? 'Tersimpan' : 'Simpan pertemuan'}</button>
          </div>
        </div>
      </>}
      {noteFor && <NoteModal classId={cls.id} studentId={noteFor} originMeeting={meeting} onClose={() => setNoteFor(null)} />}
      {newAsg && <AssignmentModal classId={cls.id} meetingId={meeting && meeting.id} onClose={a => { setNewAsg(false); if (a) setAsgId(a.id); }} />}
    </div>
  );
}

function ClassNotesTab({ cls }) {
  const { data } = useApp();
  const [add, setAdd] = useState(false);
  const [filter, setFilter] = useState('aktif');
  const notes = data.student_notes.filter(n => n.class_id === cls.id).map(n => ({ n, st: L.noteState(n, data.meetings) })).filter(x => filter === 'semua' || x.st === filter).sort((a, b) => a.n.created_at < b.n.created_at ? 1 : -1);
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <Seg value={filter} onChange={setFilter} options={[{ v: 'aktif', l: 'Aktif' }, { v: 'kedaluwarsa', l: 'Kedaluwarsa' }, { v: 'dicabut', l: 'Dicabut' }, { v: 'semua', l: 'Semua' }]} />
        <button className="btn btn-dark" onClick={() => setAdd(true)}><Icon n="plus" s={15} />Catatan khusus</button>
      </div>
      {notes.length ? <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>{notes.map(x => <NoteCard key={x.n.id} n={x.n} />)}</div>
        : <div className="card"><Empty icon="note" title="Tidak ada catatan" text="Catatan khusus (bebas setor, bebas tugas, remedial, izin khusus, dll.) akan muncul otomatis pada pertemuan yang termasuk masa berlakunya." /></div>}
      {add && <NoteModal classId={cls.id} onClose={() => setAdd(false)} />}
    </div>
  );
}

function ClassRekapTab({ cls }) {
  const { data, ctx } = useApp(); const { go } = useNav();
  const students = data.students.filter(s => s.class_id === cls.id && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const rows = students.map(s => ({ s, sum: L.studentSummary(data, s, ctx.sem.id) }));
  const meetings = data.meetings.filter(m => m.class_id === cls.id && m.semester_id === ctx.sem.id);
  if (!meetings.length) return <div className="card"><Empty icon="chart" title="Belum ada pertemuan" text="Rekap akan muncul setelah pertemuan pertama disimpan." /></div>;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h"><h3>Rekap {cls.name} · {meetings.length} pertemuan</h3></div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>No</th><th>Nama</th>{L.ATT.map(a => <th key={a.k} className="c">{a.short}</th>)}<th className="c">Hadir %</th>{ctx.settings.hafalan && <th className="c">Hafalan</th>}{ctx.settings.tugas && <th className="c">Tugas</th>}{ctx.settings.keaktifan && <th className="c">Aktif</th>}</tr></thead>
        <tbody>{rows.map(({ s, sum }, i) => (
          <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => go('siswaDetail', { id: s.id })}>
            <td className="muted">{i + 1}</td><td style={{ fontWeight: 600 }}>{s.full_name}</td>
            {L.ATT.map(a => <td key={a.k} className="c">{sum.att[a.k] || <span className="muted">0</span>}</td>)}
            <td className="c" style={{ fontWeight: 700, color: sum.attPct != null && sum.attPct < ctx.settings.attendance_threshold ? 'var(--danger)' : undefined }}>{L.fmtPct(sum.attPct)}</td>
            {ctx.settings.hafalan && <td className="c">{L.fmtPct(sum.memPct)}</td>}
            {ctx.settings.tugas && <td className="c">{sum.asgTotal ? sum.asgDone + '/' + sum.asgTotal : '—'}</td>}
            {ctx.settings.keaktifan && <td className="c">{sum.actAvg ?? '—'}</td>}
          </tr>))}</tbody>
      </table></div>
    </div>
  );
}

Object.assign(window, { AbsensiPage });
