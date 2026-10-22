// =====================================================================
// Logika domain ALAT GURU — semua perhitungan berasal dari data aktual.
// =====================================================================
(function () {
  const LEVELS = ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const ATT = [
    { k: 'hadir', label: 'Hadir', c: 'var(--hadir)', hex: '#16a34a', short: 'H' },
    { k: 'terlambat', label: 'Terlambat', c: 'var(--terlambat)', hex: '#2563eb', short: 'T' },
    { k: 'izin', label: 'Izin', c: 'var(--izin)', hex: '#f59e0b', short: 'I' },
    { k: 'sakit', label: 'Sakit', c: 'var(--sakit)', hex: '#ef4444', short: 'S' },
    { k: 'alpha', label: 'Alpha', c: 'var(--alpha)', hex: '#8b5cf6', short: 'A' },
    { k: 'bolos', label: 'Bolos', c: 'var(--bolos)', hex: '#334155', short: 'B' },
  ];
  const ATT_MAP = Object.fromEntries(ATT.map(a => [a.k, a]));
  const MEM = { setor: 'Setor', belum: 'Belum', izin: 'Izin', bebas: 'Bebas Setor' };
  const ASG = { belum: 'Belum mengumpulkan', sudah: 'Sudah mengumpulkan', terlambat: 'Terlambat', bebas: 'Bebas Tugas' };
  const NOTE_TYPES = {
    bebas_hafalan: { label: 'Bebas setor hafalan', comp: 'hafalan' },
    bebas_tugas: { label: 'Bebas tugas', comp: 'tugas' },
    tugas_pengganti: { label: 'Tugas pengganti', comp: 'tugas' },
    izin_khusus: { label: 'Izin khusus', comp: 'absensi' },
    remedial: { label: 'Remedial', comp: 'nilai' },
    perpanjangan: { label: 'Perpanjangan tenggat', comp: 'tugas' },
    catatan_keaktifan: { label: 'Catatan keaktifan', comp: 'keaktifan' },
    lainnya: { label: 'Catatan khusus lainnya', comp: 'umum' },
  };
  const VALIDITY = { current: 'Pertemuan saat ini', next: 'Pertemuan berikutnya', count: 'Beberapa pertemuan', until: 'Sampai tanggal tertentu', manual: 'Sampai dicabut guru' };

  // ---------- Tanggal ----------
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const fmtDate = (s, withDay = true) => { if (!s) return '—'; const d = parse(s.slice(0, 10)); return (withDay ? HARI[d.getDay()] + ', ' : '') + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmtShort = s => { if (!s) return '—'; const d = parse(s.slice(0, 10)); return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3); };
  const weekStart = s => { const d = parse(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); };
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const fmtPct = v => (v == null ? '—' : (Number.isInteger(v) ? v : v.toFixed(1)) + '%');
  const avg = arr => { const v = arr.filter(x => x != null && !isNaN(x)); return v.length ? Math.round(v.reduce((a, b) => a + Number(b), 0) / v.length * 10) / 10 : null; };
  const by = (arr, key) => { const m = {}; for (const x of arr) (m[x[key]] = m[x[key]] || []).push(x); return m; };
  const idx = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));
  const sortMeetings = ms => [...ms].sort((a, b) => a.date === b.date ? a.number - b.number : a.date < b.date ? -1 : 1);

  // ---------- Konteks aktif ----------
  function activeContext(d) {
    const year = d.academic_years.find(y => y.is_active) || d.academic_years[0] || null;
    const sem = (year && (d.semesters.find(s => s.academic_year_id === year.id && s.is_active) || d.semesters.find(s => s.academic_year_id === year.id))) || null;
    const settings = d.module_settings[0] || { absensi: true, hafalan: true, tugas: true, keaktifan: true, bebas_semester: false, attendance_threshold: 80, passing_grade: 75, activity_scale_max: 5, report_prefs: {} };
    const profile = d.profiles[0] || {};
    return { year, sem, settings, profile };
  }
  function className(c) { return c ? c.name : '—'; }

  // ---------- Catatan khusus: masa berlaku ----------
  // meeting: {id?, class_id, date, number}
  function meetingsAfterOrigin(note, classMeetings) {
    const ms = sortMeetings(classMeetings.filter(m => m.class_id === note.class_id));
    const origin = note.origin_meeting_id ? ms.find(m => m.id === note.origin_meeting_id) : null;
    if (origin) return ms.filter(m => m.id !== origin.id && (m.date > origin.date || (m.date === origin.date && m.number > origin.number)));
    return ms.filter(m => m.date > note.start_date);
  }
  function noteAppliesTo(note, meeting, allMeetings) {
    if (note.status !== 'aktif') return false;
    if (note.class_id !== meeting.class_id) return false;
    if (meeting.date < note.start_date) return false;
    const after = meetingsAfterOrigin(note, allMeetings).filter(m => m.id !== meeting.id);
    const isOrigin = meeting.id && meeting.id === note.origin_meeting_id;
    // posisi pertemuan kandidat di antara pertemuan setelah asal (0-based)
    const pos = after.filter(m => m.date < meeting.date || (m.date === meeting.date && m.number < meeting.number)).length;
    switch (note.validity) {
      case 'current': return isOrigin || (!note.origin_meeting_id && meeting.date === note.start_date);
      case 'next': return !isOrigin && pos === 0 && (note.origin_meeting_id ? true : meeting.date > note.start_date || meeting.date === note.start_date);
      case 'count': return !isOrigin && pos < (note.valid_count || 1);
      case 'until': return meeting.date <= note.valid_until;
      case 'manual': return true;
      default: return false;
    }
  }
  function noteState(note, allMeetings) {
    if (note.status === 'dicabut') return 'dicabut';
    const t = today();
    if (note.validity === 'manual') return 'aktif';
    if (note.validity === 'until') return t > note.valid_until ? 'kedaluwarsa' : 'aktif';
    const after = meetingsAfterOrigin(note, allMeetings);
    const n = note.validity === 'current' ? 0 : note.validity === 'next' ? 1 : (note.valid_count || 1);
    if (note.validity === 'current') {
      return after.length >= 1 || t > note.start_date ? 'kedaluwarsa' : 'aktif';
    }
    if (after.length >= n) { const last = after[n - 1]; return last.date < t ? 'kedaluwarsa' : 'aktif'; }
    return 'aktif';
  }
  function validityText(note, d) {
    if (note.validity === 'count') return note.valid_count + ' pertemuan berikutnya';
    if (note.validity === 'until') return 'Sampai ' + fmtDate(note.valid_until, false);
    return VALIDITY[note.validity];
  }
  function activeNotesFor(d, meeting, filterType) {
    return d.student_notes.filter(n => (!filterType || n.type === filterType) && noteAppliesTo(n, meeting, d.meetings));
  }

  // ---------- Statistik kehadiran ----------
  function attCounts(records) {
    const c = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0, bolos: 0, total: 0 };
    for (const r of records) { if (c[r.status] != null) { c[r.status]++; c.total++; } }
    c.present = c.hadir + c.terlambat;
    c.pct = pct(c.present, c.total);
    return c;
  }
  // Filter rekaman berdasarkan kelas/semester/rentang tanggal
  function scopeMeetings(d, { classIds, semId, from, to } = {}) {
    return d.meetings.filter(m => (!semId || m.semester_id === semId) && (!classIds || classIds.includes(m.class_id)) && (!from || m.date >= from) && (!to || m.date <= to));
  }
  function recordsFor(table, d, meetings) {
    const ids = new Set(meetings.map(m => m.id));
    return d[table].filter(r => ids.has(r.meeting_id));
  }

  function studentSummary(d, student, semId) {
    const ms = scopeMeetings(d, { semId });
    const mIds = new Set(ms.map(m => m.id));
    const att = d.attendance_records.filter(r => r.student_id === student.id && mIds.has(r.meeting_id));
    const mem = d.memorization_records.filter(r => r.student_id === student.id && mIds.has(r.meeting_id));
    const act = d.activity_records.filter(r => r.student_id === student.id && mIds.has(r.meeting_id) && r.score != null);
    const asgList = d.assignments.filter(a => a.semester_id === semId && a.class_id === student.class_id && (a.target === 'kelas' || (a.student_ids || []).includes(student.id)));
    const asgRec = asgList.map(a => ({ a, r: d.assignment_records.find(r => r.assignment_id === a.id && r.student_id === student.id) }));
    const c = attCounts(att);
    const memSetor = mem.filter(r => r.status === 'setor').length;
    const memReq = mem.filter(r => r.status !== 'bebas').length; // Bebas Setor tidak masuk penyebut & tidak dihitung 100
    const memScore = avg(mem.filter(r => r.status === 'setor').map(r => r.score));
    const asgReq = asgRec.filter(x => (x.r ? x.r.status !== 'bebas' : true) && x.a.due_date <= today());
    const asgDone = asgReq.filter(x => x.r && (x.r.status === 'sudah' || x.r.status === 'terlambat')).length;
    const asgScore = avg(asgRec.filter(x => x.r && x.r.score != null).map(x => x.r.score));
    const scaleMax = activeContext(d).settings.activity_scale_max || 5;
    const actAvg = avg(act.map(r => r.score));
    return {
      att: c, attPct: c.pct,
      memSetor, memReq, memPct: pct(memSetor, memReq), memScore, memBebas: mem.filter(r => r.status === 'bebas').length,
      asgTotal: asgReq.length, asgDone, asgPct: pct(asgDone, asgReq.length), asgScore,
      actAvg, actPct: actAvg == null ? null : Math.round(actAvg / scaleMax * 1000) / 10, actCount: act.length,
    };
  }

  // ---------- Perlu Perhatian ----------
  function attention(d, semId, classIds) {
    const { settings } = activeContext(d);
    const t = today();
    const students = d.students.filter(s => s.status === 'aktif' && (!classIds || classIds.includes(s.class_id)));
    const cls = idx(d.classes);
    const fu = (sid, cat) => d.attention_followups.find(f => f.student_id === sid && f.category === cat);
    const out = { belum_hafalan: [], kehadiran_rendah: [], remedial: [], belum_tugas: [] };
    const ms = scopeMeetings(d, { semId });
    const mIdx = idx(ms);
    for (const s of students) {
      const sm = sortMeetings(ms.filter(m => m.class_id === s.class_id));
      // Kandidat pertemuan berikutnya untuk mengecek pengecualian yang masih berlaku.
      const nextMeeting = { class_id: s.class_id, date: t, number: (sm.length ? sm[sm.length - 1].number : 0) + 1 };
      const exemptHafalan = d.student_notes.some(n => n.student_id === s.id && n.type === 'bebas_hafalan' && noteAppliesTo(n, nextMeeting, d.meetings));
      // 1. Belum setor hafalan: rekaman hafalan terakhir berstatus "belum"
      if (settings.hafalan) {
        const mem = d.memorization_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id]).sort((a, b) => (mIdx[a.meeting_id].date < mIdx[b.meeting_id].date ? -1 : 1));
        const last = mem[mem.length - 1];
        const belumCount = mem.filter(r => r.status === 'belum').length;
        if (last && last.status === 'belum' && !exemptHafalan) {
          out.belum_hafalan.push({ s, cls: cls[s.class_id], reason: 'Belum setor pada pertemuan terakhir', support: belumCount + '× belum setor semester ini', date: mIdx[last.meeting_id].date, fu: fu(s.id, 'belum_hafalan') });
        }
      }
      // 2. Kehadiran rendah
      const att = d.attendance_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id]);
      const c = attCounts(att);
      if (c.total >= 1 && c.pct < settings.attendance_threshold) {
        const lastBad = att.filter(r => !['hadir', 'terlambat'].includes(r.status)).map(r => mIdx[r.meeting_id].date).sort().pop();
        out.kehadiran_rendah.push({ s, cls: cls[s.class_id], reason: 'Kehadiran ' + fmtPct(c.pct) + ' (di bawah ' + settings.attendance_threshold + '%)', support: `H ${c.hadir} · T ${c.terlambat} · I ${c.izin} · S ${c.sakit} · A ${c.alpha} · B ${c.bolos}`, date: lastBad || null, fu: fu(s.id, 'kehadiran_rendah') });
      }
      // 3. Remedial: nilai di bawah KKM atau catatan remedial aktif
      const low = [];
      if (settings.hafalan) d.memorization_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id] && r.status === 'setor' && r.score != null && r.score < settings.passing_grade).forEach(r => low.push({ k: 'Hafalan', v: r.score, date: mIdx[r.meeting_id].date }));
      if (settings.tugas) d.assignment_records.filter(r => r.student_id === s.id && r.score != null && r.score < settings.passing_grade).forEach(r => { const a = d.assignments.find(x => x.id === r.assignment_id); if (a && a.semester_id === semId) low.push({ k: 'Tugas "' + a.title + '"', v: r.score, date: a.due_date }); });
      const remNote = d.student_notes.find(n => n.student_id === s.id && n.type === 'remedial' && noteState(n, d.meetings) === 'aktif');
      // Remedial bila rata-rata komponen di bawah KKM (bukan satu nilai rendah saja).
      const memAvg = avg(d.memorization_records.filter(r => r.student_id === s.id && mIdx[r.meeting_id] && r.status === 'setor' && r.score != null).map(r => r.score));
      const asgAvg = avg(d.assignment_records.filter(r => r.student_id === s.id && r.score != null && (d.assignments.find(x => x.id === r.assignment_id) || {}).semester_id === semId).map(r => r.score));
      const lowAvg = [];
      if (settings.hafalan && memAvg != null && memAvg < settings.passing_grade) lowAvg.push('rata-rata hafalan ' + memAvg);
      if (settings.tugas && asgAvg != null && asgAvg < settings.passing_grade) lowAvg.push('rata-rata tugas ' + asgAvg);
      if (lowAvg.length || remNote) {
        out.remedial.push({ s, cls: cls[s.class_id], reason: remNote ? 'Catatan remedial: ' + remNote.reason : lowAvg.join(' & ') + ' < KKM ' + settings.passing_grade, support: low.length ? low.length + ' nilai di bawah KKM: ' + low.slice(0, 2).map(l => l.k + ' ' + l.v).join(' · ') : '—', date: (low.map(l => l.date).sort().pop()) || (remNote && remNote.start_date), fu: fu(s.id, 'remedial') });
      }
      // 4. Belum mengumpulkan tugas (lewat tenggat, tanpa pembebasan sah)
      if (settings.tugas) {
        const pending = d.assignments.filter(a => a.semester_id === semId && a.class_id === s.class_id && a.due_date < t && (a.target === 'kelas' || (a.student_ids || []).includes(s.id))).filter(a => {
          const r = d.assignment_records.find(r => r.assignment_id === a.id && r.student_id === s.id);
          if (r && r.status !== 'belum') return false;
          const exempt = d.student_notes.some(n => n.student_id === s.id && n.status === 'aktif' && (n.type === 'bebas_tugas' || n.type === 'perpanjangan') && (n.related_assignment_id === a.id) && noteState(n, d.meetings) === 'aktif');
          return !exempt;
        });
        if (pending.length) out.belum_tugas.push({ s, cls: cls[s.class_id], reason: pending.length + ' tugas lewat tenggat', support: pending.map(a => a.title).join(', '), date: pending.map(a => a.due_date).sort()[0], fu: fu(s.id, 'belum_tugas') });
      }
    }
    return out;
  }
  const ATTN_CATS = [
    { k: 'belum_hafalan', label: 'Belum setor hafalan', mod: 'hafalan', c: '#f59e0b' },
    { k: 'kehadiran_rendah', label: 'Kehadiran rendah', mod: 'absensi', c: '#ef4444' },
    { k: 'remedial', label: 'Remedial', mod: null, c: '#8b5cf6' },
    { k: 'belum_tugas', label: 'Belum mengumpulkan tugas', mod: 'tugas', c: '#2563eb' },
  ];

  // ---------- Bebas Semester ----------
  function exemption(d, semId, student, rule) {
    const sum = studentSummary(d, student, semId);
    const checks = [];
    checks.push({ k: 'Kehadiran', v: sum.attPct, min: rule.min_attendance, ok: sum.attPct != null && sum.attPct >= rule.min_attendance });
    checks.push({ k: 'Ketuntasan hafalan', v: sum.memPct, min: rule.min_memorization, ok: sum.memPct != null && sum.memPct >= rule.min_memorization });
    if (rule.use_assignment) checks.push({ k: 'Ketuntasan tugas', v: sum.asgPct, min: rule.min_assignment, ok: sum.asgPct != null && sum.asgPct >= rule.min_assignment });
    if (rule.use_activity) checks.push({ k: 'Keaktifan', v: sum.actPct, min: rule.min_activity, ok: sum.actPct != null && sum.actPct >= rule.min_activity });
    const noData = checks.some(c => c.v == null);
    const ok = checks.every(c => c.ok);
    const review = d.semester_exemption_reviews.find(r => r.semester_id === semId && r.student_id === student.id);
    let status = noData ? 'menunggu' : ok ? 'memenuhi' : 'tidak';
    if (review) status = review.status === 'disetujui' ? 'disetujui' : review.status === 'ditolak' ? 'tidak' : 'menunggu';
    const reasons = checks.filter(c => !c.ok).map(c => c.v == null ? c.k + ': data belum tersedia' : `${c.k} ${fmtPct(c.v)} < ${c.min}%`);
    return { sum, checks, ok, noData, status, review, reasons };
  }
  const EXEMPT_STATUS = { memenuhi: ['Memenuhi syarat', 'teal'], menunggu: ['Menunggu pemeriksaan', 'warn'], disetujui: ['Disetujui', 'dark'], tidak: ['Tidak memenuhi syarat', 'red'] };

  // ---------- Ekspor & cetak ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  // Cegah formula injection pada CSV/Excel
  const safeCell = v => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
  function exportCSV(name, header, rows) {
    const q = v => { v = safeCell(v == null ? '' : v); const s = String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '\ufeff' + [header, ...rows].map(r => r.map(q).join(',')).join('\n');
    download(name + '.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  }
  function exportXLSX(name, sheets, meta) {
    if (!window.XLSX) throw Object.assign(new Error('Library Excel belum dimuat. Periksa koneksi internet.'), { friendly: true });
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const pre = meta ? [[meta.title], [meta.school], [meta.sub], []] : [];
      const ws = XLSX.utils.aoa_to_sheet([...pre, sh.header, ...sh.rows.map(r => r.map(safeCell))]);
      ws['!cols'] = sh.header.map((h, i) => ({ wch: Math.max(String(h).length + 2, i === 1 ? 26 : 10) }));
      XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    }
    XLSX.writeFile(wb, name + '.xlsx');
  }
  function printReport({ title, meta, header, rows, foot, signer }) {
    const root = document.getElementById('print-root');
    root.innerHTML = `<div class="ph"><h2>${esc(title)}</h2>
      <div>${esc(meta.school || 'Nama sekolah belum diatur')}${meta.address ? ' — ' + esc(meta.address) : ''}</div>
      <div>${esc(meta.sub || '')}</div>
      <div>Guru: ${esc(meta.teacher || '—')}${meta.subject ? ' · ' + esc(meta.subject) : ''}</div></div>
      <table><thead><tr>${header.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      ${foot ? `<tfoot><tr>${foot.map(c => `<td><b>${esc(c)}</b></td>`).join('')}</tr></tfoot>` : ''}</table>
      <div class="sig"><div style="text-align:center">${esc(fmtDate(today(), false))}<br>Guru Mata Pelajaran<br><br><br><br><b>${esc(signer || meta.teacher || '')}</b></div></div>`;
    setTimeout(() => window.print(), 50);
  }

  window.L = {
    LEVELS, ATT, ATT_MAP, MEM, ASG, NOTE_TYPES, VALIDITY, ATTN_CATS, EXEMPT_STATUS, HARI, BULAN,
    ymd, today, parse, addDays, fmtDate, fmtShort, weekStart, pct, fmtPct, avg, by, idx, sortMeetings,
    activeContext, className, noteAppliesTo, noteState, validityText, activeNotesFor, meetingsAfterOrigin,
    attCounts, scopeMeetings, recordsFor, studentSummary, attention, exemption,
    esc, download, exportCSV, exportXLSX, printReport,
  };
})();
