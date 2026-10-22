// Halaman autentikasi: Masuk, Daftar, Lupa kata sandi, Atur kata sandi baru, Ganti server.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function pwPolicy(pw) {
  const errs = [];
  if (pw.length < 8) errs.push('minimal 8 karakter');
  if (!/[a-z]/.test(pw)) errs.push('huruf kecil');
  if (!/[A-Z]/.test(pw)) errs.push('huruf besar');
  if (!/\d/.test(pw)) errs.push('angka');
  return errs;
}
function PwInput({ value, onChange, placeholder, autoComplete, err, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="inwrap">
      <input id={id} className={'input ' + (err ? 'err' : '')} type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} style={{ height: 44 }} />
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

function AuthShell({ children, footer = true }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 452 }}>{children}</div>
      {footer && <p className="small muted" style={{ marginTop: 22, textAlign: 'center' }}>Semua alat administrasi guru dalam satu tempat.</p>}
    </div>
  );
}
function Brand() {
  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      <Logo s={42} />
      <div className="col" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 19, letterSpacing: '.02em' }}>ALAT GURU</h1>
        <p className="small muted tw-pretty" style={{ lineHeight: 1.35 }}>Pusat Administrasi dan Perangkat Pembelajaran Guru</p>
      </div>
    </div>
  );
}
function ServerStatusLine({ server, onOpen }) {
  return (
    <div className="row small" style={{ gap: 8, padding: '10px 12px', borderRadius: 10, background: server ? '#f6f8fa' : 'var(--warnbg)', color: server ? 'var(--ink2)' : '#92400e', marginTop: 18 }}>
      <Icon n={server ? 'server' : 'alert'} s={15} />
      <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {server ? <>Server: <span className="mono">{new URL(server.url).hostname}</span></> : 'Belum terhubung ke server Supabase.'}
      </span>
      {!server && <button className="link" onClick={onOpen} style={{ color: 'inherit' }}>Hubungkan</button>}
    </div>
  );
}

function LoginPage({ client, server, onOpenServer, onDemo, notice }) {
  const [tab, setTab] = useState('masuk');
  const [view, setView] = useState('form'); // form | forgot | verify
  const [verifyEmail, setVerifyEmail] = useState('');
  return (
    <AuthShell>
      <div className="card" style={{ padding: '28px 26px 24px', borderRadius: 16 }}>
        <Brand />
        {view === 'form' && <>
          <div className="seg" style={{ width: '100%', marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button className={tab === 'masuk' ? 'on' : ''} onClick={() => setTab('masuk')} style={{ height: 38 }}>Masuk</button>
            <button className={tab === 'daftar' ? 'on' : ''} onClick={() => setTab('daftar')} style={{ height: 38 }}>Daftar</button>
          </div>
          {notice && <div className={'alert ' + notice.type} style={{ marginTop: 16 }}><Icon n={notice.type === 'ok' ? 'check' : 'info'} s={16} /><div>{notice.text}</div></div>}
          {tab === 'masuk'
            ? <SignInForm client={client} onForgot={() => setView('forgot')} onOpenServer={onOpenServer} />
            : <SignUpForm client={client} onOpenServer={onOpenServer} onVerify={em => { setVerifyEmail(em); setView('verify'); }} />}
        </>}
        {view === 'forgot' && <ForgotForm client={client} onBack={() => setView('form')} onOpenServer={onOpenServer} />}
        {view === 'verify' && <VerifyNotice client={client} email={verifyEmail} onBack={() => { setView('form'); setTab('masuk'); }} />}
        <ServerStatusLine server={server} onOpen={onOpenServer} />
        {!server && (
          <button className="btn btn-block" style={{ marginTop: 10, height: 42 }} onClick={onDemo}>
            <Icon n="zap" s={15} />Coba mode demo (data contoh, hanya di perangkat ini)
          </button>
        )}
      </div>
    </AuthShell>
  );
}

function needServer(client, onOpenServer, setErr) {
  if (!client) { setErr('Hubungkan aplikasi ke server Supabase terlebih dahulu melalui "Ganti server".'); onOpenServer(); return true; }
  if (!navigator.onLine) { setErr('Perangkat sedang offline. Periksa koneksi internet.'); return true; }
  return false;
}

function SignInForm({ client, onForgot, onOpenServer }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [fe, setFe] = useState({}); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    const v = {};
    if (!email.trim()) v.email = 'Email wajib diisi.'; else if (!EMAIL_RE.test(email.trim())) v.email = 'Format email tidak valid.';
    if (!pw) v.pw = 'Kata sandi wajib diisi.';
    setFe(v); if (Object.keys(v).length) return;
    if (needServer(client, onOpenServer, setErr)) return;
    setBusy(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
      if (!data.session) throw new Error('Email not confirmed');
      setOk(true); // pengalihan dilakukan oleh listener sesi
    } catch (e2) { setErr(DB.friendlyError(e2)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 20 }}>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      {ok && <div className="alert ok"><Icon n="check" s={16} /><div>Berhasil masuk. Mengalihkan ke Dashboard…</div></div>}
      <Field label="Email" error={fe.email}>
        <input className={'input ' + (fe.email ? 'err' : '')} style={{ height: 44 }} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" />
      </Field>
      <Field label="Kata sandi" error={fe.pw}>
        <PwInput value={pw} onChange={e => setPw(e.target.value)} placeholder="Masukkan kata sandi" autoComplete="current-password" err={fe.pw} />
      </Field>
      <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}{busy ? 'Memproses…' : 'Masuk'}</button>
      <div className="row between small wrap" style={{ gap: 10 }}>
        <button type="button" className="link" onClick={onForgot}>Lupa kata sandi?</button>
        <button type="button" className="link row" style={{ gap: 5, display: 'inline-flex' }} onClick={onOpenServer}><Icon n="server" s={13} />Ganti server</button>
      </div>
    </form>
  );
}

function SignUpForm({ client, onOpenServer, onVerify }) {
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
    if (needServer(client, onOpenServer, setErr)) return;
    setBusy(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: f.email.trim(), password: f.pw,
        options: { data: { full_name: f.name.trim() }, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) throw error;
      // Supabase mengembalikan user tanpa identitas bila email sudah terdaftar (proteksi enumerasi).
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw Object.assign(new Error('already registered'), { code: 'user_already_exists' });
      if (!data.session) { onVerify(f.email.trim()); return; }
      // Verifikasi email nonaktif: sesi langsung tersedia → listener sesi mengalihkan.
    } catch (e2) { setErr(DB.friendlyError(e2)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 13, marginTop: 20 }}>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      <Field label="Nama lengkap" error={fe.name}><input className={'input ' + (fe.name ? 'err' : '')} style={{ height: 44 }} autoComplete="name" value={f.name} onChange={set('name')} placeholder="mis. Siti Rahmawati, S.Pd." /></Field>
      <Field label="Email" error={fe.email}><input className={'input ' + (fe.email ? 'err' : '')} style={{ height: 44 }} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="nama@sekolah.sch.id" /></Field>
      <Field label="Kata sandi" error={fe.pw}>
        <PwInput value={f.pw} onChange={set('pw')} placeholder="Minimal 8 karakter" autoComplete="new-password" err={fe.pw} />
        <PwStrength pw={f.pw} />
      </Field>
      <Field label="Konfirmasi kata sandi" error={fe.pw2}><PwInput value={f.pw2} onChange={set('pw2')} placeholder="Ulangi kata sandi" autoComplete="new-password" err={fe.pw2} /></Field>
      <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}{busy ? 'Mendaftarkan…' : 'Buat akun'}</button>
      <div className="row small" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="link row" style={{ gap: 5, display: 'inline-flex' }} onClick={onOpenServer}><Icon n="server" s={13} />Ganti server</button>
      </div>
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
    <div className="col" style={{ gap: 14, marginTop: 24 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f2f4', display: 'grid', placeItems: 'center' }}><Icon n="mail" s={20} /></div>
      <h3 style={{ fontSize: 17 }}>Periksa email Anda</h3>
      <p className="muted tw-pretty" style={{ lineHeight: 1.55 }}>Kami mengirim tautan verifikasi ke <b style={{ color: 'var(--ink)' }}>{email}</b>. Buka tautan tersebut, lalu kembali ke sini untuk masuk. Periksa juga folder spam.</p>
      {msg && <div className={'alert ' + msg.t}><Icon n={msg.t === 'ok' ? 'check' : 'alert'} s={16} /><div>{msg.m}</div></div>}
      <button className="btn btn-block btn-lg" disabled={busy || cool > 0} onClick={resend}>{busy && <span className="spin" />}{cool ? `Kirim ulang (${cool} dtk)` : 'Kirim ulang email verifikasi'}</button>
      <button className="link" style={{ alignSelf: 'flex-start' }} onClick={onBack}>← Kembali ke Masuk</button>
    </div>
  );
}

function ForgotForm({ client, onBack, onOpenServer }) {
  const [email, setEmail] = useState(''); const [fe, setFe] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (!EMAIL_RE.test(email.trim())) { setFe('Format email tidak valid.'); return; } setFe('');
    if (needServer(client, onOpenServer, setErr)) return;
    setBusy(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname + '?reset=1' });
      if (error) throw error;
      setSent(true);
    } catch (e2) { setErr(DB.friendlyError(e2)); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 24 }}>
      <div className="col" style={{ gap: 4 }}>
        <h3 style={{ fontSize: 17 }}>Lupa kata sandi</h3>
        <p className="muted small tw-pretty" style={{ lineHeight: 1.5 }}>Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur kata sandi baru.</p>
      </div>
      {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
      {sent ? (
        <div className="alert ok"><Icon n="mail" s={16} /><div>Permintaan telah diproses. Jika email <b>{email}</b> terdaftar, tautan pemulihan akan dikirim. Buka email tersebut dan ikuti tautannya — tautan hanya berlaku sementara.</div></div>
      ) : <>
        <Field label="Email" error={fe}><input className={'input ' + (fe ? 'err' : '')} style={{ height: 44 }} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" /></Field>
        <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}Kirim tautan pemulihan</button>
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
      <div className="card" style={{ padding: '28px 26px', borderRadius: 16 }}>
        <Brand />
        <h3 style={{ fontSize: 17, marginTop: 24 }}>Atur kata sandi baru</h3>
        {!hasSession ? (
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <div className="alert err"><Icon n="alert" s={16} /><div>{linkError || 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.'} Silakan minta tautan baru melalui "Lupa kata sandi".</div></div>
            <button className="btn btn-dark btn-block btn-lg" onClick={onDone}>Kembali ke halaman masuk</button>
          </div>
        ) : ok ? (
          <div className="col" style={{ gap: 14, marginTop: 14 }}>
            <div className="alert ok"><Icon n="check" s={16} /><div>Kata sandi berhasil diperbarui.</div></div>
            <button className="btn btn-dark btn-block btn-lg" onClick={onDone}>Lanjut ke Dashboard</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="col" style={{ gap: 14, marginTop: 14 }}>
            {err && <div className="alert err"><Icon n="alert" s={16} /><div>{err}</div></div>}
            <Field label="Kata sandi baru" error={fe.pw}><PwInput value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" err={fe.pw} /><PwStrength pw={pw} /></Field>
            <Field label="Konfirmasi kata sandi baru" error={fe.pw2}><PwInput value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" err={fe.pw2} /></Field>
            <button className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy && <span className="spin" />}Simpan kata sandi</button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}

// ---------------- Ganti server / Hubungkan ke Supabase ----------------
function ServerModal({ current, onClose, onSaved }) {
  const [url, setUrl] = useState(current ? current.url : '');
  const [key, setKey] = useState(current ? current.key : '');
  const [fe, setFe] = useState({}); const [status, setStatus] = useState(null); // {state, ...}
  const [testedFor, setTestedFor] = useState(null);
  const [step, setStep] = useState('form');
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const sig = url.trim() + '|' + key.trim();
  const tested = status && status.ok && testedFor === sig;
  const isDifferent = current && current.url.replace(/\/+$/, '') !== url.trim().replace(/\/+$/, '');

  const test = async () => {
    const v = DB.validateServerInput(url, key); setFe(v); if (Object.keys(v).length) return;
    setStatus({ state: 'testing' });
    const r = await DB.testConnection(url, key);
    setStatus({ state: 'done', ...r }); setTestedFor(sig);
  };
  const save = () => {
    if (!tested) return;
    DB.saveServer(url.trim(), key.trim());
    toast('Koneksi server disimpan.');
    onSaved();
  };
  const copySql = async () => {
    try { await navigator.clipboard.writeText(window.MIGRATION_SQL); }
    catch { const ta = document.createElement('textarea'); ta.value = window.MIGRATION_SQL; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const steps = ['Buat proyek Supabase gratis atau gunakan proyek yang sudah tersedia.', 'Buka Supabase Dashboard.', 'Pilih SQL Editor.', 'Jalankan migration SQL aplikasi (lihat di bawah).', 'Buka Project Settings → API.', 'Salin Project URL dan publishable key.', 'Masukkan informasi koneksi pada formulir.', 'Uji koneksi.', 'Simpan konfigurasi jika berhasil.'];

  return (
    <Modal size="lg" title="Hubungkan ke Supabase" onClose={onClose}
      sub="Satu proyek Supabase dapat digunakan bersama oleh beberapa modul administrasi guru. Data dapat diakses dari HP dan laptop menggunakan akun yang sama."
      footer={<>
        <button className="btn" onClick={onClose}>Batal</button>
        <button className="btn" onClick={test} disabled={status && status.state === 'testing'}>{status && status.state === 'testing' ? <span className="spin" /> : <Icon n="refresh" s={15} />}Uji Koneksi</button>
        <button className="btn btn-dark" onClick={save} disabled={!tested} title={!tested ? 'Uji koneksi terlebih dahulu' : ''}><Icon n="save" s={15} />Simpan Koneksi</button>
      </>}>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={step === 'form' ? 'on' : ''} onClick={() => setStep('form')}>Koneksi</button>
        <button className={step === 'guide' ? 'on' : ''} onClick={() => setStep('guide')}>Panduan</button>
        <button className={step === 'sql' ? 'on' : ''} onClick={() => setStep('sql')}>SQL Migration</button>
      </div>

      {step === 'guide' && (
        <ol className="col" style={{ gap: 9, paddingLeft: 0, margin: 0, listStyle: 'none' }}>
          {steps.map((s, i) => (
            <li key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 6, background: i === 3 ? 'var(--ink)' : '#f1f2f4', color: i === 3 ? '#fff' : 'var(--ink2)', fontSize: 11.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
              <span style={{ lineHeight: 1.5, paddingTop: 1 }}>{s}{i === 3 && <> <button className="link small" onClick={() => setStep('sql')}>Buka SQL</button></>}</span>
            </li>
          ))}
          <li className="alert info" style={{ marginTop: 6 }}><Icon n="shield" s={16} /><div>Hanya Project URL dan <b>publishable/anon key</b> yang disimpan di browser ini. Jangan pernah memasukkan service role key, secret key, atau kata sandi akun Supabase. Keamanan data dijaga oleh Row Level Security pada migration.</div></li>
        </ol>
      )}

      {step === 'sql' && (
        <div className="col" style={{ gap: 10 }}>
          <div className="row between wrap" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8 }}><Icon n="file" s={15} /><span className="mono small">{window.MIGRATION_FILE}</span></div>
            <button className="btn btn-sm" onClick={copySql}><Icon n={copied ? 'check' : 'copy'} s={14} />{copied ? 'Tersalin' : 'Salin SQL'}</button>
          </div>
          <pre className="code">{window.MIGRATION_SQL}</pre>
          <div className="alert info"><Icon n="info" s={16} /><div>Tempel SQL ini di <b>Supabase → SQL Editor → New query</b>, periksa isinya, lalu klik <b>Run</b>. SQL ini aman dijalankan ulang dan tidak menghapus tabel atau data. Menyalin SQL <b>tidak</b> berarti migration sudah dijalankan — gunakan "Uji Koneksi" untuk memastikan tabel tersedia.</div></div>
        </div>
      )}

      {step === 'form' && (
        <div className="col" style={{ gap: 14 }}>
          {current && <div className="alert info"><Icon n="server" s={16} /><div>Koneksi aktif: <span className="mono">{current.url}</span>. Koneksi aktif tidak diubah sebelum koneksi baru lolos uji dan Anda menekan Simpan.</div></div>}
          <Field label="Project URL" error={fe.url}>
            <input className={'input mono ' + (fe.url ? 'err' : '')} style={{ fontSize: 13 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://abcdefghijkl.supabase.co" autoComplete="off" spellCheck="false" />
          </Field>
          <Field label="Publishable key / anon key" error={fe.key} hint="Ditemukan di Project Settings → API. Diawali sb_publishable_… atau eyJ… (anon).">
            <input className={'input mono ' + (fe.key ? 'err' : '')} style={{ fontSize: 13 }} value={key} onChange={e => setKey(e.target.value)} placeholder="sb_publishable_…" autoComplete="off" spellCheck="false" />
          </Field>
          <div className="row" style={{ gap: 10, padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <span className="dot" style={{ width: 10, height: 10, background: !status ? '#c9ced5' : status.state === 'testing' ? 'var(--izin)' : status.ok ? (status.schemaOk ? 'var(--hadir)' : 'var(--izin)') : 'var(--danger)' }} />
            <span className="small grow" style={{ lineHeight: 1.45 }}>
              {!status ? 'Belum diuji.' : status.state === 'testing' ? 'Menguji koneksi ke server…' : status.message}
              {status && status.state === 'done' && testedFor !== sig && <span className="muted"> (isian berubah — uji ulang)</span>}
            </span>
          </div>
          {tested && !status.schemaOk && <div className="alert warn"><Icon n="db" s={16} /><div>Tabel aplikasi belum ada. Anda tetap dapat menyimpan koneksi, tetapi jalankan <button className="link" onClick={() => setStep('sql')}>SQL migration</button> sebelum masuk agar data dapat disimpan.</div></div>}
          {tested && isDifferent && <div className="alert warn"><Icon n="alert" s={16} /><div>Anda akan beralih ke server berbeda. Server baru mungkin berisi database kosong atau data yang berbeda, dan Anda perlu masuk ulang. Data di server lama <b>tidak</b> dihapus.</div></div>}
          <p className="tiny muted tw-pretty" style={{ lineHeight: 1.5 }}>Konfigurasi ini disimpan di browser perangkat ini (runtime) dan klien Supabase diinisialisasi ulang setelah disimpan — tidak perlu deployment ulang. Untuk versi produksi Next.js, server bawaan dapat juga ditetapkan melalui <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span> dan <span className="mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span>.</p>
        </div>
      )}
    </Modal>
  );
}

Object.assign(window, { LoginPage, ResetPasswordPage, ServerModal, pwPolicy, EMAIL_RE });
