// Catatan khusus antarpertemuan: formulir, daftar, pencabutan, riwayat.
function NoteModal({ note, classId, studentId, originMeeting, onClose }) {
  const { data, api, ctx } = useApp();
  const toast = useToast();
  const editing = !!note;
  const students = data.students.filter(s => s.status === 'aktif' && (!classId || s.class_id === classId)).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const [f, setF] = useState(() => note ? { ...note, valid_count: note.valid_count || 2, valid_until: note.valid_until || '' } : {
    student_id: studentId || '', type: 'bebas_hafalan', reason: '', start_date: originMeeting ? originMeeting.date : L.today(),
    origin_meeting_id: originMeeting ? originMeeting.id : '', validity: 'next', valid_count: 2, valid_until: '', related_assignment_id: '',
  });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const stu = data.students.find(s => s.id === f.student_id);
  const cid = stu ? stu.class_id : classId;
  const classMeetings = L.sortMeetings(data.meetings.filter(m => m.class_id === cid && m.semester_id === ctx.sem.id)).reverse();
  const assignments = data.assignments.filter(a => a.class_id === cid).sort((a, b) => a.due_date < b.due_date ? 1 : -1);
  const isTugas = ['bebas_tugas', 'tugas_pengganti', 'perpanjangan'].includes(f.type);

  const save = async () => {
    const e = {};
    if (!f.student_id) e.student_id = 'Pilih siswa.';
    if ((f.reason || '').trim().length < 3) e.reason = 'Tuliskan alasan (min. 3 karakter).';
    if (!f.start_date) e.start_date = 'Tanggal mulai wajib.';
    if (f.validity === 'until' && (!f.valid_until || f.valid_until < f.start_date)) e.valid_until = 'Tanggal harus sama atau setelah tanggal mulai.';
    if (f.validity === 'count' && !(f.valid_count >= 1 && f.valid_count <= 50)) e.valid_count = '1–50 pertemuan.';
    if (f.validity === 'current' && !f.origin_meeting_id) e.origin_meeting_id = 'Pilih pertemuan asal untuk masa berlaku "pertemuan saat ini".';
    if ((f.type === 'bebas_tugas' || f.type === 'perpanjangan') && !f.related_assignment_id) e.related_assignment_id = 'Pilih tugas yang terkait.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const row = {
      student_id: f.student_id, class_id: cid, type: f.type, component: L.NOTE_TYPES[f.type].comp,
      related_assignment_id: isTugas && f.related_assignment_id ? f.related_assignment_id : null,
      reason: f.reason.trim(), start_date: f.start_date, origin_meeting_id: f.origin_meeting_id || null,
      validity: f.validity, valid_count: f.validity === 'count' ? Number(f.valid_count) : null,
      valid_until: f.validity === 'until' ? f.valid_until : null,
    };
    try {
      if (editing) {
        const changes = Object.keys(row).filter(k => String(row[k] ?? '') !== String(note[k] ?? ''));
        await api.update('student_notes', note.id, row, 'Ubah catatan khusus');
        await api.insert('note_history', [{ note_id: note.id, action: 'diubah', detail: changes.length ? 'Perubahan: ' + changes.join(', ') : 'Disimpan tanpa perubahan' }]);
      } else {
        const [n] = await api.insert('student_notes', [{ ...row, status: 'aktif', created_by: ctx.profile.full_name || 'Guru' }], 'Tambah catatan khusus');
        await api.insert('note_history', [{ note_id: n.id, action: 'dibuat', detail: L.NOTE_TYPES[f.type].label + ' · ' + L.VALIDITY[f.validity] }]);
      }
      toast('Catatan khusus tersimpan.'); onClose();
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };

  return (
    <Modal title={editing ? 'Ubah catatan khusus' : 'Catatan khusus baru'} sub="Catatan otomatis muncul pada pertemuan yang masih termasuk masa berlakunya." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan catatan</button></>}>
      <div className="fg">
        <Field label="Siswa" error={err.student_id} className="full">
          <select className="select" value={f.student_id} onChange={e => set('student_id', e.target.value)} disabled={editing}>
            <option value="">— Pilih siswa —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({(data.classes.find(c => c.id === s.class_id) || {}).name})</option>)}
          </select>
        </Field>
        <Field label="Jenis catatan">
          <select className="select" value={f.type} onChange={e => set('type', e.target.value)}>
            {Object.entries(L.NOTE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Komponen terkait"><input className="input" value={L.NOTE_TYPES[f.type].comp[0].toUpperCase() + L.NOTE_TYPES[f.type].comp.slice(1)} disabled /></Field>
        {isTugas && <Field label="Tugas terkait" error={err.related_assignment_id} className="full">
          <select className="select" value={f.related_assignment_id || ''} onChange={e => set('related_assignment_id', e.target.value)}>
            <option value="">— Pilih tugas —</option>
            {assignments.map(a => <option key={a.id} value={a.id}>{a.title} · tenggat {L.fmtShort(a.due_date)}</option>)}
          </select>
        </Field>}
        <Field label="Alasan" error={err.reason} className="full">
          <textarea className="textarea" value={f.reason} onChange={e => set('reason', e.target.value)} placeholder="mis. Telah menyetor hafalan tambahan pada pertemuan sebelumnya." />
        </Field>
        <Field label="Tanggal mulai" error={err.start_date}><input type="date" className="input" value={f.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
        <Field label="Pertemuan asal" error={err.origin_meeting_id}>
          <select className="select" value={f.origin_meeting_id || ''} onChange={e => { const m = data.meetings.find(x => x.id === e.target.value); set('origin_meeting_id', e.target.value); if (m) set('start_date', m.date); }}>
            <option value="">— Tidak terkait pertemuan —</option>
            {classMeetings.map(m => <option key={m.id} value={m.id}>Pertemuan {m.number} · {L.fmtShort(m.date)}</option>)}
          </select>
        </Field>
        <Field label="Masa berlaku" className="full">
          <div className="row wrap" style={{ gap: 6 }}>
            {Object.entries(L.VALIDITY).map(([k, v]) => <button type="button" key={k} className={'chip ' + (f.validity === k ? 'on' : '')} onClick={() => set('validity', k)}>{v}</button>)}
          </div>
        </Field>
        {f.validity === 'count' && <Field label="Jumlah pertemuan" error={err.valid_count}><input type="number" min="1" max="50" className="input" value={f.valid_count} onChange={e => set('valid_count', e.target.value)} /></Field>}
        {f.validity === 'until' && <Field label="Berlaku sampai" error={err.valid_until}><input type="date" className="input" value={f.valid_until} onChange={e => set('valid_until', e.target.value)} /></Field>}
        <div className="full alert info"><Icon n="info" s={16} /><div>{f.type === 'bebas_hafalan' ? 'Bebas setor hafalan tidak membebaskan tugas dan tidak mengubah absensi. Statusnya dicatat sebagai "Bebas Setor" (tidak dihitung sebagai nilai 100).' : f.type === 'izin_khusus' ? 'Izin khusus ditampilkan sebagai pemberitahuan; status kehadiran tetap diisi guru.' : 'Catatan hanya berlaku untuk komponen terkait.'}</div></div>
      </div>
    </Modal>
  );
}

function noteStateBadge(state) {
  return state === 'aktif' ? <span className="badge teal">Aktif</span> : state === 'dicabut' ? <span className="badge">Dicabut</span> : <span className="badge warn">Kedaluwarsa</span>;
}

function NoteCard({ n, compact }) {
  const { data, api } = useApp(); const toast = useToast();
  const [edit, setEdit] = useState(false); const [revoke, setRevoke] = useState(false); const [hist, setHist] = useState(false); const [del, setDel] = useState(false);
  const stu = data.students.find(s => s.id === n.student_id);
  const origin = data.meetings.find(m => m.id === n.origin_meeting_id);
  const asg = data.assignments.find(a => a.id === n.related_assignment_id);
  const state = L.noteState(n, data.meetings);
  const history = data.note_history.filter(h => h.note_id === n.id).sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  return (
    <div className="att-card col" style={{ gap: 8, opacity: state === 'aktif' ? 1 : .75 }}>
      <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 3, minWidth: 0 }}>
          <b style={{ fontSize: 13.5 }}>{stu ? stu.full_name : '—'}</b>
          <span className="tiny muted">{L.NOTE_TYPES[n.type].label}{asg ? ' · ' + asg.title : ''}</span>
        </div>
        {noteStateBadge(state)}
      </div>
      <p className="small tw-pretty" style={{ lineHeight: 1.5, color: 'var(--ink2)' }}>{n.reason}</p>
      <div className="row wrap tiny muted" style={{ gap: '4px 12px' }}>
        <span>Mulai {L.fmtDate(n.start_date, false)}</span>
        {origin && <span>Asal: pertemuan {origin.number}</span>}
        <span>Berlaku: {L.validityText(n)}</span>
        <span>Oleh {n.created_by || '—'}</span>
      </div>
      {!compact && <div className="row wrap" style={{ gap: 6 }}>
        <button className="btn btn-sm" onClick={() => setHist(!hist)}><Icon n="history" s={13} />Riwayat ({history.length})</button>
        {n.status === 'aktif' && <button className="btn btn-sm" onClick={() => setEdit(true)}><Icon n="edit" s={13} />Ubah</button>}
        {n.status === 'aktif' && <button className="btn btn-sm" onClick={() => setRevoke(true)}>Cabut</button>}
        <button className="btn btn-sm btn-icon btn-danger" title="Hapus catatan" aria-label="Hapus catatan" onClick={() => setDel(true)}><Icon n="trash" s={13} /></button>
      </div>}
      {del && <Confirm danger title="Hapus catatan khusus permanen?" confirmLabel="Hapus Permanen" typeToConfirm="HAPUS" onClose={() => setDel(false)}
        message={<>Catatan <b>{L.NOTE_TYPES[n.type].label}</b> untuk <b>{stu ? stu.full_name : 'siswa'}</b> beserta {history.length} riwayat perubahannya akan dihapus permanen. Gunakan ini hanya untuk catatan yang salah input.</>}
        details={<div className="alert info"><Icon n="info" s={16} /><div>Agar riwayat tetap terdokumentasi, pilih <b>Cabut</b> — catatan berhenti berlaku tetapi tetap tersimpan. Absensi dan nilai siswa tidak terpengaruh oleh penghapusan ini.</div></div>}
        onConfirm={async () => { try { await api.remove('student_notes', n.id, 'Hapus catatan khusus ' + (stu ? stu.full_name : '')); toast('Catatan dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
      {hist && <div className="col" style={{ gap: 4, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
        {history.length ? history.map(h => <div key={h.id} className="tiny"><b style={{ textTransform: 'capitalize' }}>{h.action}</b> · <span className="muted">{new Date(h.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span><div className="muted">{h.detail}</div></div>) : <span className="tiny muted">Belum ada riwayat.</span>}
      </div>}
      {edit && <NoteModal note={n} onClose={() => setEdit(false)} />}
      {revoke && <Confirm title="Cabut catatan khusus?" message={`Catatan untuk ${stu ? stu.full_name : 'siswa'} tidak akan berlaku lagi mulai sekarang. Catatan dan riwayatnya tetap tersimpan.`} confirmLabel="Cabut catatan" danger onClose={() => setRevoke(false)} onConfirm={async () => {
        try { await api.update('student_notes', n.id, { status: 'dicabut' }, 'Cabut catatan khusus'); await api.insert('note_history', [{ note_id: n.id, action: 'dicabut', detail: 'Dicabut oleh guru' }]); toast('Catatan dicabut.'); }
        catch (e) { toast(DB.friendlyError(e), 'err'); throw e; }
      }} />}
    </div>
  );
}

// Banner pemberitahuan catatan yang berlaku untuk pertemuan
function ActiveNotesBanner({ notes }) {
  const { data } = useApp();
  if (!notes.length) return null;
  return (
    <div className="card" style={{ borderColor: '#e4dafc', background: '#faf8ff' }}>
      <div className="row" style={{ padding: '12px 16px 8px', gap: 8 }}><Icon n="note" s={16} style={{ color: '#6d28d9' }} /><b style={{ fontSize: 13.5 }}>{notes.length} catatan khusus berlaku pada pertemuan ini</b></div>
      <div className="col" style={{ padding: '0 16px 12px', gap: 8 }}>
        {notes.map(n => {
          const s = data.students.find(x => x.id === n.student_id);
          const origin = data.meetings.find(m => m.id === n.origin_meeting_id);
          const asg = data.assignments.find(a => a.id === n.related_assignment_id);
          return (
            <div key={n.id} className="small tw-pretty" style={{ lineHeight: 1.5, padding: '8px 10px', background: '#fff', borderRadius: 9, border: '1px solid #ede7fb' }}>
              <b>{s ? s.full_name : '—'}</b> — <span className="badge purple" style={{ height: 19 }}>{L.NOTE_TYPES[n.type].label}</span>{asg ? <> untuk <b>{asg.title}</b></> : null} karena {n.reason.replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}.
              <div className="tiny muted" style={{ marginTop: 2 }}>Sejak {L.fmtDate(n.start_date, false)}{origin ? ` · dari pertemuan ${origin.number}` : ''} · berlaku: {L.validityText(n)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { NoteModal, NoteCard, ActiveNotesBanner, noteStateBadge });
