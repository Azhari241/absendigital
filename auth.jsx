// Halaman autentikasi ABSEN DIGITAL: Masuk, Daftar Akun, Lupa kata sandi, Atur kata sandi baru.
// Tidak ada akun uji, kredensial contoh, badge simulasi, atau mode demo di alur produksi.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function pwPolicy(pw) {
  const errs = [];
  if (pw.length < 8) errs.push('minimal 8 karakter');
  if (!/[a-z]/.test(pw)) errs.push('huruf kecil');
  if (!/[A-Z]/.test(pw)) errs.push('huruf besar');
  if (!/\d/.test(pw)) errs.push('angka');
  return errs;
}
function PwInput({ value, onChange, placeholder, autoComplete, err, id, lock }) {
  const [show, setShow] = useState(false);
  return (
    <div className={'inwrap ' + (lock ? 'has-lock' : '')}>
      {lock && <span className="lock"><Icon n="lock" s={15} /></span>}
      <input id={id} className={'input auth-in ' + (err ? 'err' : '')} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}><Icon n={show ? 'eyeOff' : 'eye'} s={17} /></button>
    </div>
  );
}
function PwStrength({ pw }) {
  if (!pw) return null;
  const miss = pwPolicy(pw);
  const score = 4 - miss.length;
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row" style={{ gap: 4 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < score ? (score >= 4 ? 'var(--teal)' : score >= 2 ? 'var(--izin)' : 'var(--danger)') : '#e6e8eb' }} />)}</div>
      {miss.length > 0 && <span className="tiny muted">Perlu: {miss.join(', ')}.</span>}
    </div>
  );
}

// Panel kiri (desktop) — identitas & keunggulan aplikasi.
const AUTH_FEATURES = [
  ['cloudCheck', 'Setiap perubahan tersimpan otomatis ke database online'],
  ['file', 'Rekap siswa dalam Word, PDF, dan Excel'],
  ['award', 'Daftar Bebas Semester formal, siap ditempel di sekolah'],
  ['shield', 'Data setiap guru terpisah dan terlindungi'],
];
function AuthBrand({ dark }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      <Logo s={40} />
      <div className="col" style={{ gap: 1, minWidth: 0 }}>
        <b style={{ fontSize: 16, letterSpacing: '.02em', color: dark ? '#fff' : 'var(--ink)' }}>ABSEN DIGITAL</b>
        <span className="tiny tw-pretty" style={{ color: dark ? 'rgba(255,255,255,.62)' : 'var(--mute)', lineHeight: 1.35 }}>Sistem Administrasi Absensi dan Perkembangan Siswa</span>
      </div>
    </div>
  );
}
function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-l" aria-label="Tentang ABSEN DIGITAL">
        <AuthBrand dark />
        <div className="auth-pitch">
          <h1>Absen kelas dalam hitungan detik. Rekap siap cetak kapan saja.</h1>
          <ul>{AUTH_FEATURES.map(([i, t]) => <li key={t}><Icon n={i} s={16} />{t}</li>)}</ul>
        </div>
        <div className="auth-foot">© {new Date().getFullYear()} ABSEN DIGITAL</div>
      </aside>
      <main className="auth-r">
        <div className="auth-mbrand"><AuthBrand /></div>
        <div className="auth-form">{children}</div>
        <div className="auth-mfoot">© {new Date().getFullYear()} ABSEN DIGITAL</div>
      </main>
    </div>
  );
}
function Brand() { return <AuthBrand />; }
function AuthHead({ title, sub }) {
  return <div className="col" style={{ gap: 6, marginBottom: 22 }}><h2 className="auth-h">{title}</h2>{sub && <p className="auth-sub tw-pretty">{sub}</p>}</div>;
}

// Ditampilkan bila Environment Variables belum diatur / database belum siap.
// Guru hanya melihat pesan singkat; detail teknis ada di panel "Untuk pengelola" yang bisa dibuka.
// TIDAK ada mode demo / database simulasi di versi produksi.
function ConfigErrorPage({ kind, detail, onRetry }) {
  const [open, setOpen] = useState(false);
  const title = kind === 'schema' ? 'Database sedang disiapkan' : kind === 'network' ? 'Server tidak dapat dijangkau' : 'Aplikasi belum siap digunakan';
  const msg = kind === 'network' ? 'Periksa koneksi internet Anda lalu coba lagi.' : 'Pengelola aplikasi sedang menyelesaikan konfigurasi. Silakan coba beberapa saat lagi atau hubungi pengelola sekolah Anda.';
  return (
    <AuthShell>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e9ebee', display: 'grid', placeItems: 'center', marginBottom: 14 }}><Icon n={kind === 'network' ? 'wifiOff' : 'server'} s={20} /></div>
      <AuthHead title={title} sub={msg} />
      <button className="btn btn-teal btn-block btn-lg" onClick={onRetry}><Icon n="refresh" s={15} />Coba lagi</button>
      {kind !== 'network' && <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Sembunyikan' : 'Untuk pengelola aplikasi'}</button>
        {open && <div className="col small" style={{ gap: 8, marginTop: 10, lineHeight: 1.55, color: 'var(--ink2)' }}>
          {kind === 'env' ? <>
            <p>Konfigurasi Supabase belum tersedia di build ini{detail ? ': ' + detail : '.'}</p>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>Vercel → Project → Settings → Environment Variables.</li>
              <li>Isi <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> dan <span className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span>.</li>
              <li>Deployments → Redeploy (nilai disisipkan saat build oleh <span className="mono">scripts/build.mjs</span>).</li>
            </ol>
            <p className="tiny muted">Jangan pernah memakai service_role / secret key.</p>
          </> : <>
            <p>Tabel berikut belum ditemukan di database: <span className="mono">{detail}</span>.</p>
            <p>Jalankan file di folder <span className="mono">supabase/migrations/</span> secara berurutan (0001 → 0002 → 0003) di Supabase SQL Editor, sekali saja.</p>
          </>}
        </div>}
      </div>}
    </AuthShell>
  );
}

function LoginPage({ client, notice }) {
  const [view, setView] = useState('masuk'); // masuk | daftar | forgot | verify
  const [verifyEmail, setVerifyEmail] = useState('');
  return (
    <AuthShell>
      {view === 'masuk' && <>
        <AuthHead title="Masuk ke akun guru" sub="Gunakan email dan kata sandi yang terdaftar." />
        {notice && <div className={'alert ' + notice.type} style={{ marginBottom: 14 }}><Icon n={notice.type === 'ok' ? 'check' : 'info'} s={16} /><div>{notice.text}</div></div>}
        <SignInForm client={client} onForgot={() => setView('forgot')} />
        <p className="auth-switch">Belum punya akun? <button className="link auth-link" onClick={() => setView('daftar')}>Daftar Akun</button></p>
      </>}
      {view === 'daftar' && <>
        <AuthHead title="Daftar akun guru" sub="Buat akun sekali, lalu gunakan di laptop maupun HP. Tidak perlu pengaturan database." />
        <SignUpForm client={client} onVerify={em => { setVerifyEmail(em); setView('verify'); }} />
        <p className="auth-switch">Sudah punya akun? <button className="link auth-link" onClick={() => setView('masuk')}>Masuk</button></p>
      </>}
      {view === 'forgot' && <ForgotForm client={client} onBack={() => setView('masuk')} />}
      {view === 'verify' && <VerifyNotice client={client} email={verifyEmail} onBack={() => setView('masuk')} />}
    </AuthShell>
  );
}

function needServer(client, setErr) {
  if (!client) { setErr('Aplikasi belum terhubung ke server. Hubungi pengelola aplikasi.'); return true; }
  if (!navigator.onLine) { setErr('Perangkat sedang offline. Periksa koneksi internet.'); return true; }
  return false;
}

function SignInForm({ client, onForgot }) {
  // Formulir selalu dimulai kosong — tidak ada kredensial contoh.
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [fe, setFe] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {};
    if (!email.trim()) v.email = 'Email wajib diisi.'; else if (!EMAIL_RE.test(email.trim())) v.email = 'Format email tidak valid.';
    if (!pw) v.pw = 'Kata sandi wajib diisi.';
    setFe(v); if (Object.keys(v).length) return;
    if (needServer(client, setErr)) return;
    setBusy(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
      if (!data.session) throw new Error('Email not confirmed');
      setOk(true); // pengalihan dilakukan oleh listener sesi
    } catch (e2) { setErr(DB.friendlyError(e2)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 14 }}>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      {ok && <div className="alert ok"><Icon n="check" s={16} /><div>Berhasil masuk. Mengalihkan ke Dashboard…</div></div>}
      <Field label="Email" error={fe.email}>
        <input className={'input auth-in ' + (fe.email ? 'err' : '')} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" />
      </Field>
      <Field label="Kata sandi" error={fe.pw}>
        <PwInput value={pw} onChange={e => setPw(e.target.value)} placeholder="Masukkan kata sandi" autoComplete="current-password" err={fe.pw} lock />
      </Field>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: -4 }}>
        <button type="button" className="link auth-link small" onClick={onForgot}>Lupa kata sandi?</button>
      </div>
      <button className="btn btn-teal btn-block auth-btn" disabled={busy}>{busy && <span className="spin" />}{busy ? 'Memproses…' : 'Masuk'}</button>
    </form>
  );
}

function SignUpForm({ client, onVerify }) {
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' });
  const [fe, setFe] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {};
    if (f.name.trim().length < 2) v.name = 'Nama lengkap wajib diisi.';
    if (!EMAIL_RE.test(f.email.trim())) v.email = 'Format email tidak valid.';
    const miss = pwPolicy(f.pw); if (miss.length) v.pw = 'Kata sandi perlu: ' + miss.join(', ') + '.';
    if (f.pw2 !== f.pw) v.pw2 = 'Konfirmasi kata sandi tidak sama.';
    setFe(v); if (Object.keys(v).length) return;
    if (needServer(client, setErr)) return;
    setBusy(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: f.email.trim(), password: f.pw,
        // Hanya full_name yang dikirim sebagai metadata. Role selalu 'guru' (ditetapkan trigger database).
        options: { data: { full_name: f.name.trim().slice(0, 120) }, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      // Supabase mengembalikan user tanpa identitas bila email sudah terdaftar (proteksi enumerasi).
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw Object.assign(new Error('already registered'), { code: 'user_already_exists' });
      if (!data.session) { onVerify(f.email.trim()); return; }
      // Verifikasi email nonaktif: sesi langsung tersedia → listener sesi mengalihkan ke Penyiapan Awal.
    } catch (e2) { setErr(DB.friendlyError(e2)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 13 }}>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      <Field label="Nama lengkap" error={fe.name}><input className={'input auth-in ' + (fe.name ? 'err' : '')} autoComplete="name" value={f.name} onChange={set('name')} placeholder="mis. Siti Rahmawati, S.Pd." /></Field>
      <Field label="Email" error={fe.email}><input className={'input auth-in ' + (fe.email ? 'err' : '')} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="nama@sekolah.sch.id" /></Field>
      <Field label="Kata sandi" error={fe.pw}>
        <PwInput value={f.pw} onChange={set('pw')} placeholder="Minimal 8 karakter" autoComplete="new-password" err={fe.pw} lock />
        <PwStrength pw={f.pw} />
      </Field>
      <Field label="Konfirmasi kata sandi" error={fe.pw2}><PwInput value={f.pw2} onChange={set('pw2')} placeholder="Ulangi kata sandi" autoComplete="new-password" err={fe.pw2} lock /></Field>
      <button className="btn btn-teal btn-block auth-btn" disabled={busy}>{busy && <span className="spin" />}{busy ? 'Mendaftarkan…' : 'Daftar Akun'}</button>
    </form>
  );
}

function VerifyNotice({ client, email, onBack }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [cool, setCool] = useState(0);
  useEffect(() => { if (!cool) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const resend = async () => {
    setBusy(true); setMsg(null);
    try {
      const { error } = await client.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      setMsg({ t: 'ok', m: 'Email verifikasi dikirim ulang.' }); setCool(60);
    } catch (e) { setMsg({ t: 'err', m: DB.friendlyError(e) }); }
    setBusy(false);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e9ebee', display: 'grid', placeItems: 'center' }}><Icon n="mail" s={20} /></div>
      <h2 className="auth-h">Periksa email Anda</h2>
      <p className="muted tw-pretty" style={{ lineHeight: 1.55 }}>Kami mengirim tautan verifikasi ke <b style={{ color: 'var(--ink)' }}>{email}</b>. Buka tautan tersebut, lalu kembali ke sini untuk masuk. Periksa juga folder spam.</p>
      {msg && <div className={'alert ' + msg.t}><Icon n={msg.t === 'ok' ? 'check' : 'alert'} s={16} /><div>{msg.m}</div></div>}
      <button className="btn btn-block btn-lg" disabled={busy || cool > 0} onClick={resend}>{busy && <span className="spin" />}{cool ? `Kirim ulang (${cool} dtk)` : 'Kirim ulang email verifikasi'}</button>
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Kembali ke Masuk</button>
    </div>
  );
}

function ForgotForm({ client, onBack }) {
  const [email, setEmail] = useState(''); const [fe, setFe] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!EMAIL_RE.test(email.trim())) { setFe('Format email tidak valid.'); return; } setFe('');
    if (needServer(client, setErr)) return;
    setBusy(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname + '?reset=1' });
      if (error) throw error;
      setSent(true);
    } catch (e2) { setErr(DB.friendlyError(e2)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 14 }}>
      <AuthHead title="Lupa kata sandi" sub="Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur kata sandi baru." />
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      {sent ? (
        <div className="alert ok"><Icon n="mail" s={16} /><div>Permintaan telah diproses. Jika email <b>{email}</b> terdaftar, tautan pemulihan akan dikirim. Buka email tersebut dan ikuti tautannya — tautan hanya berlaku sementara.</div></div>
      ) : <>
        <Field label="Email" error={fe}><input className={'input auth-in ' + (fe ? 'err' : '')} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" /></Field>
        <button className="btn btn-teal btn-block auth-btn" disabled={busy}>{busy && <span className="spin" />}Kirim tautan pemulihan</button>
      </>}
      <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Kembali ke Masuk</button>
    </form>
  );
}

function ResetPasswordPage({ client, hasSession, linkError, onDone }) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [fe, setFe] = useState({});
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {}; const miss = pwPolicy(pw);
    if (miss.length) v.pw = 'Kata sandi perlu: ' + miss.join(', ') + '.';
    if (pw2 !== pw) v.pw2 = 'Konfirmasi tidak sama.';
    setFe(v); if (Object.keys(v).length) return;
    setBusy(true);
    try { const { error } = await client.auth.updateUser({ password: pw }); if (error) throw error; setOk(true); }
    catch (e2) { setErr(DB.friendlyError(e2)); }
    setBusy(false);
  };
  return (
    <AuthShell>
      <div>
        <AuthHead title="Atur kata sandi baru" sub="Buat kata sandi baru untuk akun ABSEN DIGITAL Anda." />
        {!hasSession ? (
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <div className="alert err"><Icon n="alert" s={16} /><div>{linkError || 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.'} Silakan minta tautan baru melalui "Lupa kata sandi".</div></div>
            <button className="btn btn-teal btn-block auth-btn" onClick={onDone}>Kembali ke halaman masuk</button>
          </div>
        ) : ok ? (
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <div className="alert ok"><Icon n="check" s={16} /><div>Kata sandi berhasil diperbarui.</div></div>
            <button className="btn btn-teal btn-block auth-btn" onClick={onDone}>Lanjut ke Dashboard</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 14 }}>
            {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
            <Field label="Kata sandi baru" error={fe.pw}><PwInput value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" err={fe.pw} /><PwStrength pw={pw} /></Field>
            <Field label="Konfirmasi kata sandi baru" error={fe.pw2}><PwInput value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" err={fe.pw2} /></Field>
            <button className="btn btn-teal btn-block auth-btn" disabled={busy}>{busy && <span className="spin" />}Simpan kata sandi</button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

// ---------------- Panel pengelola (hanya untuk profiles.role = 'admin') ----------------
// Tidak ada formulir URL/key: koneksi berasal dari Environment Variables.
// Panel ini hanya mendiagnosis koneksi & skema serta menampilkan SQL migration untuk pengelola.
function AdminServerPanel() {
  const { backend } = useApp();
  const server = DB.getServer();
  const [st, setSt] = useState(null); const [sqlTab, setSqlTab] = useState('0002'); const [copied, setCopied] = useState(false);
  const run = async () => {
    setSt({ busy: true });
    const conn = await DB.testConnection(server.url, server.key);
    const schema = backend.client ? await DB.checkSchema(backend.client) : { ok: false, missing: [] };
    let rpc = false, v3 = false;
    try { const { error } = await backend.client.rpc('is_admin'); rpc = !error; } catch { rpc = false; }
    try { const { error } = await backend.client.from('student_progress_notes').select('id', { head: true, count: 'exact' }).limit(1); v3 = !error; } catch { v3 = false; }
    setSt({ conn, schema, rpc, v3 });
  };
  const sql = sqlTab === '0001' ? window.MIGRATION_SQL : sqlTab === '0002' ? window.MIGRATION_0002_SQL : window.MIGRATION_0003_SQL;
  const file = sqlTab === '0001' ? window.MIGRATION_FILE : sqlTab === '0002' ? window.MIGRATION_0002_FILE : window.MIGRATION_0003_FILE;
  const copy = async () => { try { await navigator.clipboard.writeText(sql); } catch { const t = document.createElement('textarea'); t.value = sql; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const host = server && server.url ? new URL(server.url).hostname : '—';
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card card-pad col" style={{ gap: 12 }}>
        <div className="row between wrap" style={{ gap: 8 }}><b>Koneksi server (Environment Variables)</b><span className="badge dark">Khusus pengelola</span></div>
        <div className="row small" style={{ gap: 8 }}><Icon n="server" s={15} /><span className="mono">{host}</span><span className="tiny muted">key: {server && server.key ? server.key.slice(0, 16) + '…' : '—'}</span></div>
        <p className="tiny muted tw-pretty" style={{ lineHeight: 1.5 }}>Untuk mengganti server, ubah <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> dan <span className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span> di Vercel lalu Redeploy. Data di server lama tidak terpengaruh.</p>
        <div className="row" style={{ gap: 8 }}><button className="btn" onClick={run} disabled={st && st.busy}>{st && st.busy ? <span className="spin" /> : <Icon n="refresh" s={15} />}Diagnosa koneksi & skema</button></div>
        {st && !st.busy && <div className="col" style={{ gap: 6 }}>
          <div className={'alert ' + (st.conn.authOk ? 'ok' : 'err')}><Icon n={st.conn.authOk ? 'check' : 'alert'} s={16} /><div>Auth: {st.conn.authOk ? 'terhubung' : st.conn.message}</div></div>
          <div className={'alert ' + (st.schema.ok ? 'ok' : 'warn')}><Icon n="db" s={16} /><div>Skema 0001: {st.schema.ok ? 'tabel inti lengkap (' + DB.REQUIRED_TABLES.length + ')' : 'tabel hilang: ' + st.schema.missing.join(', ')}</div></div>
          <div className={'alert ' + (st.rpc ? 'ok' : 'warn')}><Icon n="shield" s={16} /><div>Migration 0002 (penghapusan aman): {st.rpc ? 'terpasang' : 'belum terpasang — jalankan 0002'}</div></div>
          <div className={'alert ' + (st.v3 ? 'ok' : 'warn')}><Icon n="db" s={16} /><div>Migration 0003 (perkembangan siswa, riwayat Bebas Semester, NISN, status tugas): {st.v3 ? 'terpasang' : 'belum terpasang — jalankan 0003'}</div></div>
        </div>}
      </div>
      <div className="card card-pad col" style={{ gap: 10 }}>
        <div className="row between wrap" style={{ gap: 8 }}>
          <Seg value={sqlTab} onChange={setSqlTab} options={[{ v: '0001', l: '0001 init' }, { v: '0002', l: '0002 keamanan' }, { v: '0003', l: '0003 ABSEN DIGITAL' }]} />
          <button className="btn btn-sm" onClick={copy}><Icon n={copied ? 'check' : 'copy'} s={14} />{copied ? 'Tersalin' : 'Salin SQL'}</button>
        </div>
        <span className="mono tiny muted">{file}</span>
        <pre className="code">{sql}</pre>
        <div className="alert info"><Icon n="info" s={16} /><div>Jalankan berurutan (0001 → 0002 → 0003) di Supabase → SQL Editor, sekali saja. Semuanya aditif & idempoten: tidak menghapus tabel/data dan tidak mematikan RLS. Menyalin SQL tidak berarti migration sudah berjalan — gunakan Diagnosa untuk memastikan.</div></div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginPage, ResetPasswordPage, ConfigErrorPage, AdminServerPanel, pwPolicy, EMAIL_RE });
