# Handoff: ALAT GURU — Pusat Administrasi dan Perangkat Pembelajaran Guru

## Overview
ALAT GURU is a teacher administration web app for classes VII–XII. It covers attendance (6 statuses), meetings, hafalan (memorization), tugas/PR, keaktifan (participation), special notes between meetings with validity periods ("catatan khusus"), Bebas Semester eligibility, a "Perlu Perhatian" (needs attention) panel, recaps, reports (print A4 / Excel / CSV) and learning materials. It runs on **Supabase** (Postgres + Auth + RLS) and is meant to be deployed on **Vercel** with Next.js.

**Connection model (latest revision):** the app owner configures Supabase **once** through Vercel Environment Variables. End users (teachers) never enter a Project URL, key, or SQL — they only see Masuk / Daftar / Lupa kata sandi.

## About the Design Files
The files in this bundle are **design references created in HTML/React (in-browser Babel)** — a working prototype that shows intended look **and** behaviour, including real Supabase Auth / data calls. They are **not production code to ship directly**. The task is to **recreate this app in Next.js App Router + TypeScript + Tailwind + shadcn/ui + lucide-react + Recharts + React Hook Form + Zod + @supabase/ssr**, using those libraries' patterns. Domain logic in `app/logic.js` and the data layer contract in `app/db.js` can be ported almost 1:1 to TypeScript.

The two SQL files in `app/migration.js` and `app/migration-0002.js` (inside `String.raw\`…\``) **are** production artefacts: save them as `supabase/migrations/0001_alat_guru_init.sql` and `supabase/migrations/0002_ownership_and_safe_delete.sql`.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, states, copy (Bahasa Indonesia) and interactions. Recreate pixel-close with shadcn/Tailwind.

---

## 1. Supabase configuration (Vercel)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | required |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | preferred |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ…` (legacy anon JWT) | fallback if the project still uses legacy keys; read when PUBLISHABLE is empty |

- **Never** add `SUPABASE_SERVICE_ROLE_KEY` / `sb_secret_…` as a `NEXT_PUBLIC_*` variable. The app needs no service key at all. The prototype also rejects keys whose JWT role is `service_role`, as well as `sb_secret_` keys (`DB.validateServerInput`).
- After setting the variables → **Redeploy** (`NEXT_PUBLIC_*` values are inlined at build time).
- Supabase → Auth → URL Configuration: set **Site URL** to the Vercel domain and add `https://<domain>/**` (plus preview domains if needed) to **Redirect URLs**. Sign-up confirmation and password recovery redirect there (`?reset=1`).
- Suggested `lib/supabase/env.ts`:
  ```ts
  export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  export const envReady = Boolean(SUPABASE_URL && SUPABASE_KEY);
  ```
  Use `@supabase/ssr` `createBrowserClient` / `createServerClient` + middleware for session refresh and private-route protection (redirect to `/login` when there is no session).

### Boot / error states (`app/main.jsx`, `ConfigErrorPage` in `app/auth.jsx`)
1. Env missing/invalid → "Aplikasi belum siap digunakan" for teachers. A collapsible **"Untuk pengelola aplikasi"** section explains the Vercel variables. (The prototype also offers a local-only demo mode in this state; **remove demo mode in production**.)
2. Env OK → `DB.checkSchema()` HEAD-selects the 9 core tables (`profiles, academic_years, semesters, classes, students, meetings, attendance_records, module_settings, student_notes`). Missing tables → "Database sedang disiapkan" (admin detail lists the missing tables).
3. Network failure → "Server tidak dapat dijangkau" + Coba lagi.
4. Ready → session check → Login or app.

The **Ganti server** link and form were removed from the login. The old per-device `localStorage` config key (`alatguru.server.v1`) is deleted on load.

### Admin-only panel
Pengaturan → tab **"Server (pengelola)"** (`AdminServerPanel`) is visible only when the DB function `public.is_admin()` returns true (`profiles.role = 'admin'`, which can only be set from SQL). It shows the active host, runs diagnostics (Auth reachable, core tables, whether migration 0002 is installed) and displays both SQL files with Salin SQL. It has **no** URL/key form — changing servers = changing the env variables + redeploying.

To make an admin: `update public.profiles set role = 'admin' where email = '…';` (run manually in the SQL Editor).

---

## 2. Database & security

### Migration 0001 (`0001_alat_guru_init.sql`)
Tables: profiles, academic_years, semesters, classes, students, meetings, meeting_modules, attendance_records, memorization_targets, memorization_records, assignments, assignment_records, activity_records, student_notes, note_history, module_settings, semester_exemption_rules, semester_exemption_reviews, learning_materials, attention_followups, audit_logs. It adds PKs, FKs, unique constraints (e.g. `attendance_records(meeting_id, student_id)` prevents duplicate attendance), checks (e.g. a `bebas` hafalan status cannot carry a score), indexes, `set_owner_id` triggers (owner always = `auth.uid()`, overriding whatever the browser sends), and RLS on every table.

### Migration 0002 (`0002_ownership_and_safe_delete.sql`) — **required for this revision**
It only adds things and can be re-run safely; it contains no DROP TABLE, no data DELETE and no `disable row level security`.
1. INSERT policies → `with check (owner_id = auth.uid())`, scoped `to authenticated`.
2. `handle_new_user` trigger always sets `role = 'guru'` and ignores any role sent in sign-up metadata. `profiles` insert policy requires `role = 'guru'`; the existing `protect_profile_role` trigger blocks role changes from clients.
3. `lock_owner_id` trigger: `owner_id` cannot be changed by UPDATE.
4. `assert_same_owner` trigger: every FK (`class_id`, `meeting_id`, `student_id`, …) must point at a row owned by the same `auth.uid()`. Teachers cannot link data to another teacher's IDs even if they know them.
5. DELETE policies (`owner_id = auth.uid()`) on: classes, students, meetings, meeting_modules, attendance_records, memorization_targets, memorization_records, assignments, assignment_records, activity_records, student_notes, learning_materials, attention_followups, semester_exemption_reviews. `audit_logs` and `note_history` stay append-only.
6. `delete_meeting(p_meeting_id uuid) returns jsonb` — **security invoker** (so RLS still applies), runs as one transaction: deletes the meeting's attendance, memorization and activity rows and its meeting_modules; sets `assignments.meeting_id` and `student_notes.origin_meeting_id` to null (tasks, grades and notes are kept); deletes the meeting; writes an audit log entry; returns counts.
7. `delete_class(p_class_id uuid)` — security invoker. Refuses (P0001) if the class still has students, meetings or notes; otherwise deletes its targets and ungraded tasks, then the class.
8. `is_admin()` — security definer, returns only a boolean for the caller.

**Running migrations:** an administrator runs them once (SQL Editor or `supabase db push`). Do not re-run destructive scripts. Both files are idempotent.

### Client-side enforcement (`SupabaseBackend` in `app/db.js`)
- Never sends `owner_id` (stripped before insert/update).
- `update`/`remove`/`removeMany` use `.select()` and treat **0 affected rows as failure** (`NOT_OWNED`): RLS filters out other teachers' rows without raising an error, so 0 rows must not be shown as success.
- `friendlyError()` maps errors to Indonesian messages: network → "Koneksi terputus. Data belum tersimpan"; `42501`/RLS → "Akses ditolak oleh kebijakan keamanan database (RLS)…"; `23505` duplicate; `23503` FK restrict; `PGRST202` → "memerlukan migration 0002".
- The UI is updated **only after** the server confirms (`DataProvider.api.*` in `app/store.jsx`). Offline → red banner, saves refused.

---

## 3. Edit & delete matrix (new in this revision)

| Data | Edit | Delete | Rule |
|---|---|---|---|
| Pertemuan | `MeetingEditModal` (date, number with uniqueness check, materi, catatan, modules) — from Riwayat Pertemuan and the Absensi meeting bar | `MeetingDeleteConfirm` → RPC `delete_meeting` | Dialog names the meeting number, class and date, lists linked data (attendance/hafalan/keaktifan deleted; tasks & notes kept, link removed). Buttons: Batal / **Hapus Permanen** |
| Kelas | `ClassModal` | `ClassDeleteConfirm` → RPC `delete_class` | Blocked if it has students, meetings or notes (explains why and suggests Arsipkan). An empty class requires typing the class name |
| Siswa | `StudentModal` (incl. moving class) | `StudentDeleteConfirm` | Only when there is no history; otherwise suggests Arsipkan (FK `restrict` also enforces this in the DB) |
| Absensi / hafalan / keaktifan per student | Absensi table | Clicking the already-selected status clears it; clearing a hafalan/keaktifan cell → on **Simpan** the stored rows are deleted (`removeMany`) | Never converted to Alpha |
| Tugas | `AssignmentModal` | Confirm; deletes its records via FK cascade; typing `HAPUS` is required if grades exist | Linked notes are kept (`related_assignment_id` set to null) |
| Nilai tugas | `AssignmentRecords` | Clear status → deleted on save | |
| Target hafalan | inline edit | Confirm; records kept (`target_id` set to null) | |
| Catatan khusus | `NoteModal` + history entry | Prefer **Cabut**; permanent delete requires typing `HAPUS` (cascades `note_history`) | |
| Materi | `MaterialModal` | Confirm | |
| Modul settings | toggles | not deletable (only hidden; historical data kept) | |

UX rules: pencil = edit, trash = delete. On desktop, icon buttons are shown inline. On mobile (`≤1024px`), actions sit in an `ActionMenu` (⋯) rendered in a portal so tables don't widen. `Confirm` locks its buttons while working (prevents double submits), shows a spinner, and **Batal never mutates anything**. On failure a toast shows the reason and the data is left unchanged.

---

## 4. Screens
(Details unchanged from the first handoff; see the source files.)
- **Login** (`LoginPage`): 452px max card centred on `#f5f6f7`, white, radius 16, 1px `#e6e8eb` border, logo tile 42px black radius 10 with a graduation-cap icon. Title "ALAT GURU" 19px/700, subtitle 12px `#6b7380`. Segmented tabs Masuk | Daftar (38px). Inputs 44px, radius 9. Primary button black 46px. "Lupa kata sandi?" link. Footer "Semua alat administrasi guru dalam satu tempat." Uses `100dvh`; works at 360/390/430px.
- **Daftar**: nama, email, kata sandi with a strength meter (≥8 characters, lower case, upper case, digit), konfirmasi. Duplicate email is detected via `identities.length === 0`. If confirmation is required → `VerifyNotice` with resend (60s cooldown).
- **Lupa / Reset password**: `resetPasswordForEmail(redirectTo: origin + '?reset=1')`; `ResetPasswordPage` handles `PASSWORD_RECOVERY` and invalid/expired links.
- **Setup wizard** (first login): academic year, semester, teacher name, subject, school.
- **Shell**: 248px sidebar (drawer ≤1024px), sticky 64px topbar showing semester + academic year, avatar menu (Profil, Akun, Keluar with confirmation).
- **Dashboard**, **Absensi** (tabs Pertemuan / Siswa & Catatan / Rekap; mobile cards with a sticky save button), **Semua Kelas**, **Data Siswa** (+ import XLSX/CSV, export), **Detail Siswa**, **Hafalan**, **Tugas/PR**, **Keaktifan**, **Bebas Semester**, **Rekap Kehadiran**, **Riwayat Pertemuan**, **Kumpulan Materi**, **Perlu Perhatian**, **Laporan**, **Pengaturan** (Modul, Tahun ajaran, Ambang batas, Profil, Akun, Log aktivitas, Server—admin only).

## Design tokens (`app/styles.css :root`)
bg `#f5f6f7` · card `#ffffff` · line `#e6e8eb` / `#eef0f2` · ink `#0f1419` · ink2 `#3d4550` · mute `#6b7380` / `#9aa1ab` · teal `#0f766e` (hover `#0b5f58`), tealbg `#e8f5f2` / `#d3ece6` · status: hadir `#16a34a`, terlambat `#2563eb`, izin `#f59e0b`, sakit `#ef4444`, alpha `#8b5cf6`, bolos `#334155` · danger `#dc2626` · warn `#b45309` on `#fff7e6`.
Radius: inputs/buttons 9, cards 14, modals 16 (bottom sheet 18 on ≤640px). Font: Plus Jakarta Sans 400–800; JetBrains Mono for code. Button heights 32/38/46.

## State management
`DataProvider` loads every table owned by the user (paginated 1000 rows at a time), keeps an in-memory cache and merges confirmed mutations. It reloads on tab focus and every 60s (sync across devices). `rpc()` and deletes of parent rows trigger a silent reload, since the DB cascades or nulls child rows. In Next.js this maps cleanly to TanStack Query or server actions + `revalidatePath`.

## Assets
No images. Icons are hand-drawn Lucide equivalents (`app/icons.jsx`) → use `lucide-react` (`GraduationCap, Pencil, Trash2, MoreHorizontal, …`).

## Files
- `ALAT GURU.html` — entry point
- `app/config.js` — env stand-in for the prototype (keep empty in the repo)
- `app/db.js` — env config, schema check, Supabase/Demo backends, error mapping
- `app/migration.js`, `app/migration-0002.js` — SQL 0001 and 0002
- `app/main.jsx` — boot sequence, session, ConfigErrorPage routing
- `app/auth.jsx` — login, sign-up, verify, forgot/reset, ConfigErrorPage, AdminServerPanel
- `app/crud.jsx` — meeting/class/student edit & safe delete
- `app/store.jsx`, `app/shell.jsx`, `app/ui.jsx` (ActionMenu, Confirm), `app/logic.js`, `app/notes.jsx`, `app/pages-*.jsx`, `app/seed.js` (demo only — drop in production), `app/styles.css`

## Test checklist (must be run against a real Supabase project — not yet done)
1. Opening the site never asks for Supabase config. 2. Sign-up (with and without email confirmation) + profile row created with role `guru`. 3. Session persists after reload. 4–5. Using two accounts A/B: B cannot select/update/delete A's rows via the REST API using A's IDs (expect 0 rows / 42501), and cannot insert rows referencing A's `class_id`/`meeting_id` (expect 42501). 6. Data persists after logout/login. 7. Mobile 360/390/430 + desktop. 8. Offline and RLS errors show clear messages. 9. `grep -r "service_role\|sb_secret" .next/static` returns nothing. 10. Edit meeting date/materi → Riwayat, Dashboard and Rekap update; delete a test meeting → no orphan attendance/hafalan/keaktifan rows; Batal leaves the data unchanged.
