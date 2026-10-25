// Komponen UI dasar + grafik SVG ringan.
const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;

// ---------- Toast ----------
const ToastCtx = createContext(() => {});
function ToastHost({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setItems(x => [...x, { id, msg, type }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), type === 'err' ? 5200 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={'toast ' + (t.type === 'err' ? 'err' : '')}>
            <Icon n={t.type === 'err' ? 'alert' : 'check'} s={16} />{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx);

// ---------- Modal ----------
function Modal({ title, sub, onClose, children, footer, size }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="ov" onMouseDown={e => e.target === e.currentTarget && onClose && onClose()}>
      <div className={'modal ' + (size || '')} role="dialog" aria-modal="true">
        <div className="modal-h">
          <div className="col" style={{ gap: 4 }}>
            <h3>{title}</h3>
            {sub && <p className="muted small tw-pretty" style={{ lineHeight: 1.5 }}>{sub}</p>}
          </div>
          {onClose && <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Tutup"><Icon n="x" /></button>}
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
// Konfirmasi. `typeToConfirm` mewajibkan pengguna mengetik teks tertentu (untuk penghapusan berdampak besar).
// Tombol dikunci selama proses → mencegah permintaan berulang. Batal tidak mengubah data.
function Confirm({ title, message, details, confirmLabel = 'Ya, lanjutkan', danger, onConfirm, onClose, typeToConfirm, disabled }) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const locked = disabled || (typeToConfirm && typed.trim() !== typeToConfirm);
  return (
    <Modal title={title} onClose={busy ? null : onClose} footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Batal</button>
      <button className={'btn ' + (danger ? 'btn-dark' : 'btn-teal')} style={danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : null} disabled={busy || locked} onClick={async () => { if (busy) return; setBusy(true); try { await onConfirm(); onClose(); } catch { setBusy(false); } }}>
        {busy ? <span className="spin" /> : danger ? <Icon n="trash" s={15} /> : null}{busy ? 'Memproses…' : confirmLabel}
      </button>
    </>}>
      <div className="col" style={{ gap: 12 }}>
        <p className="tw-pretty" style={{ lineHeight: 1.55, color: 'var(--ink2)' }}>{message}</p>
        {details}
        {typeToConfirm && <Field label={<>Ketik <b className="mono">{typeToConfirm}</b> untuk konfirmasi</>}><input className="input" value={typed} onChange={e => setTyped(e.target.value)} autoFocus /></Field>}
      </div>
    </Modal>
  );
}

// Menu tindakan (⋯): ringkas di HP sehingga tabel tidak melebar.
function ActionMenu({ items, label = 'Tindakan' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const toggle = e => {
    e.stopPropagation();
    if (!open && ref.current) { const r = ref.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - 200, window.innerWidth - 208)) }); }
    setOpen(!open);
  };
  return (
    <>
      <button ref={ref} className="btn btn-ghost btn-sm btn-icon" aria-label={label} aria-haspopup="menu" onClick={toggle}><Icon n="more" s={17} /></button>
      {open && ReactDOM.createPortal(<>
        <div style={{ position: 'fixed', inset: 0, zIndex: 55 }} onClick={e => { e.stopPropagation(); setOpen(false); }} />
        <div className="menu" role="menu" style={{ position: 'fixed', top: Math.min(pos.top, window.innerHeight - items.length * 40 - 16), left: pos.left, right: 'auto', zIndex: 56, minWidth: 200 }}>
          {items.filter(Boolean).map(it => (
            <button key={it.label} role="menuitem" disabled={it.disabled} title={it.title} style={{ color: it.danger ? 'var(--danger)' : undefined, opacity: it.disabled ? .45 : 1 }} onClick={e => { e.stopPropagation(); setOpen(false); it.onClick(); }}>
              <Icon n={it.icon} s={16} />{it.label}
            </button>
          ))}
        </div>
      </>, document.body)}
    </>
  );
}

function Empty({ icon = 'info', title, text, action }) {
  return (
    <div className="empty">
      <div className="ei"><Icon n={icon} s={20} /></div>
      <h4>{title}</h4>
      {text && <p className="tw-pretty">{text}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
function Field({ label, error, children, className, hint }) {
  return (
    <div className={'field ' + (className || '')}>
      {label && <label>{label}</label>}
      {children}
      {hint && !error && <span className="tiny muted">{hint}</span>}
      {error && <span className="ferr">{error}</span>}
    </div>
  );
}
function Toggle({ on, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'tg ' + (on ? 'on' : '')} disabled={disabled} onClick={() => onChange(!on)} />;
}
function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(o => <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}
function AttBadge({ k }) {
  const a = L.ATT_MAP[k]; if (!a) return <span className="badge">—</span>;
  return <span className="badge" style={{ background: a.hex + '18', color: a.hex }}><span className="dot" style={{ background: a.hex }} />{a.label}</span>;
}
function MemBadge({ k }) {
  const cls = { setor: 'teal', belum: 'red', izin: 'warn', bebas: 'purple' }[k] || '';
  return <span className={'badge ' + cls}>{L.MEM[k] || '—'}</span>;
}
function AsgBadge({ k }) {
  const cls = { sudah: 'teal', belum: 'red', terlambat: 'blue', bebas: 'purple' }[k] || '';
  return <span className={'badge ' + cls}>{L.ASG[k] || '—'}</span>;
}
function Spinner({ label }) {
  return <div className="row" style={{ justifyContent: 'center', padding: 40, color: 'var(--mute)' }}><span className="spin" /> {label || 'Memuat…'}</div>;
}
// Logo ABSEN DIGITAL: papan klip bercentang pada ubin teal.
function Logo({ s = 36 }) { return <div className="logo" style={{ width: s, height: s, borderRadius: Math.round(s * .26) }}><Icon n="clipCheck" s={s * .52} w={2} /></div>; }

// ---------- Grafik ----------
function Donut({ data, size = 150, thick = 20, center }) {
  const total = data.reduce((a, b) => a + b.v, 0);
  const r = (size - thick) / 2, C = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f2" strokeWidth={thick} />
      {total > 0 && data.filter(d => d.v > 0).map((d, i) => {
        const len = d.v / total * C;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.c} strokeWidth={thick}
          strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`}><title>{d.l}: {d.v}</title></circle>;
        off += len; return el;
      })}
      {center && <foreignObject x={thick} y={thick} width={size - thick * 2} height={size - thick * 2}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{center}</div>
      </foreignObject>}
    </svg>
  );
}

function useWidth(ref) {
  const [w, setW] = useState(300);
  useEffect(() => {
    if (!ref.current) return;
    setW(Math.max(200, ref.current.clientWidth));
    const ro = new ResizeObserver(e => setW(Math.max(200, e[0].contentRect.width)));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return w;
}
// Bar / line chart generik. series: [{k,label,color}] ; data: [{x, [k]:v}]
function Chart({ data, series, type = 'bar', height = 200, yMax, ySuffix = '', stacked }) {
  const ref = useRef(null); const w = useWidth(ref);
  const [hover, setHover] = useState(null);
  const padL = 34, padB = 26, padT = 10, padR = 8;
  const iw = w - padL - padR, ih = height - padT - padB;
  const vals = data.flatMap(d => stacked ? [series.reduce((a, s) => a + (d[s.k] || 0), 0)] : series.map(s => d[s.k] ?? 0));
  const max = yMax || Math.max(1, ...vals) * 1.1;
  const ticks = [0, .25, .5, .75, 1].map(t => t * max);
  const n = data.length || 1;
  const bw = iw / n;
  const y = v => padT + ih - (v / max) * ih;
  const labelEvery = Math.ceil(n / Math.max(1, Math.floor(iw / 46)));
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', minWidth: 0, overflow: 'hidden' }}>
      <svg width={w} height={height} style={{ display: 'block', maxWidth: '100%' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => <g key={i}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="#eef0f2" />
          <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#9aa1ab">{Math.round(t)}{ySuffix}</text>
        </g>)}
        {data.map((d, i) => {
          const x0 = padL + i * bw;
          return <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={x0} y={padT} width={bw} height={ih} fill={hover === i ? '#f5f6f7' : 'transparent'} />
            {type === 'bar' && (stacked ? (() => {
              let acc = 0; const inner = Math.min(bw * .6, 34);
              return series.map(s => { const v = d[s.k] || 0; const el = <rect key={s.k} x={x0 + (bw - inner) / 2} y={y(acc + v)} width={inner} height={Math.max(0, y(acc) - y(acc + v))} fill={s.color} />; acc += v; return el; });
            })() : series.map((s, j) => {
              const inner = Math.min(bw * .7, series.length * 22); const each = inner / series.length;
              const v = d[s.k]; if (v == null) return null;
              return <rect key={s.k} x={x0 + (bw - inner) / 2 + j * each + 1} y={y(v)} width={Math.max(each - 2, 2)} height={Math.max(0, padT + ih - y(v))} rx="3" fill={s.color} />;
            }))}
            {i % labelEvery === 0 && <text x={x0 + bw / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b7380">{d.x}</text>}
          </g>;
        })}
        {type === 'line' && series.map(s => {
          const pts = data.map((d, i) => d[s.k] == null ? null : [padL + i * bw + bw / 2, y(d[s.k])]).filter(Boolean);
          if (!pts.length) return null;
          return <g key={s.k}>
            <path d={'M' + pts.map(p => p.join(',')).join('L')} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" />
            <path d={'M' + pts[0][0] + ',' + (padT + ih) + 'L' + pts.map(p => p.join(',')).join('L') + 'L' + pts[pts.length - 1][0] + ',' + (padT + ih) + 'Z'} fill={s.color} opacity=".08" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke={s.color} strokeWidth="2" />)}
          </g>;
        })}
      </svg>
      {hover != null && data[hover] && (
        <div style={{ position: 'absolute', top: 4, left: Math.min(padL + hover * bw + bw / 2 + 8, w - 170), background: '#0f1419', color: '#fff', borderRadius: 8, padding: '7px 10px', fontSize: 11.5, pointerEvents: 'none', minWidth: 120, zIndex: 2 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{data[hover].full || data[hover].x}</div>
          {series.map(s => <div key={s.k} className="row" style={{ gap: 6 }}><span className="dot" style={{ background: s.color }} />{s.label}: <b>{data[hover][s.k] == null ? '—' : data[hover][s.k] + ySuffix}</b></div>)}
        </div>
      )}
    </div>
  );
}
function Legend({ items }) {
  return <div className="row wrap" style={{ gap: 12 }}>{items.map(i => <span key={i.label} className="row small muted" style={{ gap: 6 }}><span className="dot" style={{ background: i.color }} />{i.label}</span>)}</div>;
}
function NoData({ text }) {
  return <div className="empty" style={{ padding: '28px 16px' }}><div className="ei"><Icon n="chart" s={18} /></div><h4>Data belum tersedia</h4><p>{text || 'Grafik akan muncul setelah ada data pada filter yang dipilih.'}</p></div>;
}

Object.assign(window, { ToastHost, useToast, Modal, Confirm, ActionMenu, Empty, Field, Toggle, Seg, AttBadge, MemBadge, AsgBadge, Spinner, Logo, Donut, Chart, Legend, NoData });
