// Pratinjau dokumen A4 + tombol ekspor. Pratinjau memakai HTML yang SAMA dengan Cetak Langsung,
// dan model data yang SAMA dengan PDF/Word/Excel → isi pratinjau = isi ekspor.
function DocPreview({ doc, disabled }) {
  const toast = useToast();
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState('');
  const o = EXP.orient(doc);
  const pw = o === 'landscape' ? 1123 : 794;
  useEffect(() => {
    if (!stageRef.current) return;
    const fit = () => { const w = stageRef.current.clientWidth - (window.innerWidth < 640 ? 20 : 44); setScale(Math.min(1, w / pw)); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(stageRef.current); return () => ro.disconnect();
  }, [pw]);
  const html = useMemo(() => EXP.toHTML(doc), [doc]);
  const act = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'pdf') EXP.pdf(doc);
      else if (kind === 'word') await EXP.word(doc);
      else if (kind === 'excel') EXP.excel(doc);
      else EXP.print(doc);
      if (kind !== 'print') toast('Dokumen dibuat: ' + doc.filename + '.' + ({ pdf: 'pdf', word: 'docx', excel: 'xlsx' })[kind]);
    } catch (e) {
      const name = { pdf: 'PDF', word: 'Word', excel: 'Excel', print: 'cetak' }[kind];
      toast('Ekspor ' + name + ' gagal: ' + (e && e.friendly ? e.message : 'terjadi kesalahan saat membuat dokumen.'), 'err');
      console.error(e);
    }
    setBusy('');
  };
  const B = (k, icon, label, cls = '') => <button className={'btn ' + cls} disabled={disabled || !!busy} onClick={() => act(k)}>{busy === k ? <span className="spin" /> : <Icon n={icon} s={15} />}{label}</button>;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <h3>Pratinjau dokumen</h3>
          <span className="tiny muted mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename} · A4 {o === 'landscape' ? 'landscape' : 'portrait'}</span>
        </div>
        <div className="rk-actions">
          {B('pdf', 'pdf', 'Cetak PDF', 'btn-teal')}
          {B('word', 'word', 'Unduh Word')}
          {B('excel', 'sheet', 'Excel')}
          {B('print', 'print', 'Cetak Langsung')}
        </div>
      </div>
      <div className="doc-stage" ref={stageRef}>
        {/* zoom (bukan transform) agar tinggi kertas ikut mengecil dan tidak ada ruang kosong */}
        <div className={'doc-paper ' + (o === 'landscape' ? 'ad-landscape-w' : 'ad-portrait-w')} style={{ zoom: scale }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// Identitas & tanda tangan standar dari profil guru.
function docMeta(ctx, extra = {}) {
  const p = ctx.profile;
  return {
    school: p.school_name, address: p.school_address, subject: p.teacher_subject, teacher: p.full_name,
    year: ctx.year ? ctx.year.name : '', semester: ctx.sem ? ctx.sem.name : '', ...extra,
  };
}
function docSigs(ctx, { teacher = true, principal = false, date } = {}) {
  const p = ctx.profile;
  return { teacher, principal, city: p.school_city || '', date: date ? L.fmtDate(date, false) : L.fmtDate(L.today(), false), teacherName: p.full_name, teacherNip: p.teacher_nip || '', principalName: p.principal_name || '', principalNip: p.principal_nip || '' };
}

Object.assign(window, { DocPreview, docMeta, docSigs });
