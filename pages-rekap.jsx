// Rekap Kehadiran, Riwayat Pertemuan, Perlu Perhatian, Laporan
function periodRange(period, anchor) {
  const t = anchor || L.today();
  if (period === 'harian') return [t, t];
  if (period === 'mingguan') { const s = L.weekStart(t); return [s, L.addDays(s, 6)]; }
  if (period === 'bulanan') { const d = L.parse(t); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [t.slice(0, 8) + '01', L.ymd(e)]; }
  return [null, null];
}
function reportMeta(ctx, extra) {
  return { school: ctx.profile.school_name, address: ctx.profile.school_address, teacher: ctx.profile.full_name, subject: ctx.profile.teacher_subject, sub: `Semester ${ctx.sem.name} ${ctx.year.name}${extra ? ' · ' + extra : ''}` };
}

function RekapPage() {
  const { data, ctx } = useApp(); const toast = useToast();
  const [cid, setCid, classes] = useClassPicker();
  const [period, setPeriod] = useState('semester');
  const [anchor, setAnchor] = useState(L.today());
  const [from0, to0] = periodRange(period, anchor);
  const [cFrom, setCFrom] = useState(''); const [cTo, setCTo] = useState('');
  const from = period === 'custom' ? cFrom || null : from0, to = period === 'custom' ? cTo || null : to0;
  if (!classes.length) return <NoClasses />;
  const cls = data.classes.find(c => c.id === cid);
  const ms = L.sortMeetings(L.scopeMeetings(data, { classIds: [cid], semId: ctx.sem.id, from, to }));
  const students = data.students.filter(s => s.class_id === cid && s.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const att = L.recordsFor('attendance_records', data, ms);
  const tot = L.attCounts(att);
  const rows = students.map(s => ({ s, c: L.attCounts(att.filter(r => r.student_id === s.id)) }));
  const label = period === 'semester' ? 'Semester' : from === to ? L.fmtDate(from) : `${L.fmtDate(from, false)} – ${L.fmtDate(to, false)}`;
  const header = ['No', 'Nama', 'L/P', ...ms.map(m => 'P' + m.number), ...L.ATT.map(a => a.short), 'Hadir %'];
  const dataRows = rows.map(({ s, c }, i) => [i + 1, s.full_name, s.gender, ...ms.map(m => { const r = att.find(x => x.meeting_id === m.id && x.student_id === s.id); return r ? L.ATT_MAP[r.status].short : '-'; }), ...L.ATT.map(a => c[a.k]), c.pct == null ? '-' : c.pct + '%']);
  const ex = type => {
    try {
      const name = `rekap-kehadiran-${cls.name}-${period}`;
      if (type === 'csv') L.exportCSV(name, header, dataRows);
      else L.exportXLSX(name, [{ name: 'Rekap ' + cls.name, header, rows: dataRows }], { title: 'Rekap Kehadiran ' + cls.name + ' — ' + label, school: ctx.profile.school_name || '', sub: `Semester ${ctx.sem.name} ${ctx.year.name} · Guru: ${ctx.profile.full_name || ''}` });
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
  };
  const print = () => L.printReport({ title: 'Rekap Kehadiran ' + cls.name, meta: reportMeta(ctx, label), header: ['No', 'Nama', 'L/P', ...L.ATT.map(a => a.label), 'Hadir %'], rows: rows.map(({ s, c }, i) => [i + 1, s.full_name, s.gender, ...L.ATT.map(a => c[a.k]), L.fmtPct(c.pct)]), foot: ['', 'Jumlah', '', ...L.ATT.map(a => tot[a.k]), L.fmtPct(tot.pct)] });
  const shift = d => { const n = period === 'harian' ? 1 : period === 'mingguan' ? 7 : 0; if (period === 'bulanan') { const x = L.parse(anchor); x.setMonth(x.getMonth() + d); setAnchor(L.ymd(x)); } else setAnchor(L.addDays(anchor, n * d)); };
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="toolbar">
          <ClassSelect value={cid} onChange={setCid} classes={classes} />
          <select className="select" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="harian">Harian</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option><option value="semester">Semester</option><option value="custom">Rentang tanggal</option>
          </select>
          {['harian', 'mingguan', 'bulanan'].includes(period) && <div className="row" style={{ gap: 4 }}><button className="btn btn-icon btn-sm" onClick={() => shift(-1)} aria-label="Sebelumnya"><Icon n="chevL" s={15} /></button><input type="date" className="input input-sm" style={{ width: 150 }} value={anchor} onChange={e => e.target.value && setAnchor(e.target.value)} /><button className="btn btn-icon btn-sm" onClick={() => shift(1)} aria-label="Berikutnya"><Icon n="chevR" s={15} /></button></div>}
          {period === 'custom' && <div className="row" style={{ gap: 4 }}><input type="date" className="input input-sm" value={cFrom} onChange={e => setCFrom(e.target.value)} /><span className="muted">–</span><input type="date" className="input input-sm" value={cTo} onChange={e => setCTo(e.target.value)} /></div>}
        </div>
        <div className="toolbar">
          <button className="btn" onClick={print} disabled={!ms.length}><Icon n="print" s={15} />Cetak</button>
          <button className="btn" onClick={() => ex('xlsx')} disabled={!ms.length}><Icon n="download" s={15} />Excel</button>
          <button className="btn" onClick={() => ex('csv')} disabled={!ms.length}>CSV</button>
        </div>
      </div>
      <p className="small muted">{cls.name} · {label} · {ms.length} pertemuan</p>
      {!ms.length ? <div className="card"><Empty icon="chart" title="Tidak ada pertemuan pada periode ini" text="Pilih periode lain atau isi absensi terlebih dahulu." /></div> : <>
        <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
          <div className="card stat" style={{ background: 'var(--tealbg)', borderColor: 'var(--tealbg2)' }}><span className="k">Kehadiran</span><span className="v" style={{ color: 'var(--teal)' }}>{L.fmtPct(tot.pct)}</span></div>
          {L.ATT.map(a => <div key={a.k} className="card stat"><span className="k"><span className="dot" style={{ background: a.hex }} />{a.label}</span><span className="v">{tot[a.k]}</span></div>)}
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>No</th><th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Nama</th>{ms.map(m => <th key={m.id} className="c" title={L.fmtDate(m.date)}>P{m.number}<div className="tiny muted" style={{ fontWeight: 500 }}>{L.fmtShort(m.date)}</div></th>)}{L.ATT.map(a => <th key={a.k} className="c" style={{ color: a.hex }}>{a.short}</th>)}<th className="c">%</th></tr></thead>
            <tbody>{rows.map(({ s, c }, i) => <tr key={s.id}><td className="muted">{i + 1}</td><td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.full_name}</td>
              {ms.map(m => { const r = att.find(x => x.meeting_id === m.id && x.student_id === s.id); const a = r && L.ATT_MAP[r.status]; return <td key={m.id} className="c">{a ? <span style={{ fontWeight: 700, fontSize: 12, color: a.hex }}>{a.short}</span> : <span className="muted">·</span>}</td>; })}
              {L.ATT.map(a => <td key={a.k} className="c">{c[a.k]}</td>)}
              <td className="c" style={{ fontWeight: 700, color: c.pct != null && c.pct < ctx.settings.attendance_threshold ? 'var(--danger)' : undefined }}>{L.fmtPct(c.pct)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <p className="tiny muted">H Hadir · T Terlambat · I Izin · S Sakit · A Alpha · B Bolos · "·" belum diisi (tidak dihitung)</p>
      </>}
    </div>
  );
}

function RiwayatPage({ params }) {
  const { data, ctx } = useApp(); const { go } = useNav();
  const [cid, setCid, classes] = useClassPicker(params.classId);
  const [q, setQ] = useState('');
  const [editM, setEditM] = useState(null); const [delM, setDelM] = useState(null);
  if (!classes.length) return <NoClasses />;
  const ms = L.sortMeetings(data.meetings.filter(m => m.class_id === cid && m.semester_id === ctx.sem.id)).reverse().filter(m => !q || (m.topic || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="col" style={{ gap: 14 }}>
      <PageHead>
        <ClassSelect value={cid} onChange={setCid} classes={classes} />
        <div className="search" style={{ width: 220 }}><Icon n="search" s={15} /><input className="input" placeholder="Cari materi…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn btn-dark" onClick={() => go('absensi', { classId: cid })}><Icon n="plus" s={15} />Pertemuan baru</button>
      </PageHead>
      {!ms.length ? <div className="card"><Empty icon="history" title="Belum ada pertemuan" text="Pertemuan yang disimpan dari halaman Absensi akan tercatat di sini." /></div> :
        <div className="col" style={{ gap: 10 }}>{ms.map(m => {
          const c = L.attCounts(data.attendance_records.filter(r => r.meeting_id === m.id));
          const mods = data.meeting_modules.filter(x => x.meeting_id === m.id && x.enabled && x.module !== 'absensi').map(x => x.module);
          const notes = L.activeNotesFor(data, m).length;
          return (
            <div key={m.id} role="button" tabIndex={0} className="card" style={{ textAlign: 'left', cursor: 'pointer', padding: 0 }} onClick={() => go('absensi', { classId: cid, meetingId: m.id })} onKeyDown={e => e.key === 'Enter' && go('absensi', { classId: cid, meetingId: m.id })}>
              <div className="row" style={{ padding: '14px 12px 14px 16px', gap: 14, alignItems: 'flex-start' }}>
              <div className="row wrap grow" style={{ gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 11, background: '#f1f2f4', display: 'grid', placeItems: 'center', flex: 'none' }}><div className="col" style={{ alignItems: 'center', lineHeight: 1.05 }}><span className="tiny muted">P</span><b style={{ fontSize: 17 }}>{m.number}</b></div></div>
                <div className="col grow" style={{ gap: 3, minWidth: 180 }}>
                  <b>{m.topic || 'Materi belum diisi'}</b>
                  <span className="tiny muted">{L.fmtDate(m.date)}{m.notes ? ' · ' + m.notes : ''}</span>
                  <div className="row wrap" style={{ gap: 5, marginTop: 3 }}>{mods.map(x => <span key={x} className="badge" style={{ height: 19, textTransform: 'capitalize' }}>{x}</span>)}{notes > 0 && <span className="badge purple" style={{ height: 19 }}>{notes} catatan khusus</span>}</div>
                </div>
                <div className="col" style={{ gap: 6, minWidth: 180 }}>
                  <div className="row between small"><span className="muted">{c.total} absensi</span><b>{L.fmtPct(c.pct)}</b></div>
                  <div className="kbar">{c.total > 0 && L.ATT.map(a => <i key={a.k} style={{ width: (c[a.k] / c.total * 100) + '%', background: a.hex }} />)}</div>
                </div>
              </div>
                <div className="row desk-only" style={{ gap: 2 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm btn-icon" title="Edit pertemuan" aria-label="Edit pertemuan" onClick={() => setEditM(m)}><Icon n="edit" s={15} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon btn-danger" title="Hapus pertemuan" aria-label="Hapus pertemuan" onClick={() => setDelM(m)}><Icon n="trash" s={15} /></button>
                </div>
                <span className="mobile-only" onClick={e => e.stopPropagation()}><ActionMenu label="Tindakan pertemuan" items={[
                  { label: 'Lihat detail', icon: 'eye', onClick: () => go('absensi', { classId: cid, meetingId: m.id }) },
                  { label: 'Edit pertemuan', icon: 'edit', onClick: () => setEditM(m) },
                  { label: 'Hapus pertemuan', icon: 'trash', danger: true, onClick: () => setDelM(m) },
                ]} /></span>
              </div>
            </div>
          );
        })}</div>}
      {editM && <MeetingEditModal meeting={editM} onClose={() => setEditM(null)} />}
      {delM && <MeetingDeleteConfirm meeting={delM} onClose={() => setDelM(null)} />}
    </div>
  );
}

function PerhatianPage({ params }) {
  const { data, ctx, api } = useApp(); const { go } = useNav(); const toast = useToast();
  const cats = L.ATTN_CATS.filter(c => !c.mod || ctx.settings[c.mod]);
  const [cat, setCat] = useState(params.cat && cats.find(c => c.k === params.cat) ? params.cat : cats[0].k);
  const [cid, setCid] = useState('');
  const [showDone, setShowDone] = useState(false);
  const classes = data.classes.filter(c => !c.archived);
  const attn = L.attention(data, ctx.sem.id, cid ? [cid] : null);
  const list = attn[cat].filter(x => showDone || !x.fu || x.fu.status !== 'selesai');
  const setFu = async (x, status) => {
    try { await api.upsert('attention_followups', [{ student_id: x.s.id, category: cat, status, note: x.fu ? x.fu.note : '' }], 'student_id,category', 'Tindak lanjut ' + x.s.full_name); toast('Status tindak lanjut diperbarui.'); }
    catch (e) { toast(DB.friendlyError(e), 'err'); }
  };
  const FU = { belum: 'Belum ditindaklanjuti', proses: 'Dalam proses', selesai: 'Selesai' };
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="g" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(180px,1fr))` }}>
        {cats.map(c => { const n = attn[c.k].filter(x => !x.fu || x.fu.status !== 'selesai').length; return (
          <button key={c.k} className="card" style={{ padding: 16, textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: cat === c.k ? c.c : undefined, boxShadow: cat === c.k ? `0 0 0 1px ${c.c}` : 'none' }} onClick={() => setCat(c.k)}>
            <div className="row" style={{ gap: 8 }}><span className="dot" style={{ background: c.c }} /><span className="small" style={{ fontWeight: 600 }}>{c.label}</span></div>
            <b style={{ fontSize: 26, display: 'block', marginTop: 6 }}>{n}</b><span className="tiny muted">siswa</span>
          </button>); })}
      </div>
      <div className="row between wrap" style={{ gap: 10 }}>
        <ClassSelect value={cid} onChange={setCid} classes={classes} allowAll />
        <label className="row small" style={{ gap: 6 }}><Toggle on={showDone} onChange={setShowDone} label="Tampilkan selesai" />Tampilkan yang sudah selesai</label>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {list.length ? <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Nama</th><th>Kelas</th><th>Alasan</th><th>Data pendukung</th><th>Tanggal</th><th>Tindak lanjut</th></tr></thead>
          <tbody>{list.map(x => <tr key={x.s.id}>
            <td><button className="link" style={{ textDecoration: 'none', color: 'var(--ink)' }} onClick={() => go('siswaDetail', { id: x.s.id })}>{x.s.full_name}</button></td>
            <td>{x.cls ? x.cls.name : '—'}</td><td className="small">{x.reason}</td><td className="small muted" style={{ maxWidth: 240 }}>{x.support}</td>
            <td className="small" style={{ whiteSpace: 'nowrap' }}>{x.date ? L.fmtDate(x.date, false) : '—'}</td>
            <td><select className="select input-sm" style={{ width: 175 }} value={x.fu ? x.fu.status : 'belum'} onChange={e => setFu(x, e.target.value)}>{Object.entries(FU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          </tr>)}</tbody>
        </table></div> : <Empty icon="check" title="Tidak ada siswa pada kategori ini" text="Siswa yang memiliki catatan pembebasan yang sah dan masih berlaku tidak dimasukkan ke daftar peringatan." />}
      </div>
    </div>
  );
}

function LaporanPage() {
  const { data, ctx } = useApp(); const toast = useToast();
  const [type, setType] = useState('kelas');
  const [cid, setCid, classes] = useClassPicker();
  const [sid, setSid] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  if (!classes.length) return <NoClasses />;
  const s = ctx.settings;
  const cls = data.classes.find(c => c.id === cid);
  const students = data.students.filter(x => x.class_id === cid && x.status === 'aktif').sort((a, b) => a.full_name.localeCompare(b.full_name));
  const ms = L.sortMeetings(L.scopeMeetings(data, { classIds: [cid], semId: ctx.sem.id, from: from || null, to: to || null }));
  const rangeLabel = from || to ? `${from ? L.fmtDate(from, false) : 'awal'} – ${to ? L.fmtDate(to, false) : 'sekarang'}` : 'Satu semester';

  const build = () => {
    if (type === 'kelas') {
      const header = ['No', 'Nama', 'L/P', ...L.ATT.map(a => a.label), 'Kehadiran %', ...(s.hafalan ? ['Hafalan tuntas %', 'Nilai hafalan'] : []), ...(s.tugas ? ['Tugas', 'Nilai tugas'] : []), ...(s.keaktifan ? ['Keaktifan'] : [])];
      const mIds = new Set(ms.map(m => m.id));
      const rows = students.map((st, i) => {
        const att = L.attCounts(data.attendance_records.filter(r => r.student_id === st.id && mIds.has(r.meeting_id)));
        const mem = data.memorization_records.filter(r => r.student_id === st.id && mIds.has(r.meeting_id)); const rq = mem.filter(r => r.status !== 'bebas');
        const act = data.activity_records.filter(r => r.student_id === st.id && mIds.has(r.meeting_id) && r.score != null);
        const sum = L.studentSummary(data, st, ctx.sem.id);
        return [i + 1, st.full_name, st.gender, ...L.ATT.map(a => att[a.k]), L.fmtPct(att.pct), ...(s.hafalan ? [L.fmtPct(L.pct(mem.filter(r => r.status === 'setor').length, rq.length)), L.avg(mem.filter(r => r.status === 'setor').map(r => r.score)) ?? '—'] : []), ...(s.tugas ? [sum.asgTotal ? sum.asgDone + '/' + sum.asgTotal : '—', sum.asgScore ?? '—'] : []), ...(s.keaktifan ? [L.avg(act.map(r => r.score)) ?? '—'] : [])];
      });
      return { title: 'Laporan Kelas ' + cls.name, header, rows, sheet: 'Kelas ' + cls.name };
    }
    if (type === 'individu') {
      const st = data.students.find(x => x.id === sid); if (!st) return null;
      const header = ['Pertemuan', 'Tanggal', 'Materi', 'Kehadiran', ...(s.hafalan ? ['Hafalan', 'Nilai'] : []), ...(s.keaktifan ? ['Keaktifan'] : []), 'Keterangan'];
      const rows = ms.map(m => { const a = data.attendance_records.find(r => r.meeting_id === m.id && r.student_id === st.id), h = data.memorization_records.find(r => r.meeting_id === m.id && r.student_id === st.id), k = data.activity_records.find(r => r.meeting_id === m.id && r.student_id === st.id); return [m.number, L.fmtDate(m.date, false), m.topic || '', a ? L.ATT_MAP[a.status].label : '—', ...(s.hafalan ? [h ? L.MEM[h.status] : '—', h && h.score != null ? h.score : '—'] : []), ...(s.keaktifan ? [k && k.score != null ? k.score : '—'] : []), a ? a.note || '' : '']; });
      return { title: 'Laporan Individu — ' + st.full_name + ' (' + cls.name + ')', header, rows, sheet: st.full_name };
    }
    if (type === 'catatan') {
      const header = ['Siswa', 'Jenis', 'Alasan', 'Mulai', 'Masa berlaku', 'Status', 'Pembuat'];
      const rows = data.student_notes.filter(n => n.class_id === cid).map(n => [(data.students.find(x => x.id === n.student_id) || {}).full_name || '', L.NOTE_TYPES[n.type].label, n.reason, L.fmtDate(n.start_date, false), L.validityText(n), L.noteState(n, data.meetings), n.created_by]);
      return { title: 'Catatan Khusus ' + cls.name, header, rows, sheet: 'Catatan' };
    }
    if (type === 'pertemuan') {
      const header = ['No', 'Tanggal', 'Materi', 'Catatan', ...L.ATT.map(a => a.short), 'Kehadiran %'];
      const rows = ms.map(m => { const c = L.attCounts(data.attendance_records.filter(r => r.meeting_id === m.id)); return [m.number, L.fmtDate(m.date, false), m.topic || '', m.notes || '', ...L.ATT.map(a => c[a.k]), L.fmtPct(c.pct)]; });
      return { title: 'Jurnal Pertemuan ' + cls.name, header, rows, sheet: 'Jurnal' };
    }
  };
  const rep = build();
  const doEx = kind => {
    if (!rep) return toast('Pilih siswa terlebih dahulu.', 'err');
    try {
      const fname = rep.title.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase();
      if (kind === 'csv') L.exportCSV(fname, rep.header, rep.rows);
      else if (kind === 'xlsx') L.exportXLSX(fname, [{ name: rep.sheet, header: rep.header, rows: rep.rows }], { title: rep.title, school: (ctx.profile.school_name || '') + (ctx.profile.school_address ? ' — ' + ctx.profile.school_address : ''), sub: `Semester ${ctx.sem.name} ${ctx.year.name} · ${rangeLabel} · Guru: ${ctx.profile.full_name || ''}${ctx.profile.teacher_subject ? ' (' + ctx.profile.teacher_subject + ')' : ''}` });
      else L.printReport({ title: rep.title, meta: reportMeta(ctx, rangeLabel), header: rep.header, rows: rep.rows });
    } catch (e) { toast(DB.friendlyError(e), 'err'); }
  };
  const types = [['kelas', 'Rekap kelas', 'Kehadiran, hafalan, tugas & keaktifan per siswa'], ['individu', 'Rekap individu', 'Riwayat lengkap satu siswa'], ['pertemuan', 'Jurnal pertemuan', 'Daftar pertemuan & materi'], ['catatan', 'Catatan khusus', 'Semua catatan antarpertemuan']];
  return (
    <div className="col" style={{ gap: 14 }}>
      {!ctx.profile.school_name && <div className="alert warn"><Icon n="alert" s={16} /><div>Nama sekolah belum diatur — header laporan akan kosong. Atur di Pengaturan → Profil & identitas.</div></div>}
      <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {types.map(([k, l, d]) => <button key={k} className="card" style={{ padding: 14, textAlign: 'left', cursor: 'pointer', font: 'inherit', borderColor: type === k ? 'var(--ink)' : undefined, boxShadow: type === k ? '0 0 0 1px var(--ink)' : 'none' }} onClick={() => setType(k)}><b style={{ fontSize: 13.5 }}>{l}</b><p className="tiny muted" style={{ marginTop: 3 }}>{d}</p></button>)}
      </div>
      <div className="card card-pad">
        <div className="toolbar">
          <ClassSelect value={cid} onChange={v => { setCid(v); setSid(''); }} classes={classes} />
          {type === 'individu' && <select className="select" style={{ width: 'auto', minWidth: 200 }} value={sid} onChange={e => setSid(e.target.value)}><option value="">— Pilih siswa —</option>{students.map(x => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>}
          {type !== 'catatan' && <><span className="small muted">Dari</span><input type="date" className="input" style={{ width: 155 }} value={from} onChange={e => setFrom(e.target.value)} /><span className="small muted">s.d.</span><input type="date" className="input" style={{ width: 155 }} value={to} onChange={e => setTo(e.target.value)} /></>}
          <div className="grow" />
          <button className="btn" onClick={() => doEx('print')}><Icon n="print" s={15} />Cetak A4</button>
          <button className="btn btn-dark" onClick={() => doEx('xlsx')}><Icon n="download" s={15} />Excel</button>
          <button className="btn" onClick={() => doEx('csv')}>CSV</button>
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '2px solid var(--ink)' }}>
          <b style={{ fontSize: 16 }}>{rep ? rep.title : 'Pilih siswa'}</b>
          <div className="small muted" style={{ marginTop: 3 }}>{ctx.profile.school_name || 'Nama sekolah'} · Semester {ctx.sem.name} {ctx.year.name} · {rangeLabel} · Guru: {ctx.profile.full_name || '—'}</div>
        </div>
        {rep && rep.rows.length ? <div className="tbl-wrap" style={{ maxHeight: 520 }}><table className="tbl"><thead><tr>{rep.header.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rep.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 1 ? '' : 'small'}>{c}</td>)}</tr>)}</tbody></table></div> : <Empty title="Belum ada data untuk laporan ini" text="Ubah filter atau isi data terlebih dahulu." />}
      </div>
    </div>
  );
}

Object.assign(window, { RekapPage, RiwayatPage, PerhatianPage, LaporanPage });
