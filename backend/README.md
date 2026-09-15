# ⚙️ DigiQA Backend API (Laravel 11)

> **RESTful API Backend & Auto-Distribution Sampling Engine for DigiQA Enterprise**

Backend DigiQA dibangun menggunakan framework **Laravel 11** (PHP 8.2+) untuk melayani kebutuhan komputasi analitik mutu, *batch ETL processing* file Excel, manajemen hak akses (RBAC), dan mesin distribusi kuota sampling otomatis (*Auto-Distribution Engine V2*).

---

## 📑 Daftar Isi
- [Arsitektur & Service Engine](#-arsitektur--service-engine)
- [Struktur Database & Relasi Model](#-struktur-database--relasi-model)
- [Katalog REST API Endpoints](#-katalog-rest-api-endpoints)
- [Prinsip Pemisahan Data (Data Pipeline Separation)](#-prinsip-pemisahan-data)
- [Petunjuk Setup & Eksekusi](#-petunjuk-setup--eksekusi)

---

## 🏗️ Arsitektur & Service Engine

Backend DigiQA menerapkan pola arsitektur berbasis *Service Layer* yang modular pada namespace `App\Services\Sampling`:

### 1. `AutoDistributionEngineService.php`
- **Distribusi Harian**: Mengalokasikan **20 tiket/hari** per QA On Duty berdasarkan komposisi kategori SOP (6 Informasi, 7 Gangguan, 6 Keluhan, 1 Permohonan).
- **Akumulasi Tim Harian**: `8 QA × 20 = 160 tiket/hari`.
- **Mitigasi Duplikasi**: Memastikan 1 CSO tidak dievaluasi melebihi batas target bulanan (2 sesi/CSO) dan memprioritaskan CSO yang belum pernah disampling.
- **SLA Kedaluwarsa 7 Hari**: Otomatis menandai tiket yang tidak dikerjakan dalam 7 hari sebagai `ABANDONED` dan masuk audit investigasi.

### 2. `NakerVerificationService.php`
- Normalisasi penamaan CSO/Agent (menghilangkan spasi ganda, format dot, gelar, dan pembersihan karakter non-standar).
- Pencocokan silang (*cross-match*) data transaksi mentah dengan Database Plotting NAKER aktif.

### 3. `SamplingQaAttendanceService.php`
- Manajemen roster harian 8 Evaluator QA (`ON_DUTY`, `OFF_DAY`, `CUTI`, `SAKIT`, `IJIN`).
- Pelacakan kesiapan QA harian secara mandiri (*self-service duty activation*) dan otomatisasi penarikan kuota saat bertugas.

### 4. `SamplingTargetEngineService.php`
- Pengelolaan target bulanan site: **5.920 total site** (2.960 QA Utama: 8 QA × 370 sesi/bulan).
- Distribusi kuota per QA: **346 tiket mandatory** (173 CSO × 2 sesi) + **24 tiket buffer**.

---

## 🗄️ Struktur Database & Relasi Model

```text
┌───────────────────────────┐         1:N         ┌───────────────────────────┐
│     sampling_periods      ├────────────────────►│    sampling_assignments   │
│  - period (e.g. 2026-09)  │                     │  - ticket_id / idca       │
│  - target_site (5920)     │                     │  - evaluator_name         │
│  - daily_target (160)     │                     │  - status (PENDING, etc.) │
└─────────────┬─────────────┘                     │  - score_ca, fcr, notes   │
              │ 1:N                               └─────────────┬─────────────┘
              ▼                                                 │ N:1
┌───────────────────────────┐                                   ▼
│      sampling_targets     │                     ┌───────────────────────────┐
│  - evaluator_name         │                     │       ca_assessments      │
│  - target_total (370)     │                     │  - idtiket, idca          │
│  - mandatory (346)        │                     │  - channel, category      │
└───────────────────────────┘                     │  - agent_name, raw_data   │
                                                  └───────────────────────────┘
```

---

## 📡 Katalog REST API Endpoints

### 🔐 1. Otentikasi & Sesi Pengguna
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Otentikasi username & password, mengembalikan token & user profile |
| `POST` | `/api/auth/logout` | Menghapus token sesi aktif |
| `GET` | `/api/auth/me` | Memeriksa data user yang sedang login |

---

### 📊 2. Modul 1 – 4: Dashboard & Executive Analytics
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Ringkasan metrik global CA %, FCR %, dan pencapaian target bulanan |
| `GET` | `/api/dashboard/monthly-trend` | Tren performa 12 bulan (Januari s/d Desember) |
| `GET` | `/api/dashboard/channel-breakdown`| Distribusi pencapaian skor 7 Saluran QSF |
| `GET` | `/api/dashboard/lowest-parameters`| 5 parameter kegagalan SOP terendah |
| `GET` | `/api/anev/ranking` | Data ranking Top 5 & Bottom 5 performa agen |
| `GET` | `/api/agents` | Daftar rekap skor seluruh agen dengan pagination & filter TL |
| `GET` | `/api/agents/{id}/scorecard` | Rincian histori penilaian individu seorang agen |
| `GET` | `/api/qa/success-board` | Produktivitas kuota bulanan per evaluator QA |

---

### 📚 3. Modul 5: QA Policy Hub
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/policies` | Mengambil daftar SOP, regulasi, dan notulensi kalibrasi mutu |
| `POST` | `/api/policies` | Menambah entri SOP / kebijakan mutu baru |
| `PUT` | `/api/policies/{id}` | Memperbarui isi dokumen kebijakan SOP |
| `DELETE`| `/api/policies/{id}` | Menghapus dokumen kebijakan |

---

### 📝 4. Modul 6: Sampling Ticket (Lembar Sampling QA)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/sampling/my-bucket` | Mengambil antrean tiket aktif milik QA yang sedang login |
| `POST` | `/api/sampling/start-evaluate` | Mengubah status tiket menjadi `IN_PROGRESS` (sedang dinilai) |
| `POST` | `/api/sampling/complete` | Menyimpan hasil skoring parameter SOP, skor CA, dan status FCR |
| `POST` | `/api/sampling/skip` | Melewati tiket (*SKIPPED*) dengan mencantumkan alasan standar |
| `POST` | `/api/sampling/hold` | Menunda penilaian tiket (*PENDING*) untuk eskalasi |
| `POST` | `/api/sampling/request-extra-quota`| QA mengajukan penambahan tiket ekstra ke Supervisor |

---

### ⚡ 5. Modul 7: Ticketing (Auto Distribution Engine)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/sampling/bucket-tickets` | Mengambil seluruh antrean tiket sampling beserta statistik pool mentah |
| `GET` | `/api/sampling/import-readiness-status` | Status kesiapan impor tarikan CRM harian (< 07:00 WIB) & sisa pool |
| `POST` | `/api/sampling/distribute-daily` | Menjalankan auto-distribusi harian (20 tiket/QA = 160 tiket/hari) |
| `POST` | `/api/sampling/distribute-auto` | Menjalankan auto-distribusi penuh untuk target bulanan (370/QA) |
| `GET` | `/api/sampling/quota-requests` | Mengambil daftar pengajuan kuota tambahan dari QA Evaluator |
| `POST` | `/api/sampling/grant-extra-quota` | Supervisor menyetujui / memberikan kuota tambahan (Masa aktif: 24 jam) |
| `GET` | `/api/sampling/roster` | Mengambil jadwal & matriks kesiapan kehadiran QA bulanan |
| `POST` | `/api/sampling/set-qa-readiness` | Mengubah status kehadiran QA (`ON_DUTY` / `OFF_DAY`) |
| `POST` | `/api/sampling/reassign` | Memindahkan tiket dari satu QA ke QA lainnya beserta log audit |
| `POST` | `/api/sampling/recall` | Menarik / mereset antrean tiket sampling berdasarkan filter |
| `POST` | `/api/sampling/simulate-expire` | Menjalankan simulasi kedaluwarsa SLA 7 hari (*Auto-Abandon*) |

---

### 📥 6. Modul 8 & 9: Master Data & Kelola Akun
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/import/process` | Menginjeksi batch data Excel (NAKER / QSF 7 Saluran) ke database |
| `GET` | `/api/import/history` | Riwayat seluruh berkas yang telah diimpor ke sistem |
| `POST` | `/api/import/rollback` | Menarik kembali (*rollback*) berkas impor tertentu beserta datanya |
| `GET` | `/api/users` | Mengambil daftar seluruh pengguna dan hak akses |
| `POST` | `/api/users` | Menambah akun pengguna baru (RBAC) |
| `PUT` | `/api/users/{id}` | Mengubah hak akses, role, atau profil pengguna |

---

## 📌 Prinsip Pemisahan Data

- **Data Mentah Harian (Raw CRM)**: Disimpan dalam tabel `ca_assessments` (sebagai sumber raw pool) dan `sampling_assignments` (sebagai kuota kerja QA).
- **Data Matang Bulanan (QSF Matang)**: Diimpor di awal bulan melalui Modul 8 untuk mengkalkulasi skor resmi pada Dashboard Global, Anev Ranking, dan Scorecards Agen (Modul 1–4).

---

## 🚀 Petunjuk Setup & Eksekusi

```bash
# 1. Masuk ke direktori backend
cd backend

# 2. Install dependency PHP
composer install

# 3. Generate Encryption Key
php artisan key:generate

# 4. Migrasi Skema Database & Jalankan Seeder
php artisan migrate --seed

# 5. Jalankan Server API
php artisan serve --port=8000
```
Server backend berjalan pada: `http://127.0.0.1:8000`.
