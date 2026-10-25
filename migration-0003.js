// Migration 0003 — ABSEN DIGITAL. Dijalankan SEKALI oleh pengelola (Supabase SQL Editor).
// Aditif & idempoten: tidak ada DROP TABLE, tidak menghapus data, tidak mematikan RLS.
window.MIGRATION_0003_FILE = 'supabase/migrations/0003_absen_digital.sql';
window.MIGRATION_0003_SQL = String.raw`-- =====================================================================
-- ABSEN DIGITAL — 0003: perkembangan siswa, riwayat dokumen Bebas Semester,
--                      NISN, status tugas "Selesai Dinilai", identitas tanda tangan.
-- File   : supabase/migrations/0003_absen_digital.sql
-- Syarat : 0001 dan 0002 sudah dijalankan.
-- Sifat  : aditif & idempoten. Aman dijalankan ulang.
-- =====================================================================

-- 1) Kolom tambahan (tanpa mengubah data lama)
alter table public.students    add column if not exists nisn text default '';
alter table public.profiles    add column if not exists teacher_nip     text default '';
alter table public.profiles    add column if not exists principal_name  text default '';
alter table public.profiles    add column if not exists principal_nip   text default '';
alter table public.profiles    add column if not exists school_city     text default '';
alter table public.assignments add column if not exists given_date date;
alter table public.assignments add column if not exists teacher_note text default '';
alter table public.classes     add column if not exists notes text default '';
alter table public.semester_exemption_rules add column if not exists use_memorization boolean not null default true;
alter table public.semester_exemption_rules add column if not exists updated_at timestamptz not null default now();

-- 2) Status tugas: tambah 'dinilai' (Selesai Dinilai). Nilai lama tetap valid.
alter table public.assignment_records drop constraint if exists assignment_records_status_check;
alter table public.assignment_records add constraint assignment_records_status_check
  check (status in ('belum','sudah','dinilai','terlambat','bebas'));

-- 3) Catatan perkembangan siswa (akademik, kedisiplinan, prestasi, tindak lanjut, ...)
create table if not exists public.student_progress_notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete restrict,
  class_id    uuid references public.classes(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  date        date not null default current_date,
  category    text not null check (category in ('akademik','kedisiplinan','keterlambatan','prestasi','tindak_lanjut','catatan')),
  content     text not null check (char_length(content) between 2 and 4000),
  follow_up   text not null default 'none' check (follow_up in ('none','perlu','proses','selesai')),
  -- Catatan sensitif TIDAK PERNAH dicetak pada dokumen publik/ditempel.
  sensitive   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists spn_student_idx on public.student_progress_notes(student_id, date desc);

-- 4) Riwayat dokumen Bebas Semester (snapshot yang tidak berubah walau aturan diganti)
create table if not exists public.semester_exemption_documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  title       text not null default 'DAFTAR SISWA BEBAS SEMESTER',
  class_ids   uuid[] not null default '{}',
  decided_at  date not null default current_date,
  rule        jsonb not null default '{}'::jsonb,   -- salinan aturan saat ditetapkan
  options     jsonb not null default '{}'::jsonb,   -- opsi cetak (NIS, rincian, cakupan)
  students    jsonb not null default '[]'::jsonb,   -- salinan daftar siswa & status saat ditetapkan
  created_at  timestamptz not null default now()
);
create index if not exists sed_owner_idx on public.semester_exemption_documents(owner_id, created_at desc);

-- 5) Trigger kepemilikan, updated_at, kunci owner, referensi milik sendiri
do $$
declare t text;
begin
  foreach t in array array['student_progress_notes','semester_exemption_documents'] loop
    execute format('drop trigger if exists %I_owner on public.%I', t, t);
    execute format('create trigger %I_owner before insert on public.%I for each row execute function public.set_owner_id()', t, t);
    execute format('drop trigger if exists %I_lock_owner on public.%I', t, t);
    execute format('create trigger %I_lock_owner before update on public.%I for each row execute function public.lock_owner_id()', t, t);
  end loop;
end $$;
drop trigger if exists student_progress_notes_touch on public.student_progress_notes;
create trigger student_progress_notes_touch before update on public.student_progress_notes
  for each row execute function public.touch_updated_at();
drop trigger if exists semester_exemption_rules_touch on public.semester_exemption_rules;
create trigger semester_exemption_rules_touch before update on public.semester_exemption_rules
  for each row execute function public.touch_updated_at();

drop trigger if exists student_progress_notes_same_owner on public.student_progress_notes;
create trigger student_progress_notes_same_owner before insert or update on public.student_progress_notes
  for each row execute function public.assert_same_owner('student_id','students','class_id','classes','semester_id','semesters');
drop trigger if exists semester_exemption_documents_same_owner on public.semester_exemption_documents;
create trigger semester_exemption_documents_same_owner before insert or update on public.semester_exemption_documents
  for each row execute function public.assert_same_owner('semester_id','semesters');

-- 6) Row Level Security
alter table public.student_progress_notes enable row level security;
alter table public.semester_exemption_documents enable row level security;

drop policy if exists "pemilik - baca"  on public.student_progress_notes;
drop policy if exists "pemilik - tambah" on public.student_progress_notes;
drop policy if exists "pemilik - ubah"  on public.student_progress_notes;
drop policy if exists "pemilik - hapus" on public.student_progress_notes;
create policy "pemilik - baca"  on public.student_progress_notes for select to authenticated using (owner_id = auth.uid());
create policy "pemilik - tambah" on public.student_progress_notes for insert to authenticated with check (owner_id = auth.uid());
create policy "pemilik - ubah"  on public.student_progress_notes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "pemilik - hapus" on public.student_progress_notes for delete to authenticated using (owner_id = auth.uid());

-- Dokumen historis: baca, tambah, hapus. TIDAK ada policy UPDATE → isi dokumen yang sudah
-- ditetapkan tidak dapat diubah diam-diam; buat dokumen baru bila perlu revisi.
drop policy if exists "pemilik - baca"  on public.semester_exemption_documents;
drop policy if exists "pemilik - tambah" on public.semester_exemption_documents;
drop policy if exists "pemilik - hapus" on public.semester_exemption_documents;
create policy "pemilik - baca"  on public.semester_exemption_documents for select to authenticated using (owner_id = auth.uid());
create policy "pemilik - tambah" on public.semester_exemption_documents for insert to authenticated with check (owner_id = auth.uid());
create policy "pemilik - hapus" on public.semester_exemption_documents for delete to authenticated using (owner_id = auth.uid());

-- 7) Aturan Bebas Semester boleh dihapus pemilik (tidak memengaruhi dokumen historis)
drop policy if exists "pemilik - hapus" on public.semester_exemption_rules;
create policy "pemilik - hapus" on public.semester_exemption_rules for delete to authenticated using (owner_id = auth.uid());

-- 8) Profil: pastikan pembuatan profil idempoten & role selalu 'guru' (ulang dari 0002, aman)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''), 120), new.email, 'guru')
  on conflict (id) do nothing;
  return new;
end $$;

-- Pemeriksaan cepat setelah menjalankan (opsional):
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
`;
