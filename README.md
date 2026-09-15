# 🛡️ DigiQA Enterprise (Q-Apps Contact Center Mutu v2.5)

> **Enterprise Contact Center Quality Assurance, Analytics, Dynamic Roster & Automated Sampling Distribution Platform**

Sistem terpadu tata kelola mutu (*Quality Assurance*), analitik kinerja agen, repositori kebijakan SOP, dan mesin auto-distribusi sampling transaksi harian Contact Center. Dirancang untuk memproses data mentah harian dari CRM/CSC secara *anti-collision*, mengelola evaluasi mutu harian per evaluator QA, serta mengolah pelaporan komprehensif **7 Saluran Layanan QSF** dan **Database NAKER (Plotting Penugasan)** secara *real-time*, dinamis, dan responsif (Desktop, Tablet, & Mobile View).

---

## 📌 Prinsip Arsitektur Utama (Separation of Data Pipeline)

Sistem DigiQA memisahkan secara tegas antara **Data Mentah Operasional Sampling Harian (Raw CRM)** dan **Data Matang Dashboard Eksekutif Bulanan (Processed QSF)**:

```mermaid
graph TD
    subgraph Pipeline_Harian ["🔄 Pipeline 1: Operasional Harian (Modul 6 & 7)"]
        CRM["Tarikan Transaksi CRM Mentah (Excel 62 Kolom)"] -->|Upload Harian < 07:00 WIB| M7["Modul 7: Ticketing & Auto Distribution (SPV)"]
        M7 -->|Engine V2: Bagi 20 Tiket/QA (160/Hari)| Bucket["Antrean Kerja QA (Locker Anti-Collision)"]
        Bucket -->|Observasi & Skoring Mutu| M6["Modul 6: Sampling Ticket (Worksheet QA)"]
        M6 -->|Hasil Evaluasi Harian| Arsip["Tiket Matang / Evaluated Sampling"]
    end

    subgraph Pipeline_Bulanan ["📊 Pipeline 2: Dashboard Eksekutif (Modul 1–4 & 8)"]
        MasterNAKER["Data Master NAKER (Plotting CSO/TL/TRN)"] -->|Awal Bulan| M8["Modul 8: Data Master & Import (Khusus SPV)"]
        QSF_Excel["Berkas Hasil QSF 7 Saluran (Processed Excel)"] -->|Awal Bulan| M8
        M8 -->|Agregasi & Sinkronisasi DB| DB["Database Mutu Utama"]
        DB --> M1["Modul 1: Dashboard Global (CA & FCR)"]
        DB --> M2["Modul 2: QA Analytics (Anev Ranking & Status Personel Dinamis)"]
        DB --> M3["Modul 3: Agent Scorecards (Rekap Nilai Agen)"]
        DB --> M4["Modul 4: Success Board (Pencapaian Kuota Tim QA)"]
    end

    subgraph Modul_Khusus_Binaan ["👥 Modul Binaan Tim (Modul 6 Khusus TL/Trainer)"]
        DB --> M6_TL["Modul 6: Rekap Tim Binaan (/rekap-under-team)"]
        M6_TL --> RosterTL["Master NAKER Binaan & Ekspor Excel Mandiri"]
        M6_TL --> PerfTL["Performa CA/FCR Anggota Tim Binaan"]
    end

    subgraph Modul_Pendukung ["📚 Kebijakan & Pengaturan (Modul 5 & 9)"]
        M5["Modul 5: QA Policy Hub (Repositori SOP & Notulensi)"]
        M9["Modul 9: User Setting & Kelola Akun (RBAC & Injeksi Akun NAKER)"]
    end
```

---

## 📑 Daftar Isi
- [Struktur Modul & Navigasi Berbasis Role (RBAC)](#-struktur-modul--navigasi-berbasis-role-rbac)
- [Fitur Utama & Keunggulan Sistem](#-fitur-utama--keunggulan-sistem)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Struktur Proyek](#-struktur-proyek)
- [Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
- [Akun Default & Hak Akses (RBAC)](#-akun-default--hak-akses-rbac)
- [Dokumentasi Sub-Sistem](#-dokumentasi-sub-sistem)
- [Lisensi](#-lisensi)

---

## 🚀 Struktur Modul & Navigasi Berbasis Role (RBAC)

Navigasi dan izin akses DigiQA sepenuhnya terisolasi berdasarkan role login:

| No | Modul | Rute URL | Hak Akses Role | Deskripsi Operasional |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Dashboard Global** | `/dashboard-global` | Semua Role | Monitoring performa makro **Customer Accuracy (CA ≥ 85%)** dan **First Call Resolution (FCR 100%)**, tren 12 bulan Jan-Des, status 7 kanal QSF, dan 5 parameter kegagalan terendah. |
| **2** | **QA Analytics** | `/anev` | Semua Role | Analisis & Evaluasi (*Anev*), pemeringkatan **Top 5 High Performers** & **Bottom 5 Agents**, serta **Status Personel Dinamis** yang adaptif sesuai role login. |
| **3** | **Agent Scorecards** | `/rekap-agent` | Semua Role | Rekapitulasi nilai komprehensif per agen, filter saluran & Team Leader, rincian parameter, serta ekspor laporan ke **Excel (.xlsx)** & **PDF**. |
| **4** | **Success Board** | `/pencapaian-qa` | Semua Role | Pemantauan produktivitas kuota bulanan per evaluator QA (Target: 370 sesi/bulan) dan histori kalibrasi mutu. |
| **5** | **QA Policy Hub** | `/kebijakan` | Semua Role | Repositori pusat pedoman SOP layanan Contact Center, notulensi keputusan kalibrasi mutu, FAQ parameter penilaian, dan materi coaching. |
| **6** | **Sampling Ticket** | `/evaluasi-sampling` | QA Evaluator, Supervisor | *Worksheet* evaluasi sampling tiket CRM harian. QA mengontrol status kerja mandiri (*ON DUTY / OFF DAY*), skoring parameter SOP, checklist FCR, Hold/Skip/Reassign, dan request `+ Kuota SPV`. |
| **6\*** | **Rekap Tim Binaan** | `/rekap-under-team` | Team Leader, Trainer | Modul khusus TL & Trainer untuk memantau nilai CA/FCR agen binaan, monitoring kategori coaching, dan akses Master NAKER Tim Binaan dengan tombol **Ekspor Excel (.xlsx)** mandiri. |
| **7** | **Ticketing (Auto Distribution)** | `/auto-distribution` | Khusus Supervisor / Admin | Mesin Auto-Distribusi V2: Pembagian kuota CRM harian ke QA On Duty (20 tiket/QA = 160 tiket/hari), pelacakan sisa tiket mentah cadangan (*pool*), roster kehadiran QA, audit SLA 7 hari, dan pemberian `+ Kuota SPV`. |
| **8** | **Data Master** | `/settings` | **Khusus Supervisor / Admin** | Satu Pintu Pengelolaan Data: Import data matang QSF 7 saluran bulanan, import plotting Master NAKER, input manual data matang, setting bobot SOP, dan Pusat Pengosongan / Reset Data. Non-supervisor diblokir secara ketat. |
| **9** | **User Setting** | `/kelola-akun` | **Khusus Supervisor / Admin** | Manajemen akun pengguna, injeksi akun otomatis dari Master NAKER (QA, TL, Trainer), reset password mandiri, pengaturan hak akses RBAC, dan toggle status aktif akun. |

---

## 💎 Fitur Utama & Keunggulan Sistem

1. **Status Personel Live Shift 100% Dinamis (Modul 2 / Anev Ranking)**:
   - **Login Supervisor**: Menampilkan **Hanya QA Evaluator** aktif yang terdaftar di database sistem beserta status keaktifan shift (*ON DUTY / OFF DAY / Standby*) dan jumlah pengerjaan sampling (bebas data dummy).
   - **Login QA Evaluator**: Menampilkan rekan-rekan sesama tim QA Evaluator dan ketersediaan shift.
   - **Login Team Leader**: Menampilkan **daftar agen pelayanan (CSO/Agent) under-team binaan** TL tersebut lengkap dengan layanannya (Digilive, Inbound, Socmed, dll.) dan status aktif.
   - **Login Trainer**: Menampilkan **daftar agen kelas bimbingan** di bawah asuhan Trainer tersebut.

2. **Isolasi Penuh Data Master (Khusus Supervisor / Admin)**:
   - Rute `/settings` dan `/input-supervisor` diproteksi ketat menggunakan `SupervisorRoute` dan *strict component-level access guard*.
   - Team Leader dan Trainer tidak lagi melihat menu Data Master di sidebar maupun dashboard hub, melainkan mandiri di **Modul 6: Rekap Tim Binaan**.

3. **Injeksi Akun Master NAKER Dinamis**:
   - Akun QA, TL, dan Trainer dibuat dinamis dan terhubung dengan Master NAKER. Jika data belum diinjeksi atau akun belum dibuat oleh Supervisor, sistem menampilkan *empty state* bersih tanpa data fiktif.

4. **Sistem Notifikasi Privat Berbasis Akun & Role**:
   - Notifikasi user dispesifikasikan berdasarkan `target_user_id` dan `target_role` (misal update profil/password hanya dikirim ke user terkait, peringatan wipe data hanya ke supervisor).
   - Dilengkapi *Real-Time Server-Sent Events (SSE)* di `/api/notifications/stream` dan penanda sudah dibaca (*mark as read*).

5. **Pusat Pengosongan & Reset Data Terkendali**:
   - Supervisor dapat melakukan pembersihan data secara selektif: per kanal saluran, seluruh data asesmen, master data NAKER, antrean sampling tiket, atau reset database total dengan dialog konfirmasi aman.

---

## 🛠️ Teknologi yang Digunakan

### Frontend Client
- **Framework & Runtime**: [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- **Routing**: [React Router v6](https://reactrouter.com/) dengan Route Guards RBAC (`SupervisorRoute`, `SamplingRoute`, `UnderTeamRoute`)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) dengan Corporate Executive Design System
- **Komponen Dropdown**: Custom in-DOM Select dropdown (bebas overflow issue pada layar mobile)
- **Ikonografi**: [Lucide React](https://lucide.dev/)
- **Visualisasi Grafik**: [Recharts](https://recharts.org/)
- **Pengolah Berkas**: [SheetJS (xlsx)](https://sheetjs.com/) & [jsPDF](https://github.com/parallax/jsPDF)
- **Build Optimization**: Custom manual chunking (*vendor splitting*) untuk mencegah lonjakan memori Node.js (*Heap OOM*)

### Backend REST API
- **Framework**: [Laravel 11](https://laravel.com/) (PHP 8.2+)
- **Database**: MySQL / MariaDB (melalui XAMPP / MariaDB Server)
- **Otentikasi**: Laravel Sanctum / Token-based Session Auth
- **Komunikasi Real-Time**: Server-Sent Events (SSE) & Custom Event Bus
- **Service Layer Engine**: `AutoDistributionEngineService`, `SamplingQaAttendanceService`, `SamplingTargetEngineService`, `NakerVerificationService`

---

## 📁 Struktur Proyek

```text
digiQa/
├── backend/                             # RESTful API Backend (Laravel 11)
│   ├── app/
│   │   ├── Http/Controllers/Api/         # DashboardController, AuthController, NotificationController, dll.
│   │   ├── Models/                       # Eloquent Models (User, Employee, CaAssessment, dll.)
│   │   └── Services/Sampling/            # Engine V2 (AutoDistribution, Roster, Attendance, dll.)
│   ├── database/
│   │   ├── migrations/                   # Skema Tabel Database Mutu
│   │   └── seeders/                      # Seeder Akun Utama & Master Data Awal
│   └── routes/api.php                    # Katalog Rute API RESTful
│
├── frontend/                            # Single Page Application (React 18 + Vite)
│   ├── public/                           # Aset Publik (Logo, Favicon)
│   └── src/
│       ├── components/
│       │   ├── common/                   # CustomSelect, ErrorBoundary, Dialog Modal
│       │   └── layout/                   # Navbar, Sidebar (RBAC Filtered), MobileNav
│       ├── context/                      # AuthContext, DialogContext, SyncContext
│       ├── pages/                        # 9 Modul Halaman Utama & Rekap Tim Binaan
│       └── services/api.js               # Jembatan Axios REST Client
│
├── FLOWAPPS_MANUAL_BOOK_PANDUAN_OPERASIONAL.md # Panduan Manual Book Lengkap Operasional
├── run_digiqa.bat                       # Script Eksekusi 1-Klik Otomatis (Windows)
├── start_backend.bat                    # Script Menjalankan Server Laravel (Port 8000)
├── start_frontend.bat                   # Script Menjalankan Vite Dev Server (Port 5173)
├── stop_digiqa.bat                      # Script Menghentikan Seluruh Servis
└── README.md                            # Dokumentasi Utama Proyek
```

---

## ⚡ Panduan Instalasi & Menjalankan

### Persyaratan Sistem:
- **PHP** >= 8.2 (Ekstensi: `pdo_mysql`, `mbstring`, `fileinfo`, `zip`, `curl`)
- **Composer** (PHP Package Manager)
- **Node.js** >= 18.x & **NPM**
- **MySQL / MariaDB Server** (Port 3306)

---

### Cara Cepat (1-Klik di Windows):
Jalankan file batch pada root direktori:
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
Pastikan konfigurasi koneksi database di file `backend/.env`:
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
Aplikasi dapat diakses di browser: **`http://127.0.0.1:5173`**.

---

### 🚀 Cara Build & Update di Server Production

```bash
# 1. Tarik pembaruan kode
git pull origin main

# 2. Build frontend production
cd frontend
npm install
npm run build

# 3. Optimasi & bersihkan cache backend
cd ../backend
composer install --no-dev --optimize-autoloader
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

---

## 🔐 Akun Default & Hak Akses (RBAC)

| Role | Username | Password | Modul Utama yang Diakses |
| :--- | :--- | :--- | :--- |
| **Supervisor / Admin** | `supervisor` | `password` | Akses penuh seluruh modul (Modul 1 s/d 9), Data Master, User Setting, Auto Distribution, dan Reset Data. |
| **QA Evaluator** | `qa` / `[nama.qa]` | `password` | Dashboard Global (1), QA Analytics (2), Agent Scorecards (3), Success Board (4), QA Policy Hub (5), dan **Sampling Ticket (6)**. |
| **Team Leader (TL)** | `team_leader` / `[tl-username]` | `password` | Dashboard Global (1), QA Analytics (2), Agent Scorecards (3), Success Board (4), QA Policy Hub (5), dan **Rekap Tim Binaan (6)**. |
| **Trainer** | `trainer` / `[trn-username]` | `password` | Dashboard Global (1), QA Analytics (2), Agent Scorecards (3), Success Board (4), QA Policy Hub (5), dan **Rekap Kelas Bimbingan (6)**. |
| **Superadmin** | `admin` | `password` | Hak akses penuh sistem dan konfigurasi. |

---

## 📖 Dokumentasi Sub-Sistem

- 📘 **[Buku Panduan Operasional Lengkap (Manual Book)](file:///c:/xampp/htdocs/digiQa/FLOWAPPS_MANUAL_BOOK_PANDUAN_OPERASIONAL.md)**: Panduan detail proses bisnis harian dan bulanan.
- ⚙️ **[Dokumentasi Backend API](file:///c:/xampp/htdocs/digiQa/backend/README.md)**: Arsitektur Laravel, katalog REST API endpoint, dan service engine sampling.
- 🎨 **[Dokumentasi Frontend Client](file:///c:/xampp/htdocs/digiQa/frontend/README.md)**: Arsitektur komponen React, router, design system, dan state context.

---

## 📄 Lisensi
Hak Cipta © 2026 **DigiQA Enterprise / Q-Apps System**. Seluruh hak cipta dilindungi undang-undang.
