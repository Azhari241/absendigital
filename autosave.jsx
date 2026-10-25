// =====================================================================
// Autosave ABSEN DIGITAL
// - Antrean serial (satu permintaan berjalan pada satu waktu) → urutan terjaga,
//   mis. pertemuan PASTI dibuat sebelum catatan absensi yang mengacu padanya.
// - Kunci per item (mis. "att:<siswa>"): perubahan cepat pada item yang sama
//   digabung, hanya nilai terakhir yang dikirim (mencegah duplikasi).
// - Debounce untuk input teks, langsung untuk pilihan status.
// - Retry otomatis untuk gangguan jaringan (3x, jeda bertambah), lalu tombol "Coba lagi".
// - Status "Tersimpan otomatis" HANYA setelah database mengonfirmasi.
// - Selama ada perubahan tertunda/gagal: peringatan saat menutup tab / pindah halaman.
// =====================================================================
const isNetErr = e => { const m = ((e && e.message) || '').toLowerCase(); return !navigator.onLine || m.includes('failed to fetch') || m.includes('network') || m.includes('load failed') || m.includes('timeout'); };
const asSleep = ms => new Promise(r => setTimeout(r, ms));

function useAutosave() {
  const nav = useNav();
  const [st, setSt] = useState({ status: 'idle', at: null, err: null, fails: 0 });
  const pending = useRef(new Map());   // key -> job siap jalan
  const timers = useRef(new Map());    // key -> {t, fn} (debounce)
  const failed = useRef(new Map());    // key -> job gagal (menunggu retry)
  const running = useRef(false);
  const alive = useRef(true);
  const waiters = useRef([]);
  const set = v => alive.current && setSt(v);

  const syncDirty = () => {
    const d = pending.current.size + timers.current.size + failed.current.size > 0 || running.current;
    if (nav && nav.dirtyRef) nav.dirtyRef.current = d;
  };
  useEffect(() => () => { alive.current = false; if (nav && nav.dirtyRef) nav.dirtyRef.current = false; }, []);

  const run = async () => {
    if (running.current) return;
    running.current = true; syncDirty();
    while (pending.current.size) {
      const [key, job] = pending.current.entries().next().value;
      pending.current.delete(key);
      set(s => ({ ...s, status: 'saving' }));
      for (let attempt = 0; ; attempt++) {
        try { await job(); failed.current.delete(key); break; }
        catch (e) {
          if (e && e.validation) { failed.current.set(key, job); set(s => ({ ...s, status: 'error', err: e.message, fails: failed.current.size })); break; }
          if (isNetErr(e) && attempt < 3 && !pending.current.has(key)) { set(s => ({ ...s, status: 'saving', err: 'Koneksi bermasalah, mencoba lagi…' })); await asSleep(1200 * (attempt + 1)); continue; }
          // Bila sudah ada versi lebih baru untuk kunci ini, kegagalan versi lama diabaikan.
          if (!pending.current.has(key)) failed.current.set(key, job);
          set(s => ({ ...s, status: 'error', err: DB.friendlyError(e), fails: failed.current.size }));
          break;
        }
      }
    }
    running.current = false;
    if (failed.current.size) set(s => ({ ...s, status: 'error', fails: failed.current.size }));
    else if (!timers.current.size) set({ status: 'saved', at: new Date(), err: null, fails: 0 });
    syncDirty();
    const w = waiters.current; waiters.current = []; w.forEach(f => f());
  };

  // queue(key, job, { delay }) — job: async () => void (melempar error bila gagal)
  const queue = useCallback((key, job, opt = {}) => {
    failed.current.delete(key);
    const old = timers.current.get(key); if (old) clearTimeout(old.t);
    set(s => ({ ...s, status: s.status === 'saving' ? 'saving' : 'dirty' }));
    if (opt.delay) {
      const t = setTimeout(() => { timers.current.delete(key); pending.current.set(key, job); run(); }, opt.delay);
      timers.current.set(key, { t, job });
    } else { timers.current.delete(key); pending.current.set(key, job); run(); }
    syncDirty();
  }, []);
  const cancel = useCallback(key => { const o = timers.current.get(key); if (o) clearTimeout(o.t); timers.current.delete(key); pending.current.delete(key); failed.current.delete(key); syncDirty(); }, []);
  const retry = useCallback(() => { failed.current.forEach((job, k) => pending.current.set(k, job)); failed.current.clear(); run(); }, []);
  // Kirim semua yang tertunda sekarang (dipakai tombol "Simpan sekarang" dan sebelum pindah pertemuan).
  const flush = useCallback(() => new Promise(resolve => {
    timers.current.forEach(({ t, job }, k) => { clearTimeout(t); pending.current.set(k, job); });
    timers.current.clear();
    failed.current.forEach((job, k) => pending.current.set(k, job)); failed.current.clear();
    if (!pending.current.size && !running.current) return resolve();
    waiters.current.push(resolve); run();
  }), []);
  const hasPending = () => pending.current.size + timers.current.size + failed.current.size > 0 || running.current;
  const isPending = key => pending.current.has(key) || timers.current.has(key) || failed.current.has(key);
  return { ...st, queue, cancel, retry, flush, hasPending, isPending };
}

function AutosaveIndicator({ s, idleText }) {
  const t = s.at ? s.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
  if (s.status === 'dirty') return <span className="as as-dirty" role="status"><span className="dot" />Perubahan belum tersimpan</span>;
  if (s.status === 'saving') return <span className="as as-saving" role="status"><span className="spin" style={{ width: 12, height: 12 }} />{s.err && s.err.includes('mencoba') ? s.err : 'Menyimpan…'}</span>;
  if (s.status === 'saved') return <span className="as as-saved" role="status"><Icon n="cloud" s={14} />Tersimpan otomatis · {t}</span>;
  if (s.status === 'error') return <span className="as as-err" role="alert" title={s.err || ''}><Icon n="alert" s={14} />Gagal menyimpan · <button className="link" style={{ color: 'inherit' }} onClick={s.retry}>Coba lagi</button></span>;
  return idleText ? <span className="as as-idle"><Icon n="cloud" s={14} />{idleText}</span> : null;
}

Object.assign(window, { useAutosave, AutosaveIndicator, isNetErr });
