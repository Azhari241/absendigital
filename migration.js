// SQL migration ALAT GURU — ditampilkan di halaman "Hubungkan ke Supabase".
// File: supabase/migrations/0001_alat_guru_init.sql
window.MIGRATION_FILE = 'supabase/migrations/0001_alat_guru_init.sql';
window.MIGRATION_SQL = String.raw`-- =====================================================================
-- ALAT GURU — Migration awal
-- File   : supabase/migrations/0001_alat_guru_init.sql
-- Aman dijalankan ulang (IF NOT EXISTS). Tidak berisi DROP TABLE / DELETE.
-- Semua tabel dibatasi per pemilik (owner_id = auth.uid()) melalui RLS.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Fungsi bantu ----------
create or replace function public.set_owner_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Kepemilikan selalu diambil dari sesi, bukan dari input frontend.
  new.owner_id := auth.uid();
  return new;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Profil ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  email         text not null default '',
  status        text not null default 'aktif' check (status in ('aktif','nonaktif')),
  role          text not null default 'guru' check (role in ('guru','admin')),
  teacher_subject text default '',
  school_name   text default '',
  school_address text default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role tidak boleh diubah sendiri oleh pengguna.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    new.role := old.role;
  end if;
  new.id := old.id;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- Tahun ajaran & semester ----------
create table if not exists public.academic_years (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (name ~ '^\d{4}/\d{4}$'),
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.semesters (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  name             text not null check (name in ('Ganjil','Genap')),
  is_active        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (academic_year_id, name)
);

-- ---------- Kelas & siswa ----------
create table if not exists public.classes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  level            text not null check (level in ('VII','VIII','IX','X','XI','XII')),
  name             text not null check (char_length(name) between 1 and 40),
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (owner_id, academic_year_id, name)
);

create table if not exists public.students (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id   uuid references public.classes(id) on delete set null,
  full_name  text not null check (char_length(full_name) between 2 and 120),
  nis        text default '',
  gender     text not null check (gender in ('L','P')),
  status     text not null default 'aktif' check (status in ('aktif','arsip')),
  join_date  date,
  notes      text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists students_owner_nis_uq
  on public.students(owner_id, nis) where nis is not null and nis <> '';
create index if not exists students_class_idx on public.students(class_id);

-- ---------- Pertemuan ----------
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  date        date not null,
  number      int  not null check (number > 0),
  topic       text default '',
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (class_id, semester_id, number)
);
create index if not exists meetings_class_date_idx on public.meetings(class_id, date);

create table if not exists public.meeting_modules (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  module     text not null check (module in ('absensi','hafalan','tugas','keaktifan')),
  enabled    boolean not null default true,
  unique (meeting_id, module)
);

create table if not exists public.attendance_records (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete restrict,
  status       text not null check (status in ('hadir','terlambat','izin','sakit','alpha','bolos')),
  late_minutes int check (late_minutes is null or late_minutes between 0 and 600),
  note         text default '',
  updated_at   timestamptz not null default now(),
  unique (meeting_id, student_id)
);

-- ---------- Hafalan ----------
create table if not exists public.memorization_targets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  title       text not null,
  description text default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.memorization_records (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  target_id  uuid references public.memorization_targets(id) on delete set null,
  status     text not null check (status in ('setor','belum','izin','bebas')),
  score      numeric(5,2) check (score is null or score between 0 and 100),
  comment    text default '',
  updated_at timestamptz not null default now(),
  unique (meeting_id, student_id),
  -- Bebas Setor tidak boleh diberi nilai (tidak dihitung sebagai 100).
  check (status <> 'bebas' or score is null)
);

-- ---------- Tugas / PR ----------
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete restrict,
  semester_id uuid not null references public.semesters(id) on delete restrict,
  meeting_id  uuid references public.meetings(id) on delete set null,
  title       text not null,
  description text default '',
  due_date    date not null,
  target      text not null default 'kelas' check (target in ('kelas','siswa')),
  student_ids uuid[] default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists public.assignment_records (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete restrict,
  status        text not null check (status in ('belum','sudah','terlambat','bebas')),
  score         numeric(5,2) check (score is null or score between 0 and 100),
  comment       text default '',
  submitted_at  date,
  updated_at    timestamptz not null default now(),
  unique (assignment_id, student_id),
  check (status <> 'bebas' or score is null)
);

-- ---------- Keaktifan ----------
create table if not exists public.activity_records (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  score      int check (score is null or score between 0 and 100),
  note       text default '',
  updated_at timestamptz not null default now(),
  unique (meeting_id, student_id)
);

-- ---------- Catatan khusus antarpertemuan ----------
create table if not exists public.student_notes (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id            uuid not null references public.students(id) on delete restrict,
  class_id              uuid not null references public.classes(id) on delete restrict,
  type                  text not null check (type in ('bebas_hafalan','bebas_tugas','tugas_pengganti','izin_khusus','remedial','perpanjangan','catatan_keaktifan','lainnya')),
  component             text not null check (component in ('hafalan','tugas','absensi','keaktifan','nilai','umum')),
  related_assignment_id uuid references public.assignments(id) on delete set null,
  reason                text not null check (char_length(reason) >= 3),
  start_date            date not null,
  origin_meeting_id     uuid references public.meetings(id) on delete set null,
  validity              text not null check (validity in ('current','next','count','until','manual')),
  valid_count           int check (valid_count is null or valid_count between 1 and 50),
  valid_until           date,
  status                text not null default 'aktif' check (status in ('aktif','dicabut')),
  created_by            text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (validity <> 'until' or valid_until is not null),
  check (validity <> 'count' or valid_count is not null)
);
create index if not exists student_notes_student_idx on public.student_notes(student_id);

create table if not exists public.note_history (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id    uuid not null references public.student_notes(id) on delete cascade,
  action     text not null,
  detail     text default '',
  created_at timestamptz not null default now()
);

-- ---------- Pengaturan modul ----------
create table if not exists public.module_settings (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  absensi               boolean not null default true check (absensi = true),
  hafalan               boolean not null default true,
  tugas                 boolean not null default true,
  keaktifan             boolean not null default true,
  bebas_semester        boolean not null default false,
  attendance_threshold  int not null default 80 check (attendance_threshold between 0 and 100),
  passing_grade         int not null default 75 check (passing_grade between 0 and 100),
  activity_scale_max    int not null default 5 check (activity_scale_max between 1 and 100),
  report_prefs          jsonb not null default '{}'::jsonb,
  updated_at            timestamptz not null default now()
);

-- ---------- Bebas Semester ----------
create table if not exists public.semester_exemption_rules (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id        uuid not null references public.semesters(id) on delete cascade,
  min_attendance     int not null default 95 check (min_attendance between 0 and 100),
  min_memorization   int not null default 80 check (min_memorization between 0 and 100),
  min_assignment     int not null default 0  check (min_assignment between 0 and 100),
  min_activity       int not null default 0  check (min_activity between 0 and 100),
  use_assignment     boolean not null default false,
  use_activity       boolean not null default false,
  extra_requirements text default '',
  unique (owner_id, semester_id)
);

create table if not exists public.semester_exemption_reviews (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete restrict,
  status      text not null check (status in ('menunggu','disetujui','ditolak')),
  note        text default '',
  reviewed_at timestamptz not null default now(),
  unique (semester_id, student_id)
);

-- ---------- Materi, tindak lanjut, audit ----------
create table if not exists public.learning_materials (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  level       text not null check (level in ('VII','VIII','IX','X','XI','XII')),
  semester_id uuid references public.semesters(id) on delete set null,
  title       text not null,
  description text default '',
  url         text not null check (url ~* '^https?://'),
  created_at  timestamptz not null default now()
);

create table if not exists public.attention_followups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  category   text not null check (category in ('belum_hafalan','kehadiran_rendah','remedial','belum_tugas')),
  status     text not null default 'belum' check (status in ('belum','proses','selesai')),
  note       text default '',
  updated_at timestamptz not null default now(),
  unique (student_id, category)
);

create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_owner_idx on public.audit_logs(owner_id, created_at desc);

-- ---------- Trigger kepemilikan & updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['academic_years','semesters','classes','students','meetings','meeting_modules',
    'attendance_records','memorization_targets','memorization_records','assignments','assignment_records',
    'activity_records','student_notes','note_history','module_settings','semester_exemption_rules',
    'semester_exemption_reviews','learning_materials','attention_followups','audit_logs']
  loop
    execute format('drop trigger if exists %I_owner on public.%I', t, t);
    execute format('create trigger %I_owner before insert on public.%I for each row execute function public.set_owner_id()', t, t);
  end loop;
  foreach t in array array['profiles','students','meetings','attendance_records','memorization_records',
    'assignment_records','activity_records','student_notes','module_settings','attention_followups']
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
drop policy if exists "profil milik sendiri - baca" on public.profiles;
create policy "profil milik sendiri - baca" on public.profiles for select using (id = auth.uid());
drop policy if exists "profil milik sendiri - tambah" on public.profiles;
create policy "profil milik sendiri - tambah" on public.profiles for insert with check (id = auth.uid() and role = 'guru');
drop policy if exists "profil milik sendiri - ubah" on public.profiles;
create policy "profil milik sendiri - ubah" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['academic_years','semesters','classes','students','meetings','meeting_modules',
    'attendance_records','memorization_targets','memorization_records','assignments','assignment_records',
    'activity_records','student_notes','note_history','module_settings','semester_exemption_rules',
    'semester_exemption_reviews','learning_materials','attention_followups','audit_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "pemilik - baca" on public.%I', t);
    execute format('create policy "pemilik - baca" on public.%I for select using (owner_id = auth.uid())', t);
    execute format('drop policy if exists "pemilik - tambah" on public.%I', t);
    execute format('create policy "pemilik - tambah" on public.%I for insert with check (owner_id = auth.uid())', t);
    execute format('drop policy if exists "pemilik - ubah" on public.%I', t);
    execute format('create policy "pemilik - ubah" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
  -- Penghapusan hanya diizinkan untuk data yang memang boleh dihapus.
  foreach t in array array['learning_materials','memorization_targets','assignments']
  loop
    execute format('drop policy if exists "pemilik - hapus" on public.%I', t);
    execute format('create policy "pemilik - hapus" on public.%I for delete using (owner_id = auth.uid())', t);
  end loop;
end $$;

-- Audit log dan riwayat catatan bersifat append-only (tidak ada policy update/delete).
drop policy if exists "pemilik - ubah" on public.audit_logs;
drop policy if exists "pemilik - ubah" on public.note_history;
`;
