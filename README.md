# Attendance & Daily Logbook (Multi-User Fullstack Web App)

Aplikasi web **Attendance & Daily Logbook** multi-user berbasis **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, dan **Supabase (Auth, PostgreSQL, Storage)** yang siap di-deploy ke **Railway**.

## 1. Isolasi Database Supabase (`mall-survey`)
Aplikasi ini terisolasi penuh menggunakan prefix `att_` untuk tabel dan `att-` untuk Storage Bucket tanpa menyentuh tabel/trigger eksisting:
- **File Migrasi SQL**: `supabase/migrations/001_init_attendance.sql`
- **Tabel**:
  - `public.att_profiles`
  - `public.att_approvers`
  - `public.att_logs`
- **Storage Buckets**:
  - `att-attachments` (Lampiran bukti harian per folder `{user_id}/...`)
  - `att-signatures` (File tanda tangan digital PNG per folder `{user_id}/...`)
- **Row Level Security (RLS)**: Ketat per user (`auth.uid() = id` / `user_id`).

## 2. Fitur Utama
1. **Autentikasi & Onboarding (`/login` & `/onboarding`)**:
   - Login & Register menggunakan email dan password via Supabase Auth.
   - Saat pertama kali masuk, user diarahkan ke `/onboarding` untuk mengisi Nama Lengkap, Jabatan, Target Jam Kerja Default (`08:00 - 17:00`), dan minimal 1 Approver (tersedia tombol **"Isi Contoh Cepat"** sesuai spesifikasi).
2. **Dashboard Kalender & Tabel Rekap Harian (`/`)**:
   - Mode **WFO**: Wajib isi Jam Masuk & Jam Keluar aktual + otomatis menghitung selisih keterlambatan/lembur terhadap target jam kerja.
   - Mode **WFA**: Tanpa wajib jam masuk/keluar, tersedia catatan/keterangan opsional.
   - **Auto-Weekend & Weekend Job**: Hari Sabtu & Minggu otomatis ditandai `WEEKEND`, namun tetap bisa diklik untuk menginput **Weekend Job**.
   - **Daily Activity + 1 Lampiran Bukti**: Upload JPG/PNG/PDF dengan kompresi gambar otomatis di sisi client (HTML5 Canvas) sebelum diunggah ke Supabase Storage.
3. **Interactive Digital Signature (E-Sign) & Export Engine (`/export` & `/profile`)**:
   - Pilihan TTD: **(a)** Gambar langsung di canvas (`react-signature-canvas`), **(b)** Upload PNG transparan, atau **(c)** Kosongkan untuk tanda tangan basah.
   - **Free Drag & Resize (`react-rnd`)**: Pada halaman `/export`, tanda tangan user dapat digeser dan diubah ukurannya secara bebas di atas blok tanda tangan kiri.
   - **Export Excel (`.xlsx`)** via `exceljs`: Lengkap dengan 9 kolom standar dan highlight warna abu-abu otomatis pada baris `WEEKEND`.
   - **Export PDF (A4 Print Layout)**: Mempertahankan posisi tanda tangan hasil drag & resize beserta halaman **Appendix (Lampiran Bukti Harian)** di halaman belakang.

## 3. Menjalankan Secara Lokal

```bash
npm install --legacy-peer-deps
npm run dev
```

Buka `http://localhost:3000`.

## 4. Deployment ke Railway
Project telah dikonfigurasi menggunakan `output: "standalone"` pada `next.config.ts`.
Tambahkan environment variables berikut di dashboard Railway:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
