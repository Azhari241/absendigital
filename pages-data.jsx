// Semua Kelas, Data Siswa, Detail Siswa
function ClassModal({ cls, onClose }) {
  const { data, api, ctx } = useApp(); const toast = useToast();
  const [f, setF] = useState(cls ? { level: cls.level, name: cls.name } : { level: 'VII', name: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    const name = f.name.trim();
    if (!name) return setErr('Nama rombel wajib diisi.');
    if (data.classes.some(c => c.id !== (cls && cls.id) && c.academic_year_id === ctx.year.id && c.name.toLowerCase() === name.toLowerCase())) return setErr('Nama kelas sudah dipakai pada tahun ajaran ini.');
    setBusy(true);
    try {
      if (cls) await api.update('classes', cls.id, { level: f.level, name }, 'Ubah kelas ' + name);
      else await api.insert('classes', [{ level: f.level, name, academic_year_id: ctx.year.id, archived: false }], 'Tambah kelas ' + name);
      toast('Kelas tersimpan.'); onClose();
    } catch (e) { toast(DB.friendlyError(e), 'err'); setBusy(false); }
  };
  return (
    <Modal title={cls ? 'Edit kelas' : 'Tambah kelas'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan</button></>}>
      <div className="fg">
        <Field label="Tingkat"><select className="select" value={f.level} onChange={e => setF({ ...f, level: e.target.value, name: f.name || e.target.value + '.' })}>{L.LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Nama rombel" error={err}><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder={f.level + '.1'} autoFocus /></Field>
      </div>
    </Modal>
  );
}

function KelasPage() {
  const { data, api, ctx } = useApp(); const { go } = useNav(); const toast = useToast();
  const [modal, setModal] = useState(null); const [showArch, setShowArch] = useState(false); const [arch, setArch] = useState(null); const [delC, setDelC] = useState(null);
  const [yearId, setYearId] = useState(ctx.year.id);
  const [semId, setSemId] = useState(ctx.sem.id);
  const sems = data.semesters.filter(s => s.academic_year_id === yearId);
  const classes = data.classes.filter(c => (c.academic_year_id === yearId || !c.academic_year_id) && (showArch || !c.archived));
  return (
    <div className="col" style={{ gap: 16 }}>
      <PageHead sub="Kelola rombel per tingkat. Mengarsipkan kelas tidak menghapus siswa maupun riwayatnya.">
        <select className="select" style={{ width: 'auto' }} value={yearId} onChange={e => { setYearId(e.target.value); const s = data.semesters.find(x => x.academic_year_id === e.target.value); setSemId(s ? s.id : ''); }}>{data.academic_years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
        <select className="select" style={{ width: 'auto' }} value={semId} onChange={e => setSemId(e.target.value)}>{sems.map(s => <option key={s.id} value={s.id}>Semester {s.name}</option>)}</select>
        <label className="row small" style={{ gap: 6, cursor: 'pointer' }}><Toggle on={showArch} onChange={setShowArch} label="Tampilkan arsip" />Arsip</label>
        <button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tambah kelas</button>
      </PageHead>
      {!classes.length ? <div className="card"><Empty icon="layers" title="Belum ada kelas" text="Tambahkan rombel pertama Anda, mis. VII.1." action={<button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tambah kelas</button>} /></div> :
        L.LEVELS.map(lv => {
          const cs = classes.filter(c => c.level === lv); if (!cs.length) return null;
          return (
            <div key={lv} className="col" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 8 }}><b>Kelas {lv}</b><span className="badge">{cs.length} rombel</span></div>
              <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))' }}>
                {cs.map(c => {
                  const studs = data.students.filter(s => s.class_id === c.id && s.status === 'aktif');
                  const ms = data.meetings.filter(m => m.class_id === c.id && m.semester_id === semId);
                  const cc = L.attCounts(L.recordsFor('attendance_records', data, ms));
                  const notes = data.student_notes.filter(n => n.class_id === c.id && L.noteState(n, data.meetings) === 'aktif').length;
                  return (
                    <div key={c.id} className="card" style={{ padding: 16, opacity: c.archived ? .6 : 1 }}>
                      <div className="row between"><b style={{ fontSize: 17 }}>{c.name}</b>{c.archived ? <span className="badge">Diarsipkan</span> : <span className="badge teal">Aktif</span>}</div>
                      <div className="g" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '14px 0' }}>
                        <div className="col"><span className="tiny muted">Siswa</span><b>{studs.length}</b></div>
                        <div className="col"><span className="tiny muted">Pertemuan</span><b>{ms.length}</b></div>
                        <div className="col"><span className="tiny muted">Kehadiran</span><b>{L.fmtPct(cc.pct)}</b></div>
                      </div>
                      {cc.total > 0 && <div className="kbar" style={{ marginBottom: 12 }}>{L.ATT.map(a => <i key={a.k} style={{ width: (cc[a.k] / cc.total * 100) + '%', background: a.hex }} />)}</div>}
                      {notes > 0 && <p className="tiny" style={{ color: '#6d28d9', marginBottom: 10 }}>{notes} catatan khusus aktif</p>}
                      <div className="row wrap" style={{ gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => go('siswa', { classId: c.id })}><Icon n="users" s={13} />Siswa</button>
                        <button className="btn btn-sm" onClick={() => go('riwayat', { classId: c.id })}><Icon n="history" s={13} />Pertemuan</button>
                        <button className="btn btn-sm" onClick={() => go('absensi', { classId: c.id, tab: 'rekap' })}><Icon n="chart" s={13} />Rekap</button>
                        <ActionMenu label="Tindakan kelas" items={[
                          { label: 'Edit kelas', icon: 'edit', onClick: () => setModal(c) },
                          { label: c.archived ? 'Pulihkan kelas' : 'Arsipkan kelas', icon: c.archived ? 'refresh' : 'archive', onClick: () => setArch(c) },
                          { label: 'Hapus kelas', icon: 'trash', danger: true, onClick: () => setDelC(c) },
                        ]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      {modal && <ClassModal cls={modal.id ? modal : null} onClose={() => setModal(null)} />}
      {delC && <ClassDeleteConfirm cls={delC} onClose={() => setDelC(null)} />}
      {arch && <Confirm title={arch.archived ? 'Pulihkan kelas?' : 'Arsipkan kelas?'} message={arch.archived ? `${arch.name} akan kembali muncul di pilihan kelas.` : `${arch.name} akan disembunyikan dari pilihan kelas. Siswa, pertemuan, dan seluruh riwayat tetap tersimpan.`} confirmLabel={arch.archived ? 'Pulihkan' : 'Arsipkan'} onClose={() => setArch(null)}
        onConfirm={async () => { try { await api.update('classes', arch.id, { archived: !arch.archived }, (arch.archived ? 'Pulihkan' : 'Arsipkan') + ' kelas ' + arch.name); toast('Status kelas diperbarui.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}

function StudentModal({ student, classId, onClose }) {
  const { data, api } = useApp(); const toast = useToast();
  const classes = data.classes.filter(c => !c.archived);
  const [f, setF] = useState(student ? { ...student, nis: student.nis || '', notes: student.notes || '', join_date: student.join_date || '' } : { full_name: '', nis: '', gender: 'L', class_id: classId || (classes[0] && classes[0].id) || '', status: 'aktif', join_date: L.today(), notes: '' });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false); const [dupOk, setDupOk] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const dupName = data.students.find(s => s.id !== (student && student.id) && s.class_id === f.class_id && s.full_name.trim().toLowerCase() === f.full_name.trim().toLowerCase());
  const save = async () => {
    const e = {};
    if (f.full_name.trim().length < 2) e.full_name = 'Nama minimal 2 karakter.';
    if (!f.class_id) e.class_id = 'Pilih kelas.';
    if (f.nis && !/^[0-9A-Za-z.\-]{3,20}$/.test(f.nis.trim())) e.nis = 'NIS/NISN 3–20 karakter (angka/huruf).';
    if (f.nis && data.students.some(s => s.id !== (student && student.id) && s.nis && s.nis === f.nis.trim())) e.nis = 'NIS/NISN sudah dipakai siswa lain.';
    setErr(e); if (Object.keys(e).length) return;
    if (dupName && !dupOk) { setDupOk(true); return; }
    setBusy(true);
    const row = { full_name: f.full_name.trim(), nis: f.nis.trim(), gender: f.gender, class_id: f.class_id, status: f.status, join_date: f.join_date || null, notes: f.notes.trim() };
    try {
      if (student) await api.update('students', student.id, row, 'Ubah siswa ' + row.full_name + (student.class_id !== row.class_id ? ' (pindah kelas)' : ''));
      else await api.insert('students', [row], 'Tambah siswa ' + row.full_name);
      toast('Data siswa tersimpan.'); onClose();
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  return (
    <Modal title={student ? 'Edit siswa' : 'Tambah siswa'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}{dupName && dupOk ? 'Tetap simpan' : 'Simpan'}</button></>}>
      <div className="fg">
        <Field label="Nama lengkap" error={err.full_name} className="full"><input className="input" value={f.full_name} onChange={e => { setF({ ...f, full_name: e.target.value }); setDupOk(false); }} autoFocus /></Field>
        {dupName && <div className="full alert warn"><Icon n="alert" s={16} /><div>Sudah ada siswa bernama <b>{dupName.full_name}</b> di kelas ini. {dupOk ? 'Tekan "Tetap simpan" jika memang berbeda.' : ''}</div></div>}
        <Field label="NIS/NISN (opsional)" error={err.nis}><input className="input" value={f.nis} onChange={set('nis')} inputMode="numeric" /></Field>
        <Field label="Jenis kelamin"><Seg value={f.gender} onChange={v => setF({ ...f, gender: v })} options={[{ v: 'L', l: 'Laki-laki' }, { v: 'P', l: 'Perempuan' }]} /></Field>
        <Field label="Kelas" error={err.class_id} hint={student && student.class_id !== f.class_id ? 'Siswa akan dipindah. Riwayat di kelas lama tetap tersimpan.' : null}>
          <select className="select" value={f.class_id} onChange={set('class_id')}><option value="">—</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Field label="Tanggal masuk"><input type="date" className="input" value={f.join_date} onChange={set('join_date')} /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={set('status')}><option value="aktif">Aktif</option><option value="arsip">Diarsipkan</option></select></Field>
        <Field label="Catatan umum" className="full"><textarea className="textarea" value={f.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

function ImportModal({ classId, onClose }) {
  const { data, api } = useApp(); const toast = useToast();
  const [rows, setRows] = useState(null); const [cid, setCid] = useState(classId || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const classes = data.classes.filter(c => !c.archived);
  const parse = async file => {
    setErr('');
    try {
      if (!window.XLSX) throw new Error('Library Excel belum dimuat.');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const norm = k => String(k).toLowerCase().replace(/[^a-z]/g, '');
      const out = json.map(r => {
        const m = {}; Object.keys(r).forEach(k => m[norm(k)] = String(r[k]).trim());
        const name = m.nama || m.namalengkap || m.namasiswa || m.name || '';
        const g = (m.jk || m.lp || m.jeniskelamin || m.gender || '').toUpperCase();
        return { full_name: name, nis: m.nis || m.nisn || m.nisnisn || '', gender: g.startsWith('P') ? 'P' : g.startsWith('L') ? 'L' : '' };
      }).filter(r => r.full_name);
      if (!out.length) throw new Error('Tidak ada baris dengan kolom "Nama". Pastikan baris pertama berisi judul kolom: Nama, NIS, JK.');
      setRows(out);
    } catch (e) { setErr(e.message || 'File tidak dapat dibaca.'); }
  };
  const nisSet = new Set(data.students.map(s => s.nis).filter(Boolean));
  const checked = (rows || []).map((r, i, arr) => {
    const issues = [];
    if (!r.gender) issues.push('JK kosong');
    if (r.nis && nisSet.has(r.nis)) issues.push('NIS sudah ada');
    if (r.nis && arr.findIndex(x => x.nis === r.nis) !== i) issues.push('NIS ganda di file');
    if (data.students.some(s => s.class_id === cid && s.full_name.toLowerCase() === r.full_name.toLowerCase())) issues.push('Nama sudah ada di kelas');
    return { ...r, issues, ok: issues.length === 0 };
  });
  const valid = checked.filter(r => r.ok);
  const doImport = async () => {
    if (!cid) return setErr('Pilih kelas tujuan.');
    setBusy(true);
    try { await api.insert('students', valid.map(r => ({ full_name: r.full_name, nis: r.nis, gender: r.gender, class_id: cid, status: 'aktif', join_date: L.today(), notes: '' })), 'Impor ' + valid.length + ' siswa'); toast(valid.length + ' siswa berhasil diimpor.'); onClose(); }
    catch (e) { toast(DB.friendlyError(e), 'err'); setBusy(false); }
  };
  const template = () => L.exportCSV('template-impor-siswa', ['Nama', 'NIS', 'JK'], [['Ahmad Contoh', '2026001', 'L'], ['Siti Contoh', '2026002', 'P']]);
  return (
    <Modal size="lg" title="Impor siswa dari Excel/CSV" sub="Kolom yang dikenali: Nama, NIS/NISN, JK (L/P). Baris dengan masalah tidak akan diimpor." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-dark" disabled={busy || !valid.length} onClick={doImport}>{busy && <span className="spin" />}Impor {valid.length} siswa</button></>}>
      <div className="col" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <Field label="Kelas tujuan"><select className="select" value={cid} onChange={e => setCid(e.target.value)}><option value="">—</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="File (.xlsx, .xls, .csv)"><input type="file" accept=".xlsx,.xls,.csv" className="input" style={{ paddingTop: 7 }} onChange={e => e.target.files[0] && parse(e.target.files[0])} /></Field>
          <button className="btn btn-sm" style={{ alignSelf: 'flex-end', marginBottom: 4 }} onClick={template}><Icon n="download" s={13} />Template</button>
        </div>
        {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
        {rows && <div className="card" style={{ maxHeight: 300, overflow: 'auto' }}><table className="tbl"><thead><tr><th>Nama</th><th>NIS</th><th>JK</th><th>Status</th></tr></thead><tbody>
          {checked.map((r, i) => <tr key={i}><td>{r.full_name}</td><td>{r.nis || '—'}</td><td>{r.gender || '—'}</td><td>{r.ok ? <span className="badge teal">Siap</span> : <span className="badge red">{r.issues.join(', ')}</span>}</td></tr>)}
        </tbody></table></div>}
      </div>
    </Modal>
  );
}

function SiswaPage({ params }) {
  const { data, api, ctx } = useApp(); const { go } = useNav(); const toast = useToast();
  const [cid, setCid] = useState(params.classId || '');
  const [q, setQ] = useState(''); const [g, setG] = useState(''); const [st, setSt] = useState('aktif');
  const [modal, setModal] = useState(null); const [imp, setImp] = useState(false); const [arch, setArch] = useState(null); const [delS, setDelS] = useState(null);
  const classes = data.classes.filter(c => !c.archived);
  const cls = L.idx(data.classes);
  const list = data.students.filter(s => (!cid || s.class_id === cid) && (!g || s.gender === g) && (st === 'semua' || s.status === st) && (s.full_name.toLowerCase().includes(q.toLowerCase()) || (s.nis || '').includes(q)))
    .sort((a, b) => ((cls[a.class_id] || {}).name || '').localeCompare((cls[b.class_id] || {}).name || '') || a.full_name.localeCompare(b.full_name));
  const exportList = type => {
    const header = ['No', 'Nama', 'NIS/NISN', 'JK', 'Kelas', 'Status', 'Tanggal Masuk', 'Catatan'];
    const rows = list.map((s, i) => [i + 1, s.full_name, s.nis || '', s.gender, (cls[s.class_id] || {}).name || '', s.status, s.join_date || '', s.notes || '']);
    try { type === 'csv' ? L.exportCSV('data-siswa', header, rows) : L.exportXLSX('data-siswa', [{ name: 'Siswa', header, rows }], { title: 'Data Siswa', school: ctx.profile.school_name || '', sub: ctx.year.name }); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead sub={`${list.length} siswa ditampilkan`}>
        <button className="btn" onClick={() => setImp(true)}><Icon n="upload" s={15} />Impor</button>
        <button className="btn" onClick={() => exportList('xlsx')}><Icon n="download" s={15} />Excel</button>
        <button className="btn" onClick={() => exportList('csv')}>CSV</button>
        <button className="btn btn-dark" onClick={() => setModal({})} disabled={!classes.length}><Icon n="plus" s={15} />Tambah siswa</button>
      </PageHead>
      {!classes.length ? <NoClasses /> : <>
        <div className="toolbar">
          <div className="search" style={{ width: 240 }}><Icon n="search" s={15} /><input className="input" placeholder="Cari nama atau NIS…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <ClassSelect value={cid} onChange={setCid} classes={classes} allowAll />
          <select className="select" style={{ width: 'auto' }} value={g} onChange={e => setG(e.target.value)}><option value="">L & P</option><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
          <Seg value={st} onChange={setSt} options={[{ v: 'aktif', l: 'Aktif' }, { v: 'arsip', l: 'Arsip' }, { v: 'semua', l: 'Semua' }]} />
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {list.length ? <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>No</th><th>Nama</th><th>NIS/NISN</th><th className="c">L/P</th><th>Kelas</th><th className="c">Kehadiran</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((s, i) => {
              const sum = L.studentSummary(data, s, ctx.sem.id);
              return <tr key={s.id}>
                <td className="muted">{i + 1}</td>
                <td><button className="link" style={{ textDecoration: 'none', color: 'var(--ink)' }} onClick={() => go('siswaDetail', { id: s.id })}>{s.full_name}</button></td>
                <td className="muted mono small">{s.nis || '—'}</td><td className="c">{s.gender}</td>
                <td>{(cls[s.class_id] || {}).name || '—'}</td>
                <td className="c">{L.fmtPct(sum.attPct)}</td>
                <td>{s.status === 'aktif' ? <span className="badge teal">Aktif</span> : <span className="badge">Arsip</span>}</td>
                <td><div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm btn-icon desk-only" onClick={() => setModal(s)} aria-label="Edit / pindah kelas" title="Edit / pindah kelas"><Icon n="edit" s={14} /></button>
                  <ActionMenu label="Tindakan siswa" items={[
                    { label: 'Lihat riwayat', icon: 'history', onClick: () => go('siswaDetail', { id: s.id }) },
                    { label: 'Edit / pindah kelas', icon: 'edit', onClick: () => setModal(s) },
                    { label: s.status === 'aktif' ? 'Arsipkan' : 'Aktifkan kembali', icon: s.status === 'aktif' ? 'archive' : 'refresh', onClick: () => setArch(s) },
                    { label: 'Hapus siswa', icon: 'trash', danger: true, onClick: () => setDelS(s) },
                  ]} />
                </div></td>
              </tr>;
            })}</tbody>
          </table></div> : <Empty icon="users" title="Tidak ada siswa" text={q ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Tambahkan siswa satu per satu atau impor dari Excel/CSV.'} />}
        </div>
      </>}
      {modal && <StudentModal student={modal.id ? modal : null} classId={cid} onClose={() => setModal(null)} />}
      {imp && <ImportModal classId={cid} onClose={() => setImp(false)} />}
      {delS && <StudentDeleteConfirm student={delS} onClose={() => setDelS(null)} />}
      {arch && <Confirm title={arch.status === 'aktif' ? 'Arsipkan siswa?' : 'Aktifkan kembali?'} message={arch.status === 'aktif' ? `${arch.full_name} tidak akan muncul di absensi. Riwayat akademik tetap tersimpan.` : `${arch.full_name} akan kembali muncul di absensi.`} confirmLabel={arch.status === 'aktif' ? 'Arsipkan' : 'Aktifkan'} onClose={() => setArch(null)}
        onConfirm={async () => { try { await api.update('students', arch.id, { status: arch.status === 'aktif' ? 'arsip' : 'aktif' }, 'Status siswa ' + arch.full_name); toast('Status siswa diperbarui.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}

function SiswaDetailPage({ params }) {
  const { data, ctx } = useApp(); const { go } = useNav();
  const s = data.students.find(x => x.id === params.id);
  const [tab, setTab] = useState('kehadiran'); const [edit, setEdit] = useState(false); const [addNote, setAddNote] = useState(false);
  if (!s) return <div className="card"><Empty title="Siswa tidak ditemukan" action={<button className="btn" onClick={() => go('siswa')}>Kembali</button>} /></div>;
  const sum = L.studentSummary(data, s, ctx.sem.id);
  const cls = data.classes.find(c => c.id === s.class_id);
  const mIdx = L.idx(data.meetings); const cIdx = L.idx(data.classes);
  const att = data.attendance_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id]).sort((a, b) => mIdx[a.meeting_id].date < mIdx[b.meeting_id].date ? 1 : -1);
  const mem = data.memorization_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id]).sort((a, b) => mIdx[a.meeting_id].date < mIdx[b.meeting_id].date ? 1 : -1);
  const act = data.activity_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id]).sort((a, b) => mIdx[a.meeting_id].date < mIdx[b.meeting_id].date ? 1 : -1);
  const asg = data.assignments.filter(a => a.class_id === s.class_id || data.assignment_records.some(r => r.assignment_id === a.id && r.student_id === s.id)).filter(a => a.target === 'kelas' || (a.student_ids || []).includes(s.id)).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const notes = data.student_notes.filter(n => n.student_id === s.id).sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const meetingsAll = [...new Set([...att, ...mem, ...act].map(r => r.meeting_id))].map(id => mIdx[id]).sort((a, b) => a.date < b.date ? 1 : -1);
  const s2 = ctx.settings;
  const tabs = [['kehadiran', 'Kehadiran'], s2.hafalan && ['hafalan', 'Hafalan'], s2.tugas && ['tugas', 'Tugas'], s2.keaktifan && ['keaktifan', 'Keaktifan'], ['catatan', 'Catatan khusus'], ['pertemuan', 'Riwayat pertemuan'], ['profil', 'Profil']].filter(Boolean);
  const mLabel = m => `P${m.number} · ${L.fmtDate(m.date, false)}${m.class_id !== s.class_id ? ' · ' + (cIdx[m.class_id] || {}).name : ''}`;
  return (
    <div className="col" style={{ gap: 14 }}>
      <button className="link small" style={{ alignSelf: 'flex-start' }} onClick={() => go('siswa', { classId: s.class_id })}>← Data Siswa</button>
      <div className="card card-pad row wrap" style={{ gap: 16 }}>
        <div className="avatar" style={{ width: 52, height: 52, fontSize: 18, background: s.gender === 'P' ? '#0f766e' : 'var(--ink)' }}>{s.full_name.split(' ').slice(0, 2).map(w => w[0]).join('')}</div>
        <div className="col grow" style={{ gap: 3 }}>
          <h2 style={{ fontSize: 20 }}>{s.full_name}</h2>
          <span className="small muted">{cls ? cls.name : '—'} · {s.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · NIS {s.nis || '—'} {s.status !== 'aktif' && '· Diarsipkan'}</span>
        </div>
        <button className="btn" onClick={() => setAddNote(true)}><Icon n="note" s={15} />Catatan khusus</button>
        <button className="btn" onClick={() => setEdit(true)}><Icon n="edit" s={15} />Edit</button>
      </div>
      <div className="g g-stats">
        <div className="card stat"><span className="k">Kehadiran</span><span className="v">{L.fmtPct(sum.attPct)}</span><span className="s">{sum.att.present}/{sum.att.total} pertemuan</span></div>
        {s2.hafalan && <div className="card stat"><span className="k">Ketuntasan hafalan</span><span className="v">{L.fmtPct(sum.memPct)}</span><span className="s">{sum.memSetor}/{sum.memReq} setor · {sum.memBebas} bebas · rata-rata {sum.memScore ?? '—'}</span></div>}
        {s2.tugas && <div className="card stat"><span className="k">Tugas</span><span className="v">{sum.asgTotal ? sum.asgDone + '/' + sum.asgTotal : '—'}</span><span className="s">rata-rata nilai {sum.asgScore ?? '—'}</span></div>}
        {s2.keaktifan && <div className="card stat"><span className="k">Keaktifan</span><span className="v">{sum.actAvg ?? '—'}</span><span className="s">skala 0–{s2.activity_scale_max} · {sum.actCount} penilaian</span></div>}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tabs" style={{ padding: '0 10px' }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
        <div className="tbl-wrap">
          {tab === 'kehadiran' && (att.length ? <table className="tbl"><thead><tr><th>Pertemuan</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>{att.map(r => <tr key={r.id}><td>{mLabel(mIdx[r.meeting_id])}</td><td><AttBadge k={r.status} /></td><td className="small">{r.late_minutes ? r.late_minutes + ' menit · ' : ''}{r.note}</td></tr>)}</tbody></table> : <Empty title="Belum ada data kehadiran" />)}
          {tab === 'hafalan' && (mem.length ? <table className="tbl"><thead><tr><th>Pertemuan</th><th>Target</th><th>Status</th><th className="c">Nilai</th><th>Komentar</th></tr></thead><tbody>{mem.map(r => <tr key={r.id}><td>{mLabel(mIdx[r.meeting_id])}</td><td className="small">{(data.memorization_targets.find(t => t.id === r.target_id) || {}).title || mIdx[r.meeting_id].topic || '—'}</td><td><MemBadge k={r.status} /></td><td className="c">{r.score ?? '—'}</td><td className="small">{r.comment}</td></tr>)}</tbody></table> : <Empty title="Belum ada data hafalan" />)}
          {tab === 'tugas' && (asg.length ? <table className="tbl"><thead><tr><th>Tugas</th><th>Tenggat</th><th>Status</th><th className="c">Nilai</th></tr></thead><tbody>{asg.map(a => { const r = data.assignment_records.find(x => x.assignment_id === a.id && x.student_id === s.id); return <tr key={a.id}><td>{a.title}</td><td>{L.fmtDate(a.due_date, false)}</td><td>{r ? <AsgBadge k={r.status} /> : <span className="badge">{a.due_date < L.today() ? 'Belum mengumpulkan' : 'Belum tenggat'}</span>}</td><td className="c">{r && r.score != null ? r.score : r && ['sudah', 'terlambat'].includes(r.status) ? <span className="badge warn">Belum dinilai</span> : '—'}</td></tr>; })}</tbody></table> : <Empty title="Belum ada tugas" />)}
          {tab === 'keaktifan' && (act.length ? <table className="tbl"><thead><tr><th>Pertemuan</th><th className="c">Nilai</th><th>Catatan</th></tr></thead><tbody>{act.map(r => <tr key={r.id}><td>{mLabel(mIdx[r.meeting_id])}</td><td className="c">{r.score ?? '—'}</td><td className="small">{r.note}</td></tr>)}</tbody></table> : <Empty title="Belum ada data keaktifan" />)}
          {tab === 'catatan' && <div style={{ padding: 14 }}>{notes.length ? <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>{notes.map(n => <NoteCard key={n.id} n={n} />)}</div> : <Empty icon="note" title="Belum ada catatan khusus" />}</div>}
          {tab === 'pertemuan' && (meetingsAll.length ? <table className="tbl"><thead><tr><th>Pertemuan</th><th>Materi</th><th>Kehadiran</th>{s2.hafalan && <th>Hafalan</th>}{s2.keaktifan && <th className="c">Aktif</th>}</tr></thead><tbody>{meetingsAll.map(m => { const a = att.find(r => r.meeting_id === m.id), h = mem.find(r => r.meeting_id === m.id), k = act.find(r => r.meeting_id === m.id); return <tr key={m.id}><td>{mLabel(m)}</td><td className="small">{m.topic || '—'}</td><td>{a ? <AttBadge k={a.status} /> : '—'}</td>{s2.hafalan && <td>{h ? <MemBadge k={h.status} /> : '—'}</td>}{s2.keaktifan && <td className="c">{k ? k.score : '—'}</td>}</tr>; })}</tbody></table> : <Empty title="Belum ada riwayat pertemuan" />)}
          {tab === 'profil' && <div className="fg" style={{ padding: 18 }}>{[['Nama lengkap', s.full_name], ['NIS/NISN', s.nis || '—'], ['Jenis kelamin', s.gender === 'L' ? 'Laki-laki' : 'Perempuan'], ['Kelas', cls ? cls.name : '—'], ['Status', s.status], ['Tanggal masuk', L.fmtDate(s.join_date, false)], ['Catatan umum', s.notes || '—']].map(([k, v]) => <div key={k} className="col" style={{ gap: 3 }}><span className="tiny muted">{k}</span><b style={{ fontWeight: 600 }}>{v}</b></div>)}</div>}
        </div>
      </div>
      {edit && <StudentModal student={s} onClose={() => setEdit(false)} />}
      {addNote && <NoteModal classId={s.class_id} studentId={s.id} onClose={() => setAddNote(false)} />}
    </div>
  );
}

Object.assign(window, { KelasPage, SiswaPage, SiswaDetailPage });
