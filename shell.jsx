// Layout setelah login: sidebar, header, routing halaman.
const NAV = [
  { g: 'Utama' },
  { k: 'dashboard', l: 'Dashboard', i: 'home' },
  { k: 'absensi', l: 'Absensi', i: 'calCheck' },
  { k: 'kelas', l: 'Semua Kelas', i: 'layers' },
  { k: 'siswa', l: 'Data Siswa', i: 'users' },
  { g: 'Modul' },
  { k: 'hafalan', l: 'Hafalan', i: 'book', mod: 'hafalan' },
  { k: 'tugas', l: 'Tugas / PR', i: 'clip', mod: 'tugas' },
  { k: 'keaktifan', l: 'Keaktifan', i: 'star', mod: 'keaktifan' },
  { k: 'perkembangan', l: 'Perkembangan Siswa', i: 'trend' },
  { k: 'bebas', l: 'Bebas Semester', i: 'award', mod: 'bebas_semester' },
  { g: 'Rekap & Arsip' },
  { k: 'rekap', l: 'Rekap Data Siswa', i: 'file' },
  { k: 'riwayat', l: 'Riwayat Pertemuan', i: 'history' },
  { k: 'perhatian', l: 'Perlu Perhatian', i: 'alert' },
  { k: 'materi', l: 'Kumpulan Materi', i: 'folder' },
  { g: 'Sistem' },
  { k: 'pengaturan', l: 'Pengaturan', i: 'sliders' },
];
const PAGE_TITLES = Object.fromEntries(NAV.filter(n => n.k).map(n => [n.k, n.l]));
PAGE_TITLES.siswaDetail = 'Detail Siswa'; PAGE_TITLES.pertemuan = 'Pertemuan'; PAGE_TITLES.laporan = 'Laporan';

const NavCtx = createContext(null);
const useNav = () => useContext(NavCtx);

function Shell() {
  const app = useApp();
  const { ctx, data, backend, user, onLogout, online, syncAt, reload } = app;
  const [route, setRoute] = useState(() => { try { return JSON.parse(localStorage.getItem('absendigital.route') || 'null') || { page: 'dashboard' }; } catch { return { page: 'dashboard' }; } });
  const [sideOpen, setSideOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const dirtyRef = useRef(false);
  const go = useCallback((page, params = {}) => {
    if (dirtyRef.current && !confirm('Ada perubahan yang belum berhasil disimpan ke database. Tinggalkan halaman ini?')) return;
    dirtyRef.current = false;
    const r = { page, params }; setRoute(r); localStorage.setItem('absendigital.route', JSON.stringify(r)); setSideOpen(false); window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const h = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, []);

  const s = ctx.settings;
  const visibleNav = NAV.filter(n => !n.mod || s[n.mod]);
  // Jika modul nonaktif & pengguna berada di halamannya, alihkan.
  const curNav = NAV.find(n => n.k === route.page);
  const page = curNav && curNav.mod && !s[curNav.mod] ? 'dashboard' : route.page;

  const attnCount = useMemo(() => {
    if (!ctx.sem) return 0;
    const a = L.attention(data, ctx.sem.id);
    const ids = new Set();
    L.ATTN_CATS.forEach(c => (!c.mod || s[c.mod]) && a[c.k].forEach(x => (!x.fu || x.fu.status !== 'selesai') && ids.add(x.s.id)));
    return ids.size;
  }, [data, ctx.sem]);

  const name = ctx.profile.full_name || user.email;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  // Penyiapan Awal: tahun ajaran/semester belum ada ATAU profil belum lengkap.
  if (!ctx.year || !ctx.sem || !ctx.profile.teacher_subject || !ctx.profile.school_name) return <SetupWizard />;

  const P = {
    dashboard: DashboardPage, absensi: AbsensiPage, kelas: KelasPage, siswa: SiswaPage, siswaDetail: SiswaDetailPage,
    hafalan: HafalanPage, tugas: TugasPage, keaktifan: KeaktifanPage, bebas: BebasPage, rekap: RekapDataPage, perkembangan: PerkembanganPage,
    riwayat: RiwayatPage, materi: MateriPage, perhatian: PerhatianPage, laporan: LaporanPage, pengaturan: PengaturanPage,
  }[page] || DashboardPage;

  return (
    <NavCtx.Provider value={{ go, route: { ...route, page }, dirtyRef }}>
      <div className="app">
        <div className={'side-ov ' + (sideOpen ? 'open' : '')} onClick={() => setSideOpen(false)} />
        <aside className={'side ' + (sideOpen ? 'open' : '')} aria-label="Navigasi">
          <div className="side-brand">
            <Logo />
            <div className="col grow" style={{ gap: 1 }}>
              <b style={{ fontSize: 15, letterSpacing: '.02em' }}>ABSEN DIGITAL</b>
              <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.profile.school_name || 'Administrasi Absensi & Perkembangan'}</span>
            </div>
            <button className="btn btn-ghost btn-sm btn-icon mobile-only" onClick={() => setSideOpen(false)} aria-label="Tutup menu"><Icon n="x" /></button>
          </div>
          <nav className="side-nav">
            {visibleNav.map((n, i) => n.g
              ? <div key={'g' + i} className="nav-group">{n.g}</div>
              : <button key={n.k} className={'nav-i ' + (page === n.k || (n.k === 'siswa' && page === 'siswaDetail') ? 'on' : '')} onClick={() => go(n.k)}>
                  <Icon n={n.i} s={17} />{n.l}{n.k === 'perhatian' && attnCount > 0 && <span className="cnt">{attnCount}</span>}
                </button>)}
          </nav>
          <div className="side-foot">
            <div className="row small" style={{ gap: 7, color: online ? 'var(--teal)' : 'var(--danger)', fontWeight: 600 }}>
              <Icon n={online ? 'cloud' : 'wifiOff'} s={15} />
              {online ? 'Tersambung ke database online' : 'Offline — perubahan tidak dapat disimpan'}
            </div>
            {syncAt && <button className="link tiny" style={{ marginTop: 4, color: 'var(--mute)' }} onClick={reload}>Sinkron {syncAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · muat ulang</button>}
          </div>
        </aside>

        <div className="main">
          {!online && <div style={{ background: '#7f1d1d', color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '7px 16px', display: 'flex', gap: 8, alignItems: 'center' }}><Icon n="wifiOff" s={14} />Koneksi terputus. Perubahan tidak akan tersimpan sampai perangkat kembali online.</div>}
          <header className="topbar">
            <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setSideOpen(true)} aria-label="Buka menu"><Icon n="menu" /></button>
            <h1 className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{PAGE_TITLES[page]}</h1>
            <span className="pill desk-only"><Icon n="cal" s={15} />{ctx.year.name} · Semester {ctx.sem.name}</span>
            <div style={{ position: 'relative' }}>
              <button className="row" style={{ gap: 9, border: 0, background: 'none', cursor: 'pointer', padding: 4, borderRadius: 10 }} onClick={() => setMenu(!menu)} aria-haspopup="menu">
                <div className="avatar">{initials || 'G'}</div>
                <div className="col desk-only" style={{ alignItems: 'flex-start', gap: 0 }}>
                  <b style={{ fontSize: 13, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</b>
                  <span className="tiny muted">{ctx.profile.teacher_subject || 'Guru'}</span>
                </div>
                <Icon n="chevD" s={15} className="desk-only" />
              </button>
              {menu && <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenu(false)} />
                <div className="menu" role="menu">
                  <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--line2)', marginBottom: 4 }}>
                    <b style={{ fontSize: 13 }}>{name}</b><div className="tiny muted" style={{ wordBreak: 'break-all' }}>{user.email}</div>
                    <div className="tiny muted mobile-only" style={{ marginTop: 4 }}>{ctx.year.name} · Semester {ctx.sem.name}</div>
                  </div>
                  <button onClick={() => { setMenu(false); go('pengaturan', { tab: 'profil' }); }}><Icon n="user" s={16} />Profil & identitas</button>
                  <button onClick={() => { setMenu(false); go('pengaturan', { tab: 'akun' }); }}><Icon n="shield" s={16} />Akun & kata sandi</button>
                  <button onClick={() => { setMenu(false); setConfirmOut(true); }} style={{ color: 'var(--danger)' }}><Icon n="logout" s={16} />Keluar</button>
                </div>
              </>}
            </div>
          </header>
          <main className="content" key={page + JSON.stringify(route.params || {})}>
            <P params={route.params || {}} />
          </main>
        </div>
      </div>
      {confirmOut && <Confirm title="Keluar dari ABSEN DIGITAL?" message="Sesi Anda di perangkat ini akan diakhiri. Data tetap tersimpan di server." confirmLabel="Keluar" danger onClose={() => setConfirmOut(false)} onConfirm={onLogout} />}
    </NavCtx.Provider>
  );
}

// Pemilih kelas yang dipakai ulang di banyak halaman
function useClassPicker(initial) {
  const { data } = useApp();
  const classes = data.classes.filter(c => !c.archived).sort((a, b) => L.LEVELS.indexOf(a.level) - L.LEVELS.indexOf(b.level) || a.name.localeCompare(b.name));
  const stored = localStorage.getItem('absendigital.class');
  const def = (initial && classes.find(c => c.id === initial)) || classes.find(c => c.id === stored) || classes[0];
  const [cid, setCid] = useState(def ? def.id : '');
  const set = id => { setCid(id); localStorage.setItem('absendigital.class', id); };
  return [cid, set, classes];
}
function ClassSelect({ value, onChange, classes, allowAll, style }) {
  return (
    <select className="select" value={value} onChange={e => onChange(e.target.value)} style={{ width: 'auto', minWidth: 130, ...style }} aria-label="Pilih kelas">
      {allowAll && <option value="">Semua kelas</option>}
      {L.LEVELS.map(lv => { const cs = classes.filter(c => c.level === lv); return cs.length ? <optgroup key={lv} label={'Kelas ' + lv}>{cs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : null; })}
    </select>
  );
}
function NoClasses() {
  const { go } = useNav();
  return <div className="card"><Empty icon="layers" title="Belum ada kelas" text="Tambahkan kelas dan siswa terlebih dahulu agar fitur ini dapat digunakan." action={<button className="btn btn-dark" onClick={() => go('kelas')}><Icon n="plus" s={15} />Tambah kelas</button>} /></div>;
}
function PageHead({ title, sub, children }) {
  return (
    <div className="row between wrap" style={{ gap: 12, marginBottom: 16 }}>
      <div className="col" style={{ gap: 3 }}>{title && <h2 style={{ fontSize: 20 }}>{title}</h2>}{sub && <p className="muted small tw-pretty">{sub}</p>}</div>
      {children && <div className="toolbar">{children}</div>}
    </div>
  );
}

Object.assign(window, { Shell, NavCtx, useNav, useClassPicker, ClassSelect, NoClasses, PageHead, NAV });
