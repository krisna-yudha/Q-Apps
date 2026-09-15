# ⚙️ DigiQA Backend API (Laravel 11)

> **RESTful API Backend, Service Layer Engine & Real-Time Notification Platform for DigiQA Enterprise**

Backend DigiQA dibangun menggunakan framework **Laravel 11** (PHP 8.2+) untuk menangani kalkulasi analitik makro mutu, pemrosesan batch data Excel (NAKER & QSF 7 Saluran), manajemen hak akses (RBAC), mesin distribusi kuota sampling otomatis (*Auto-Distribution Engine V2*), serta aliran notifikasi real-time (*Server-Sent Events / SSE*).

---

## 📑 Daftar Isi
- [Arsitektur & Service Engine](#-arsitektur--service-engine)
- [Struktur Database & Relasi Model](#-struktur-database--relasi-model)
- [Katalog REST API Endpoints](#-katalog-rest-api-endpoints)
- [Fitur Khusus Backend](#-fitur-khusus-backend)
- [Prinsip Pemisahan Data (Data Pipeline Separation)](#-prinsip-pemisahan-data)
- [Petunjuk Setup & Eksekusi](#-petunjuk-setup--eksekusi)

---

## 🏗️ Arsitektur & Service Engine

Backend menerapkan pola arsitektur berbasis *Service Layer* modular pada namespace `App\Services\Sampling`:

### 1. `AutoDistributionEngineService.php`
- **Distribusi Harian Proporsional**: Mengalokasikan **20 tiket/hari** per QA On Duty berdasarkan komposisi kategori SOP (6 Informasi, 7 Gangguan, 6 Keluhan, 1 Permohonan).
- **Kapasitas Tim**: `8 QA × 20 = 160 tiket/hari`.
- **Mitigasi Duplikasi (Anti-Collision Locker)**: Memastikan 1 CSO tidak dievaluasi melebihi batas target bulanan (maks 2 sesi/CSO) dan memprioritaskan CSO yang belum pernah disampling.
- **SLA Kedaluwarsa 7 Hari**: Otomatis mendeteksi tiket yang belum diselesaikan dalam 7 hari untuk penandaan status *Auto-Abandon* / audit investigasi.

### 2. `NakerVerificationService.php`
- Normalisasi penamaan CSO/Agent (menghilangkan spasi ganda, format dot, gelar, dan pembersihan karakter non-standar).
- Pencocokan silang (*cross-match*) data transaksi mentah dengan Database Plotting NAKER aktif.

### 3. `SamplingQaAttendanceService.php`
- Manajemen roster harian 8 Evaluator QA (`ON_DUTY`, `OFF_DAY`, `CUTI`, `SAKIT`, `IJIN`).
- Pelacakan kesiapan QA harian secara mandiri (*self-service duty activation*) di mana QA mengaktifkan shift kerjanya sendiri untuk menarik kuota harian.

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

### 🔐 1. Otentikasi & Profil Pengguna (`AuthController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Login user, mengembalikan token Bearer & info profile lengkap |
| `POST` | `/api/logout` | Logout dan invalidasi sesi token |
| `POST` | `/api/user/heartbeat` | Pembaruan status online & last-seen pengguna |
| `POST` | `/api/user/profile` | Update profil (nama, email, phone, avatar) |
| `POST` | `/api/user/password` | Ganti password akun |

---

### 🔔 2. Sistem Notifikasi Privat & Real-Time (`NotificationController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/notifications` | Daftar notifikasi terfilter sesuai akun login (`target_user_id` / `target_role`) |
| `GET` | `/api/notifications/unread-count` | Jumlah notifikasi belum dibaca |
| `GET` | `/api/notifications/stream` | Server-Sent Events (SSE) stream notifikasi real-time |
| `POST` | `/api/notifications/mark-read` | Menandai satu notifikasi telah dibaca |
| `POST` | `/api/notifications/clear-all` | Menandai semua notifikasi akun terkait telah dibaca |

---

### 📊 3. Modul 1 – 4: Dashboard & Executive Analytics (`DashboardController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/global` | Ringkasan metrik makro CA %, FCR %, 12 bulan tren, breakdown 7 kanal |
| `GET` | `/api/dashboard/anev` | Pemeringkatan Top 5 & Bottom 5 Agen serta **Status Personel Dinamis Berbasis Role** |
| `GET` | `/api/dashboard/parameters-low` | Analisis parameter kegagalan SOP terendah per layanan |
| `GET` | `/api/agents/recap` | Rekapitulasi penilaian agen dengan filter saluran, TL, dan Trainer |
| `GET` | `/api/assessments/{id}/scores` | Rincian skor parameter individu per tiket asesmen |
| `GET` | `/api/evaluators/sampling` | Produktivitas kuota bulanan per evaluator QA (Target: 370 sesi) |

---

### 📚 4. Modul 5: QA Policy Hub (`PolicyDiscussionController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/policy-discussions` | Mengambil daftar SOP, regulasi kanal, notulensi kalibrasi, dan FAQ |
| `POST` | `/api/policy-discussions` | Menambah entri SOP / notulensi kebijakan baru |
| `PATCH`| `/api/policy-discussions/{id}/toggle` | Mengubah status aktif dokumen kebijakan |
| `DELETE`| `/api/policy-discussions/{id}` | Menghapus dokumen kebijakan |

---

### 📝 5. Modul 6: Sampling Ticket Worksheet (`SamplingDistributionController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/sampling/my-status` | Status duty QA saat ini (`ON_DUTY` / `OFF_DAY`) & kuota harian |
| `POST` | `/api/sampling/my-readiness` | Self-Service QA untuk mengaktifkan status ON DUTY & menarik 20 tiket |
| `POST` | `/api/sampling/assignments/{id}/start` | Mengubah status tiket menjadi `IN_PROGRESS` (dikunci ke QA) |
| `POST` | `/api/sampling/assignments/{id}/complete` | Menyimpan hasil skoring SOP, skor CA, dan status FCR |
| `POST` | `/api/sampling/assignments/{id}/skip` | Melewati tiket (*SKIPPED*) dengan alasan terstandarisasi |
| `POST` | `/api/sampling/assignments/{id}/hold` | Menunda pengerjaan tiket (*HOLD*) |
| `POST` | `/api/sampling/assignments/{id}/reopen` | Membuka kembali tiket yang sudah selesai dinilai |
| `POST` | `/api/sampling/quota-requests` | QA mengajukan penambahan kuota ekstra ke Supervisor |

---

### ⚡ 6. Modul 7: Auto Distribution Engine (`SamplingDistributionController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/sampling/periods` | Daftar periode sampling aktif |
| `POST` | `/api/sampling/periods` | Membuat periode sampling baru |
| `POST` | `/api/sampling/periods/{period}/distribute-daily` | Eksekusi Auto-Distribusi Harian (20 tiket/QA) |
| `GET` | `/api/sampling/bucket/tickets` | Mengambil antrean tiket sampling & ringkasan raw pool |
| `GET` | `/api/sampling/monitoring/qa-handling` | Monitoring real-time produktivitas dan antrean tiap QA |
| `GET` | `/api/sampling/roster` | Jadwal & matriks kesiapan kehadiran QA bulanan |
| `POST` | `/api/sampling/roster/bulk-update` | Update matriks shift & kehadiran roster QA |
| `POST` | `/api/sampling/extra-quota/grant` | Supervisor memberikan `+ Kuota SPV` (berlaku 24 jam) |
| `POST` | `/api/sampling/assignments/{id}/reassign` | Memindahkan tiket ke evaluator lain dengan audit log |
| `POST` | `/api/sampling/bucket/clear` | Mengosongkan antrean tiket bucket |
| `POST` | `/api/sampling/bucket/recall` | Menarik tiket kembali ke pool cadangan |
| `POST` | `/api/sampling/reset-all` | Reset seluruh data sampling pada periode tertentu |

---

### 📥 7. Modul 8: Data Master & Import Matang (`AgentRecapController.php` & `EmployeeController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/supervisor/channel-summary` | Ringkasan data asesmen 7 saluran dan database NAKER |
| `POST` | `/api/agents/preview-excel` | Pratinjau & audit redundansi file Excel sebelum impor |
| `POST` | `/api/agents/import-excel` | Impor data matang QSF 7 Saluran & Master NAKER ke database |
| `POST` | `/api/agents/store-manual` | Input manual skor asesmen per agen |
| `POST` | `/api/agents/clear-data` | **Pusat Pengosongan Data**: Menghapus data per saluran / selektif |
| `POST` | `/api/system/reset-data` | Reset data sistem secara terkontrol |
| `GET` | `/api/employees` | Mengambil data Master Tenaga Kerja (NAKER) dan plotting penugasan |
| `GET` | `/api/naker/export` | Ekspor seluruh data Master NAKER ke Excel |

---

### 👥 8. Modul 9: User Setting & Kelola Akun (`UserController.php`)
| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/users` | Mengambil daftar seluruh akun login sistem |
| `GET` | `/api/users/naker-candidates` | Daftar kandidat NAKER yang belum memiliki akun login |
| `POST` | `/api/users/sync-from-naker` | Injeksi otomatis akun login dari Master NAKER (QA, TL, Trainer) |
| `POST` | `/api/users` | Menambah akun pengguna baru secara manual |
| `PUT` | `/api/users/{id}` | Memperbarui profil dan role pengguna |
| `POST` | `/api/users/{id}/reset-password` | Reset password akun pengguna ke default |
| `POST` | `/api/users/{id}/toggle-status` | Mengaktifkan / menonaktifkan akun pengguna |

---

## 💎 Fitur Khusus Backend

### 1. Logika Status Personel Dinamis (`DashboardController.php::anevRanking`)
Endpoint `/api/dashboard/anev` secara cerdas meresolusi data personel:
- **Untuk Supervisor**: Mengambil daftar user bertipe `quality_assurance` dengan status keaktifan shift duty riil.
- **Untuk Team Leader**: Mengambil daftar anggota agen pelayanan under-team yang di-plotting ke TL tersebut melalui relasi `EmployeeAssignment` / `Agent`.
- **Untuk Trainer**: Mengambil daftar anggota agen kelas bimbingan di bawah bimbingan Trainer.

### 2. Notifikasi Terisolasi & Real-Time SSE
Notifikasi ditargetkan secara privat (`target_user_id` atau `target_role`) sehingga aktivitas individual (seperti ganti foto profil) tidak membroadcast ke seluruh sistem secara global.

---

## 📌 Prinsip Pemisahan Data
- **Data Mentah CRM (Pipeline Harian)**: Dimasukkan ke `ca_assessments` (raw pool) dan dibagi ke `sampling_assignments` (kuota kerja).
- **Data Matang QSF (Pipeline Bulanan)**: Diimpor di awal bulan melalui Modul 8 untuk mengisi metrik resmi pada Dashboard Global, Anev Ranking, dan Scorecards.

---

## 🚀 Petunjuk Setup & Eksekusi

```bash
# 1. Masuk ke direktori backend
cd backend

# 2. Install dependency PHP
composer install

# 3. Konfigurasi environment
cp .env.example .env
php artisan key:generate

# 4. Migrasi Skema Database & Jalankan Seeder
php artisan migrate --seed

# 5. Jalankan Server API
php artisan serve --port=8000
```
Server backend berjalan pada: `http://127.0.0.1:8000`.
