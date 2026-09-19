<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\PolicyDiscussion;

// Clear any old/dummy policy records
PolicyDiscussion::truncate();

$policies = [
    [
        'title' => 'ICONNET UPGRADE HARGA KHUSUS (CUSTOMER LOYALTY)',
        'category' => 'PROMO',
        'discussion_date' => '2026-09-01',
        'summary' => 'Berikut ini syarat dan ketentuan ICONNET UPGRADE HARGA KHUSUS (CUSTOMER LOYALTY) yang penawarannya hanya untuk pelanggan terpilih melalui aplikasi MyICON+',
        'details' => "Ketentuan Program ICONNET Customer Loyalty 2026:\n" .
            "1. Kriteria Pelanggan Terpilih:\n" .
            "   - Pelanggan aktif eksisting perorangan (residensial) dengan masa aktif berlangganan minimal 6 bulan berturut-turut.\n" .
            "   - Tidak memiliki catatan riwayat keterlambatan pembayaran atau tunggakan tagihan dalam 3 bulan terakhir.\n" .
            "2. Mekanisme Penawaran & Aktivasi:\n" .
            "   - Notifikasi promo dikirimkan otomatis melalui push-notification aplikasi PLN Mobile & MyICON+.\n" .
            "   - Klaim voucher promo harga khusus hanya dapat dilakukan langsung oleh pelanggan secara mandiri (self-service) pada menu 'Promo & Loyalty' di aplikasi MyICON+.\n" .
            "3. Ketentuan Paket & Bandwidth:\n" .
            "   - Berlaku untuk upgrade paket kecepatan (misal 20 Mbps ke 35 Mbps / 50 Mbps / 100 Mbps).\n" .
            "   - Potongan tarif khusus berlaku selama 12 bulan pertama pembayaran lancar sebelum tanggal jatuh tempo (tanggal 20).\n" .
            "4. Pedoman Pelayanan CSO Contact Center:\n" .
            "   - CSO wajib melakukan verifikasi kepemilikan akun (ID Pelanggan, Nama Terdaftar, dan Nomor WhatsApp aktif).\n" .
            "   - CSO memberikan asistensi panduan langkah klaim voucher di aplikasi MyICON+ dan dilarang mengubah harga secara manual di sistem billing CRM.",
        'status' => 'active',
        'author' => 'Tim QA Operasional & Produk',
        'attachment_name' => 'SK-DIR-ICON-0926-01',
        'file_size' => '1.8 MB',
    ],
    [
        'title' => 'ICONNET UPGRADE HARGA KHUSUS (UPSELLING)',
        'category' => 'PROMO',
        'discussion_date' => '2026-09-01',
        'summary' => 'Berikut ini syarat dan ketentuan program promo Upgrade Harga Khusus (Upselling) yang HANYA DAPAT DILAKUKAN melalui aplikasi MyICON+',
        'details' => "Ketentuan Program Upselling Bandwidth ICONNET 2026:\n" .
            "1. Syarat Administrasi Pelanggan:\n" .
            "   - Terbuka untuk seluruh pelanggan aktif paket 10 Mbps dan 20 Mbps yang ingin meningkatkan kapasitas ke 35 Mbps, 50 Mbps, atau 100 Mbps.\n" .
            "   - Akun pelanggan dalam status 'Active' (tidak dalam masa isolir atau penangguhan).\n" .
            "2. Alur Transaksi Digital:\n" .
            "   - Transaksi pemilihan paket dan pembayaran invoice penyesuaian pertama wajib diselesaikan melalui payment channel resmi di MyICON+ (PLN Mobile, Virtual Account Bank, atau gerai ritel).\n" .
            "   - Bebas biaya sewa router ONT Dual-Band (Gigabit) selama masa berlangganan paket upselling aktif.\n" .
            "3. Standar Penanganan CSO:\n" .
            "   - Lakukan pengecekan kapasitas port FAT dan redaman optik di alamat pelanggan sebelum memberikan rekomendasi paket tinggi.\n" .
            "   - Bubuhkan tagging interaksi 'UPGRADE-MYICON-UPSELLING' pada log tiket CRM.",
        'status' => 'active',
        'author' => 'Tim QA Operasional & Pemasaran',
        'attachment_name' => 'SK-DIR-ICON-0926-02',
        'file_size' => '1.5 MB',
    ],
    [
        'title' => 'KEWAJIBAN MENGISI FORM ESKALASI',
        'category' => 'BACK OFFICE',
        'discussion_date' => '2026-09-08',
        'summary' => 'Seluruh CSO dan Agent Contact Center diwajibkan mengisi formulir tiket eskalasi gangguan secara lengkap dan presisi sebelum dialihkan ke tim teknis Back Office / Field Service.',
        'details' => "Standar Operasional Prosedur Pengisian Formulir Eskalasi Tiket:\n" .
            "1. Parameter Wajib (Mandatory Fields):\n" .
            "   - ID Pelanggan ICONNET (10 digit numerik).\n" .
            "   - Nomor WhatsApp / Handphone alternatif yang dapat dihubungi teknisi di lokasi.\n" .
            "   - Titik Koordinat Rumah (Google Maps pin / Alamat detail dengan patokan jelas).\n" .
            "   - Nomor ID Tiang / FAT PLN terdekat.\n" .
            "   - Hasil diagnosa visual lampu indikator ONT (PON: Hijau/Mati, LOS: Merah/Mati, LAN/WLAN: Berkedip).\n" .
            "2. Service Level Agreement (SLA) Eskalasi:\n" .
            "   - Tiket keluhan teknis wajib didispatch ke antrean Back Office maksimal 15 menit setelah interaksi berakhir.\n" .
            "3. Dampak Penilaian Mutu QA:\n" .
            "   - Ketidaklengkapan pengisian kolom mandatory atau kesalahan pemilihan kategori eskalasi dinilai sebagai Fatal Error pada parameter FCR (First Contact Resolution) dan CA Score.",
        'status' => 'active',
        'author' => 'Supervisor QA & Operasional',
        'attachment_name' => 'SOP-QA-ESK-0926-03',
        'file_size' => '2.1 MB',
    ],
    [
        'title' => 'STANDAR SAMBUTAN (GREETING) & VERIFIKASI IDENTITAS PELANGGAN',
        'category' => 'NEWS',
        'discussion_date' => '2026-08-15',
        'summary' => 'Format pembukaan interaksi panggilan resmi dan mandatory 3 poin verifikasi data keamanan akun pelanggan ICONNET.',
        'details' => "Standar Greeting & Verifikasi Keamanan Akun:\n" .
            "1. Kalimat Salam Pembuka Resmi:\n" .
            "   'Selamat Pagi / Siang / Sore / Malam, terima kasih telah menghubungi Layanan Pelanggan ICONNET PLN, dengan saya [Nama CSO], ada yang bisa kami bantu?'\n" .
            "2. Verifikasi 3 Poin Keamanan Akun:\n" .
            "   CSO wajib memvalidasi minimal 3 data sebelum mengakses atau mengubah data akun:\n" .
            "   (a) ID Pelanggan ICONNET.\n" .
            "   (b) Nama Lengkap Pemilik Akun / Pelanggan Terdaftar.\n" .
            "   (c) Nomor Handphone atau Alamat Email aktif yang terdaftar di sistem.\n" .
            "3. Larangan Fatal Keamanan:\n" .
            "   Dilarang menyebutkan data pribadi mendahului pelanggan (leading questions) demi menjaga privasi dan keamanan data pelanggan.",
        'status' => 'active',
        'author' => 'Supervisor Mutu QA',
        'attachment_name' => 'SOP-QA-GRT-0826-04',
        'file_size' => '1.2 MB',
    ],
    [
        'title' => 'SOP PENANGANAN STATUS ISOLIR & PEMBAYARAN TAGIHAN BILLING',
        'category' => 'BILLING',
        'discussion_date' => '2026-08-20',
        'summary' => 'Ketentuan batas waktu pembayaran tagihan bulanan ICONNET dan prosedur percepatan pembukaan isolir otomatis pasca pembayaran.',
        'details' => "Prosedur Penanganan Billing & Isolir:\n" .
            "1. Siklus Jatuh Tempo Tagihan:\n" .
            "   Jatuh tempo pembayaran setiap bulan adalah tanggal 20. Sistem auto-isolir aktif pada tanggal 21 pukul 00.01 WIB untuk tagihan yang belum terbayar.\n" .
            "2. Pemulihan Layanan Otomatis (Auto-Unblock):\n" .
            "   Sistem auto-unblock memulihkan layanan internet dalam waktu 5 hingga 15 menit setelah pembayaran terverifikasi di payment gateway.\n" .
            "3. Penanganan Manual Tiket Isolir:\n" .
            "   Jika layanan belum terbuka setelah 15 menit pasca bayar, CSO memvalidasi bukti transfer dan nomor referensi bank, lalu menerbitkan tiket prioritas 'UNBLOCK-PRIORITY-BILLING' ke tim Finance.",
        'status' => 'active',
        'author' => 'Finance & QA Lead',
        'attachment_name' => 'SOP-QA-BIL-0826-05',
        'file_size' => '1.4 MB',
    ],
    [
        'title' => 'STANDARISASI PENANGANAN GANGGUAN INDIKATOR LOS MERAH PADA ONT',
        'category' => 'INTERNET',
        'discussion_date' => '2026-08-25',
        'summary' => 'Panduan penanganan mandiri lampu indikator LOS merah dan tata cara eskalasi gangguan fisik kabel optik dropcore ke tim lapangan.',
        'details' => "Petunjuk Teknis Troubleshooting Lampu LOS Merah:\n" .
            "1. Analisa Gangguan:\n" .
            "   Lampu LOS berkedip merah menandakan kabel dropcore fiber optik tidak menerima sinyal transmisi cahaya dari OLT/FAT.\n" .
            "2. Langkah Pertolongan Pertama (First Aid Guidance):\n" .
            "   (a) Pandu pelanggan memeriksa kabel patchcord optik (kabel kuning berkonektor biru/hijau) di bagian bawah/belakang ONT agar tidak tertekuk tajam, terhimpit, atau kendor.\n" .
            "   (b) Instruksikan proses Power Cycle (matikan sakelar daya ONT selama 10 detik, lalu hidupkan kembali).\n" .
            "3. Eskalasi Tim Lapangan (Harla):\n" .
            "   Jika lampu LOS tetap merah setelah restart, CSO segera terbitkan tiket perbaikan kabel fisik dropcore ke Tim Pemeliharaan Jaringan Lapangan.",
        'status' => 'active',
        'author' => 'Technical Support QA',
        'attachment_name' => 'SOP-QA-LOS-0826-06',
        'file_size' => '2.5 MB',
    ],
    [
        'title' => 'SOP JADWAL & VERIFIKASI PEMASANGAN SAMBUNGAN BARU (PSB)',
        'category' => 'PEMASANGAN',
        'discussion_date' => '2026-08-28',
        'summary' => 'Prosedur verifikasi permohonan pasang baru, pengecekan coverage FAT PLN, dan konfirmasi jadwal kunjungan teknisi instalasi.',
        'details' => "Standar Operasional Pasang Sambungan Baru (PSB):\n" .
            "1. Verifikasi Registrasi:\n" .
            "   CSO memeriksa kelengkapan identitas calon pelanggan (KTP, No HP, Email, dan Alamat Pemasangan) pada portal pendaftaran PLN Mobile / MyICON+.\n" .
            "2. Kelayakan Jaringan (FAT Coverage):\n" .
            "   Pengecekan jarak tiang optik PLN (maksimal 200 meter dari rumah pelanggan) dan ketersediaan port idle FAT.\n" .
            "3. Penjadwalan Slot Instalasi:\n" .
            "   Konfirmasi slot kunjungan teknisi (Pagi: 09.00-12.00 / Siang: 13.00-16.00 WIB) dengan pemilik rumah atau perwakilan dewasa di lokasi.",
        'status' => 'active',
        'author' => 'Provisioning & QA Tim',
        'attachment_name' => 'SOP-QA-PSB-0826-07',
        'file_size' => '1.9 MB',
    ],
    [
        'title' => 'PANDUAN OUTBOUND CALL RETENSI & REMINDER JATUH TEMPO',
        'category' => 'OUTBOUND',
        'discussion_date' => '2026-09-05',
        'summary' => 'Tata krama dan alur komunikasi panggilan keluar (Outbound Call) untuk edukasi batas akhir pembayaran dan penawaran program retensi.',
        'details' => "Prosedur Panggilan Outbound Reminder:\n" .
            "1. Waktu Operasional:\n" .
            "   Panggilan keluar dilakukan pada H-3 hingga H-1 sebelum tanggal jatuh tempo (tanggal 17 - 19) pada jam 08.30 – 17.00 WIB.\n" .
            "2. Salam & Izin Waktu:\n" .
            "   'Selamat Pagi/Siang/Sore Bapak/Ibu [Nama Pelanggan], perkenalkan saya [Nama Agent] dari Layanan ICONNET PLN. Mohon izin apakah saat ini Bapak/Ibu sedang leluasa untuk berbicara sebentar?'\n" .
            "3. Kebijakan Do Not Call (DNC):\n" .
            "   Apabila pelanggan menolak atau merasa terganggu, CSO wajib mencatat disposisi 'Customer Refused / DNC' dan tidak melakukan panggilan ulang pada periode yang sama.",
        'status' => 'active',
        'author' => 'Outbound QA Lead',
        'attachment_name' => 'SOP-QA-OUT-0926-08',
        'file_size' => '1.6 MB',
    ],
    [
        'title' => 'PROSEDUR PENGAJUAN RELOKASI PERANGKAT & ALAMAT PELANGGAN',
        'category' => 'ISOLIR',
        'discussion_date' => '2026-08-10',
        'summary' => 'Ketentuan administrasi, biaya relokasi instalasi, dan pengecekan coverage jaringan di alamat tujuan baru pelanggan ICONNET.',
        'details' => "Ketentuan Relokasi Layanan ICONNET:\n" .
            "1. Validasi Coverage Alamat Baru:\n" .
            "   CSO wajib memverifikasi ketersediaan tiang dan port FAT PLN di alamat baru sebelum permohonan relokasi diproses.\n" .
            "2. Syarat Administrasi & Biaya:\n" .
            "   Pelanggan tidak memiliki tunggakan tagihan berjalan. Biaya administrasi relokasi dibebankan pada tagihan bulan berikutnya.\n" .
            "3. Penanganan Perangkat:\n" .
            "   Pelanggan diinstruksikan membawa mandiri unit ONT dan adaptor kabel ke alamat baru saat jadwal teknisi tiba di lokasi.",
        'status' => 'active',
        'author' => 'Back Office & QA Lead',
        'attachment_name' => 'SOP-QA-RLK-0826-09',
        'file_size' => '1.7 MB',
    ],
];

foreach ($policies as $p) {
    PolicyDiscussion::create($p);
}

echo "Successfully seeded " . count($policies) . " authentic ICONNET QA policies into database." . PHP_EOL;
