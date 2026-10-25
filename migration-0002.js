// Migration lanjutan — dijalankan SEKALI oleh pengelola melalui Supabase SQL Editor
// (atau `supabase db push`). Aditif & idempoten: tidak ada DROP TABLE / DELETE data / DISABLE RLS.
window.MIGRATION_0002_FILE = 'supabase/migrations/0002_ownership_and_safe_delete.sql';
window.MIGRATION_0002_SQL = String.raw`-- =====================================================================
-- ALAT GURU — 0002: penegasan kepemilikan, kebijakan DELETE, penghapusan aman
-- File   : supabase/migrations/0002_ownership_and_safe_delete.sql
-- Syarat : 0001_alat_guru_init.sql sudah dijalankan.
-- Sifat  : aditif & idempoten. Tidak menghapus tabel/data, tidak mematikan RLS.
-- =====================================================================

-- 1) INSERT hanya boleh dengan owner_id = auth.uid()
--    (trigger set_owner_id tetap menimpa nilai dari browser; policy ini lapisan kedua)
do $$
declare t text;
begin
  foreach t in array array['academic_years','semesters','classes','students','meetings','meeting_modules',
    'attendance_records','memorization_targets','memorization_records','assignments','assignment_records',
    'activity_records','student_notes','note_history','module_settings','semester_exemption_rules',
    'semester_exemption_reviews','learning_materials','attention_followups','audit_logs']
  loop
    execute format('drop policy if exists "pemilik - tambah" on public.%I', t);
    execute format('create policy "pemilik - tambah" on public.%I for insert to authenticated with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- Profil: pengguna hanya boleh membuat profilnya sendiri dengan role 'guru'
drop policy if exists "profil milik sendiri - tambah" on public.profiles;
create policy "profil milik sendiri - tambah" on public.profiles
  for insert to authenticated with check (id = auth.uid() and role = 'guru');

-- Trigger pendaftaran: role selalu 'guru' (metadata dari formulir diabaikan untuk role)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''), 120), new.email, 'guru')
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) owner_id tidak boleh dipindah ke akun lain lewat UPDATE
create or replace function public.lock_owner_id()
returns trigger language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id tidak boleh diubah' using errcode = '42501';
  end if;
  return new;
end $$;

-- 3) Referensi silang wajib milik akun yang sama
--    (mencegah menautkan data ke pertemuan/siswa/kelas milik guru lain walau ID-nya diketahui)
create or replace function public.assert_same_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text; ref_table text; ref_id uuid; ref_owner uuid; i int;
begin
  for i in 0 .. (tg_nargs / 2) - 1 loop
    col := tg_argv[i * 2]; ref_table := tg_argv[i * 2 + 1];
    execute format('select ($1).%I::uuid', col) into ref_id using new;
    if ref_id is not null then
      execute format('select owner_id from public.%I where id = $1', ref_table) into ref_owner using ref_id;
      if ref_owner is null or ref_owner <> auth.uid() then
        raise exception 'Referensi % bukan milik akun Anda', col using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end $$;

do $$
declare r record;
begin
  for r in select * from (values
    ('semesters',                  array['academic_year_id','academic_years']),
    ('classes',                    array['academic_year_id','academic_years']),
    ('students',                   array['class_id','classes']),
    ('meetings',                   array['class_id','classes','semester_id','semesters']),
    ('meeting_modules',            array['meeting_id','meetings']),
    ('attendance_records',         array['meeting_id','meetings','student_id','students']),
    ('memorization_targets',       array['class_id','classes','semester_id','semesters']),
    ('memorization_records',       array['meeting_id','meetings','student_id','students','target_id','memorization_targets']),
    ('assignments',                array['class_id','classes','semester_id','semesters','meeting_id','meetings']),
    ('assignment_records',         array['assignment_id','assignments','student_id','students']),
    ('activity_records',           array['meeting_id','meetings','student_id','students']),
    ('student_notes',              array['student_id','students','class_id','classes','origin_meeting_id','meetings','related_assignment_id','assignments']),
    ('note_history',               array['note_id','student_notes']),
    ('semester_exemption_rules',   array['semester_id','semesters']),
    ('semester_exemption_reviews', array['semester_id','semesters','student_id','students']),
    ('learning_materials',         array['semester_id','semesters']),
    ('attention_followups',        array['student_id','students'])
  ) as v(tbl, args)
  loop
    execute format('drop trigger if exists %I_same_owner on public.%I', r.tbl, r.tbl);
    execute format('create trigger %I_same_owner before insert or update on public.%I for each row execute function public.assert_same_owner(%s)',
      r.tbl, r.tbl, (select string_agg(quote_literal(a), ',') from unnest(r.args) a));
    execute format('drop trigger if exists %I_lock_owner on public.%I', r.tbl, r.tbl);
    execute format('create trigger %I_lock_owner before update on public.%I for each row execute function public.lock_owner_id()', r.tbl, r.tbl);
  end loop;
end $$;

-- 4) Kebijakan DELETE: hanya pemilik. audit_logs & note_history tetap append-only.
--    FK yang ada tetap menjaga konsistensi (restrict untuk riwayat siswa, cascade untuk isi pertemuan).
do $$
declare t text;
begin
  foreach t in array array['classes','students','meetings','meeting_modules','attendance_records',
    'memorization_targets','memorization_records','assignments','assignment_records','activity_records',
    'student_notes','learning_materials','attention_followups','semester_exemption_reviews']
  loop
    execute format('drop policy if exists "pemilik - hapus" on public.%I', t);
    execute format('create policy "pemilik - hapus" on public.%I for delete to authenticated using (owner_id = auth.uid())', t);
  end loop;
end $$;

-- 5) Hapus pertemuan dalam SATU transaksi, dengan RLS tetap berlaku (security invoker)
create or replace function public.delete_meeting(p_meeting_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  m public.meetings%rowtype;
  n_att int; n_mem int; n_act int;
begin
  select * into m from public.meetings where id = p_meeting_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'Pertemuan tidak ditemukan atau bukan milik Anda' using errcode = '42501';
  end if;
  delete from public.attendance_records   where meeting_id = m.id; get diagnostics n_att = row_count;
  delete from public.memorization_records where meeting_id = m.id; get diagnostics n_mem = row_count;
  delete from public.activity_records     where meeting_id = m.id; get diagnostics n_act = row_count;
  delete from public.meeting_modules      where meeting_id = m.id;
  update public.assignments   set meeting_id = null        where meeting_id = m.id;  -- tugas & nilainya tetap
  update public.student_notes set origin_meeting_id = null where origin_meeting_id = m.id; -- catatan tetap
  delete from public.meetings where id = m.id;
  insert into public.audit_logs (action, entity, entity_id, detail)
  values ('hapus', 'meetings', m.id, jsonb_build_object('class_id', m.class_id, 'number', m.number, 'date', m.date,
    'attendance', n_att, 'memorization', n_mem, 'activity', n_act));
  return jsonb_build_object('attendance', n_att, 'memorization', n_mem, 'activity', n_act);
end $$;

-- 6) Hapus kelas hanya bila tidak ada siswa, pertemuan, atau catatan (tidak ada cascade diam-diam)
create or replace function public.delete_class(p_class_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare c public.classes%rowtype;
begin
  select * into c from public.classes where id = p_class_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'Kelas tidak ditemukan atau bukan milik Anda' using errcode = '42501';
  end if;
  if exists (select 1 from public.students where class_id = c.id)
     or exists (select 1 from public.meetings where class_id = c.id)
     or exists (select 1 from public.student_notes where class_id = c.id) then
    raise exception 'Kelas masih memiliki siswa, pertemuan, atau catatan. Arsipkan kelas sebagai gantinya.' using errcode = 'P0001';
  end if;
  delete from public.assignments a where a.class_id = c.id
    and not exists (select 1 from public.assignment_records r where r.assignment_id = a.id);
  delete from public.memorization_targets where class_id = c.id;
  delete from public.classes where id = c.id;
  insert into public.audit_logs (action, entity, entity_id, detail)
  values ('hapus', 'classes', c.id, jsonb_build_object('name', c.name));
end $$;

revoke all on function public.delete_meeting(uuid) from public, anon;
revoke all on function public.delete_class(uuid)   from public, anon;
grant execute on function public.delete_meeting(uuid) to authenticated;
grant execute on function public.delete_class(uuid)   to authenticated;

-- 7) Fungsi bantu khusus pengelola: cek role tanpa membuka data guru lain
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- Menjadikan akun Anda pengelola (jalankan manual, ganti email):
-- update public.profiles set role = 'admin' where email = 'pengelola@sekolah.sch.id';
`;
