// Dashboard — seluruh angka dihitung dari data aktual.
function DashboardPage() {
  const { data, ctx } = useApp();
  const { go } = useNav();
  const s = ctx.settings;
  const [level, setLevel] = useState(localStorage.getItem('alatguru.dashLevel') || '');
  const [classId, setClassId] = useState('');
  const [range, setRange] = useState('semester');
  const t = L.today();
  const classesAll = data.classes.filter(c => !c.archived);
  const lvClasses = level ? classesAll.filter(c => c.level === level) : classesAll;
  const classIds = classId ? [classId] : lvClasses.map(c => c.id);
  const from = range === '30' ? L.addDays(t, -30) : range === 'bulan' ? t.slice(0, 8) + '01' : null;
  const meetings = L.scopeMeetings(data, { classIds, semId: ctx.sem.id, from, to: t });
  const students = data.students.filter(x => x.status === 'aktif' && classIds.includes(x.class_id));
  const att = L.recordsFor('attendance_records', data, meetings);
  const counts = L.attCounts(att);
  const todayMeetings = meetings.filter(m => m.date === t);
  const todayCounts = L.attCounts(L.recordsFor('attendance_records', data, todayMeetings));
  const mem = L.recordsFor('memorization_records', data, meetings);
  const act = L.recordsFor('activity_records', data, meetings).filter(r => r.score != null);
  const asgs = data.assignments.filter(a => a.semester_id === ctx.sem.id && classIds.includes(a.class_id));
  const asgPending = asgs.filter(a => a.due_date < t).reduce((acc, a) => {
    const targets = a.target === 'kelas' ? students.filter(x => x.class_id === a.class_id) : students.filter(x => (a.student_ids || []).includes(x.id));
    return acc + targets.filter(st => { const r = data.assignment_records.find(r => r.assignment_id === a.id && r.student_id === st.id); return !r || r.status === 'belum'; }).length;
  }, 0);

  const setLv = v => { setLevel(v); setClassId(''); localStorage.setItem('alatguru.dashLevel', v); };

  // Tren kehadiran per minggu
  const trend = useMemo(() => {
    const byW = {};
    for (const m of meetings) { const w = L.weekStart(m.date); (byW[w] = byW[w] || []).push(m); }
    return Object.keys(byW).sort().map(w => { const c = L.attCounts(L.recordsFor('attendance_records', data, byW[w])); return { x: L.fmtShort(w), full: 'Minggu ' + L.fmtDate(w, false), pct: c.pct }; });
  }, [meetings, data]);
  const perClass = lvClasses.map(c => {
    const ms = meetings.filter(m => m.class_id === c.id);
    const cc = L.attCounts(L.recordsFor('attendance_records', data, ms));
    const mm = L.recordsFor('memorization_records', data, ms);
    const req = mm.filter(r => r.status !== 'bebas');
    return { x: c.name, pct: cc.pct, mem: L.pct(req.filter(r => r.status === 'setor').length, req.length) };
  }).filter(r => r.pct != null || r.mem != null);
  const memTrend = useMemo(() => {
    const byW = {};
    for (const m of meetings) { const w = L.weekStart(m.date); (byW[w] = byW[w] || []).push(m); }
    return Object.keys(byW).sort().map(w => {
      const rs = L.recordsFor('memorization_records', data, byW[w]);
      return { x: L.fmtShort(w), full: 'Minggu ' + L.fmtDate(w, false), setor: rs.filter(r => r.status === 'setor').length, belum: rs.filter(r => r.status === 'belum').length, izin: rs.filter(r => r.status === 'izin').length, bebas: rs.filter(r => r.status === 'bebas').length };
    });
  }, [meetings, data]);
  const asgChart = asgs.filter(a => a.due_date <= t).sort((a, b) => a.due_date < b.due_date ? -1 : 1).slice(-8).map(a => {
    const rs = data.assignment_records.filter(r => r.assignment_id === a.id);
    const tgt = a.target === 'kelas' ? data.students.filter(x => x.class_id === a.class_id && x.status === 'aktif').length : (a.student_ids || []).length;
    const sud = rs.filter(r => r.status === 'sudah').length, tl = rs.filter(r => r.status === 'terlambat').length, beb = rs.filter(r => r.status === 'bebas').length;
    return { x: a.title.length > 10 ? a.title.slice(0, 9) + '…' : a.title, full: a.title + ' (' + (data.classes.find(c => c.id === a.class_id) || {}).name + ')', sudah: sud, terlambat: tl, bebas: beb, belum: Math.max(0, tgt - sud - tl - beb) };
  });
  const actTrend = useMemo(() => {
    const byW = {};
    for (const m of meetings) { const w = L.weekStart(m.date); (byW[w] = byW[w] || []).push(m); }
    return Object.keys(byW).sort().map(w => ({ x: L.fmtShort(w), full: 'Minggu ' + L.fmtDate(w, false), avg: L.avg(L.recordsFor('activity_records', data, byW[w]).map(r => r.score)) }));
  }, [meetings, data]);

  const attn = L.attention(data, ctx.sem.id, classIds);
  const memReq = mem.filter(r => r.status !== 'bebas');
  const statCards = [
    { k: 'Total siswa', v: students.length, sub: 'aktif pada filter ini', i: 'users' },
    { k: 'Total kelas', v: lvClasses.length, sub: level ? 'tingkat ' + level : 'semua tingkat', i: 'layers' },
    { k: 'Kehadiran hari ini', v: todayCounts.total ? todayCounts.present + '/' + todayCounts.total : '—', sub: todayMeetings.length ? todayMeetings.length + ' pertemuan hari ini' : 'belum ada pertemuan hari ini', i: 'calCheck' },
    { k: 'Persentase kehadiran', v: L.fmtPct(counts.pct), sub: counts.total + ' catatan absensi', i: 'chart', accent: true },
  ];
  const attCards = L.ATT.filter(a => a.k !== 'hadir').map(a => ({ ...a, v: counts[a.k] }));

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="lvl-tabs">
        {L.LEVELS.map(lv => {
          const n = classesAll.filter(c => c.level === lv).length;
          return <button key={lv} className={'lvl ' + (level === lv ? 'on' : '')} onClick={() => setLv(level === lv ? '' : lv)}><b>{lv}</b><span>{n} kelas</span></button>;
        })}
      </div>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div className="toolbar">
          <ClassSelect value={classId} onChange={setClassId} classes={lvClasses} allowAll />
          <Seg value={range} onChange={setRange} options={[{ v: 'semester', l: 'Semester' }, { v: 'bulan', l: 'Bulan ini' }, { v: '30', l: '30 hari' }]} />
        </div>
        <span className="small muted">{level ? 'Tingkat ' + level : 'Semua tingkat'} · Semester {ctx.sem.name} {ctx.year.name}</span>
      </div>

      {classesAll.length === 0 ? <NoClasses /> : <>
        <div className="g g-stats">
          {statCards.map(c => (
            <div key={c.k} className="card stat" style={c.accent ? { background: 'var(--tealbg)', borderColor: 'var(--tealbg2)' } : null}>
              <span className="k"><Icon n={c.i} s={15} />{c.k}</span>
              <span className="v" style={c.accent ? { color: 'var(--teal)' } : null}>{c.v}</span>
              <span className="s">{c.sub}</span>
            </div>
          ))}
        </div>
        <div className="g" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
          {attCards.map(a => (
            <div key={a.k} className="card" style={{ padding: '12px 14px' }}>
              <div className="row small" style={{ gap: 7, fontWeight: 600, color: 'var(--ink2)' }}><span className="dot" style={{ background: a.hex }} />{a.label}</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 4 }}><b style={{ fontSize: 22 }}>{a.v}</b><span className="tiny muted">{counts.total ? L.fmtPct(L.pct(a.v, counts.total)) : ''}</span></div>
            </div>
          ))}
        </div>

        <div className="g g-main">
          <div className="col" style={{ gap: 14, minWidth: 0 }}>
            <div className="g g-2">
              <div className="card">
                <div className="card-h"><h3>Tren kehadiran</h3><span className="tiny muted">per minggu</span></div>
                <div style={{ padding: '12px 14px' }}>{trend.length ? <Chart type="line" data={trend} series={[{ k: 'pct', label: 'Kehadiran', color: '#0f766e' }]} yMax={100} ySuffix="%" /> : <NoData />}</div>
              </div>
              <div className="card">
                <div className="card-h"><h3>Distribusi status</h3><span className="tiny muted">{counts.total} catatan</span></div>
                <div className="row" style={{ padding: 16, gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {counts.total ? <>
                    <Donut data={L.ATT.map(a => ({ v: counts[a.k], c: a.hex, l: a.label }))} center={<><b style={{ fontSize: 22 }}>{L.fmtPct(counts.pct)}</b><span className="tiny muted">hadir</span></>} />
                    <div className="col" style={{ gap: 7, minWidth: 140 }}>
                      {L.ATT.map(a => <div key={a.k} className="row small" style={{ gap: 8 }}><span className="dot" style={{ background: a.hex }} /><span className="grow">{a.label}</span><b>{counts[a.k]}</b><span className="muted tiny" style={{ width: 40, textAlign: 'right' }}>{L.fmtPct(L.pct(counts[a.k], counts.total))}</span></div>)}
                    </div>
                  </> : <NoData />}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3>Perbandingan kelas</h3><Legend items={[{ label: 'Kehadiran', color: '#0f766e' }, ...(s.hafalan ? [{ label: 'Ketuntasan hafalan', color: '#5eead4' }] : [])]} /></div>
              <div style={{ padding: '12px 14px' }}>{perClass.length ? <Chart data={perClass} series={[{ k: 'pct', label: 'Kehadiran', color: '#0f766e' }, ...(s.hafalan ? [{ k: 'mem', label: 'Ketuntasan hafalan', color: '#5eead4' }] : [])]} yMax={100} ySuffix="%" /> : <NoData />}</div>
            </div>
            <div className="g g-2">
              {s.hafalan && <div className="card">
                <div className="card-h"><h3>Perkembangan hafalan</h3><span className="tiny muted">{memReq.length ? L.fmtPct(L.pct(memReq.filter(r => r.status === 'setor').length, memReq.length)) + ' tuntas' : ''}</span></div>
                <div style={{ padding: '12px 14px' }}>
                  {memTrend.length ? <><Chart data={memTrend} stacked series={[{ k: 'setor', label: 'Setor', color: '#0f766e' }, { k: 'izin', label: 'Izin', color: '#f59e0b' }, { k: 'bebas', label: 'Bebas Setor', color: '#a78bfa' }, { k: 'belum', label: 'Belum', color: '#e5e7eb' }]} height={180} />
                    <div style={{ marginTop: 6 }}><Legend items={[{ label: 'Setor', color: '#0f766e' }, { label: 'Izin', color: '#f59e0b' }, { label: 'Bebas Setor', color: '#a78bfa' }, { label: 'Belum', color: '#d1d5db' }]} /></div></> : <NoData />}
                </div>
              </div>}
              {s.tugas && <div className="card">
                <div className="card-h"><h3>Penyelesaian tugas</h3><span className="tiny muted">{asgPending} belum dikumpulkan</span></div>
                <div style={{ padding: '12px 14px' }}>
                  {asgChart.length ? <><Chart data={asgChart} stacked series={[{ k: 'sudah', label: 'Sudah', color: '#0f766e' }, { k: 'terlambat', label: 'Terlambat', color: '#2563eb' }, { k: 'bebas', label: 'Bebas', color: '#a78bfa' }, { k: 'belum', label: 'Belum', color: '#fca5a5' }]} height={180} />
                    <div style={{ marginTop: 6 }}><Legend items={[{ label: 'Sudah', color: '#0f766e' }, { label: 'Terlambat', color: '#2563eb' }, { label: 'Bebas', color: '#a78bfa' }, { label: 'Belum', color: '#fca5a5' }]} /></div></> : <NoData text="Belum ada tugas yang melewati tenggat pada filter ini." />}
                </div>
              </div>}
              {s.keaktifan && <div className="card">
                <div className="card-h"><h3>Keaktifan</h3><span className="tiny muted">rata-rata {L.avg(act.map(r => r.score)) ?? '—'} / {s.activity_scale_max}</span></div>
                <div style={{ padding: '12px 14px' }}>{actTrend.some(x => x.avg != null) ? <Chart type="line" data={actTrend} series={[{ k: 'avg', label: 'Rata-rata', color: '#8b5cf6' }]} yMax={s.activity_scale_max} height={180} /> : <NoData />}</div>
              </div>}
            </div>
          </div>

          <div className="col" style={{ gap: 14 }}>
            <AttentionPanel attn={attn} />
            {s.bebas_semester && <BebasDashCard classIds={classIds} />}
            <div className="card">
              <div className="card-h"><h3>Menu cepat</h3></div>
              <div className="col" style={{ padding: 12, gap: 8 }}>
                <button className="btn" style={{ justifyContent: 'flex-start', height: 42 }} onClick={() => go('absensi')}><Icon n="calCheck" s={16} />Isi absensi / pertemuan baru</button>
                <button className="btn" style={{ justifyContent: 'flex-start', height: 42 }} onClick={() => go('rekap')}><Icon n="chart" s={16} />Rekap kehadiran</button>
                <button className="btn" style={{ justifyContent: 'flex-start', height: 42 }} onClick={() => go('laporan')}><Icon n="download" s={16} />Laporan & ekspor Excel</button>
              </div>
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}

function AttentionPanel({ attn }) {
  const { ctx } = useApp(); const { go } = useNav();
  const cats = L.ATTN_CATS.filter(c => !c.mod || ctx.settings[c.mod]);
  return (
    <div className="card">
      <div className="card-h"><h3>Perlu Perhatian</h3><button className="link small" onClick={() => go('perhatian')}>Lihat semua</button></div>
      <div className="col">
        {cats.map(c => {
          const list = attn[c.k].filter(x => !x.fu || x.fu.status !== 'selesai');
          return (
            <button key={c.k} className="list-i" style={{ border: 0, borderBottom: '1px solid var(--line2)', background: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => go('perhatian', { cat: c.k })}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: c.c + '18', color: c.c, display: 'grid', placeItems: 'center', fontWeight: 800, flex: 'none' }}>{list.length}</span>
              <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{c.label}</b>
                <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.length ? list.slice(0, 3).map(x => x.s.full_name).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '') : 'Tidak ada siswa'}</span>
              </div>
              <Icon n="chevR" s={16} style={{ color: 'var(--mute2)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BebasDashCard({ classIds }) {
  const { data, ctx } = useApp(); const { go } = useNav();
  const rule = data.semester_exemption_rules.find(r => r.semester_id === ctx.sem.id);
  if (!rule) return (
    <div className="card card-pad"><div className="row between"><b>Bebas Semester</b><button className="link small" onClick={() => go('bebas')}>Atur kriteria</button></div><p className="small muted" style={{ marginTop: 6 }}>Kriteria semester ini belum diatur.</p></div>
  );
  const studs = data.students.filter(s => s.status === 'aktif' && classIds.includes(s.class_id));
  const res = studs.map(s => L.exemption(data, ctx.sem.id, s, rule).status);
  const c = k => res.filter(x => x === k).length;
  return (
    <div className="card">
      <div className="card-h"><h3>Bebas Semester</h3><button className="link small" onClick={() => go('bebas')}>Buka</button></div>
      <div className="g" style={{ gridTemplateColumns: '1fr 1fr', padding: 14, gap: 10 }}>
        {Object.entries(L.EXEMPT_STATUS).map(([k, [lbl, col]]) => <div key={k} className="col" style={{ gap: 2 }}><span className={'badge ' + col} style={{ alignSelf: 'flex-start' }}>{lbl}</span><b style={{ fontSize: 20, marginTop: 4 }}>{c(k)}</b></div>)}
      </div>
      <p className="tiny muted" style={{ padding: '0 14px 14px' }}>Kehadiran ≥ {rule.min_attendance}% · Hafalan ≥ {rule.min_memorization}%</p>
    </div>
  );
}

Object.assign(window, { DashboardPage, AttentionPanel });
