// Akar aplikasi ABSEN DIGITAL: satu koneksi Supabase pusat dari konfigurasi build
// (bukan input pengguna) dan sesi Supabase Auth. Tidak ada mode demo di produksi.
// Untuk pengujian lokal tanpa server, dev/ menyediakan window.__AD_DEV_BACKEND__
// (file itu TIDAK ikut ke build produksi).
function Root() {
  const server = useMemo(() => DB.getServer(), []);
  const envOk = server && server.url;
  const [client, setClient] = useState(null);
  const [boot, setBoot] = useState(envOk ? 'checking' : 'env'); // checking | ready | env | schema | network
  const [bootDetail, setBootDetail] = useState(envOk ? '' : Object.values((server && server.errors) || {}).join(' '));
  const [session, setSession] = useState(undefined);
  const devB = window.__AD_DEV_BACKEND__ || null;
  const [demo, setDemo] = useState(() => !!(devB && devB.session()));
  const [notice, setNotice] = useState(null);
  const [retry, setRetry] = useState(0);
  const urlParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const [recovery, setRecovery] = useState(urlParams.get('reset') === '1' || hashParams.get('type') === 'recovery');
  const [linkError] = useState(hashParams.get('error_description') || urlParams.get('error_description') || null);

  useEffect(() => {
    if (!envOk) return;
    let alive = true, c;
    setBoot('checking'); setSession(undefined);
    try { c = DB.makeClient(server.url, server.key); } catch (e) { setBoot('network'); return; }
    setClient(c);
    (async () => {
      if (!navigator.onLine) { alive && setBoot('network'); return; }
      const sc = await DB.checkSchema(c);
      if (!alive) return;
      if (sc.network) { setBoot('network'); return; }
      if (sc.missing.length) { setBoot('schema'); setBootDetail(sc.missing.join(', ')); return; }
      setBoot('ready');
      const { data } = await c.auth.getSession().catch(() => ({ data: {} }));
      alive && setSession((data && data.session) || null);
    })();
    const { data: sub } = c.auth.onAuthStateChange((event, s) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setSession(prev => { if (prev) setNotice({ type: 'info', text: 'Sesi berakhir. Silakan masuk kembali.' }); return null; });
      else if (event === 'TOKEN_REFRESHED' && !s) { setSession(null); setNotice({ type: 'info', text: 'Sesi berakhir. Silakan masuk kembali.' }); }
      else setSession(s || null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [retry]);

  useEffect(() => {
    if (session && (location.hash.includes('access_token') || location.search.includes('code='))) history.replaceState(null, '', location.pathname + (recovery ? '?reset=1' : ''));
  }, [session]);

  const backend = useMemo(() => {
    if (demo && devB) return devB.backend();
    if (client && session) return DB.SupabaseBackend(client);
    return null;
  }, [demo, client, session && session.user && session.user.id]);

  const logout = async () => {
    localStorage.removeItem('alatguru.route');
    if (demo && devB) { devB.logout(); setDemo(false); return; }
    try { await client.auth.signOut(); } catch { /* sesi lokal tetap dibersihkan */ }
    setSession(null); setNotice({ type: 'ok', text: 'Anda telah keluar dengan aman.' });
  };
  const center = label => <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner label={label} /></div>;

  if (!demo && boot !== 'ready') {
    if (boot === 'checking') return center('Menghubungkan ke server…');
    if (devB && boot === 'env') return <devB.LoginPage onLogin={() => setDemo(true)} />;
    return <ConfigErrorPage kind={boot} detail={bootDetail} onRetry={() => setRetry(r => r + 1)} />;
  }
  if (recovery && !demo) {
    if (session === undefined) return center('Memeriksa tautan pemulihan…');
    return <ResetPasswordPage client={client} hasSession={!!session && !linkError} linkError={linkError ? 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.' : null}
      onDone={() => { setRecovery(false); history.replaceState(null, '', location.pathname); }} />;
  }
  if (!demo && session === undefined) return center('Memeriksa sesi…');
  if (!backend) return <LoginPage client={client} server={server} notice={notice} />;

  const user = demo && devB ? devB.user() : { id: session.user.id, email: session.user.email, name: (session.user.user_metadata || {}).full_name };
  return <DataProvider key={user.id + backend.kind} backend={backend} user={user} onLogout={logout}><Shell /></DataProvider>;
}

class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ABSEN DIGITAL] Runtime error:', error, info); }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:20, background:'#f4f6f8' }}>
        <div style={{ maxWidth:620, width:'100%', background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:24, boxShadow:'0 10px 30px rgba(0,0,0,.06)' }}>
          <h2 style={{ marginTop:0, color:'#b42318' }}>Aplikasi mengalami kendala</h2>
          <p>Halaman gagal ditampilkan karena terjadi kesalahan saat menjalankan aplikasi. Muat ulang halaman. Jika masalah berulang, salin pesan di bawah dan kirimkan kepada pengelola.</p>
          <pre style={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere', background:'#f8fafc', padding:12, borderRadius:8, fontSize:12 }}>{String(this.state.error?.message || this.state.error)}</pre>
          <button className="btn btn-dark" onClick={() => location.reload()}>Muat ulang aplikasi</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(<RootErrorBoundary><ToastHost><Root /></ToastHost></RootErrorBoundary>);
