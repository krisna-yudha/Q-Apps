# 🎨 DigiQA Frontend Client (React 18 + Vite)

> **Corporate Single Page Application (SPA) for Contact Center Quality Analytics & Sampling Management**

Frontend DigiQA dibangun menggunakan **React 18** dan dibundel dengan **Vite 5** untuk menghasilkan antarmuka pengguna yang sangat cepat, responsif di seluruh perangkat (Desktop, Tablet, & Smartphone), serta menerapkan standar **Corporate Executive Design System**.

---

## 📑 Daftar Isi
- [Fitur Desain & User Experience](#-fitur-desain--user-experience)
- [Struktur Folder & Komponen](#-struktur-folder--komponen)
- [Peta Rute Halaman & Proteksi RBAC](#-peta-rute-halaman--proteksi-rbac)
- [Sistem Sinkronisasi & Konteks Global](#-sistem-sinkronisasi--konteks-global)
- [Optimasi Build & Memori](#-optimasi-build--memori)
- [Petunjuk Menjalankan & Build](#-petunjuk-menjalankan--build)

---

## 💎 Fitur Desain & User Experience

### 1. Corporate Executive Theme
- **Harmoni Palet Warna**: Memadukan warna korporat Navy Deep Blue (`#0F2744`), Cool Slate (`#64748B`), Emerald Green (`#059669`), dan Amber Alert (`#D97706`).
- **Tipografi Bersih**: Menggunakan font Inter / Sans modern dengan hierarki visual yang tegas dan rapi.
- **Micro-Animations & Transisi Halus**: Efek hover interaktif, transisi tab mulus, modal dialog konfirmasi yang aman, serta animasi badge live status.

### 2. Mobile-First & Anti-Overflow Architecture
- **Custom in-DOM Select (`CustomSelect.jsx`)**: Menggantikan elemen `<select>` bawaan browser yang sering overflow atau terpotong pada layar smartphone.
- **Adaptive Grid vs Table**: Menampilkan kartu ringkas (2x2 grid) pada layar ponsel dan tabel data komprehensif pada layar monitor desktop.
- **Bottom Navigation Bar (`MobileNav.jsx`)**: Navigasi bawah ramah sentuhan (*touch-friendly*) khusus pengguna mobile yang otomatis menyesuaikan role login.

### 3. Kemandirian Modul Binaan Tim (`UnderTeamRekap.jsx`)
- Khusus untuk **Team Leader** dan **Trainer**, modul binaan menyediakan rekapitulasi nilai agen binaan sekaligus tab **Master NAKER Tim Binaan** lengkap dengan tombol **"Ekspor Excel (.xlsx)"** mandiri tanpa memerlukan akses ke Data Master global.

---

## 📁 Struktur Folder & Komponen

```text
frontend/src/
├── components/
│   ├── common/
│   │   ├── CustomSelect.jsx             # Dropdown kustom anti-overflow mobile
│   │   ├── ErrorBoundary.jsx            # Error boundary pencegah crash aplikasi
│   │   └── SupervisorImportReminder.jsx # Banner pengingat tarikan CRM & sisa pool
│   ├── layout/
│   │   ├── Layout.jsx                   # Wrapper layout utama
│   │   ├── Navbar.jsx                   # Navigasi atas, profil user, & notifikasi privat
│   │   ├── Sidebar.jsx                  # Menu sidebar dinamis terfilter sesuai RBAC
│   │   └── MobileNav.jsx                # Bar navigasi bawah responsif perangkat mobile
│   └── profile/
│       └── ProfileModal.jsx             # Modal edit profil & ganti password akun
│
├── context/
│   ├── AuthContext.jsx                  # Sesi user, token autentikasi, & role RBAC
│   ├── DialogContext.jsx                # Toast alerts, konfirmasi modal, & alert popup
│   └── SyncContext.jsx                  # Event bus sinkronisasi instan real-time
│
├── pages/
│   ├── SplashScreen.jsx                 # Pembuka animasi splash screen (3s)
│   ├── Login.jsx                        # Portal login aman
│   ├── MainHub.jsx                      # Dashboard Utama (Hub Direktori Modul)
│   ├── GlobalDashboard.jsx              # Modul 1: Dashboard Global (Macro CA & FCR)
│   ├── AnevRanking.jsx                  # Modul 2: QA Analytics & Status Personel Dinamis
│   ├── AgentRecap.jsx                   # Modul 3: Agent Scorecards (Rekap Nilai Agen)
│   ├── QATrainerSampling.jsx            # Modul 4: Success Board (Pencapaian Kuota Tim QA)
│   ├── PolicyRepository.jsx             # Modul 5: QA Policy Hub (SOP, Notulensi, Kalibrasi)
│   ├── QASamplingWorksheet.jsx          # Modul 6: Sampling Ticket Worksheet (QA Evaluator)
│   ├── UnderTeamRekap.jsx               # Modul 6*: Rekap Tim Binaan (Khusus TL & Trainer)
│   ├── AutoDistribution.jsx             # Modul 7: Ticketing & Auto Distribution (Khusus SPV)
│   ├── Settings.jsx / SupervisorInput   # Modul 8: Data Master & Import (Khusus SPV)
│   └── UserManagement.jsx               # Modul 9: User Setting & Kelola Akun (Khusus SPV)
│
├── services/
│   └── api.js                           # Axios REST client, interceptor, & endpoint bridge
│
├── App.jsx                              # Router utama & route guards (SupervisorRoute, dll.)
├── main.jsx                             # Entry point React
└── index.css                            # Token Tailwind & styling korporat
```

---

## 🗺️ Peta Rute Halaman & Proteksi RBAC

Akses rute diproteksi secara ketat menggunakan Route Guard komponen:

| Rute URL | Komponen Halaman | Route Guard | Pengguna yang Berhak Mengakses |
| :--- | :--- | :--- | :--- |
| `/` | `MainHub.jsx` | `ProtectedRoute` | Semua Pengguna Terautentikasi |
| `/dashboard-global` | `GlobalDashboard.jsx` | `ProtectedRoute` | Semua Role |
| `/anev` | `AnevRanking.jsx` | `ProtectedRoute` | Semua Role (Status Personel Dinamis per Role) |
| `/rekap-agent` | `AgentRecap.jsx` | `ProtectedRoute` | Semua Role |
| `/pencapaian-qa` | `QATrainerSampling.jsx` | `ProtectedRoute` | Semua Role |
| `/kebijakan` | `PolicyRepository.jsx` | `ProtectedRoute` | Semua Role |
| `/evaluasi-sampling`| `QASamplingWorksheet.jsx`| `SamplingRoute` | **Khusus QA Evaluator & Supervisor** |
| `/rekap-under-team` | `UnderTeamRekap.jsx` | `UnderTeamRoute` | **Khusus Team Leader, Trainer, & Supervisor** |
| `/auto-distribution`| `AutoDistribution.jsx` | `SupervisorRoute` | **Khusus Supervisor & Administrator** |
| `/settings` | `Settings.jsx` | `SupervisorRoute` | **Khusus Supervisor & Administrator** |
| `/kelola-akun` | `UserManagement.jsx` | `SupervisorRoute` | **Khusus Supervisor & Administrator** |

---

## ⚡ Sistem Sinkronisasi & Konteks Global

1. **`AuthContext.jsx`**:
   - Menyimpan sesi pengguna aktif (`user`), token Bearer, dan melakukan sinkronisasi otomatis antar tab browser.
2. **`DialogContext.jsx`**:
   - Menyediakan fungsi global `showToast`, `showAlert`, dan `showConfirm` untuk dialog interaktif tanpa reload.
3. **`SyncContext.jsx` & Event Bus**:
   - `triggerDataUpdate()` memancarkan event `digiqa:data_refresh` ke seluruh modul sehingga tabel dan metrik KPI otomatis ter-update saat terjadi perubahan data.

---

## 🚀 Optimasi Build & Memori

Konfigurasi Vite (`vite.config.js`) dilengkapi dengan **manual chunking** (*vendor splitting*) untuk memecah pustaka berukuran besar menjadi file terpisah:
- `vendor-xlsx`: Khusus modul pemroses berkas Excel SheetJS.
- `vendor-recharts`: Khusus pustaka visualisasi grafik.
- `vendor-react`: Runtime inti React & React Router.

Hal ini mencegah lonjakan konsumsi memori Node.js (*JavaScript heap out of memory*) saat proses kompilasi produksi di lingkungan server dengan sumber daya terbatas.

---

## 💻 Petunjuk Menjalankan & Build

```bash
# 1. Masuk ke direktori frontend
cd frontend

# 2. Install dependency Node.js
npm install

# 3. Jalankan server pengembangan lokal (HMR)
npm run dev

# 4. Build bundle produksi teroptimasi
npm run build

# 5. Pratinjau hasil build produksi lokal
npm run preview
```

Server lokal pengembangan berjalan pada: `http://127.0.0.1:5173`.
