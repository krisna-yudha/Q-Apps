<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class QappsMasterSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Sites
        DB::table('sites')->updateOrInsert(
            ['code' => 'SMG'],
            ['name' => 'SEMARANG', 'status' => true, 'updated_at' => now(), 'created_at' => now()]
        );
        $siteId = DB::table('sites')->where('code', 'SMG')->value('id');

        // 2. Roles
        $roles = [
            'superadmin',
            'admin',
            'supervisor',
            'qa',
            'trainer',
            'team_leader',
            'agent',
            'mm',
            'cso'
        ];
        foreach ($roles as $roleName) {
            DB::table('roles')->updateOrInsert(
                ['name' => $roleName],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }

        // 3. Services with Source Mappings (7 Canonical Services as per Roadmap)
        $services = [
            [
                'code' => 'INBOUND',
                'name' => 'Inbound',
                'source_ca_label' => 'Inbound',
                'source_layanan_label' => 'Inbound',
                'description' => 'Layanan Inbound Voice Call',
            ],
            [
                'code' => 'DIGILIVE',
                'name' => 'Digilive',
                'source_ca_label' => 'Digilive',
                'source_layanan_label' => 'Digilive',
                'description' => 'Layanan Live Chat & Digital Interaction',
            ],
            [
                'code' => 'SOCMED',
                'name' => 'Socmed',
                'source_ca_label' => 'Socmed',
                'source_layanan_label' => 'SOSMED',
                'description' => 'Layanan Social Media (Instagram, WhatsApp, dll)',
            ],
            [
                'code' => 'EMAIL_INBOUND',
                'name' => 'Email',
                'source_ca_label' => 'Email_Inbound',
                'source_layanan_label' => 'Email',
                'description' => 'Layanan Penanganan Tiket Masuk Email',
            ],
            [
                'code' => 'EMAIL_OUTBOUND',
                'name' => 'Email Outbound',
                'source_ca_label' => 'Email_Outbound',
                'source_layanan_label' => 'Outbound Reguler',
                'description' => 'Layanan Email & Outbound Call Reguler',
            ],
            [
                'code' => 'OUTBOUND_CALL',
                'name' => 'Outbound Call',
                'source_ca_label' => 'Outbound_Call',
                'source_layanan_label' => 'Outbound Call',
                'description' => 'Layanan Panggilan Keluar Konfirmasi/Follow Up',
            ],
            [
                'code' => 'BACK_OFFICE',
                'name' => 'Back Office',
                'source_ca_label' => 'Ketepatan Eskalasi BO',
                'source_layanan_label' => 'Ketepatan Eskalasi BO',
                'description' => 'Layanan Eskalasi Back Office & Tiket Lanjutan',
            ],
        ];

        foreach ($services as $svc) {
            DB::table('services')->updateOrInsert(
                ['code' => $svc['code']],
                array_merge($svc, ['status' => true, 'updated_at' => now(), 'created_at' => now()])
            );
        }

        $serviceIds = DB::table('services')->pluck('id', 'code');

        // 4. Service Mappings (NAKER Source Labels)
        $nakerMappings = [
            'CSO DIGILIVE CHAT - MY ICON+' => $serviceIds['DIGILIVE'],
            'CSO DIGILIVE CHAT - WA' => $serviceIds['DIGILIVE'],
            'CSO DIGILIVE CHAT - SOCIAL MEDIA' => $serviceIds['SOCMED'],
            'CSO INBOUND' => $serviceIds['INBOUND'],
            'CSO OUTBOUND' => $serviceIds['OUTBOUND_CALL'],
            'CSO BACK OFFICE' => $serviceIds['BACK_OFFICE'],
            'CSO EMAIL' => $serviceIds['EMAIL_OUTBOUND'],
            'NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE' => $serviceIds['INBOUND'],
        ];

        foreach ($nakerMappings as $srcVal => $sId) {
            DB::table('service_mappings')->updateOrInsert(
                ['source_system' => 'NAKER', 'source_value' => $srcVal],
                ['service_id' => $sId, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 5. Platforms
        $platforms = [
            'LIVE CHAT MYICON+',
            'WHATSAPP',
            'DM INSTAGRAM',
            'RATING MY ICON+'
        ];
        foreach ($platforms as $pName) {
            DB::table('platforms')->updateOrInsert(
                ['name' => $pName],
                ['service_id' => $serviceIds['DIGILIVE'] ?? null, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 6. Categories
        $categories = ['GANGGUAN', 'INFORMASI', 'KELUHAN'];
        foreach ($categories as $catName) {
            foreach ($serviceIds as $svcCode => $svcId) {
                DB::table('categories')->updateOrInsert(
                    ['service_id' => $svcId, 'name' => $catName],
                    ['code' => strtoupper(substr($catName, 0, 3)), 'status' => true, 'updated_at' => now(), 'created_at' => now()]
                );
            }
        }

        // 7. CA Parameters for All Services

        // 7.1 Inbound (14 Parameters)
        $inboundParams = [
            '1' => 'Greeting Awal & Identifikasi',
            '2' => 'Konfirmasi Nomor Pelanggan / ID',
            '3' => 'Eksplorasi Kebutuhan / Permasalahan',
            '4' => 'Validasi Data & Kepemilikan Akun',
            '5' => 'Solusi & Penjelasan Informasi',
            '6' => 'Ketepatan Input Data di Aplikasi (CRM/Ticketing)',
            '7' => 'Penggunaan Fitur / Eskalasi Tiket',
            '8' => 'Kejelasan Suara & Artikulasi',
            '9' => 'Etika & Sikap Pelayanan (Polite & Empathetic)',
            '10' => 'Efisiensi Waktu Transaksi (AHT)',
            '11' => 'Edukasi Mandiri (Self Service MyIcon+)',
            '12' => 'Konfirmasi Pemahaman Pelanggan',
            '13' => 'Greeting Akhir & Penutupan',
            '14' => 'First Call Resolution (FCR) Compliance'
        ];
        $seq = 1;
        foreach ($inboundParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['INBOUND'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.2 Digilive (18 Parameters)
        $digiliveParams = [
            '1.1' => 'Greeting Awal Chat',
            '2.1' => 'Waktu Respon Awal (First Response Time)',
            '2.2' => 'Kecepatan Respon Antar Pesan (Hold Chat)',
            '2.3' => 'Pemberitahuan Penundaan / Holding',
            '3.1' => 'Identifikasi ID Pelanggan / Layanan',
            '4.1' => 'Analisa Masalah & Pertanyaan Tepat',
            '5.1' => 'Ketepatan Informasi yang Diberikan',
            '5.2' => 'Kelengkapan Panduan Solusi',
            '5.3' => 'Pemeriksaan Status Jaringan / Tiket',
            '6.1' => 'Tata Bahasa, Typo & Tanda Baca (SOP Chat)',
            '6.2' => 'Gaya Bahasa Ramah & Profesional',
            '7.1' => 'Ketepatan Input CRM / Ticketing',
            '8.1' => 'Edukasi Fitur Aplikasi MyIcon+',
            '8.2' => 'Ajakan Penggunaan Self Service',
            '9.1' => 'Konfirmasi Akhir Penyelesaian',
            '9.2' => 'Ajakan Pengisian Rating / CSAT',
            '10.1' => 'Greeting Akhir Penutupan Chat',
            '10.2' => 'Ketepatan Waktu Pengakhiran Sesi'
        ];
        $seq = 1;
        foreach ($digiliveParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['DIGILIVE'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.3 Socmed (8 Parameters)
        $socmedParams = [
            'A.1' => 'Kecepatan Respon Awal Socmed (SLA Respon)',
            'A.2' => 'Format Salam & Identitas Akun Resmi',
            'B.1' => 'Verifikasi Akun & Validasi Privasi',
            'B.2' => 'Ketepatan Jawaban DM / Komentar',
            'B.3' => 'Penanganan Komentar Publik & Pengalihan DM',
            'B.4' => 'Pemberian Solusi & Eskalasi Teknis',
            'C.1' => 'Gaya Komunikasi Menarik & Humanis (Brand Voice)',
            'C.2' => 'Penutupan Respon & Monitoring Balasan'
        ];
        $seq = 1;
        foreach ($socmedParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['SOCMED'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.4 Email Outbound (15 Parameters)
        $emailParams = [
            'A1' => 'Ketepatan Alamat Email & Subjek Surat',
            'B1' => 'Format Salam Pembuka Resmi',
            'B2' => 'Penyebutan Nama Pelanggan / Nomor ID',
            'C3' => 'Kejelasan Isi Pesan / Tujuan Email',
            'C4' => 'Ketepatan Lampiran & Dokumen Pendukung',
            'C5' => 'Struktur Paragraf & Tata Bahasa Formal',
            'D6' => 'Tindak Lanjut Tiket & Konfirmasi Perbaikan',
            'D7' => 'Panggilan Outbound Konfirmasi Pelanggan',
            'D8' => 'Waktu Panggilan Sesuai Jadwal Janji',
            'D9' => 'Kesesuaian Data Hasil Outbound di CRM',
            'D10' => 'Ketepatan Status Akhir Tiket',
            'E11' => 'Pemberian Kontak Layanan Pelanggan',
            'E12' => 'Format Signature Resmi Perusahaan',
            'E13' => 'Waktu Pengiriman Email (SLA)',
            'E14' => 'Pencegahan Komplain Berulang'
        ];
        $seq = 1;
        foreach ($emailParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['EMAIL_OUTBOUND'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.5 Back Office (3 Parameters)
        $boParams = [
            '1' => 'Ketepatan Validasi & Verifikasi Data Tiket BO',
            '2' => 'Ketepatan Analisa Teknis & Alur Eskalasi Tim Lapangan',
            '3' => 'Kesesuaian SLA Waktu Penyelesaian Eskalasi'
        ];
        $seq = 1;
        foreach ($boParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['BACK_OFFICE'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.6 Email / Email Inbound (15 Parameters: 1 - 15)
        $emailInboundParams = [
            '1' => 'Greeting Awal & Pembuka Email',
            '2' => 'Konfirmasi / Verifikasi Data Pelanggan',
            '3' => 'Identifikasi Masalah & Subjek Tiket',
            '4' => 'Kelengkapan Analisa & Validasi Tiket',
            '5' => 'Ketepatan Solusi & Informasi',
            '6' => 'Struktur Paragraf & Tata Bahasa Formal',
            '7' => 'Ketepatan Lampiran & File Pendukung',
            '8' => 'Penulisan Salam Penutup & Signature',
            '9' => 'Ketepatan Input CRM / Ticketing',
            '10' => 'SLA Waktu Respon & Pengiriman Email',
            '11' => 'Edukasi Fitur Aplikasi / Self Service',
            '12' => 'Konfirmasi Tindak Lanjut & Closing',
            '13' => 'Etika & Kesopanan Komunikasi Tertulis',
            '14' => 'Pencegahan Komplain Berulang',
            '15' => 'First Contact Resolution Compliance'
        ];
        $seq = 1;
        foreach ($emailInboundParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['EMAIL_INBOUND'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.7 Outbound Call (12 Parameters: 1 - 12)
        $outboundCallParams = [
            '1' => 'Greeting Awal & Identifikasi Pelanggan',
            '2' => 'Konfirmasi Kesiapan Pelanggan Berbicara',
            '3' => 'Penyampaian Tujuan Panggilan Outbound',
            '4' => 'Validasi Data & Histori Tiket Terkait',
            '5' => 'Kejelasan Solusi & Informasi Tindak Lanjut',
            '6' => 'Kejelasan Suara & Artikulasi Petugas',
            '7' => 'Etika, Kesopanan & Sikap Empati',
            '8' => 'Efisiensi Durasi Panggilan (AHT Outbound)',
            '9' => 'Ketepatan Input Hasil Panggilan di CRM',
            '10' => 'Edukasi Mandiri Fitur MyIcon+',
            '11' => 'Konfirmasi Akhir & Salam Penutup',
            '12' => 'First Contact Resolution (FCR) Compliance'
        ];
        $seq = 1;
        foreach ($outboundCallParams as $code => $name) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['OUTBOUND_CALL'], 'code' => (string)$code],
                ['name' => $name, 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 8. Import Profiles (NAKER + 7 QSF Profiles)
        $profiles = [
            [
                'code' => 'NAKER_AUGUST_2026',
                'name' => 'Database NAKER (Tenaga Kerja)',
                'import_type' => 'NAKER',
                'service_id' => null,
                'sheet_name' => 'PLOTTING',
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_INBOUND',
                'name' => 'QSF Inbound Voice Call',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['INBOUND'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_DIGILIVE',
                'name' => 'QSF Digilive Live Chat',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['DIGILIVE'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_SOCMED',
                'name' => 'QSF Social Media',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['SOCMED'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_EMAIL_INBOUND',
                'name' => 'QSF Email',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['EMAIL_INBOUND'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_EMAIL_OUTBOUND',
                'name' => 'QSF Email Outbound',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['EMAIL_OUTBOUND'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_OUTBOUND_CALL',
                'name' => 'QSF Outbound Call',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['OUTBOUND_CALL'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
            [
                'code' => 'QSF_BACK_OFFICE',
                'name' => 'QSF Back Office (Ketepatan Eskalasi BO)',
                'import_type' => 'QSF',
                'service_id' => $serviceIds['BACK_OFFICE'],
                'sheet_name' => null,
                'header_row' => 1,
                'data_start_row' => 2,
                'version' => '1.0',
            ],
        ];

        foreach ($profiles as $p) {
            DB::table('import_profiles')->updateOrInsert(
                ['code' => $p['code']],
                array_merge($p, ['status' => true, 'expected_extension' => 'xls,xlsx,csv', 'updated_at' => now(), 'created_at' => now()])
            );
        }

        // 9. Users Default
        $defaultUsers = [
            [
                'name' => 'Supervisor Utama',
                'username' => 'supervisor',
                'email' => 'supervisor@digiqa.id',
                'role' => 'supervisor',
                'password' => Hash::make('password')
            ],
            [
                'name' => 'QA Lead 1',
                'username' => 'qa1',
                'email' => 'qa1@digiqa.id',
                'role' => 'quality_assurance',
                'password' => Hash::make('password')
            ],
            [
                'name' => 'Team Leader 1',
                'username' => 'tl1',
                'email' => 'tl1@digiqa.id',
                'role' => 'team_leader',
                'password' => Hash::make('password')
            ],
        ];

        foreach ($defaultUsers as $u) {
            $roleId = DB::table('roles')->where('name', $u['role'])->value('id') ?: 1;
            DB::table('users')->updateOrInsert(
                ['username' => $u['username']],
                [
                    'name' => $u['name'],
                    'email' => $u['email'],
                    'role' => $u['role'],
                    'password' => $u['password'],
                    'status' => 'active',
                    'updated_at' => now(),
                    'created_at' => now()
                ]
            );
        }
    }
}
