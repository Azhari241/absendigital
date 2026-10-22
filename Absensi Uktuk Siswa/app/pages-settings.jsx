// Kumpulan Materi & Pengaturan
function MateriPage() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [lv, setLv] = useState(''); const [semId, setSemId] = useState(ctx.sem.id); const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); const [del, setDel] = useState(null);
  const sems = data.semesters.filter(s => s.academic_year_id === ctx.year.id);
  const list = data.learning_materials.filter(m => (!lv || m.level === lv) && (!semId || m.semester_id === semId) && (!q || (m.title + ' ' + m.description).toLowerCase().includes(q.toLowerCase())));
  const host = u => { try { return new URL(u).hostname.replace('www.', ''); } catch { return u; } };
  const kind = u => /docs\.google\.com\/presentation/.test(u) ? 'Slides' : /docs\.google\.com\/document/.test(u) ? 'Docs' : /docs\.google\.com\/spreadsheets/.test(u) ? 'Sheets' : /drive\.google/.test(u) ? 'Drive' : /youtu/.test(u) ? 'Video' : 'Website';
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead>
        <div className="search" style={{ width: 220 }}><Icon n="search" s={15} /><input className="input" placeholder="Cari materi…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 'auto' }} value={lv} onChange={e => setLv(e.target.value)}><option value="">Semua tingkat</option>{L.LEVELS.map(l => <option key={l} value={l}>Kelas {l}</option>)}</select>
        <select className="select" style={{ width: 'auto' }} value={semId} onChange={e => setSemId(e.target.value)}><option value="">Semua semester</option>{sems.map(s => <option key={s.id} value={s.id}>Semester {s.name}</option>)}</select>
        <button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tambah materi</button>
      </PageHead>
      {!list.length ? <div className="card"><Empty icon="folder" title={q || lv ? 'Tidak ada materi yang cocok' : 'Belum ada materi'} text="Simpan tautan Google Drive, Docs, Slides, atau website untuk setiap tingkat kelas." action={<button className="btn btn-dark" onClick={() => setModal({})}><Icon n="plus" s={15} />Tambah materi</button>} /></div> :
        L.LEVELS.filter(l => list.some(m => m.level === l)).map(l => (
          <div key={l} className="col" style={{ gap: 10 }}>
            <b>Kelas {l}</b>
            <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
              {list.filter(m => m.level === l).map(m => (
                <div key={m.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="row between"><span className="badge">{kind(m.url)}</span><span className="tiny muted">Semester {(data.semesters.find(s => s.id === m.semester_id) || {}).name || '—'}</span></div>
                  <b>{m.title}</b>
                  {m.description && <p className="small muted tw-pretty" style={{ lineHeight: 1.5 }}>{m.description}</p>}
                  <span className="tiny muted mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host(m.url)}</span>
                  <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
                    <a className="btn btn-sm" href={m.url} target="_blank" rel="noopener noreferrer"><Icon n="ext" s={13} />Buka</a>
                    <button className="btn btn-sm btn-icon" onClick={() => setModal(m)} aria-label="Edit"><Icon n="edit" s={13} /></button>
                    <button className="btn btn-sm btn-icon btn-danger" onClick={() => setDel(m)} aria-label="Hapus"><Icon n="trash" s={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      {modal && <MaterialModal m={modal.id ? modal : null} defLevel={lv} onClose={() => setModal(null)} />}
      {del && <Confirm title="Hapus materi?" danger message={`"${del.title}" akan dihapus dari daftar. File asli di Google Drive tidak terpengaruh.`} confirmLabel="Hapus" onClose={() => setDel(null)} onConfirm={async () => { try { await api.remove('learning_materials', del.id, 'Hapus materi ' + del.title); toast('Materi dihapus.'); } catch (e) { toast(DB.friendlyError(e), 'err'); throw e; } }} />}
    </div>
  );
}
function MaterialModal({ m, defLevel, onClose }) {
  const { data, api, ctx } = useApp(); const toast = useToast();
  const [f, setF] = useState(m ? { ...m } : { level: defLevel || 'VII', semester_id: ctx.sem.id, title: '', description: '', url: '' });
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false);
  const save = async () => {
    const e = {};
    if (f.title.trim().length < 2) e.title = 'Judul wajib diisi.';
    let ok = false; try { const u = new URL(f.url.trim()); ok = u.protocol === 'https:' || u.protocol === 'http:'; } catch { }
    if (!ok) e.url = 'Masukkan tautan lengkap yang diawali https://';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    const row = { level: f.level, semester_id: f.semester_id || null, title: f.title.trim(), description: (f.description || '').trim(), url: f.url.trim() };
    try { if (m) await api.update('learning_materials', m.id, row, 'Ubah materi'); else await api.insert('learning_materials', [row], 'Tambah materi'); toast('Materi tersimpan.'); onClose(); }
    catch (e2) { toast(DB.friendlyError(e2), 'err'); setBusy(false); }
  };
  return (
    <Modal title={m ? 'Edit materi' : 'Tambah materi'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan</button></>}>
      <div className="fg">
        <Field label="Judul" error={err.title} className="full"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Tingkat kelas"><select className="select" value={f.level} onChange={e => setF({ ...f, level: e.target.value })}>{L.LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
        <Field label="Semester"><select className="select" value={f.semester_id || ''} onChange={e => setF({ ...f, semester_id: e.target.value })}>{data.semesters.filter(s => s.academic_year_id === ctx.year.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Tautan (Google Drive, Docs, Slides, website)" error={err.url} className="full"><input className="input" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://docs.google.com/…" inputMode="url" /></Field>
        <Field label="Deskripsi" className="full"><textarea className="textarea" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function PengaturanPage({ params }) {
  const [tab, setTab] = useState(params.tab || 'modul');
  return (
    <div className="col" style={{ gap: 16, maxWidth: 900 }}>
      <div className="tabs">{[['modul', 'Modul'], ['akademik', 'Tahun ajaran & semester'], ['nilai', 'Ambang batas & laporan'], ['profil', 'Profil & identitas'], ['akun', 'Akun & server'], ['audit', 'Log aktivitas']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'modul' && <ModulSettings />}
      {tab === 'akademik' && <AkademikSettings />}
      {tab === 'nilai' && <NilaiSettings />}
      {tab === 'profil' && <ProfilSettings />}
      {tab === 'akun' && <AkunSettings />}
      {tab === 'audit' && <AuditLog />}
    </div>
  );
}
function ModulSettings() {
  const { ctx, api, data } = useApp(); const toast = useToast();
  const [busy, setBusy] = useState(null);
  const st = ctx.settings;
  const toggle = async (k, v) => {
    setBusy(k);
    try {
      if (st.id) await api.update('module_settings', st.id, { [k]: v }, `Modul ${k} ${v ? 'diaktifkan' : 'dinonaktifkan'}`);
      else await api.insert('module_settings', [{ absensi: true, hafalan: true, tugas: true, keaktifan: true, bebas_semester: false, attendance_threshold: 80, passing_grade: 75, activity_scale_max: 5, report_prefs: {}, [k]: v }]);
      toast(`Modul ${v ? 'diaktifkan' : 'dinonaktifkan'} — tersimpan di server.`);
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(null);
  };
  const count = { hafalan: data.memorization_records.length, tugas: data.assignments.length, keaktifan: data.activity_records.length, bebas_semester: data.semester_exemption_reviews.length };
  const mods = [
    { k: 'absensi', l: 'Absensi', d: 'Kehadiran siswa per pertemuan. Wajib aktif.', locked: true, i: 'calCheck' },
    { k: 'hafalan', l: 'Hafalan', d: 'Target, setor, nilai, dan status Bebas Setor.', i: 'book' },
    { k: 'tugas', l: 'Tugas / PR', d: 'Tugas, tenggat, pengumpulan, dan penilaian.', i: 'clip' },
    { k: 'keaktifan', l: 'Keaktifan', d: 'Nilai partisipasi per pertemuan.', i: 'star' },
    { k: 'bebas_semester', l: 'Bebas Semester', d: 'Kelayakan bebas ujian semester berdasarkan kriteria.', i: 'award' },
  ];
  return (
    <div className="card">
      <div className="card-h"><h3>Modul aktif</h3></div>
      {mods.map(m => (
        <div key={m.k} className="list-i" style={{ padding: '14px 18px' }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: st[m.k] ? 'var(--tealbg)' : '#f1f2f4', color: st[m.k] ? 'var(--teal)' : 'var(--mute)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon n={m.i} s={17} /></span>
          <div className="col grow" style={{ gap: 2 }}>
            <div className="row" style={{ gap: 8 }}><b>{m.l}</b>{m.locked && <span className="badge">Wajib</span>}</div>
            <span className="small muted">{m.d}</span>
            {!st[m.k] && count[m.k] > 0 && <span className="tiny" style={{ color: 'var(--teal)' }}>{count[m.k]} data historis tetap tersimpan</span>}
          </div>
          {busy === m.k ? <span className="spin" /> : <Toggle on={!!st[m.k]} disabled={m.locked} onChange={v => toggle(m.k, v)} label={m.l} />}
        </div>
      ))}
      <div style={{ padding: 16 }}><div className="alert info"><Icon n="shield" s={16} /><div>Menonaktifkan modul hanya menyembunyikan menu, kolom, dan kartu terkait di semua perangkat. Tidak ada tabel, nilai, atau catatan historis yang dihapus — aktifkan kembali kapan saja.</div></div></div>
    </div>
  );
}
function AkademikSettings() {
  const { data, ctx, api } = useApp(); const toast = useToast();
  const [ny, setNy] = useState(''); const [busy, setBusy] = useState(false);
  const activate = async (yearId, semId) => {
    setBusy(true);
    try {
      for (const y of data.academic_years) if (y.is_active !== (y.id === yearId)) await api.update('academic_years', y.id, { is_active: y.id === yearId });
      for (const s of data.semesters) if (s.is_active !== (s.id === semId)) await api.update('semesters', s.id, { is_active: s.id === semId });
      await api.audit('ubah', 'semesters', semId, { info: 'Semester aktif diganti' });
      toast('Semester aktif diperbarui.');
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  const addYear = async () => {
    if (!/^\d{4}\/\d{4}$/.test(ny) || +ny.slice(5) !== +ny.slice(0, 4) + 1) return toast('Format tahun ajaran: 2027/2028', 'err');
    if (data.academic_years.some(y => y.name === ny)) return toast('Tahun ajaran sudah ada.', 'err');
    setBusy(true);
    try { const [y] = await api.insert('academic_years', [{ name: ny, is_active: false }], 'Tahun ajaran ' + ny); await api.insert('semesters', [{ academic_year_id: y.id, name: 'Ganjil', is_active: false }, { academic_year_id: y.id, name: 'Genap', is_active: false }]); setNy(''); toast('Tahun ajaran ditambahkan.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  return (
    <div className="card">
      <div className="card-h"><h3>Tahun ajaran & semester</h3>{busy && <span className="spin" />}</div>
      {[...data.academic_years].sort((a, b) => a.name < b.name ? 1 : -1).map(y => (
        <div key={y.id} className="list-i" style={{ padding: '12px 18px', flexWrap: 'wrap' }}>
          <b className="grow">{y.name}</b>
          {data.semesters.filter(s => s.academic_year_id === y.id).sort((a, b) => a.name === 'Ganjil' ? -1 : 1).map(s => {
            const on = ctx.sem.id === s.id;
            return <button key={s.id} className={'chip ' + (on ? 'on' : '')} style={{ '--c': 'var(--teal)' }} disabled={busy} onClick={() => !on && activate(y.id, s.id)}>{on ? '✓ ' : ''}Semester {s.name}</button>;
          })}
        </div>
      ))}
      <div className="row wrap" style={{ padding: 16, gap: 8, borderTop: '1px solid var(--line2)' }}>
        <input className="input" style={{ width: 160 }} placeholder="2027/2028" value={ny} onChange={e => setNy(e.target.value)} />
        <button className="btn" disabled={busy} onClick={addYear}><Icon n="plus" s={14} />Tambah tahun ajaran</button>
        <p className="tiny muted" style={{ width: '100%' }}>Mengganti semester aktif mengubah filter seluruh halaman. Data semester lain tetap tersimpan.</p>
      </div>
    </div>
  );
}
function NilaiSettings() {
  const { ctx, api } = useApp(); const toast = useToast(); const { go } = useNav();
  const st = ctx.settings;
  const [f, setF] = useState({ attendance_threshold: st.attendance_threshold, passing_grade: st.passing_grade, activity_scale_max: st.activity_scale_max, show_signature: (st.report_prefs || {}).show_signature !== false, orientation: (st.report_prefs || {}).orientation || 'portrait' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!(+f.attendance_threshold >= 0 && +f.attendance_threshold <= 100) || !(+f.passing_grade >= 0 && +f.passing_grade <= 100)) return toast('Nilai harus 0–100.', 'err');
    if (!(+f.activity_scale_max >= 1 && +f.activity_scale_max <= 100)) return toast('Skala keaktifan 1–100.', 'err');
    setBusy(true);
    try { await api.update('module_settings', st.id, { attendance_threshold: +f.attendance_threshold, passing_grade: +f.passing_grade, activity_scale_max: +f.activity_scale_max, report_prefs: { ...(st.report_prefs || {}), show_signature: f.show_signature, orientation: f.orientation } }, 'Ubah ambang batas'); toast('Pengaturan tersimpan.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  return (
    <div className="card card-pad col" style={{ gap: 16 }}>
      <div className="fg">
        <Field label="Ambang batas kehadiran (%)" hint="Siswa di bawah angka ini masuk Perlu Perhatian."><input type="number" className="input" value={f.attendance_threshold} onChange={e => setF({ ...f, attendance_threshold: e.target.value })} /></Field>
        <Field label="Nilai ketuntasan / KKM" hint="Nilai hafalan/tugas di bawah KKM masuk kategori Remedial."><input type="number" className="input" value={f.passing_grade} onChange={e => setF({ ...f, passing_grade: e.target.value })} /></Field>
        <Field label="Skala maksimum keaktifan" hint="mis. 5 untuk skala 0–5, atau 100."><input type="number" className="input" value={f.activity_scale_max} onChange={e => setF({ ...f, activity_scale_max: e.target.value })} /></Field>
        <Field label="Kriteria Bebas Semester"><button className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => go('bebas')} disabled={!st.bebas_semester}><Icon n="award" s={15} />{st.bebas_semester ? 'Atur di halaman Bebas Semester' : 'Aktifkan modul terlebih dahulu'}</button></Field>
      </div>
      <div className="row" style={{ gap: 10 }}><Toggle on={f.show_signature} onChange={v => setF({ ...f, show_signature: v })} label="Tanda tangan" /><span className="small">Tampilkan kolom tanda tangan guru pada laporan cetak</span></div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan</button></div>
    </div>
  );
}
function ProfilSettings() {
  const { ctx, api, user } = useApp(); const toast = useToast();
  const p = ctx.profile;
  const [f, setF] = useState({ full_name: p.full_name || '', teacher_subject: p.teacher_subject || '', school_name: p.school_name || '', school_address: p.school_address || '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.full_name.trim().length < 2) return toast('Nama wajib diisi.', 'err');
    setBusy(true);
    try { await api.update('profiles', p.id, { full_name: f.full_name.trim(), teacher_subject: f.teacher_subject.trim(), school_name: f.school_name.trim(), school_address: f.school_address.trim() }, 'Ubah profil'); toast('Profil tersimpan.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
    setBusy(false);
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card card-pad col" style={{ gap: 16 }}>
      <div className="fg">
        <Field label="Nama guru"><input className="input" value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label="Mata pelajaran"><input className="input" value={f.teacher_subject} onChange={set('teacher_subject')} /></Field>
        <Field label="Nama sekolah"><input className="input" value={f.school_name} onChange={set('school_name')} /></Field>
        <Field label="Alamat sekolah"><input className="input" value={f.school_address} onChange={set('school_address')} /></Field>
        <Field label="Email akun"><input className="input" value={user.email} disabled /></Field>
        <Field label="Terdaftar sejak"><input className="input" value={p.created_at ? L.fmtDate(p.created_at.slice(0, 10), false) : '—'} disabled /></Field>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-dark" disabled={busy} onClick={save}>{busy && <span className="spin" />}Simpan profil</button></div>
    </div>
  );
}
function AkunSettings() {
  const { backend, user, onLogout } = useApp(); const toast = useToast();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const server = DB.getServer();
  const change = async () => {
    setErr(''); const miss = pwPolicy(pw);
    if (miss.length) return setErr('Kata sandi perlu: ' + miss.join(', ') + '.');
    if (pw !== pw2) return setErr('Konfirmasi tidak sama.');
    setBusy(true);
    try { const { error } = await backend.client.auth.updateUser({ password: pw }); if (error) throw error; setPw(''); setPw2(''); toast('Kata sandi diperbarui.'); }
    catch (e) { setErr(DB.friendlyError(e)); }
    setBusy(false);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card card-pad col" style={{ gap: 12 }}>
        <b>Server</b>
        {backend.kind === 'demo' ? <div className="alert warn"><Icon n="zap" s={16} /><div>Anda sedang di <b>mode demo</b>. Data hanya tersimpan di browser ini. Keluar lalu gunakan "Ganti server" untuk menghubungkan Supabase.</div></div>
          : <div className="row small" style={{ gap: 8 }}><Icon n="server" s={15} /><span className="mono">{server && server.url}</span><span className="badge teal">Terhubung</span></div>}
        <p className="tiny muted">Untuk mengganti server, keluar terlebih dahulu lalu pilih "Ganti server" di halaman masuk. Data di server lama tidak dihapus.</p>
      </div>
      {backend.kind === 'supabase' && <div className="card card-pad col" style={{ gap: 12 }}>
        <b>Ganti kata sandi</b>
        {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
        <div className="fg">
          <Field label="Kata sandi baru"><input type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Konfirmasi"><input type="password" className="input" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-dark" disabled={busy} onClick={change}>{busy && <span className="spin" />}Perbarui kata sandi</button></div>
      </div>}
      <div className="card card-pad row between"><div className="col"><b>Keluar</b><span className="small muted">{user.email}</span></div><button className="btn btn-danger" onClick={onLogout}><Icon n="logout" s={15} />Keluar</button></div>
    </div>
  );
}
function AuditLog() {
  const { data } = useApp();
  const logs = [...data.audit_logs].sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, 100);
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h"><h3>Log aktivitas</h3><span className="tiny muted">100 terakhir · tidak dapat diubah</span></div>
      {logs.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Waktu</th><th>Aksi</th><th>Data</th><th>Keterangan</th></tr></thead><tbody>{logs.map(l => <tr key={l.id}><td className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td><td><span className="badge">{l.action}</span></td><td className="mono tiny">{l.entity}</td><td className="small">{(l.detail && (l.detail.info || l.detail.note)) || ''}</td></tr>)}</tbody></table></div> : <Empty title="Belum ada aktivitas" />}
    </div>
  );
}

Object.assign(window, { MateriPage, PengaturanPage });
