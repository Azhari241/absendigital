// Data contoh untuk MODE DEMO saja (tidak pernah dikirim ke server Supabase).
(function () {
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const NAMES_L = ['Ahmad Rizki Maulana', 'Andi Fathur Rahman', 'Dzakwan Al-Farisi', 'Hafidz Hidayat', 'M. Alif Ramadhan', 'Raihan Al-Ghazali', 'Umar Faruq', 'Zidan Maulana', 'Fikri Haikal', 'Bilal Mubarak', 'Naufal Azzam', 'Yusuf Habibi', 'Rafi Ardiansyah', 'Ilham Saputra', 'Khalid Anwar', 'Hamzah Firdaus', 'Daffa Pratama', 'Arkan Wicaksono'];
  const NAMES_P = ['Aisyah Bahar', 'Citra Lestari', 'Fatimah Az-Zahra', 'Intan Salsabila', 'Nabila Syafitri', 'Siti Nurhaliza', 'Zahra Amalia', 'Khadijah Putri', 'Hana Rahmawati', 'Salma Kamilah', 'Nadia Kusuma', 'Alya Rahma', 'Maryam Hasna', 'Rania Azzahra', 'Syifa Aulia', 'Laila Nuraini', 'Dinda Maharani', 'Kayla Safira'];
  const SURAH = ['QS. An-Naba 1–10', 'QS. An-Naba 11–20', 'QS. An-Naba 21–30', 'QS. An-Naba 31–40', "QS. An-Nazi'at 1–15", "QS. An-Nazi'at 16–30", "QS. An-Nazi'at 31–46", 'QS. Abasa 1–21', 'QS. Abasa 22–42', 'QS. At-Takwir 1–14', 'QS. At-Takwir 15–29', 'QS. Al-Infitar 1–19', 'QS. Al-Mutaffifin 1–17'];
  const TOPICS = ['Pengenalan materi & kontrak belajar', 'Mufradat: Al-Madrasah', 'Hiwar: Perkenalan', 'Qira\'ah: Fi al-Fashl', 'Kitabah: Menyusun kalimat', 'Mufradat: Al-Usrah', 'Qawa\'id: Isim isyarah', 'Hiwar: Di rumah', 'Latihan & evaluasi bab 1', 'Mufradat: As-Sa\'ah', 'Qawa\'id: Dhamir', 'Qira\'ah: Yaumiyyati', 'Kitabah: Paragraf pendek'];

  window.buildDemoSeed = function (DB, L, fullName, email) {
    const r = rng(20261021);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const id = DB.uuid; const now = DB.nowIso();
    const owner = 'demo-user';
    const T = {}; DB.TABLES.forEach(t => T[t] = []);
    const base = x => ({ owner_id: owner, created_at: now, updated_at: now, ...x });

    T.profiles.push(base({ id: owner, full_name: fullName || 'Guru Demo', email: email || 'demo@alatguru.local', status: 'aktif', role: 'guru', teacher_subject: 'Bahasa Arab', school_name: 'MTs Contoh Nusantara', school_address: 'Jl. Pendidikan No. 1' }));
    const yr = base({ id: id(), name: '2026/2027', is_active: true }); T.academic_years.push(yr);
    const sem = base({ id: id(), academic_year_id: yr.id, name: 'Ganjil', is_active: true }); T.semesters.push(sem);
    T.semesters.push(base({ id: id(), academic_year_id: yr.id, name: 'Genap', is_active: false }));
    T.module_settings.push(base({ id: id(), absensi: true, hafalan: true, tugas: true, keaktifan: true, bebas_semester: true, attendance_threshold: 80, passing_grade: 75, activity_scale_max: 5, report_prefs: { show_signature: true } }));
    T.semester_exemption_rules.push(base({ id: id(), semester_id: sem.id, min_attendance: 95, min_memorization: 80, min_assignment: 80, min_activity: 0, use_assignment: false, use_activity: false, extra_requirements: 'Tidak memiliki catatan pelanggaran berat.' }));

    const classDefs = [['VII', 'VII.1', 1], ['VII', 'VII.2', 4], ['VIII', 'VIII.1', 2], ['IX', 'IX.1', 3], ['X', 'X.1', 1], ['XI', 'XI.1', 5]];
    const startDate = '2026-07-14';
    let nameCursor = 0;
    for (const [level, cname, dow] of classDefs) {
      const cls = base({ id: id(), academic_year_id: yr.id, level, name: cname, archived: false }); T.classes.push(cls);
      const n = 12 + Math.floor(r() * 4);
      const studs = [];
      for (let i = 0; i < n; i++) {
        const g = (i + nameCursor) % 2 === 0 ? 'L' : 'P';
        const pool = g === 'L' ? NAMES_L : NAMES_P;
        const nm = pool[(Math.floor((i + nameCursor) / 2)) % pool.length];
        const s = base({ id: id(), class_id: cls.id, full_name: nm, nis: String(2026000 + T.students.length + 1), gender: g, status: 'aktif', join_date: '2026-07-13', notes: '' });
        s._p = 0.82 + r() * 0.17; s._m = 0.6 + r() * 0.38; s._a = r();
        studs.push(s); T.students.push(s);
      }
      nameCursor += 3;
      studs.sort((a, b) => a.full_name.localeCompare(b.full_name));
      // Pertemuan mingguan sampai sebelum hari ini
      let d = L.parse(startDate); while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
      const meetings = [];
      let num = 1; const end = L.today();
      while (L.ymd(d) < end && num <= 14) {
        const m = base({ id: id(), class_id: cls.id, semester_id: sem.id, date: L.ymd(d), number: num, topic: TOPICS[(num - 1) % TOPICS.length], notes: '' });
        meetings.push(m); T.meetings.push(m);
        ['absensi', 'hafalan', 'tugas', 'keaktifan'].forEach(mod => T.meeting_modules.push(base({ id: id(), meeting_id: m.id, module: mod, enabled: true })));
        const target = base({ id: id(), class_id: cls.id, semester_id: sem.id, title: SURAH[(num - 1) % SURAH.length], description: '' });
        T.memorization_targets.push(target);
        for (const s of studs) {
          const x = r();
          let st = x < s._p ? 'hadir' : x < s._p + 0.04 ? 'terlambat' : x < s._p + 0.08 ? 'izin' : x < s._p + 0.12 ? 'sakit' : x < s._p + 0.16 ? 'alpha' : 'bolos';
          if (st === 'bolos' && r() < .6) st = 'alpha';
          T.attendance_records.push(base({ id: id(), meeting_id: m.id, student_id: s.id, status: st, late_minutes: st === 'terlambat' ? 5 + Math.floor(r() * 20) : null, note: st === 'sakit' ? 'Demam' : st === 'izin' ? 'Keperluan keluarga' : '' }));
          const present = st === 'hadir' || st === 'terlambat';
          const mst = !present ? (st === 'izin' || st === 'sakit' ? 'izin' : 'belum') : r() < s._m ? 'setor' : 'belum';
          T.memorization_records.push(base({ id: id(), meeting_id: m.id, student_id: s.id, target_id: target.id, status: mst, score: mst === 'setor' ? 65 + Math.floor(r() * 35) : null, comment: '' }));
          if (present) T.activity_records.push(base({ id: id(), meeting_id: m.id, student_id: s.id, score: Math.max(1, Math.min(5, Math.round(2 + s._a * 3 + (r() - .5)))), note: '' }));
        }
        if (num % 3 === 0) {
          const due = L.addDays(L.ymd(d), 7);
          const a = base({ id: id(), class_id: cls.id, semester_id: sem.id, meeting_id: m.id, title: 'Latihan ' + TOPICS[(num - 1) % TOPICS.length].split(':')[0] + ' #' + (num / 3), description: 'Kerjakan latihan pada buku paket.', due_date: due, target: 'kelas', student_ids: [] });
          T.assignments.push(a);
          if (due < end) for (const s of studs) {
            const y = r();
            const st = y < .72 ? 'sudah' : y < .84 ? 'terlambat' : 'belum';
            T.assignment_records.push(base({ id: id(), assignment_id: a.id, student_id: s.id, status: st, score: st === 'belum' ? null : 60 + Math.floor(r() * 40), comment: '', submitted_at: st === 'belum' ? null : due }));
          }
        }
        num++; d.setDate(d.getDate() + 7);
      }
      // Catatan khusus contoh
      const aisyah = studs.find(s => s.full_name === 'Aisyah Bahar');
      const lastM = meetings[meetings.length - 1];
      if (aisyah && lastM) {
        const nt = base({ id: id(), student_id: aisyah.id, class_id: cls.id, type: 'bebas_hafalan', component: 'hafalan', related_assignment_id: null, reason: 'Telah menyetor hafalan tambahan pada pertemuan sebelumnya.', start_date: lastM.date, origin_meeting_id: lastM.id, validity: 'next', valid_count: null, valid_until: null, status: 'aktif', created_by: fullName || 'Guru Demo' });
        T.student_notes.push(nt);
        T.note_history.push(base({ id: id(), note_id: nt.id, action: 'dibuat', detail: 'Catatan dibuat pada pertemuan ke-' + lastM.number }));
      }
      if (cname === 'VIII.1' && lastM) {
        const s2 = studs[3];
        const nt = base({ id: id(), student_id: s2.id, class_id: cls.id, type: 'remedial', component: 'nilai', related_assignment_id: null, reason: 'Remedial hafalan QS. An-Naba ayat 21–30.', start_date: lastM.date, origin_meeting_id: lastM.id, validity: 'count', valid_count: 2, valid_until: null, status: 'aktif', created_by: fullName || 'Guru Demo' });
        T.student_notes.push(nt);
        T.note_history.push(base({ id: id(), note_id: nt.id, action: 'dibuat', detail: 'Catatan dibuat pada pertemuan ke-' + lastM.number }));
      }
    }
    T.students.forEach(s => { delete s._p; delete s._m; delete s._a; });
    const mat = (level, title, desc, url) => T.learning_materials.push(base({ id: id(), level, semester_id: sem.id, title, description: desc, url }));
    mat('VII', 'Modul Bab 1 — At-Ta\'aruf', 'Slide pengenalan diri dan mufradat dasar.', 'https://docs.google.com/presentation/');
    mat('VII', 'Lembar Kerja Mufradat', 'Latihan menjodohkan kosakata.', 'https://docs.google.com/document/');
    mat('VIII', 'Bank Soal Qawa\'id', 'Kumpulan soal isim isyarah dan dhamir.', 'https://drive.google.com/');
    mat('IX', 'Video Hiwar Fi al-Maktabah', 'Video percakapan untuk latihan istima\'.', 'https://www.youtube.com/');
    T.audit_logs.push(base({ id: id(), action: 'seed', entity: 'demo', entity_id: null, detail: { note: 'Data contoh mode demo dibuat' } }));
    return T;
  };
})();
