// Perkembangan siswa — catatan perkembangan yang tersimpan di Supabase.
function PerkembanganPage() {
  const { data, api, ctx } = useApp();
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [category, setCategory] = useState('akademik');
  const [content, setContent] = useState('');
  const [followUp, setFollowUp] = useState('none');
  const [sensitive, setSensitive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const classes = data.classes.filter(c => !c.archived).sort((a,b) => a.name.localeCompare(b.name));
  const students = data.students.filter(s => s.status === 'aktif' && (!classId || s.class_id === classId)).sort((a,b) => a.full_name.localeCompare(b.full_name));
  const notes = (data.student_progress_notes || []).filter(n => {
    const st = data.students.find(s => s.id === n.student_id);
    return (!classId || n.class_id === classId) && (!filter || ((st && st.full_name) || '').toLowerCase().includes(filter.toLowerCase()) || (n.content || '').toLowerCase().includes(filter.toLowerCase()));
  }).sort((a,b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''));

  const save = async () => {
    if (!studentId) { toast('Pilih siswa terlebih dahulu.', 'err'); return; }
    if (content.trim().length < 2) { toast('Catatan minimal 2 karakter.', 'err'); return; }
    const student = data.students.find(s => s.id === studentId);
    if (!student) { toast('Data siswa tidak ditemukan. Muat ulang data.', 'err'); return; }
    setBusy(true);
    try {
      await api.insert('student_progress_notes', [{
        student_id: studentId, class_id: student.class_id || null, semester_id: ctx.sem?.id || null,
        date: L.today(), category, content: content.trim(), follow_up: followUp, sensitive
      }], 'Tambah catatan perkembangan siswa');
      setContent(''); setFollowUp('none'); toast('Catatan perkembangan berhasil disimpan.');
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
    finally { setBusy(false); }
  };

  return <div className="col" style={{gap:16}}>
    <PageHead title="Perkembangan Siswa" sub="Catat perkembangan akademik, kedisiplinan, prestasi, dan tindak lanjut siswa." />
    {data.student_progress_notes === undefined ? <div className="alert warn">Fitur ini membutuhkan migrasi database 0003 (student_progress_notes). Pastikan migrasi ketiga sudah dijalankan di Supabase, lalu muat ulang aplikasi.</div> : <>
      <section className="card card-pad">
        <h3 style={{marginTop:0,marginBottom:12}}>Tambah catatan perkembangan</h3>
        <div className="fg">
          <label className="field"><span className="label">Kelas</span><select className="select" value={classId} onChange={e=>{setClassId(e.target.value);setStudentId('')}}><option value="">Semua kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field"><span className="label">Siswa</span><select className="select" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Pilih siswa</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>
          <label className="field"><span className="label">Kategori</span><select className="select" value={category} onChange={e=>setCategory(e.target.value)}>{[['akademik','Akademik'],['kedisiplinan','Kedisiplinan'],['keterlambatan','Keterlambatan'],['prestasi','Prestasi'],['tindak_lanjut','Tindak lanjut'],['catatan','Catatan umum']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="field"><span className="label">Tindak lanjut</span><select className="select" value={followUp} onChange={e=>setFollowUp(e.target.value)}><option value="none">Tidak ada</option><option value="perlu">Perlu ditindaklanjuti</option><option value="proses">Sedang diproses</option><option value="selesai">Selesai</option></select></label>
        </div>
        <label className="field" style={{marginTop:12}}><span className="label">Catatan</span><textarea className="input" rows="3" value={content} onChange={e=>setContent(e.target.value)} placeholder="Tuliskan perkembangan siswa secara jelas..." /></label>
        <label className="row small" style={{gap:8,marginTop:10,alignItems:'center'}}><input type="checkbox" checked={sensitive} onChange={e=>setSensitive(e.target.checked)} /> Catatan sensitif (jangan disertakan pada dokumen cetak publik)</label>
        <div className="row" style={{justifyContent:'flex-end',marginTop:12}}><button className="btn btn-dark" disabled={busy} onClick={save}>{busy?'Menyimpan…':'Simpan catatan'}</button></div>
      </section>
      <section className="card card-pad">
        <div className="row between wrap" style={{gap:10,marginBottom:12}}><h3 style={{margin:0}}>Riwayat catatan</h3><input className="input" style={{maxWidth:280}} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Cari siswa atau catatan..." /></div>
        {!notes.length ? <Empty icon="trend" title="Belum ada catatan" text="Catatan perkembangan yang disimpan akan muncul di sini." /> :
          <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Tanggal</th><th>Siswa</th><th>Kategori</th><th>Catatan</th><th>Tindak lanjut</th></tr></thead><tbody>{notes.map(n=>{const st=data.students.find(s=>s.id===n.student_id);return <tr key={n.id}><td>{L.fmtDate(n.date,false)}</td><td>{st?.full_name || 'Siswa tidak ditemukan'}</td><td>{n.category}</td><td style={{minWidth:220,whiteSpace:'pre-wrap'}}>{n.content}{n.sensitive && <div className="tiny muted">Catatan sensitif</div>}</td><td>{({none:'—',perlu:'Perlu',proses:'Diproses',selesai:'Selesai'})[n.follow_up] || n.follow_up}</td></tr>})}</tbody></table></div>}
      </section>
    </>}
  </div>;
}
