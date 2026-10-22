// Modul: Hafalan, Tugas/PR, Keaktifan, Bebas Semester
function HafalanPage() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const [addT, setAddT] = useState(false); const [tTitle, setTTitle] = useState(''); const [busy, setBusy] = useState(false);
  if (!classes.length) return <NoClasses />;
  const students = data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ms = L.sortMeetings(data.meetings.filter(m => m.class_id === cid && m.semester_id === ctx.sem.id));
  const targets = data.memorization_targets.filter(t => t.class_id === cid && t.semester_id === ctx.sem.id);
  const recs = L.recordsFor('memorization_records', data, ms);
  const req = recs.filter(r => r.status !== 'bebas');
  const addTarget = async () => {
    if (tTitle.trim().length < 2) return;
    setBusy(true);
    try { await api.insert('memorization_targets', [{ class_id: cid, semester_id: ctx.sem.id, title: tTitle.trim(), description: '' }], 'Target hafalan'); setTTitle(''); setAddT(false); toast('Target hafalan ditambahkan.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub="Bebas Setor tidak dihitung sebagai nilai 100 dan tidak masuk penyebut ketuntasan. Setor hafalan diisi melalui Absensi.">
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <button className="btn btn-dark" onClick={() => setAddT(true)}><Icon n="plus" s={15} />Target hafalan</button>
      </PageHead>
      <div className="g g-stats">
        <div className="card stat"><span className="k">Ketuntasan kelas</span><span className="v">{L.fmtPct(L.pct(req.filter(r => r.status === 'setor').length, req.length))}</span><span className="s">{req.filter(r => r.status === 'setor').length} setor dari {req.length} kewajiban</span></div>
        <div className="card stat"><span className="k">Rata-rata nilai</span><span className="v">{L.avg(recs.filter(r => r.status === 'setor').map(r => r.score)) ?? '—'}</span><span className="s">hanya dari status Setor</span></div>
        <div className="card stat"><span className="k">Bebas Setor</span><span className="v">{recs.filter(r => r.status === 'bebas').length}</span><span className="s">berdasarkan catatan khusus</span></div>
        <div className="card stat"><span className="k">Target</span><span className="v">{targets.length}</span><span className="s">semester ini</span></div>
      </div>
      {addT && <div className="card card-pad row wrap" style={{ gap: 8 }}><input className="input grow" style={{ minWidth: 200 }} placeholder="mis. QS. An-Naba 1–10" value={tTitle} onChange={e => setTTitle(e.target.value)} autoFocus /><button className="btn" onClick={() => setAddT(false)}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={addTarget}>{busy && <span className="spin" />}Simpan target</button><p className="tiny muted" style={{ width: '100%' }}>Target dengan judul sama seperti "Materi" pertemuan akan otomatis terhubung saat menyimpan absensi.</p></div>}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h"><h3>Riwayat setor per pertemuan</h3><Legend items={[{ label: 'Setor', color: '#0f766e' }, { label: 'Belum', color: '#ef4444' }, { label: 'Izin', color: '#f59e0b' }, { label: 'Bebas', color: '#8b5cf6' }]} /></div>
        {ms.length && students.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Nama</th>{ms.map(m => <th key={m.id} className="c" title={m.topic}>P{m.number}</th>)}<th className="c">Tuntas</th><th className="c">Nilai</th></tr></thead>
          <tbody>{students.map(s => {
            const sr = recs.filter(r => r.student_id === s.id); const rq = sr.filter(r => r.status !== 'bebas');
            return <tr key={s.id}><td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.full_name}</td>
              {ms.map(m => { const r = sr.find(x => x.meeting_id === m.id); const c = r ? { setor: '#0f766e', belum: '#ef4444', izin: '#f59e0b', bebas: '#8b5cf6' }[r.status] : null; return <td key={m.id} className="c" title={r ? L.MEM[r.status] + (r.score != null ? ' · ' + r.score : '') : 'Belum diisi'}>{r ? <span style={{ display: 'inline-block', minWidth: 26, fontSize: 11, fontWeight: 700, color: '#fff', background: c, borderRadius: 5, padding: '2px 4px' }}>{r.status === 'setor' ? (r.score ?? '✓') : r.status === 'bebas' ? 'B' : r.status === 'izin' ? 'I' : '–'}</span> : <span className="muted">·</span>}</td>; })}
              <td className="c" style={{ fontWeight: 700 }}>{L.fmtPct(L.pct(sr.filter(r => r.status === 'setor').length, rq.length))}</td>
              <td className="c">{L.avg(sr.filter(r => r.status === 'setor').map(r => r.score)) ?? '—'}</td></tr>;
          })}</tbody></table></div> : <Empty icon="book" title="Belum ada data hafalan" text="Isi kolom Hafalan pada halaman Absensi untuk setiap pertemuan." />}
      </div>
      {targets.length > 0 && <div className="card"><div className="card-h"><h3>Target hafalan semester ini</h3></div>{targets.map(t => <div key={t.id} className="list-i"><Icon n="book" s={15} /><span className="grow">{t.title}</span><span className="tiny muted">{recs.filter(r => r.target_id === t.id && r.status === 'setor').length} setor</span></div>)}</div>}
    </div>
  );
}

function AssignmentModal({ classId, meetingId, assignment, onClose }) {
  const { data, api, ctx } = useApp(); const toast = useToast();
  const [f, setF] = useState(assignment ? { ...assignment, student_ids: assignment.student_ids || [] } : { class_id: classId, title: '', description: '', due_date: L.addDays(L.today(), 7), target: 'kelas', student_ids: [] });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const students = data.students.filter(s => s.class_id === f.class_id && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const save = async () => {
    const e = {};
    if (f.title.trim().length < 2) e.title = 'Judul tugas wajib diisi.';
    if (!f.due_date) e.due_date = 'Tenggat wajib diisi.';
    if (f.target === 'siswa' && !f.student_ids.length) e.target = 'Pilih minimal satu siswa.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const row = { class_id: f.class_id, semester_id: ctx.sem.id, meeting_id: meetingId || f.meeting_id || null, title: f.title.trim(), description: f.description.trim(), due_date: f.due_date, target: f.target, student_ids: f.target === 'siswa' ? f.student_ids : [] };
    try {
      let out;
      if (assignment) out = await api.update('assignments', assignment.id, row, 'Ubah tugas');
      else [out] = await api.insert('assignments', [row], 'Tugas baru ' + row.title);
      toast('Tugas tersimpan.'); onClose(out);
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  return (
    <Modal title={assignment ? 'Edit tugas' : 'Tugas / PR baru'} onClose={() => onClose(null)} footer={<><button className="btn" onClick={() => onClose(null)}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan tugas</button></>}>
      <div className="fg">
        <Field label="Judul" error={err.title} className="full"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Kelas"><select className="select" value={f.class_id} disabled={!!assignment} onChange={e => setF({ ...f, class_id: e.target.value, student_ids: [] })}>{data.classes.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Tenggat" error={err.due_date}><input type="date" className="input" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label="Deskripsi" className="full"><textarea className="textarea" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Ditujukan untuk" error={err.target} className="full"><Seg value={f.target} onChange={v => setF({ ...f, target: v })} options={[{ v: 'kelas', l: 'Seluruh kelas' }, { v: 'siswa', l: 'Siswa tertentu' }]} /></Field>
        {f.target === 'siswa' && <div className="full row wrap" style={{ gap: 6, maxHeight: 180, overflow: 'auto' }}>{students.map(s => { const on = f.student_ids.includes(s.id); return <button key={s.id} type="button" className={'chip ' + (on ? 'on' : '')} onClick={() => setF({ ...f, student_ids: on ? f.student_ids.filter(x => x !== s.id) : [...f.student_ids, s.id] })}>{s.full_name}</button>; })}</div>}
      </div>
    </Modal>
  );
}

function TugasPage() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const [modal, setModal] = useState(null); const [open, setOpen] = useState(null); const [del, setDel] = useState(null);
  if (!classes.length) return <NoClasses />;
  const t = L.today();
  const list = data.assignments.filter(a => a.class_id === cid && a.semester_id === ctx.sem.id).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const allStud = data.students.filter(s => s.class_id === cid && s.status === 'aktif');
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub="Catat pengumpulan & nilai di sini atau langsung di tabel Absensi.">
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tugas baru</button>
      </PageHead>
      {!list.length ? <div className="card"><Empty icon="clip" title="Belum ada tugas" text="Buat tugas atau PR, tetapkan tenggat, lalu catat pengumpulannya." action={<button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tugas baru</button>} /></div> :
        <div className="col" style={{ gap: 10 }}>{list.map(a => {
          const tgt = a.target === 'kelas' ? allStud : allStud.filter(s => (a.student_ids || []).includes(s.id));
          const rs = data.assignment_records.filter(r => r.assignment_id === a.id);
          const done = rs.filter(r => ['sudah', 'terlambat'].includes(r.status)).length, beb = rs.filter(r => r.status === 'bebas').length;
          const ungraded = rs.filter(r => ['sudah', 'terlambat'].includes(r.status) && r.score == null).length;
          const overdue = a.due_date < t;
          return (
            <div key={a.id} className="card">
              <div className="row wrap" style={{ padding: '14px 16px', gap: 12, cursor: 'pointer' }} onClick={() => setOpen(open === a.id ? null : a.id)}>
                <div className="col grow" style={{ gap: 3, minWidth: 200 }}>
                  <b>{a.title}</b>
                  <span className="tiny muted">Tenggat {L.fmtDate(a.due_date)} · {a.target === 'kelas' ? 'Seluruh kelas' : tgt.length + ' siswa'}</span>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="badge teal">{done}/{tgt.length - beb} kumpul</span>
                  {beb > 0 && <span className="badge purple">{beb} bebas</span>}
                  {ungraded > 0 && <span className="badge warn">{ungraded} belum dinilai</span>}
                  {overdue && tgt.length - beb - done > 0 && <span className="badge red">{tgt.length - beb - done} belum</span>}
                  {!overdue && <span className="badge">Berjalan</span>}
                </div>
                <Icon n={open === a.id ? 'chevD' : 'chevR'} s={16} />
              </div>
              {open === a.id && <AssignmentRecords a={a} students={tgt} onEdit={() => setModal(a)} onDelete={() => setDel(a)} />}
            </div>
          );
        })}</div>}
      {modal && <AssignmentModal classId={cid} assignment={modal.id ? modal : null} onClose={() => setModal(null)} />}
      {del && <Confirm title="Hapus tugas?" danger message={data.assignment_records.some(r => r.assignment_id === del.id) ? 'Tugas ini sudah memiliki catatan pengumpulan dan tidak dapat dihapus agar riwayat nilai tetap utuh.' : `"${del.title}" akan dihapus permanen.`} confirmLabel="Hapus" onClose={() => setDel(null)}
        onConfirm={async () => { if (data.assignment_records.some(r => r.assignment_id === del.id)) { toast('Tugas memiliki riwayat nilai — tidak dihapus.', 'err'); throw new Error('x'); } try { await api.remove('assignments', del.id, 'Hapus tugas ' + del.title); toast('Tugas dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}
function AssignmentRecords({ a, students, onEdit, onDelete }) {
  const { data, api } = useApp(); const toast = useToast();
  const init = () => Object.fromEntries(students.map(s => { const r = data.assignment_records.find(x => x.assignment_id === a.id && x.student_id === s.id); return [s.id, { status: r ? r.status : '', score: r && r.score != null ? String(r.score) : '', comment: r ? r.comment || '' : '' }]; }));
  const [rows, setRows] = useState(init); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const exempt = s => data.student_notes.find(n => n.student_id === s.id && n.related_assignment_id === a.id && n.status === 'aktif' && ['bebas_tugas', 'perpanjangan', 'tugas_pengganti'].includes(n.type));
  const upd = (id, p) => { setRows(r => ({ ...r, [id]: { ...r[id], ...p } })); setDirty(true); };
  const save = async () => {
    for (const s of students) { const r = rows[s.id]; if (r.score && !(+r.score >= 0 && +r.score <= 100)) return toast('Nilai harus 0–100 (' + s.full_name + ').', 'err'); }
    setBusy(true);
    try {
      await api.upsert('assignment_records', students.filter(s => rows[s.id].status).map(s => ({ assignment_id: a.id, student_id: s.id, status: rows[s.id].status, score: ['sudah', 'terlambat'].includes(rows[s.id].status) && rows[s.id].score !== '' ? Number(rows[s.id].score) : null, comment: rows[s.id].comment.trim(), submitted_at: ['sudah', 'terlambat'].includes(rows[s.id].status) ? L.today() : null })), 'assignment_id,student_id', 'Nilai tugas ' + a.title);
      setDirty(false); toast('Pengumpulan & nilai tersimpan.');
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  return (
    <div style={{ borderTop: '1px solid var(--line2)' }}>
      {a.description && <p className="small muted" style={{ padding: '10px 16px 0' }}>{a.description}</p>}
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Nama</th><th>Status</th><th className="c">Nilai</th><th>Komentar</th></tr></thead>
        <tbody>{students.map(s => { const r = rows[s.id]; const ex = exempt(s); return <tr key={s.id}>
          <td style={{ fontWeight: 600, minWidth: 160 }}>{s.full_name}{ex && <div className="tiny" style={{ color: '#6d28d9', fontWeight: 500 }}>{L.NOTE_TYPES[ex.type].label}: {ex.reason}</div>}</td>
          <td><select className="select input-sm" style={{ width: 170 }} value={r.status} onChange={e => upd(s.id, { status: e.target.value })}><option value="">— belum dicatat —</option>{Object.entries(L.ASG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td className="c">{['sudah', 'terlambat'].includes(r.status) ? <input className="input input-sm" style={{ width: 64, textAlign: 'center' }} inputMode="numeric" placeholder="—" value={r.score} onChange={e => upd(s.id, { score: e.target.value })} /> : <span className="muted">—</span>}</td>
          <td><input className="input input-sm" style={{ minWidth: 140 }} value={r.comment} onChange={e => upd(s.id, { comment: e.target.value })} /></td>
        </tr>; })}</tbody>
      </table></div>
      <div className="row between wrap" style={{ padding: 12, gap: 8 }}>
        <div className="row" style={{ gap: 6 }}><button className="btn btn-sm" onClick={onEdit}><Icon n="edit" s={13} />Edit tugas</button><button className="btn btn-sm btn-danger" onClick={onDelete}><Icon n="trash" s={13} />Hapus</button></div>
        <div className="row" style={{ gap: 8 }}>{dirty && <span className="unsaved"><span className="dot" />Belum tersimpan</span>}<button className="btn btn-teal btn-sm" disabled={!dirty || busy} onClick={save}>{busy && <span className="spin" />}Simpan</button></div>
      </div>
    </div>
  );
}

function KeaktifanPage() {
  const { data, ctx } = useApp(); const { go } = useNav();
  const [cid, setCid, classes] = useClassPicker();
  if (!classes.length) return <NoClasses />;
  const max = ctx.settings.activity_scale_max;
  const students = data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ms = L.sortMeetings(data.meetings.filter(m => m.class_id === cid && m.semester_id === ctx.sem.id));
  const recs = L.recordsFor('activity_records', data, ms);
  const trend = ms.map(m => ({ x: 'P' + m.number, full: 'Pertemuan ' + m.number + ' · ' + L.fmtShort(m.date), avg: L.avg(recs.filter(r => r.meeting_id === m.id).map(r => r.score)) }));
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub={`Skala nilai 0–${max} (ubah di Pengaturan). Nilai keaktifan tidak dicampur dengan hafalan atau tugas.`}>
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <button className="btn btn-dark" onClick={() => go('absensi', { classId: cid })}><Icon n="star" s={15} />Nilai di pertemuan</button>
      </PageHead>
      <div className="card"><div className="card-h"><h3>Rata-rata keaktifan per pertemuan</h3></div><div style={{ padding: '12px 14px' }}>{trend.some(x => x.avg != null) ? <Chart data={trend} series={[{ k: 'avg', label: 'Rata-rata', color: '#8b5cf6' }]} yMax={max} height={190} /> : <NoData />}</div></div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-h"><h3>Rekap per siswa</h3></div>
        {students.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Nama</th><th className="c">Penilaian</th><th className="c">Rata-rata</th><th style={{ width: '35%' }}>Sebaran</th><th>Catatan terakhir</th></tr></thead>
          <tbody>{students.map(s => { const sr = recs.filter(r => r.student_id === s.id && r.score != null); const av = L.avg(sr.map(r => r.score)); const lastNote = recs.filter(r => r.student_id === s.id && r.note).pop(); return <tr key={s.id}>
            <td style={{ fontWeight: 600 }}>{s.full_name}</td><td className="c">{sr.length}</td><td className="c" style={{ fontWeight: 700 }}>{av ?? '—'}</td>
            <td><div className="kbar" style={{ height: 8 }}><i style={{ width: ((av || 0) / max * 100) + '%', background: '#8b5cf6' }} /></div></td>
            <td className="small muted">{lastNote ? lastNote.note : '—'}</td></tr>; })}</tbody>
        </table></div> : <Empty title="Belum ada siswa" />}
      </div>
    </div>
  );
}

function BebasPage() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const rule = data.semester_exemption_rules.find(r => r.semester_id === ctx.sem.id);
  const [f, setF] = useState(rule || { min_attendance: 95, min_memorization: 80, min_assignment: 80, min_activity: 60, use_assignment: false, use_activity: false, extra_requirements: '' });
  const [busy, setBusy] = useState(false); const [editRule, setEditRule] = useState(!rule); const [filter, setFilter] = useState('');
  const saveRule = async () => {
    for (const k of ['min_attendance', 'min_memorization', 'min_assignment', 'min_activity']) if (!(+f[k] >= 0 && +f[k] <= 100)) return toast('Ambang batas harus 0–100.', 'err');
    setBusy(true);
    const row = { semester_id: ctx.sem.id, min_attendance: +f.min_attendance, min_memorization: +f.min_memorization, min_assignment: +f.min_assignment, min_activity: +f.min_activity, use_assignment: !!f.use_assignment, use_activity: !!f.use_activity, extra_requirements: (f.extra_requirements || '').trim() };
    try { if (rule) await api.update('semester_exemption_rules', rule.id, row, 'Ubah kriteria bebas semester'); else await api.insert('semester_exemption_rules', [row], 'Kriteria bebas semester'); toast('Kriteria tersimpan.'); setEditRule(false); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  const review = async (s, status) => {
    try { await api.upsert('semester_exemption_reviews', [{ semester_id: ctx.sem.id, student_id: s.id, status, note: '', reviewed_at: DB.nowIso() }], 'semester_id,student_id', 'Review bebas semester ' + s.full_name); toast('Status ' + s.full_name + ' diperbarui.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
  };
  const students = classes.length ? data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name)) : [];
  const res = rule ? students.map(s => ({ s, r: L.exemption(data, ctx.sem.id, s, rule) })) : [];
  const shown = res.filter(x => !filter || x.r.status === filter);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="alert info"><Icon n="info" s={16} /><div>Status Bebas Semester <b>tidak mengubah</b> nilai akademik apa pun. Persetujuan akhir tetap di tangan guru.</div></div>
      <div className="card">
        <div className="card-h"><h3>Kriteria — Semester {ctx.sem.name} {ctx.year.name}</h3>{!editRule && <button className="btn btn-sm" onClick={() => setEditRule(true)}><Icon n="edit" s={13} />Ubah</button>}</div>
        {editRule ? <div style={{ padding: 16 }}>
          <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            <Field label="Kehadiran minimum (%)"><input type="number" className="input" value={f.min_attendance} onChange={e => setF({ ...f, min_attendance: e.target.value })} /></Field>
            <Field label="Ketuntasan hafalan minimum (%)"><input type="number" className="input" value={f.min_memorization} onChange={e => setF({ ...f, min_memorization: e.target.value })} /></Field>
            <Field label={<span className="row" style={{ gap: 8 }}><Toggle on={f.use_assignment} onChange={v => setF({ ...f, use_assignment: v })} label="Pakai tugas" />Ketuntasan tugas (%)</span>}><input type="number" className="input" disabled={!f.use_assignment} value={f.min_assignment} onChange={e => setF({ ...f, min_assignment: e.target.value })} /></Field>
            <Field label={<span className="row" style={{ gap: 8 }}><Toggle on={f.use_activity} onChange={v => setF({ ...f, use_activity: v })} label="Pakai keaktifan" />Keaktifan minimum (%)</span>}><input type="number" className="input" disabled={!f.use_activity} value={f.min_activity} onChange={e => setF({ ...f, min_activity: e.target.value })} /></Field>
          </div>
          <Field label="Syarat tambahan (diperiksa manual oleh guru)" className="" ><textarea className="textarea" style={{ marginTop: 6 }} value={f.extra_requirements} onChange={e => setF({ ...f, extra_requirements: e.target.value })} /></Field>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>{rule && <button className="btn" onClick={() => { setF(rule); setEditRule(false); }}>Batal</button>}<button className="btn btn-dark" disabled={busy} onClick={saveRule}>{busy && <span className="spin" />}Simpan kriteria</button></div>
        </div> : <div className="row wrap" style={{ padding: 16, gap: 8 }}>
          <span className="badge dark">Kehadiran ≥ {rule.min_attendance}%</span><span className="badge dark">Hafalan ≥ {rule.min_memorization}%</span>
          {rule.use_assignment && <span className="badge dark">Tugas ≥ {rule.min_assignment}%</span>}{rule.use_activity && <span className="badge dark">Keaktifan ≥ {rule.min_activity}%</span>}
          {rule.extra_requirements && <span className="small muted">+ {rule.extra_requirements}</span>}
        </div>}
      </div>
      {rule && (classes.length ? <>
        <div className="row between wrap" style={{ gap: 10 }}>
          <ClassSelect value={cid} onChange={setCid} classes={classes} />
          <div className="row wrap" style={{ gap: 6 }}>
            <button className={'chip ' + (!filter ? 'on' : '')} onClick={() => setFilter('')}>Semua ({res.length})</button>
            {Object.entries(L.EXEMPT_STATUS).map(([k, [l]]) => <button key={k} className={'chip ' + (filter === k ? 'on' : '')} onClick={() => setFilter(k)}>{l} ({res.filter(x => x.r.status === k).length})</button>)}
          </div>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {shown.length ? <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Nama</th>{res[0] && res[0].r.checks.map(c => <th key={c.k} className="c">{c.k}</th>)}<th>Status</th><th>Alasan</th><th></th></tr></thead>
            <tbody>{shown.map(({ s, r }) => { const [lbl, col] = L.EXEMPT_STATUS[r.status]; return <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.full_name}</td>
              {r.checks.map(c => <td key={c.k} className="c" style={{ color: c.v == null ? 'var(--mute)' : c.ok ? 'var(--teal)' : 'var(--danger)', fontWeight: 700 }}>{L.fmtPct(c.v)}</td>)}
              <td><span className={'badge ' + col}>{lbl}</span></td>
              <td className="small muted" style={{ maxWidth: 260 }}>{r.reasons.length ? r.reasons.join('; ') : 'Semua kriteria terpenuhi'}</td>
              <td><div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                {r.status !== 'disetujui' && <button className="btn btn-sm" disabled={!r.ok} title={!r.ok ? 'Belum memenuhi kriteria' : ''} onClick={() => review(s, 'disetujui')}>Setujui</button>}
                {r.review && <button className="btn btn-sm btn-ghost" onClick={() => review(s, 'menunggu')}>Tinjau ulang</button>}
                {!r.review && <button className="btn btn-sm btn-ghost" onClick={() => review(s, 'ditolak')}>Tolak</button>}
              </div></td></tr>; })}</tbody>
          </table></div> : <Empty title="Tidak ada siswa pada filter ini" />}
        </div>
      </> : <NoClasses />)}
    </div>
  );
}

Object.assign(window, { HafalanPage, TugasPage, KeaktifanPage, BebasPage, AssignmentModal });
