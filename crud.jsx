// Edit & hapus data berelasi: pertemuan, kelas, siswa.
// Semua penghapusan: konfirmasi → permintaan ke server → UI diperbarui hanya setelah server mengonfirmasi.

function meetingImpact(data, m) {
  const cnt = t => data[t].filter(r => r.meeting_id === m.id).length;
  return {
    attendance: cnt('attendance_records'), memorization: cnt('memorization_records'), activity: cnt('activity_records'),
    assignments: data.assignments.filter(a => a.meeting_id === m.id).length,
    notes: data.student_notes.filter(n => n.origin_meeting_id === m.id).length,
  };
}

function MeetingEditModal({ meeting, onClose }) {
  const { data, api, ctx } = useApp(); const toast = useToast();
  const cls = data.classes.find(c => c.id === meeting.class_id);
  const MOD_LIST = [{ k: 'hafalan', l: 'Hafalan' }, { k: 'tugas', l: 'Tugas' }, { k: 'keaktifan', l: 'Keaktifan' }];
  const modOn = k => { const r = data.meeting_modules.find(x => x.meeting_id === meeting.id && x.module === k); return r ? r.enabled : false; };
  const [f, setF] = useState({ date: meeting.date, number: String(meeting.number), topic: meeting.topic || '', notes: meeting.notes || '', mods: Object.fromEntries(MOD_LIST.map(x => [x.k, modOn(x.k)])) });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = {}; const n = Number(f.number);
    if (!f.date) e.date = 'Tanggal wajib diisi.';
    if (!Number.isInteger(n) || n < 1) e.number = 'Nomor harus bilangan bulat ≥ 1.';
    else if (data.meetings.some(m => m.id !== meeting.id && m.class_id === meeting.class_id && m.semester_id === meeting.semester_id && m.number === n)) e.number = 'Nomor ' + n + ' sudah dipakai di kelas ini.';
    setErr(e); if (Object.keys(e).length) return;
    if (busy) return; setBusy(true);
    try {
      await api.update('meetings', meeting.id, { date: f.date, number: n, topic: f.topic.trim(), notes: f.notes.trim() }, `Edit pertemuan ${n} ${cls ? cls.name : ''}`);
      await api.upsert('meeting_modules', [{ meeting_id: meeting.id, module: 'absensi', enabled: true }, ...MOD_LIST.map(x => ({ meeting_id: meeting.id, module: x.k, enabled: !!f.mods[x.k] }))], 'meeting_id,module');
      toast('Perubahan pertemuan tersimpan.'); onClose(true);
    } catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  return (
    <Modal title="Edit pertemuan" sub={`${cls ? cls.name : ''} · data lama sudah terisi. Absensi & nilai tidak berubah.`} onClose={busy ? null : () => onClose(false)}
      footer={<><button className="btn" disabled={busy} onClick={() => onClose(false)}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy ? <span className="spin" /> : <Icon n="save" s={15} />}Simpan perubahan</button></>}>
      <div className="fg">
        <Field label="Tanggal" error={err.date}><input type="date" className="input" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Nomor pertemuan" error={err.number}><input type="number" min="1" className={'input ' + (err.number ? 'err' : '')} value={f.number} onChange={e => setF({ ...f, number: e.target.value })} /></Field>
        <Field label="Materi pembelajaran" className="full"><input className="input" value={f.topic} onChange={e => setF({ ...f, topic: e.target.value })} /></Field>
        <Field label="Catatan pertemuan" className="full"><textarea className="textarea" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <Field label="Modul kegiatan yang digunakan" className="full">
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="chip on" style={{ '--c': 'var(--ink)', cursor: 'default' }}>Absensi</span>
            {MOD_LIST.filter(x => ctx.settings[x.k]).map(x => <button type="button" key={x.k} className={'chip ' + (f.mods[x.k] ? 'on' : '')} style={{ '--c': 'var(--teal)' }} onClick={() => setF({ ...f, mods: { ...f.mods, [x.k]: !f.mods[x.k] } })}>{f.mods[x.k] ? '✓ ' : ''}{x.l}</button>)}
          </div>
          <span className="tiny muted">Menonaktifkan modul di sini hanya menyembunyikan kolomnya pada pertemuan ini; nilai yang sudah ada tidak dihapus.</span>
        </Field>
      </div>
    </Modal>
  );
}

function MeetingDeleteConfirm({ meeting, onClose, onDeleted }) {
  const { data, api } = useApp(); const toast = useToast();
  const cls = data.classes.find(c => c.id === meeting.class_id);
  const im = meetingImpact(data, meeting);
  const rows = [
    [im.attendance, 'catatan absensi', 'dihapus'], [im.memorization, 'catatan hafalan', 'dihapus'], [im.activity, 'nilai keaktifan', 'dihapus'],
    [im.assignments, 'tugas yang dibuat di pertemuan ini', 'tetap ada (tautan ke pertemuan dilepas, nilai tugas aman)'],
    [im.notes, 'catatan khusus berasal dari pertemuan ini', 'tetap ada (tautan pertemuan asal dilepas)'],
  ].filter(r => r[0] > 0);
  return (
    <Confirm danger title="Hapus pertemuan secara permanen?" confirmLabel="Hapus Permanen" onClose={onClose}
      message={<>Anda akan menghapus <b>Pertemuan {meeting.number}</b> kelas <b>{cls ? cls.name : '—'}</b> pada <b>{L.fmtDate(meeting.date)}</b>. Tindakan ini tidak dapat dibatalkan.</>}
      details={rows.length ? <div className="alert warn"><Icon n="alert" s={16} /><div><b>Data terhubung:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{rows.map(r => <li key={r[1]}>{r[0]} {r[1]} — {r[2]}</li>)}</ul><div className="tiny" style={{ marginTop: 6 }}>Semua dihapus dalam satu transaksi database: berhasil seluruhnya atau tidak sama sekali. Rekap & dashboard dihitung ulang otomatis.</div></div></div>
        : <div className="alert info"><Icon n="info" s={16} /><div>Pertemuan ini belum memiliki data absensi atau nilai.</div></div>}
      onConfirm={async () => {
        try {
          const out = await api.rpc('delete_meeting', { p_meeting_id: meeting.id });
          toast(`Pertemuan ${meeting.number} dihapus${out && out.attendance ? ` beserta ${out.attendance} absensi` : ''}.`);
          onDeleted && onDeleted();
        } catch (e) { toast(DB.friendlyError(e) + ' Data tidak berubah.', 'err'); throw e; }
      }} />
  );
}

function ClassDeleteConfirm({ cls, onClose }) {
  const { data, api } = useApp(); const toast = useToast();
  const nStud = data.students.filter(s => s.class_id === cls.id).length;
  const nMeet = data.meetings.filter(m => m.class_id === cls.id).length;
  const nNote = data.student_notes.filter(n => n.class_id === cls.id).length;
  const blocked = nStud + nMeet + nNote > 0;
  const nAsg = data.assignments.filter(a => a.class_id === cls.id).length;
  const nTgt = data.memorization_targets.filter(t => t.class_id === cls.id).length;
  return (
    <Confirm danger title={blocked ? 'Kelas tidak dapat dihapus' : 'Hapus kelas permanen?'} confirmLabel="Hapus Permanen" onClose={onClose} disabled={blocked} typeToConfirm={blocked ? null : cls.name}
      message={blocked ? <>Kelas <b>{cls.name}</b> masih memiliki data. Agar riwayat akademik siswa tidak rusak, kelas yang berisi data tidak dihapus otomatis.</> : <>Kelas <b>{cls.name}</b> kosong dan akan dihapus permanen.</>}
      details={blocked ? <div className="alert warn"><Icon n="alert" s={16} /><div><ul style={{ margin: 0, paddingLeft: 18 }}>{nStud > 0 && <li>{nStud} siswa — pindahkan ke kelas lain melalui Data Siswa</li>}{nMeet > 0 && <li>{nMeet} pertemuan — hapus satu per satu di Riwayat Pertemuan</li>}{nNote > 0 && <li>{nNote} catatan khusus</li>}</ul><div style={{ marginTop: 6 }}>Alternatif yang aman: <b>Arsipkan</b> kelas — data tetap tersimpan dan kelas disembunyikan.</div></div></div>
        : (nAsg + nTgt > 0 ? <div className="alert info"><Icon n="info" s={16} /><div>{nTgt} target hafalan dan {nAsg} tugas tanpa nilai milik kelas ini juga dihapus.</div></div> : null)}
      onConfirm={async () => {
        try { await api.rpc('delete_class', { p_class_id: cls.id }); toast('Kelas ' + cls.name + ' dihapus.'); }
        catch (e) { toast(DB.friendlyError(e), 'err'); throw e; }
      }} />
  );
}

function StudentDeleteConfirm({ student, onClose, onDeleted }) {
  const { data, api } = useApp(); const toast = useToast();
  const hist = ['attendance_records', 'memorization_records', 'activity_records', 'assignment_records', 'student_notes', 'semester_exemption_reviews'].reduce((a, t) => a + data[t].filter(r => r.student_id === student.id).length, 0);
  return (
    <Confirm danger title={hist ? 'Siswa tidak dapat dihapus' : 'Hapus siswa permanen?'} confirmLabel="Hapus Permanen" onClose={onClose} disabled={hist > 0}
      message={hist ? <><b>{student.full_name}</b> memiliki {hist} catatan riwayat (absensi, nilai, atau catatan khusus). Riwayat akademik tidak dihapus otomatis.</> : <><b>{student.full_name}</b> belum memiliki riwayat apa pun dan akan dihapus permanen. Gunakan ini untuk data yang salah input.</>}
      details={hist ? <div className="alert info"><Icon n="archive" s={16} /><div>Gunakan <b>Arsipkan</b> agar siswa tidak muncul di absensi sementara riwayatnya tetap aman.</div></div> : null}
      onConfirm={async () => {
        try { await api.remove('students', student.id, 'Hapus siswa ' + student.full_name); toast(student.full_name + ' dihapus.'); onDeleted && onDeleted(); }
        catch (e) { toast(DB.friendlyError(e), 'err'); throw e; }
      }} />
  );
}

Object.assign(window, { MeetingEditModal, MeetingDeleteConfirm, ClassDeleteConfirm, StudentDeleteConfirm, meetingImpact });
