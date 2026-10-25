// Bebas Semester — pengaturan ambang kelulusan dan daftar hasil peninjauan.
function BebasPage() {
  const { data, api, ctx } = useApp();
  const toast = useToast();
  const sem = ctx.sem;
  const [form, setForm] = useState({ min_attendance:95, min_memorization:80, min_assignment:0, min_activity:0, use_assignment:false, use_activity:false, extra_requirements:'' });
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState('');
  const rules = (data.semester_exemption_rules || []).find(r => r.semester_id === sem?.id);
  useEffect(() => {
    if (!sem?.id || loadedFor === sem.id) return;
    const r = (data.semester_exemption_rules || []).find(x => x.semester_id === sem.id);
    setForm(r ? { min_attendance:r.min_attendance ?? 95, min_memorization:r.min_memorization ?? 80, min_assignment:r.min_assignment ?? 0, min_activity:r.min_activity ?? 0, use_assignment:!!r.use_assignment, use_activity:!!r.use_activity, extra_requirements:r.extra_requirements || '', use_memorization:r.use_memorization !== false } : { min_attendance:95, min_memorization:80, min_assignment:0, min_activity:0, use_assignment:false, use_activity:false, use_memorization:true, extra_requirements:'' });
    setLoadedFor(sem.id);
  }, [sem?.id, data.semester_exemption_rules, loadedFor]);

  const save = async () => {
    if (!sem?.id) { toast('Semester aktif belum tersedia.', 'err'); return; }
    const numberFields = ['min_attendance','min_memorization','min_assignment','min_activity'];
    for (const k of numberFields) if (!Number.isInteger(Number(form[k])) || Number(form[k]) < 0 || Number(form[k]) > 100) { toast('Persentase harus berupa bilangan bulat 0–100.', 'err'); return; }
    setBusy(true);
    try {
      const payload = { ...form, semester_id:sem.id, min_attendance:Number(form.min_attendance), min_memorization:Number(form.min_memorization), min_assignment:Number(form.min_assignment), min_activity:Number(form.min_activity) };
      if (rules) await api.update('semester_exemption_rules', rules.id, payload, 'Ubah aturan Bebas Semester');
      else await api.insert('semester_exemption_rules', [payload], 'Buat aturan Bebas Semester');
      toast('Aturan Bebas Semester berhasil disimpan.');
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
    finally { setBusy(false); }
  };
  const reviews = (data.semester_exemption_reviews || []).filter(r => r.semester_id === sem?.id).sort((a,b)=>(b.reviewed_at||'').localeCompare(a.reviewed_at||''));
  const students = data.students || [];
  const pctField = (key,label) => <label className="field" key={key}><span className="label">{label} (%)</span><input className="input" type="number" min="0" max="100" step="1" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></label>;

  return <div className="col" style={{gap:16}}>
    <PageHead title="Bebas Semester" sub={`Atur kriteria dan lihat hasil peninjauan siswa · Semester ${sem?.name || '—'} ${ctx.year?.name || ''}`} />
    <section className="card card-pad">
      <h3 style={{marginTop:0}}>Kriteria Bebas Semester</h3>
      <p className="muted small">Aturan ini disimpan untuk semester aktif. Pengaturan tidak otomatis menetapkan siswa bebas semester; penetapan harus ditinjau dan dicatat secara terpisah.</p>
      <div className="fg">{pctField('min_attendance','Kehadiran minimum')}{pctField('min_memorization','Hafalan minimum')}{pctField('min_assignment','Tugas minimum')}{pctField('min_activity','Keaktifan minimum')}</div>
      <div className="col" style={{gap:8,marginTop:12}}>
        <label className="row small" style={{gap:8}}><input type="checkbox" checked={!!form.use_memorization} onChange={e=>setForm(f=>({...f,use_memorization:e.target.checked}))}/> Gunakan kriteria hafalan</label>
        <label className="row small" style={{gap:8}}><input type="checkbox" checked={!!form.use_assignment} onChange={e=>setForm(f=>({...f,use_assignment:e.target.checked}))}/> Gunakan kriteria tugas</label>
        <label className="row small" style={{gap:8}}><input type="checkbox" checked={!!form.use_activity} onChange={e=>setForm(f=>({...f,use_activity:e.target.checked}))}/> Gunakan kriteria keaktifan</label>
      </div>
      <label className="field" style={{marginTop:12}}><span className="label">Persyaratan tambahan</span><textarea className="input" rows="2" value={form.extra_requirements || ''} onChange={e=>setForm(f=>({...f,extra_requirements:e.target.value}))} placeholder="Persyaratan tambahan (opsional)" /></label>
      <div className="row" style={{justifyContent:'flex-end',marginTop:12}}><button className="btn btn-dark" disabled={busy} onClick={save}>{busy?'Menyimpan…':'Simpan aturan'}</button></div>
    </section>
    <section className="card card-pad">
      <h3 style={{marginTop:0}}>Riwayat peninjauan</h3>
      {!reviews.length ? <Empty icon="award" title="Belum ada hasil peninjauan" text="Hasil peninjauan yang tercatat untuk semester ini akan muncul di sini."/> :
      <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Siswa</th><th>Kelas</th><th>Status</th><th>Catatan</th><th>Tanggal</th></tr></thead><tbody>{reviews.map(r=>{const st=students.find(s=>s.id===r.student_id);const cl=st&&data.classes.find(c=>c.id===st.class_id);return <tr key={r.id}><td>{st?.full_name || 'Siswa tidak ditemukan'}</td><td>{cl?.name || '—'}</td><td>{r.status}</td><td>{r.note || '—'}</td><td>{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString('id-ID') : '—'}</td></tr>})}</tbody></table></div>}
    </section>
  </div>;
}
