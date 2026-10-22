// Akar aplikasi: memilih backend, mengelola sesi Supabase Auth, dan mode demo.
function Root() {
  const [server, setServer] = useState(DB.getServer());
  const [client, setClient] = useState(null);
  const [clientErr, setClientErr] = useState('');
  const [session, setSession] = useState(undefined); // undefined = memeriksa
  const [demo, setDemo] = useState(() => !DB.getServer() && DB.demoSession.get());
  const [showServer, setShowServer] = useState(false);
  const [notice, setNotice] = useState(null);
  const urlParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const [recovery, setRecovery] = useState(urlParams.get('reset') === '1' || hashParams.get('type') === 'recovery');
  const [linkError] = useState(hashParams.get('error_description') || urlParams.get('error_description') || null);

  // Inisialisasi ulang klien setiap kali konfigurasi server berubah.
  useEffect(() => {
    setSession(undefined); setClientErr('');
    if (!server) { setClient(null); setSession(null); return; }
    let c;
    try { c = DB.makeClient(server.url, server.key); } catch (e) { setClientErr(e.message); setClient(null); setSession(null); return; }
    setClient(c);
    let alive = true;
    c.auth.getSession().then(({ data }) => alive && setSession(data.session || null)).catch(() => alive && setSession(null));
    const { data: sub } = c.auth.onAuthStateChange((event, s) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setSession(prev => { if (prev) setNotice({ type: 'info', text: 'Anda telah keluar. Silakan masuk kembali.' }); return null; });
      else if (event === 'TOKEN_REFRESHED' && !s) { setSession(null); setNotice({ type: 'info', text: 'Sesi berakhir. Silakan masuk kembali.' }); }
      else setSession(s || null);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [server]);

  // Bersihkan token dari URL setelah diproses.
  useEffect(() => {
    if (session && (location.hash.includes('access_token') || location.search.includes('code='))) history.replaceState(null, '', location.pathname + (recovery ? '?reset=1' : ''));
  }, [session]);

  const backend = useMemo(() => {
    if (demo) {
      const b = DB.DemoBackend();
      if (!b.hasData()) b.seed(window.buildDemoSeed(DB, L, 'Guru Demo', 'demo@alatguru.local'));
      return b;
    }
    if (client && session) return DB.SupabaseBackend(client);
    return null;
  }, [demo, client, session && session.user && session.user.id]);

  const logout = async () => {
    if (demo) { DB.demoSession.set(false); setDemo(false); setNotice({ type: 'info', text: 'Keluar dari mode demo. Data contoh tetap ada di perangkat ini.' }); return; }
    try { await client.auth.signOut(); } catch { /* sesi lokal tetap dibersihkan */ }
    localStorage.removeItem('alatguru.route');
    setSession(null); setNotice({ type: 'ok', text: 'Anda telah keluar dengan aman.' });
  };

  const serverModal = showServer && <ServerModal current={server} onClose={() => setShowServer(false)} onSaved={() => {
    setShowServer(false); DB.demoSession.set(false); setDemo(false);
    const s = DB.getServer();
    if (client && session) client.auth.signOut().catch(() => {});
    setServer(s); setNotice({ type: 'ok', text: 'Server tersimpan. Silakan masuk atau daftar akun di server ini.' });
  }} />;

  if (recovery && !demo) {
    if (session === undefined) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner label="Memeriksa tautan pemulihan…" /></div>;
    return <ResetPasswordPage client={client} hasSession={!!session && !linkError} linkError={linkError ? 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.' : null}
      onDone={() => { setRecovery(false); history.replaceState(null, '', location.pathname); }} />;
  }
  if (!demo && session === undefined) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner label="Memeriksa sesi…" /></div>;

  if (!backend) return <>
    <LoginPage client={client} server={server} onOpenServer={() => setShowServer(true)} notice={clientErr ? { type: 'err', text: clientErr } : notice}
      onDemo={() => { DB.demoSession.set(true); setDemo(true); setNotice(null); }} />
    {serverModal}
  </>;

  const user = demo ? { id: 'demo-user', email: 'demo@alatguru.local', name: 'Guru Demo' } : { id: session.user.id, email: session.user.email, name: (session.user.user_metadata || {}).full_name };
  return <DataProvider key={user.id + backend.kind} backend={backend} user={user} onLogout={logout}><Shell /></DataProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<ToastHost><Root /></ToastHost>);
