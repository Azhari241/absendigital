// =====================================================================
// ABSEN DIGITAL — Mesin dokumen tunggal untuk Pratinjau, Cetak, PDF, Word, Excel.
// Semua format dibangun dari SATU model dokumen sehingga isi pratinjau = isi ekspor.
//
// Model dokumen:
// {
//   title, subtitle?, meta: { school, address, subject, teacher, year, semester, className, period },
//   columns: [{ h, w?(relatif), align?('left'|'center'|'right') }],
//   rows: [[...]], foot?: [...], notes?: [string], orientation?: 'portrait'|'landscape',
//   signatures: { teacher: bool, principal: bool, city, date, teacherName, teacherNip, principalName, principalNip, teacherRole },
//   filename: 'Rekap_Absensi_Kelas_VII-1_Ganjil_2026-2027'
// }
// =====================================================================
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = v => (v == null || v === '' ? '' : String(v));
  const orient = doc => doc.orientation || (doc.columns.length > 9 ? 'landscape' : 'portrait');

  function metaLines(doc) {
    const m = doc.meta || {};
    const pairs = [
      ['Sekolah', m.school || '—'], ['Mata pelajaran', m.subject || '—'],
      ['Guru', m.teacher || '—'], ['Tahun ajaran', m.year || '—'],
      ['Semester', m.semester || '—'], ['Kelas', m.className || '—'],
      ['Periode', m.period || '—'],
    ];
    return pairs;
  }
  function sigDate(doc) {
    const s = doc.signatures || {};
    return (s.city ? s.city + ', ' : '') + (s.date || L.fmtDate(L.today(), false));
  }

  // ---------------- HTML (dipakai pratinjau DAN cetak langsung) ----------------
  function toHTML(doc) {
    const m = doc.meta || {};
    const cols = doc.columns;
    const totalW = cols.reduce((a, c) => a + (c.w || 1), 0);
    const s = doc.signatures || {};
    const sigBox = (lines, name, nip) => `<div class="ad-sig-box">${lines.map(l => `<div>${esc(l) || '&nbsp;'}</div>`).join('')}<div class="ad-sig-space"></div><div class="ad-sig-name">${esc(name || '..............................')}</div><div>${nip ? 'NIP. ' + esc(nip) : 'NIP. ..............................'}</div></div>`;
    return `<div class="ad-doc ad-${orient(doc)}">
      <div class="ad-kop">
        <div class="ad-school">${esc(m.school || 'Nama sekolah belum diatur')}</div>
        ${m.address ? `<div class="ad-addr">${esc(m.address)}</div>` : ''}
      </div>
      <div class="ad-title">${esc(doc.title)}</div>
      ${doc.subtitle ? `<div class="ad-subtitle">${esc(doc.subtitle)}</div>` : ''}
      <table class="ad-meta"><tbody>${chunk(metaLines(doc), 2).map(r => `<tr>${r.map(([k, v]) => `<td class="k">${esc(k)}</td><td class="c">:</td><td class="v">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${doc.rows.length ? `<table class="ad-tbl">
        <colgroup>${cols.map(c => `<col style="width:${((c.w || 1) / totalW * 100).toFixed(2)}%">`).join('')}</colgroup>
        <thead><tr>${cols.map(c => `<th style="text-align:${c.align || 'center'}">${esc(c.h)}</th>`).join('')}</tr></thead>
        <tbody>${doc.rows.map(r => `<tr>${r.map((v, i) => `<td style="text-align:${(cols[i] && cols[i].align) || 'left'}">${esc(str(v))}</td>`).join('')}</tr>`).join('')}</tbody>
        ${doc.foot ? `<tfoot><tr>${doc.foot.map((v, i) => `<td style="text-align:${(cols[i] && cols[i].align) || 'left'}">${esc(str(v))}</td>`).join('')}</tr></tfoot>` : ''}
      </table>` : `<div class="ad-empty">Tidak ada data untuk filter yang dipilih.</div>`}
      ${doc.notes && doc.notes.length ? `<div class="ad-notes">${doc.notes.map(n => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
      ${s.teacher || s.principal ? `<div class="ad-sigs">
        ${s.principal ? sigBox(['', 'Mengetahui,', 'Kepala Sekolah'], s.principalName, s.principalNip) : '<div></div>'}
        ${s.teacher ? sigBox([sigDate(doc), s.teacherRole || 'Guru Mata Pelajaran', ''], s.teacherName, s.teacherNip) : '<div></div>'}
      </div>` : ''}
      <div class="ad-gen">Dibuat dengan ABSEN DIGITAL · ${esc(new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }))}</div>
    </div>`;
  }
  function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

  // ---------------- Cetak langsung (dialog browser) ----------------
  function print(doc) {
    const root = document.getElementById('print-root');
    root.innerHTML = toHTML(doc);
    let st = document.getElementById('ad-page-style');
    if (!st) { st = document.createElement('style'); st.id = 'ad-page-style'; document.head.appendChild(st); }
    st.textContent = `@page{size:A4 ${orient(doc)};margin:12mm}`;
    const prevTitle = document.title;
    document.title = doc.filename || doc.title; // nama file default saat "Simpan sebagai PDF"
    setTimeout(() => { window.print(); setTimeout(() => { document.title = prevTitle; }, 500); }, 60);
  }

  // ---------------- PDF (jsPDF + AutoTable) ----------------
  function pdf(doc) {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) throw Object.assign(new Error('Library PDF belum dimuat. Periksa koneksi internet lalu muat ulang halaman.'), { friendly: true });
    const o = orient(doc);
    const p = new J({ orientation: o, unit: 'mm', format: 'a4' });
    if (typeof p.autoTable !== 'function') throw Object.assign(new Error('Plugin tabel PDF belum dimuat.'), { friendly: true });
    const W = p.internal.pageSize.getWidth(), M = 12;
    const m = doc.meta || {};
    let y = 14;
    p.setFont('helvetica', 'bold'); p.setFontSize(12);
    p.text(m.school || 'Nama sekolah belum diatur', W / 2, y, { align: 'center' }); y += 5;
    if (m.address) { p.setFont('helvetica', 'normal'); p.setFontSize(9); p.text(m.address, W / 2, y, { align: 'center' }); y += 4; }
    p.setLineWidth(0.6); p.line(M, y, W - M, y); y += 7;
    p.setFont('helvetica', 'bold'); p.setFontSize(13);
    p.text(doc.title, W / 2, y, { align: 'center' }); y += 5;
    if (doc.subtitle) { p.setFont('helvetica', 'normal'); p.setFontSize(9.5); p.text(doc.subtitle, W / 2, y, { align: 'center' }); y += 5; }
    y += 1;
    p.setFontSize(9);
    const ml = chunk(metaLines(doc), 2);
    const colX = [M, M + 28, M + 31, W / 2 + 2, W / 2 + 30, W / 2 + 33];
    ml.forEach(r => {
      r.forEach(([k, v], i) => {
        p.setFont('helvetica', 'normal'); p.text(k, colX[i * 3], y); p.text(':', colX[i * 3 + 1], y);
        p.setFont('helvetica', 'bold'); p.text(p.splitTextToSize(String(v), W / 2 - 36)[0], colX[i * 3 + 2], y);
      });
      y += 4.6;
    });
    y += 2;
    const totalW = doc.columns.reduce((a, c) => a + (c.w || 1), 0);
    const avail = W - M * 2;
    const columnStyles = {};
    doc.columns.forEach((c, i) => { columnStyles[i] = { cellWidth: (c.w || 1) / totalW * avail, halign: c.align || 'left' }; });
    if (doc.rows.length) {
      p.autoTable({
        startY: y, margin: { left: M, right: M, top: 14, bottom: 14 },
        head: [doc.columns.map(c => c.h)],
        body: doc.rows.map(r => r.map(str)),
        foot: doc.foot ? [doc.foot.map(str)] : undefined,
        showFoot: 'lastPage',
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: doc.columns.length > 14 ? 6.5 : doc.columns.length > 10 ? 7.5 : 8.5, cellPadding: 1.4, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: [0, 0, 0], overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [232, 245, 242], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [245, 246, 247], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles,
        didDrawPage: () => {
          const n = p.internal.getNumberOfPages();
          p.setFontSize(7.5); p.setFont('helvetica', 'normal'); p.setTextColor(110);
          p.text((doc.filename || doc.title) + ' · hal. ' + n, W - M, p.internal.pageSize.getHeight() - 7, { align: 'right' });
          p.setTextColor(0);
        },
      });
      y = p.lastAutoTable.finalY + 5;
    } else {
      p.setFont('helvetica', 'italic'); p.text('Tidak ada data untuk filter yang dipilih.', M, y + 4); y += 10;
    }
    const H = p.internal.pageSize.getHeight();
    if (doc.notes && doc.notes.length) {
      p.setFont('helvetica', 'normal'); p.setFontSize(8);
      doc.notes.forEach(n => { const lines = p.splitTextToSize(n, avail); if (y + lines.length * 3.6 > H - 14) { p.addPage(); y = 16; } p.text(lines, M, y); y += lines.length * 3.6; });
      y += 2;
    }
    const s = doc.signatures || {};
    if (s.teacher || s.principal) {
      if (y + 38 > H - 12) { p.addPage(); y = 20; }
      p.setFontSize(9.5); p.setFont('helvetica', 'normal');
      const boxW = 70, lx = M + 6, rx = W - M - boxW;
      const box = (x, lines, name, nip) => {
        let yy = y; lines.forEach(l => { p.text(l, x + boxW / 2, yy, { align: 'center' }); yy += 4.6; });
        yy += 18; p.setFont('helvetica', 'bold'); p.text(name || '..............................', x + boxW / 2, yy, { align: 'center' });
        p.setFont('helvetica', 'normal'); p.text(nip ? 'NIP. ' + nip : 'NIP. ..............................', x + boxW / 2, yy + 4.6, { align: 'center' });
      };
      if (s.principal) box(lx, ['', 'Mengetahui,', 'Kepala Sekolah'], s.principalName, s.principalNip);
      if (s.teacher) box(rx, [sigDate(doc), s.teacherRole || 'Guru Mata Pelajaran', ''], s.teacherName, s.teacherNip);
    }
    p.save((doc.filename || 'dokumen') + '.pdf');
  }

  // ---------------- Word (.docx asli via library docx) ----------------
  async function word(doc) {
    const D = window.docx;
    if (!D || !D.Document) throw Object.assign(new Error('Library Word belum dimuat. Periksa koneksi internet lalu muat ulang halaman.'), { friendly: true });
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, PageOrientation, BorderStyle, VerticalAlign, ShadingType } = D;
    const o = orient(doc);
    const m = doc.meta || {};
    const pageW = o === 'landscape' ? 16838 : 11906, margin = 720; // twips (0,5 inch)
    const usable = pageW - margin * 2;
    const fs = doc.columns.length > 14 ? 14 : doc.columns.length > 10 ? 16 : 19; // half-points
    const P = (text, opt = {}) => new Paragraph({ alignment: opt.align || AlignmentType.LEFT, spacing: { after: opt.after ?? 0, before: opt.before ?? 0 }, children: [new TextRun({ text: str(text), bold: !!opt.bold, size: opt.size || 20, italics: !!opt.italic, font: 'Arial' })] });
    const al = a => (a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT);
    const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
    const cellNB = { top: NONE, bottom: NONE, left: NONE, right: NONE };

    const children = [
      P(m.school || 'Nama sekolah belum diatur', { align: AlignmentType.CENTER, bold: true, size: 26 }),
    ];
    if (m.address) children.push(P(m.address, { align: AlignmentType.CENTER, size: 18 }));
    children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 1 } }, spacing: { after: 160 }, children: [] }));
    children.push(P(doc.title, { align: AlignmentType.CENTER, bold: true, size: 26, after: doc.subtitle ? 40 : 160 }));
    if (doc.subtitle) children.push(P(doc.subtitle, { align: AlignmentType.CENTER, size: 19, after: 160 }));

    // Identitas dokumen (tabel tanpa garis, 2 pasang kolom)
    const ml = chunk(metaLines(doc), 2);
    const mw = [Math.round(usable * .14), Math.round(usable * .02), Math.round(usable * .34)];
    children.push(new Table({
      width: { size: usable, type: WidthType.DXA }, columnWidths: [...mw, ...mw], borders: noBorders,
      rows: ml.map(r => new TableRow({ children: [0, 1].flatMap(i => { const pr = r[i] || ['', '']; return [
        new TableCell({ borders: cellNB, width: { size: mw[0], type: WidthType.DXA }, children: [P(pr[0], { size: 18 })] }),
        new TableCell({ borders: cellNB, width: { size: mw[1], type: WidthType.DXA }, children: [P(pr[0] ? ':' : '', { size: 18 })] }),
        new TableCell({ borders: cellNB, width: { size: mw[2], type: WidthType.DXA }, children: [P(pr[1], { size: 18, bold: true })] }),
      ]; }) })),
    }));
    children.push(P('', { after: 120 }));

    const totalW = doc.columns.reduce((a, c) => a + (c.w || 1), 0);
    const cw = doc.columns.map(c => Math.max(300, Math.floor((c.w || 1) / totalW * usable)));
    const cell = (text, i, opt = {}) => new TableCell({
      width: { size: cw[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      shading: opt.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opt.fill } : undefined,
      children: [new Paragraph({ alignment: opt.head ? AlignmentType.CENTER : al(doc.columns[i] && doc.columns[i].align), children: [new TextRun({ text: str(text), bold: !!opt.bold, size: fs, font: 'Arial' })] })],
    });
    if (doc.rows.length) {
      const rows = [new TableRow({ tableHeader: true, children: doc.columns.map((c, i) => cell(c.h, i, { head: true, bold: true, fill: 'E8F5F2' })) })];
      doc.rows.forEach(r => rows.push(new TableRow({ cantSplit: true, children: r.map((v, i) => cell(v, i)) })));
      if (doc.foot) rows.push(new TableRow({ children: doc.foot.map((v, i) => cell(v, i, { bold: true, fill: 'F5F6F7' })) }));
      children.push(new Table({ width: { size: usable, type: WidthType.DXA }, columnWidths: cw, rows }));
    } else children.push(P('Tidak ada data untuk filter yang dipilih.', { italic: true }));

    if (doc.notes && doc.notes.length) { children.push(P('', { after: 60 })); doc.notes.forEach(n => children.push(P(n, { size: 16 }))); }

    const s = doc.signatures || {};
    if (s.teacher || s.principal) {
      children.push(P('', { after: 240 }));
      const half = Math.floor(usable / 2);
      const sigCell = (lines, name, nip) => new TableCell({ borders: cellNB, width: { size: half, type: WidthType.DXA }, children: [
        ...lines.map(l => P(l, { align: AlignmentType.CENTER, size: 20 })),
        P('', { after: 800 }),
        P(name || '..............................', { align: AlignmentType.CENTER, bold: true, size: 20 }),
        P(nip ? 'NIP. ' + nip : 'NIP. ..............................', { align: AlignmentType.CENTER, size: 20 }),
      ] });
      const empty = new TableCell({ borders: cellNB, width: { size: half, type: WidthType.DXA }, children: [P('')] });
      children.push(new Table({ width: { size: usable, type: WidthType.DXA }, columnWidths: [half, half], borders: noBorders, rows: [new TableRow({ cantSplit: true, children: [
        s.principal ? sigCell(['', 'Mengetahui,', 'Kepala Sekolah'], s.principalName, s.principalNip) : empty,
        s.teacher ? sigCell([sigDate(doc), s.teacherRole || 'Guru Mata Pelajaran', ''], s.teacherName, s.teacherNip) : empty,
      ] })] }));
    }

    const d = new Document({
      creator: 'ABSEN DIGITAL', title: doc.title, description: 'Dokumen dibuat dengan ABSEN DIGITAL',
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838, orientation: o === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: margin, bottom: margin, left: margin, right: margin } } }, children }],
    });
    const blob = await Packer.toBlob(d);
    L.download((doc.filename || 'dokumen') + '.docx', blob);
  }

  // ---------------- Excel (.xlsx) ----------------
  function excel(doc) {
    if (!window.XLSX) throw Object.assign(new Error('Library Excel belum dimuat. Periksa koneksi internet.'), { friendly: true });
    const safe = v => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
    const m = doc.meta || {};
    const pre = [[doc.title], ...(doc.subtitle ? [[doc.subtitle]] : []), [m.school || ''], ...metaLines(doc).map(([k, v]) => [k, v]), []];
    const aoa = [...pre, doc.columns.map(c => c.h), ...doc.rows.map(r => r.map(safe)), ...(doc.foot ? [doc.foot.map(safe)] : [])];
    if (doc.notes) { aoa.push([]); doc.notes.forEach(n => aoa.push([n])); }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = doc.columns.map((c, i) => ({ wch: Math.max(String(c.h).length + 2, Math.round((c.w || 1) * 7), i === 0 ? 16 : 6) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (doc.sheet || 'Rekap').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
    XLSX.writeFile(wb, (doc.filename || 'dokumen') + '.xlsx');
  }

  window.EXP = { toHTML, print, pdf, word, excel, orient };
})();
