# 📘 Panduan Lengkap Koneksi Google Drive Backup (OAuth2 Personal 15 GB) - DigiQA V1.3

Dokumen ini berisi panduan langkah demi langkah (*step-by-step foolproof guide*) untuk menghubungkan penyimpanan **Google Drive Akun Pribadi (15 GB)** ke modul **DigiQA Cloud Backup**.

---

## 📌 Ringkasan Arsitektur & Mengapa OAuth2 Personal?

| Metode Autentikasi | Kapasitas Kuota | Cocok Untuk | Catatan Penting |
| :--- | :--- | :--- | :--- |
| **OAuth2 Akun Personal (Direkomendasikan)** | **15 GB Kuota Akun Anda** | Akun Gmail Standar (`@gmail.com`) & Google Workspace | File cadangan tersimpan langsung di *Drive Saya* (`My Drive`) Anda tanpa batasan kuota Service Account. |
| **Service Account Key (JSON)** | **0 MB (Pada Personal Drive)** / Kuota Domain Workspace | Google Workspace Shared Drive (Drive Bersama) | Google membatasi Service Account dengan kuota 0 MB jika membuat file di folder pribadi `@gmail.com` (*error 403: storageQuotaExceeded*). |

---

## 🚀 Langkah 1: Siapkan Folder di Google Drive & Ambil Folder ID

1. Buka [Google Drive](https://drive.google.com/).
2. Buat folder baru khusus untuk cadangan DigiQA, misalnya beri nama: `App_Backups` atau `DigiQA_Backups`.
3. Buka folder tersebut dan perhatikan URL di address bar browser Anda:
   ```text
   https://drive.google.com/drive/folders/1Nyipxn60T0SY6lnhXloLZmHEKXl5s8FF
   ```
4. Salin string karakter setelah `/folders/`. String tersebut adalah **Google Drive Folder ID** Anda.
   > **Contoh Folder ID**: `1Nyipxn60T0SY6lnhXloLZmHEKXl5s8FF`

---

## 🌐 Langkah 2: Buat Project & Aktifkan Google Drive API

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Login menggunakan akun Google Anda (misal `nama@gmail.com`).
3. Buat Project baru atau pilih project yang sudah ada (misal: `DigiQA Backup App`).
4. Pada kolom pencarian atas atau menu navigasi kiri:
   - Buka **APIs & Services** > **Library** (Pustaka).
   - Cari kata kunci: **Google Drive API**.
   - Klik **Google Drive API** lalu klik tombol biru **Enable (Aktifkan)**.

---

## 👥 Langkah 3: Konfigurasi OAuth Consent Screen & Daftarkan "Test Users" (Wajib)

> ⚠️ **PENTING**: Jika langkah ini dilewati, Google akan memblokir proses otorisasi dengan pesan error: `403: access_denied (User is not in the test audience)`.

1. Pada menu Google Cloud sebelah kiri, pilih **APIs & Services** > **OAuth consent screen** (Layar Persetujuan OAuth) atau **Audience**.
2. Pilih User Type: **External**, lalu klik **Create**.
3. Isi informasi aplikasi dasar:
   - **App name**: `DigiQA Backup Engine`
   - **User support email**: Pilih email Google Anda.
   - **Developer contact information**: Masukkan email Google Anda.
   - Klik **Save and Continue**.
4. Pada bagian **Scopes (Cakupan)**:
   - Klik **Save and Continue** (lewati).
5. Pada bagian **Test Users (Pengguna Penguji)**:
   - Klik **+ ADD USERS**.
   - Masukkan alamat email login Google Anda (misal: `krisnayudhap117@gmail.com`).
   - Klik **Add** lalu klik **Save and Continue**.
6. Klik **Back to Dashboard**. Pastikan status Publishing status berada dalam mode **Testing** dengan email Anda terdaftar di daftar Test users.

---

## 🔑 Langkah 4: Buat Kredensial OAuth 2.0 Client ID

1. Pada menu Google Cloud sebelah kiri, pilih **APIs & Services** > **Credentials**.
2. Klik tombol **+ CREATE CREDENTIALS** di bagian atas, pilih **OAuth client ID**.
3. Isi form pembuatan kredensial:
   - **Application type**: Pilih **Web application**.
   - **Name**: Beri nama `DigiQA Web Backup Client`.
   - Scroll ke bawah ke bagian **Authorized redirect URIs** (URI Pengalihan Resmi).
   - Klik **+ ADD URI** dan masukkan URL berikut:
     ```text
     https://developers.google.com/oauthplayground
     ```
     *(Opsional untuk integrasi lokal langsung: Anda juga bisa menambahkan `http://localhost:8000/api/backup-settings/oauth/callback` dan `http://127.0.0.1:5173/backup-drive`)*
4. Klik tombol biru **CREATE**.
5. Pop-up akan menampilkan **Your Client ID** dan **Your Client Secret**:
   - Salin **Client ID** (contoh: `1065696746353-8233...apps.googleusercontent.com`).
   - Salin **Client Secret** (contoh: `GOCSPX-BVkrAVzmtAT...`).

---

## ⚡ Langkah 5: Dapatkan OAuth Refresh Token Menggunakan OAuth Playground

1. Buka [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. ⚙️ **LANGKAH KRUSIAL (Setting Kredensial Sendiri)**:
   - Klik ikon **Gear (Pengaturan ⚙️)** di pojok kanan atas halaman OAuth Playground.
   - Centang kotak ☑️ **"Use your own OAuth credentials"**.
   - Masukkan **OAuth Client ID** Anda pada kolom `OAuth Client ID`.
   - Masukkan **OAuth Client Secret** Anda pada kolom `OAuth Client secret`.
   - Tutup menu panel gear dengan mengklik kembali ikon gear.

3. **Step 1: Select & authorize APIs**:
   - Pada panel menu di sisi kiri, scroll ke bawah dan temukan **Drive API v3**.
   - Klik untuk membuka sub-menu dan centang:
     ```text
     https://www.googleapis.com/auth/drive
     ```
   - Klik tombol biru **Authorize APIs**.

4. **Konfirmasi Akun Google**:
   - Browser akan membuka jendela login/persetujuan Google.
   - Pilih akun Google Anda.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced (Lanjutan)** di kiri bawah > klik **Go to DigiQA Backup Client (unsafe)**.
   - Klik **Continue (Lanjutkan)** dan beri izin akses Drive.

5. **Step 2: Exchange authorization code for tokens**:
   - Browser akan kembali ke halaman OAuth Playground.
   - Kolom *Authorization code* otomatis terisi.
   - Klik tombol biru **Exchange authorization code for tokens**.
   - Pada panel sebelah kanan (Response), cari dan salin string pada baris:
     ```text
     "refresh_token": "1//04Yo2X8CwDW7xCgYIARAAGAQSNwF-L9Ir..."
     ```
   - Salin nilai **Refresh Token** tersebut (hanya string di dalam tanda petik).

---

## 🖥️ Langkah 6: Masukkan Kredensial ke Dashboard DigiQA

1. Buka aplikasi **DigiQA** > Masuk ke menu **Modul 9: Cloud Backup** (`/backup-drive`).
2. Pastikan tab metode koneksi memilih **OAuth2 Akun Personal (Drive Saya - 15 GB)**.
3. Masukkan data kredensial:
   - **1. Google Drive Folder ID**: Tempelkan Folder ID dari Langkah 1.
   - **OAuth Client ID**: Tempelkan Client ID dari Langkah 4.
   - **OAuth Client Secret**: Tempelkan Client Secret dari Langkah 4.
   - **OAuth Refresh Token**: Tempelkan Refresh Token dari Langkah 5.
4. Klik tombol **Simpan & Enkripsi Kredensial**.
   - Seluruh secret dan refresh token otomatis dienkripsi dengan standar **AES-256-CBC** di database DigiQA.

---

## ✅ Langkah 7: Pengujian & Validasi Koneksi

1. Klik tombol **Uji Koneksi** di bagian kanan atas atau bar konfigurasi.
2. Sistem backend DigiQA akan menjalankan rangkaian uji diagnostik:
   - Validasi pertukaran access token melalui Google OAuth2 endpoint.
   - Pengecekan informasi akun Google (`about.get`) dan kuota penyimpanan.
   - Uji coba pembuatan dan penghapusan file uji `digiqa_probe.txt` di dalam folder Google Drive target.
3. Jika berhasil, akan muncul notifikasi sukses berwarna hijau:
   > *"Koneksi dan akses tulis ke Google Drive (OAuth2: nama@gmail.com) berhasil!"*
4. Status integrasi akan otomatis berubah menjadi **Integrasi Aktif & Terhubung**.

---

## 🛠️ Panduan Troubleshooting & FAQ

### 1. Error: `401 unauthorized_client` di OAuth Playground
- **Penyebab**: Anda belum mencentang *"Use your own OAuth credentials"* pada ikon Gear ⚙️ di pojok kanan atas OAuth Playground saat otorisasi.
- **Solusi**: Ulangi Langkah 5. Buka Gear ⚙️ > Centang "Use your own OAuth credentials" > Masukkan Client ID & Secret > Klik Authorize APIs.

### 2. Error: `403 access_denied` (Layar Persetujuan Google)
- **Penyebab**: Akun Google Anda belum didaftarkan di daftar Pengguna Penguji (*Test Users*) pada Google Cloud Console.
- **Solusi**: Buka Google Cloud Console > APIs & Services > OAuth consent screen / Audience > Tambahkan email Anda pada daftar **Test Users** (Langkah 3).

### 3. Error: `403 storageQuotaExceeded`
- **Penyebab**: Terjadi jika menggunakan metode Service Account pada folder Drive pribadi `@gmail.com` yang dibatasi kuota 0 MB.
- **Solusi**: Gunakan metode **OAuth2 Akun Personal** sesuai panduan ini.

### 4. Error: `404 File not found: [Folder ID]`
- **Penyebab**: Folder ID salah, atau folder di Google Drive telah dihapus/berada di menu Sampah (Trash).
- **Solusi**: Buka folder di Google Drive, pastikan URL folder benar, dan salin ulang Folder ID ke form DigiQA.

### 5. Apakah Refresh Token Bisa Kedaluwarsa?
- Pada mode Google Cloud *Testing*, refresh token untuk OAuth App testing berlaku selama 7 hari jika tidak ada aktivitas berkala.
- Jika status Publishing App di Google Cloud Console diubah menjadi **In Production** (tetap untuk keperluan internal), Refresh Token berlaku permanen tanpa kedaluwarsa kecuali dicabut manual (*revoked*).

---

## ⏱️ Manajemen Jadwal Pencadangan Otomatis

Setelah terhubung:
1. Atur **Jadwal Pencadangan Otomatis** (Harian / Mingguan / Bulanan) dan tentukan jam eksekusi (misal: `02:00 WIB`).
2. Pilih modul data yang ingin dicadangkan (Data Master, Penilaian Sampling, Logbook, Kebijakan QA).
3. Tentukan **Retensi File** (misal: Simpan 30 hari terakhir). DigiQA akan otomatis membersihkan arsip cadangan lama di Google Drive agar tidak memenuhi kuota.
4. Anda juga dapat melakukan pencadangan instan kapan saja dengan menekan tombol **Cadangkan Sekarang**.
