# 🛡️ DigiQA Enterprise (Q-Apps Contact Center Mutu v2.0)

> **Enterprise Contact Center Quality Assurance, Analytics & Automated Sampling Distribution Platform**

Sistem terpadu tata kelola mutu (*Quality Assurance*), analitik kinerja agen, repositori kebijakan SOP, dan mesin auto-distribusi sampling transaksi harian Contact Center. Dirancang untuk memproses transaksi mentah dari CRM/CSC secara harian dan mengolah pelaporan komprehensif **7 Saluran Layanan QSF** serta **Database NAKER (Plotting)** secara *real-time*, akurat, dan responsif (Desktop & Mobile View).

---

## 📌 Prinsip Arsitektur Utama (Separation of Data Pipeline)

Sistem DigiQA memisahkan secara tegas antara **Data Mentah Operasional Sampling Harian (Raw CRM)** dan **Data Matang Dashboard Eksekutif Bulanan (Processed QSF)**:

```mermaid
graph TD
    subgraph Pipeline_Harian ["🔄 Pipeline 1: Operasional Harian (Modul 6 & 7)"]
        CRM["Tarikan Transaksi CRM Mentah (Excel 62 Kolom)"] -->|Upload Harian < 07:00 WIB| M7["Modul 7: Ticketing & Auto Distribution"]
        M7 -->|Engine V2: Bagi 20 Tiket/QA (160/Hari)| Bucket["Antrean Kerja QA"]
        Bucket -->|Observasi & Skoring Mutu| M6["Modul 6: Sampling Ticket (Lembar Sampling QA)"]
        M6 -->|Hasil Evaluasi Harian| Arsip["Tiket Matang / Evaluated Sampling"]
    end

    subgraph Pipeline_Bulanan ["📊 Pipeline 2: Dashboard Eksekutif (Modul 1–4 & 8)"]
        MasterNAKER["Data Master NAKER (Plotting CSO/TL)"] -->|Awal Bulan| M8["Modul 8: Data Master & Import"]
        QSF_Excel["Berkas Hasil QSF 7 Saluran (Processed Excel)"] -->|Awal Bulan| M8
        M8 -->|Agregasi & Sinkronisasi DB| DB["Database Mutu Utama"]
        DB --> M1["Modul 1: Dashboard Global (CA & FCR)"]
        DB --> M2["Modul 2: QA Analytics & Anev Ranking"]
        DB --> M3["Modul 3: Agent Scorecards (Rekap Nilai)"]
        DB --> M4["Modul 4: Success Board (Pencapaian QA)"]
    end

    subgraph Modul_Pendukung ["📚 Kebijakan & Pengaturan (Modul 5 & 9)"]
        M5["Modul 5: QA Policy Hub (Repositori SOP & Notulensi)"]
        M9["Modul 9: User Setting & Kelola Akun (RBAC)"]
    end
```

---

## 📑 Daftar Isi
- [Struktur 9 Modul Sistem](#-struktur-9-modul-sistem)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Struktur Proyek](#-struktur-proyek)
- [Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
- [Akun Default & Hak Akses (RBAC)](#-akun-default--hak-akses-rbac)
- [Dokumentasi Tambahan](#-dokumentasi-tambahan)
- [Lisensi](#-lisensi)

---

## 🚀 Struktur 9 Modul Sistem

| No | Modul | Kode Menu | Pengguna Utama | Deskripsi Operasional |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Dashboard Global** | `Dashboard Global` | Executive, SPV, TL, QA | Monitoring performa makro **Customer Accuracy (CA ≥ 85%)** dan **First Call Resolution (FCR 100%)**, tren 12 bulan, status 7 kanal QSF, dan 5 parameter kegagalan terendah. |
| **2** | **QA Analytics** | `QA Analytics` | SPV, TL, Trainer | Analisis dan evaluasi (*Anev*), pemeringkatan **Top 5 High Performers** dan **Bottom 5 Agents** untuk prioritas pembinaan dan kalibrasi mutu. |
| **3** | **Agent Scorecards** | `Agent Scorecards` | TL, QA, Supervisor | Rincian lembar nilai komprehensif per agen, filter saluran & Team Leader, pencarian NIK/Nama, serta ekspor laporan ke **Excel (.xlsx)** & **PDF**. |
| **4** | **Success Board** | `Success Board` | Supervisor, QA, Trainer | Pemantauan produktivitas kuota bulanan per evaluator QA (Target: 370 sesi/bulan) dan histori kalibrasi mutu. |
| **5** | **QA Policy Hub** | `QA Policy Hub` | Seluruh Pengguna | Repositori pusat pedoman SOP layanan Contact Center, notulensi keputusan kalibrasi mutu, dan FAQ parameter penilaian. |
| **6** | **Sampling Ticket** | `Sampling Ticket` | QA Evaluator, SPV | Lembar kerja evaluasi sampling (*Worksheet*). QA mendengarkan recording/chat, menilai kepatuhan SOP per parameter, checklist FCR, Hold/Skip/Reassign, dan pengajuan `+ Kuota SPV`. |
| **7** | **Ticketing (Auto Distribution)** | `Ticketing` | Supervisor, QA, TL | Mesin Auto-Distribusi V2: Membagi tarikan CRM harian ke 8 QA On Duty (20 tiket/QA = 160 tiket/hari), pelacakan sisa tiket mentah cadangan (pool), roster kehadiran QA, audit SLA 7 hari, dan pemberian `+ Kuota SPV`. |
| **8** | **Data Master** | `Data Master` | Supervisor, Admin | Satu Pintu Pengelolaan Data: Import data matang QSF 7 saluran bulanan, import plotting Master NAKER, setting bobot SOP, dan manajemen kategori layanan. |
| **9** | **User Setting** | `User Setting` | Superadmin, SPV | Pengelolaan akun pengguna, manajemen kredensial NAKER, pengaturan hak akses (*Role-Based Access Control*), dan audit log aktivitas. |

---

## 🛠️ Teknologi yang Digunakan

### Frontend
- **Framework & Runtime**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) dengan Corporate Design System kustom
- **Komponen Dropdown**: Custom in-DOM Select dropdown (bebas overflow issue pada layar mobile)
- **Ikonografi**: [Lucide React](https://lucide.dev/)
- **Visualisasi Grafik**: [Recharts](https://recharts.org/)
- **Pengolah Berkas**: [SheetJS (xlsx)](https://sheetjs.com/) & [jsPDF](https://github.com/parallax/jsPDF)

### Backend
- **Framework**: [Laravel 11](https://laravel.com/) (PHP 8.2+)
- **Database**: MySQL / MariaDB (melalui XAMPP)
- **Komunikasi API**: RESTful JSON API dengan token otentikasi & CORS terkonfigurasi
- **Arsitektur Service**: Pipeline Service terpisah untuk Impor NAKER, Impor QSF, Auto-Distribusi V2, dan SLA Monitoring

---

## 📁 Struktur Proyek

```text
digiQa/
├── backend/                  # RESTful API Backend (Laravel 11)
│   ├── app/
│   │   ├── Http/Controllers/Api/  # SamplingDistributionController, DashboardController, dll.
│   │   ├── Models/                # Eloquent Models (CaAssessment, SamplingAssignment, dll.)
│   │   └── Services/Sampling/     # Engine V2 (AutoDistributionEngine, NakerVerification, dll.)
│   ├── database/
│   │   ├── migrations/            # Skema Tabel Database
│   │   └── seeders/               # Database Seeder Akun & Data Awal
│   └── routes/api.php             # Rute API RESTful
│
├── frontend/                 # Single Page Application (React 18 + Vite)
│   ├── public/                    # Aset Publik (Logo, Favicon)
│   └── src/
│       ├── components/            # Komponen Layout, CustomSelect, Reminder Banner
│       ├── context/               # AuthContext, DialogContext
│       ├── pages/                 # 9 Modul Halaman Lengkap
│       └── services/api.js        # Jembatan Axios REST Client
│
├── FLOWAPPS_MANUAL_BOOK_PANDUAN_OPERASIONAL.md # Panduan Manual Book Lengkap
├── run_digiqa.bat            # Script Eksekusi 1-Klik Otomatis (Windows)
├── start_backend.bat         # Script Menjalankan Server Laravel (Port 8000)
├── start_frontend.bat        # Script Menjalankan Vite Dev Server (Port 5173)
├── stop_digiqa.bat           # Script Menghentikan Seluruh Servis
└── README.md                 # Dokumentasi Utama
```

---

## ⚡ Panduan Instalasi & Menjalankan

### Persyaratan Sistem:
- **PHP** >= 8.2 (Ekstensi: `pdo_mysql`, `mbstring`, `fileinfo`, `zip`)
- **Composer** (PHP Dependency Manager)
- **Node.js** >= 18.x & **NPM**
- **MySQL Database Server** (XAMPP / Standalone MariaDB di port 3306)

---

### Cara Cepat (1-Klik di Windows):
Jalankan file batch pada root direktori proyek:
```cmd
run_digiqa.bat
```
Script akan otomatis memeriksa koneksi MySQL, menjalankan server backend di `http://127.0.0.1:8000`, dan membuka frontend di `http://127.0.0.1:5173`.

---

### Cara Manual:

#### 1. Setup Backend (Laravel 11)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```
Pastikan konfigurasi database di file `backend/.env`:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=qa_db
DB_USERNAME=root
DB_PASSWORD=
```
Jalankan migrasi database dan server:
```bash
php artisan migrate --seed
php artisan serve --port=8000
```

#### 2. Setup Frontend (React 18 + Vite)
Buka terminal baru:
```bash
cd frontend
npm install
npm run dev
```
Aplikasi siap diakses di: **`http://127.0.0.1:5173`**.

---

## 🔐 Akun Default & Hak Akses (RBAC)

| Role | Username | Password | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **Supervisor** | `supervisor` | `password` | Akses penuh seluruh 9 modul, Auto-Distribusi, Setor Berkas CRM, Tambah Kuota SPV, dan Import Master Data. |
| **QA Evaluator** | `qa` | `password` | Lembar Sampling QA (Modul 6), Bucket Kerja, Penilaian SOP & FCR, Pengajuan Tambahan Kuota, Dashboard Global, dan QA Policy Hub. |
| **Team Leader** | `team_leader` | `password` | Pemantauan performa CSO tim bimbingan, Scorecards Agen, Anev Ranking, dan Audit Mutu. |
| **Superadmin** | `admin` | `password` | Manajemen Pengguna (Modul 9), Konfigurasi Sistem, Backup, dan Hak Akses Global. |

---

## 📖 Dokumentasi Tambahan

- **[Buku Panduan Operasional & Flow Pengisian Data (Manual Book)](file:///c:/xampp/htdocs/digiQa/FLOWAPPS_MANUAL_BOOK_PANDUAN_OPERASIONAL.md)**: Panduan langkah demi langkah *end-to-end* pengoperasian aplikasi mulai dari import NAKER, distribusi harian, sampling QA, hingga dashboard bulanan.
- **[Dokumentasi Backend API](file:///c:/xampp/htdocs/digiQa/backend/README.md)**: Arsitektur Laravel, katalog REST API endpoint, dan service engine.
- **[Dokumentasi Frontend Client](file:///c:/xampp/htdocs/digiQa/frontend/README.md)**: Struktur komponen React, corporate design system, dan state management.

---

## 📄 Lisensi
Hak Cipta © 2026 **DigiQA Enterprise / Q-Apps System**. Seluruh hak cipta dilindungi undang-undang.
