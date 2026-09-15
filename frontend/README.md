# 🎨 DigiQA Frontend Client (React 18 + Vite)

> **Corporate Single Page Application (SPA) for Contact Center Quality Analytics & Sampling Management**

Frontend DigiQA dibangun menggunakan **React 18** dan dibundel dengan **Vite** untuk menghasilkan antarmuka pengguna yang sangat cepat, responsif di seluruh perangkat (Desktop, Tablet, & Smartphone), serta menerapkan standar **Corporate Executive Design System**.

---

## 📑 Daftar Isi
- [Fitur Desain & User Experience](#-fitur-desain--user-experience)
- [Struktur Folder & Komponen](#-struktur-folder--komponen)
- [Peta Halaman (9 Modul)](#-peta-halaman-9-modul)
- [Sistem Sinkronisasi Real-Time](#-sistem-sinkronisasi-real-time)
- [Petunjuk Menjalankan & Build](#-petunjuk-menjalankan--build)

---

## 💎 Fitur Desain & User Experience

### 1. Corporate Executive Theme
- **Harmoni Palet Warna**: Memadukan warna korporat Navy Deep Blue (`#0F2744`), Cool Slate (`#64748B`), Emerald Green (`#059669`), dan Amber Alert (`#D97706`).
- **Tipografi Bersih**: Menggunakan font Inter / Sans modern dengan perataan hierarki visual yang tajam.
- **Micro-Animations & Transisi Halus**: Animasi lembut saat berpindah tab, dialog konfirmasi modal, dan live status badge.

### 2. Mobile-First & Anti-Overflow Architecture
- **Custom in-DOM Select (`CustomSelect.jsx`)**: Menggantikan elemen `<select>` bawaan OS yang sering menyebabkan overflow atau terpotong di layar ponsel.
- **Adaptive Card Grid vs Table**: Menampilkan kartu ringkas (2x2 grid) pada layar ponsel dan tabel data komprehensif pada layar monitor desktop.
- **Bottom Navigation Bar**: Navigasi bawah ramah sentuhan (*touch-friendly*) khusus pengguna mobile.

---

## 📁 Struktur Folder & Komponen

```text
frontend/src/
├── components/
│   ├── common/
│   │   ├── CustomSelect.jsx             # Dropdown kustom bebas overflow mobile
│   │   └── SupervisorImportReminder.jsx # Banner pengingat tarikan CRM & sisa pool
│   ├── layout/
│   │   ├── Navbar.jsx                   # Navigasi atas & status sinkronisasi
│   │   ├── Sidebar.jsx                  # Menu 9 Modul sidebar korporat
│   │   └── MobileNav.jsx                # Navigasi bawah khusus perangkat mobile
│   └── profile/
│       └── ProfileModal.jsx             # Modal profil & ganti password
│
├── context/
│   ├── AuthContext.jsx                  # Pengelolaan sesi user, token, & RBAC role
│   └── DialogContext.jsx                # Toast alerts, konfirmasi modal, & dialogs
│
├── pages/
│   ├── SplashScreen.jsx                 # Pembuka animasi splash screen (3s)
│   ├── Login.jsx                        # Portal login aman
│   ├── GlobalDashboard.jsx              # Modul 1: Dashboard Global (CA & FCR)
│   ├── AnevRanking.jsx                  # Modul 2: QA Analytics & Ranking Agen
│   ├── AgentScorecards.jsx              # Modul 3: Rekap Nilai Agent
│   ├── SuccessBoard.jsx                 # Modul 4: Pencapaian Tim QA
│   ├── QAPolicyHub.jsx                  # Modul 5: Repositori Kebijakan SOP
│   ├── QASamplingWorksheet.jsx          # Modul 6: Lembar Sampling QA
│   ├── AutoDistribution.jsx             # Modul 7: Ticketing & Auto Distribution
│   ├── DataMasterSetting.jsx            # Modul 8: Input, Import & Setting
│   └── UserSetting.jsx                  # Modul 9: Kelola Akun & Hak Akses
│
├── services/
│   └── api.js                           # Axios REST client & API interceptor
│
├── App.jsx                              # Router utama & proteksi rute (RBAC)
├── main.jsx                             # Entry point React
└── index.css                            # Token Tailwind & styling korporat
```

---

## 🗺️ Peta Halaman (9 Modul)

| Rute URL | Komponen Halaman | Modul & Fungsi |
| :--- | :--- | :--- |
| `/` | `GlobalDashboard.jsx` | **Modul 1**: Dashboard Pencapaian Global Mutu |
| `/qa-analytics` | `AnevRanking.jsx` | **Modul 2**: QA Analytics & Pemetaan Top/Bottom Agen |
| `/agent-scorecards` | `AgentScorecards.jsx` | **Modul 3**: Rekap Nilai & Lembar Observasi Agen |
| `/success-board` | `SuccessBoard.jsx` | **Modul 4**: Pencapaian Kuota Tim Evaluator QA |
| `/qa-policy-hub` | `QAPolicyHub.jsx` | **Modul 5**: Repositori Kebijakan SOP & Kalibrasi |
| `/lembar-sampling-qa` | `QASamplingWorksheet.jsx` | **Modul 6**: Lembar Sampling Pengerjaan Tiket QA |
| `/auto-distribution` | `AutoDistribution.jsx` | **Modul 7**: Auto-Distribusi, Roster QA, & Pool Cadangan |
| `/data-master` | `DataMasterSetting.jsx` | **Modul 8**: Master Data, Import QSF Bulanan & Plotting NAKER |
| `/user-setting` | `UserSetting.jsx` | **Modul 9**: Manajemen Akun & Hak Akses Pengguna |

---

## ⚡ Sistem Sinkronisasi Real-Time

Frontend mengadopsi mekanisme *Event Bus* terpadu:
- **`window.dispatchEvent(new CustomEvent('digiqa:data_refresh'))`**:
  Setiap aksi penyelesaian evaluasi sampling, import data Excel, update roster kehadiran, atau persetujuan kuota SPV akan memicu sinkronisasi instan ke seluruh komponen dan widget tanpa memerlukan reload halaman manual.

---

## 🚀 Petunjuk Menjalankan & Build

```bash
# 1. Masuk ke direktori frontend
cd frontend

# 2. Install dependency Node.js
npm install

# 3. Jalankan server pengembangan lokal (Hot Module Reloading)
npm run dev

# 4. Build bundle produksi teroptimasi
npm run build

# 5. Pratinjau hasil build produksi
npm run preview
```

Server lokal berjalan pada: `http://127.0.0.1:5173`.
