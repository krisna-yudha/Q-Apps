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
            '1' => ['name' => 'Greeting Awal & Identifikasi', 'weight' => 2.0],
            '2' => ['name' => 'Konfirmasi Nomor Pelanggan / ID', 'weight' => 5.0],
            '3' => ['name' => 'Eksplorasi Kebutuhan / Permasalahan', 'weight' => 10.0],
            '4' => ['name' => 'Validasi Data & Kepemilikan Akun', 'weight' => 10.0],
            '5' => ['name' => 'Solusi & Penjelasan Informasi', 'weight' => 5.0],
            '6' => ['name' => 'Ketepatan Input Data di Aplikasi (CRM/Ticketing)', 'weight' => 5.0],
            '7' => ['name' => 'Penggunaan Fitur / Eskalasi Tiket', 'weight' => 10.0],
            '8' => ['name' => 'Kejelasan Suara & Artikulasi', 'weight' => 30.0],
            '9' => ['name' => 'Etika & Sikap Pelayanan (Polite & Empathetic)', 'weight' => 3.0],
            '10' => ['name' => 'Efisiensi Waktu Transaksi (AHT)', 'weight' => 5.0],
            '11' => ['name' => 'Edukasi Mandiri (Self Service MyIcon+)', 'weight' => 15.0],
            '12' => ['name' => 'Konfirmasi Pemahaman Pelanggan', 'weight' => 5.0],
            '13' => ['name' => 'Greeting Akhir & Penutupan', 'weight' => 10.0],
            '14' => ['name' => 'First Call Resolution (FCR) Compliance', 'weight' => 2.0]
        ];
        $seq = 1;
        foreach ($inboundParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['INBOUND'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.2 Digilive (18 Parameters)
        $digiliveParams = [
            '1.1' => ['name' => 'Greeting Awal Chat', 'weight' => 2.0],
            '2.1' => ['name' => 'Waktu Respon Awal (First Response Time)', 'weight' => 3.0],
            '2.2' => ['name' => 'Kecepatan Respon Antar Pesan (Hold Chat)', 'weight' => 5.0],
            '2.3' => ['name' => 'Pemberitahuan Penundaan / Holding', 'weight' => 2.0],
            '3.1' => ['name' => 'Identifikasi ID Pelanggan / Layanan', 'weight' => 3.0],
            '4.1' => ['name' => 'Analisa Masalah & Pertanyaan Tepat', 'weight' => 2.0],
            '5.1' => ['name' => 'Ketepatan Informasi yang Diberikan', 'weight' => 4.0],
            '5.2' => ['name' => 'Kelengkapan Panduan Solusi', 'weight' => 3.0],
            '5.3' => ['name' => 'Pemeriksaan Status Jaringan / Tiket', 'weight' => 5.0],
            '6.1' => ['name' => 'Tata Bahasa, Typo & Tanda Baca (SOP Chat)', 'weight' => 5.0],
            '6.2' => ['name' => 'Gaya Bahasa Ramah & Profesional', 'weight' => 5.0],
            '7.1' => ['name' => 'Ketepatan Input CRM / Ticketing', 'weight' => 3.0],
            '8.1' => ['name' => 'Edukasi Fitur Aplikasi MyIcon+', 'weight' => 8.0],
            '8.2' => ['name' => 'Ajakan Penggunaan Self Service', 'weight' => 2.0],
            '9.1' => ['name' => 'Konfirmasi Akhir Penyelesaian', 'weight' => 3.0],
            '9.2' => ['name' => 'Ajakan Pengisian Rating / CSAT', 'weight' => 5.0],
            '10.1' => ['name' => 'Greeting Akhir Penutupan Chat', 'weight' => 30.0],
            '10.2' => ['name' => 'Ketepatan Waktu Pengakhiran Sesi', 'weight' => 10.0]
        ];
        $seq = 1;
        foreach ($digiliveParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['DIGILIVE'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.3 Socmed (8 Parameters)
        $socmedParams = [
            'A.1' => ['name' => 'Kecepatan Respon Awal Socmed (SLA Respon)', 'weight' => 2.0],
            'A.2' => ['name' => 'Format Salam & Identitas Akun Resmi', 'weight' => 23.0],
            'B.1' => ['name' => 'Verifikasi Akun & Validasi Privasi', 'weight' => 10.0],
            'B.2' => ['name' => 'Ketepatan Jawaban DM / Komentar', 'weight' => 30.0],
            'B.3' => ['name' => 'Penanganan Komentar Publik & Pengalihan DM', 'weight' => 10.0],
            'B.4' => ['name' => 'Pemberian Solusi & Eskalasi Teknis', 'weight' => 10.0],
            'C.1' => ['name' => 'Gaya Komunikasi Menarik & Humanis (Brand Voice)', 'weight' => 5.0],
            'C.2' => ['name' => 'Penutupan Respon & Monitoring Balasan', 'weight' => 10.0]
        ];
        $seq = 1;
        foreach ($socmedParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['SOCMED'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.4 Email Outbound (15 Parameters)
        $emailParams = [
            'A1' => ['name' => 'Ketepatan Alamat Email & Subjek Surat', 'weight' => 10.0],
            'B1' => ['name' => 'Format Salam Pembuka Resmi', 'weight' => 3.0],
            'B2' => ['name' => 'Penyebutan Nama Pelanggan / Nomor ID', 'weight' => 2.0],
            'C3' => ['name' => 'Kejelasan Isi Pesan / Tujuan Email', 'weight' => 5.0],
            'C4' => ['name' => 'Ketepatan Lampiran & Dokumen Pendukung', 'weight' => 2.0],
            'C5' => ['name' => 'Struktur Paragraf & Tata Bahasa Formal', 'weight' => 8.0],
            'D6' => ['name' => 'Tindak Lanjut Tiket & Konfirmasi Perbaikan', 'weight' => 5.0],
            'D7' => ['name' => 'Panggilan Outbound Konfirmasi Pelanggan', 'weight' => 3.0],
            'D8' => ['name' => 'Waktu Panggilan Sesuai Jadwal Janji', 'weight' => 2.0],
            'D9' => ['name' => 'Kesesuaian Data Hasil Outbound di CRM', 'weight' => 5.0],
            'D10' => ['name' => 'Ketepatan Status Akhir Tiket', 'weight' => 5.0],
            'E11' => ['name' => 'Pemberian Kontak Layanan Pelanggan', 'weight' => 5.0],
            'E12' => ['name' => 'Format Signature Resmi Perusahaan', 'weight' => 30.0],
            'E13' => ['name' => 'Waktu Pengiriman Email (SLA)', 'weight' => 5.0],
            'E14' => ['name' => 'Pencegahan Komplain Berulang', 'weight' => 10.0]
        ];
        $seq = 1;
        foreach ($emailParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['EMAIL_OUTBOUND'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.5 Back Office (3 Parameters)
        $boParams = [
            '1' => ['name' => 'Ketepatan Validasi & Verifikasi Data Tiket BO', 'weight' => 50.0],
            '2' => ['name' => 'Ketepatan Analisa Teknis & Alur Eskalasi Tim Lapangan', 'weight' => 30.0],
            '3' => ['name' => 'Kesesuaian SLA Waktu Penyelesaian Eskalasi', 'weight' => 20.0]
        ];
        $seq = 1;
        foreach ($boParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['BACK_OFFICE'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.6 Email / Email Inbound (15 Parameters: 1 - 15)
        $emailInboundParams = [
            '1' => ['name' => 'Greeting Awal & Pembuka Email', 'weight' => 3.0],
            '2' => ['name' => 'Konfirmasi / Verifikasi Data Pelanggan', 'weight' => 2.0],
            '3' => ['name' => 'Identifikasi Masalah & Subjek Tiket', 'weight' => 5.0],
            '4' => ['name' => 'Kelengkapan Analisa & Validasi Tiket', 'weight' => 2.0],
            '5' => ['name' => 'Ketepatan Solusi & Informasi', 'weight' => 8.0],
            '6' => ['name' => 'Struktur Paragraf & Tata Bahasa Formal', 'weight' => 5.0],
            '7' => ['name' => 'Ketepatan Lampiran & File Pendukung', 'weight' => 2.0],
            '8' => ['name' => 'Penulisan Salam Penutup & Signature', 'weight' => 3.0],
            '9' => ['name' => 'Ketepatan Input CRM / Ticketing', 'weight' => 5.0],
            '10' => ['name' => 'SLA Waktu Respon & Pengiriman Email', 'weight' => 10.0],
            '11' => ['name' => 'Edukasi Fitur Aplikasi / Self Service', 'weight' => 5.0],
            '12' => ['name' => 'Konfirmasi Tindak Lanjut & Closing', 'weight' => 10.0],
            '13' => ['name' => 'Etika & Kesopanan Komunikasi Tertulis', 'weight' => 5.0],
            '14' => ['name' => 'Pencegahan Komplain Berulang', 'weight' => 5.0],
            '15' => ['name' => 'First Contact Resolution Compliance', 'weight' => 30.0]
        ];
        $seq = 1;
        foreach ($emailInboundParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['EMAIL_INBOUND'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.7 Outbound Call (12 Parameters: 1 - 12)
        $outboundCallParams = [
            '1' => ['name' => 'Greeting Awal & Identifikasi Pelanggan', 'weight' => 2.0],
            '2' => ['name' => 'Konfirmasi Kesiapan Pelanggan Berbicara', 'weight' => 5.0],
            '3' => ['name' => 'Penyampaian Tujuan Panggilan Outbound', 'weight' => 10.0],
            '4' => ['name' => 'Validasi Data & Histori Tiket Terkait', 'weight' => 10.0],
            '5' => ['name' => 'Kejelasan Solusi & Informasi Tindak Lanjut', 'weight' => 5.0],
            '6' => ['name' => 'Kejelasan Suara & Artikulasi Petugas', 'weight' => 5.0],
            '7' => ['name' => 'Etika, Kesopanan & Sikap Empati', 'weight' => 10.0],
            '8' => ['name' => 'Efisiensi Durasi Panggilan (AHT Outbound)', 'weight' => 30.0],
            '9' => ['name' => 'Ketepatan Input Hasil Panggilan di CRM', 'weight' => 3.0],
            '10' => ['name' => 'Edukasi Mandiri Fitur MyIcon+', 'weight' => 5.0],
            '11' => ['name' => 'Konfirmasi Akhir & Salam Penutup', 'weight' => 10.0],
            '12' => ['name' => 'First Contact Resolution (FCR) Compliance', 'weight' => 5.0]
        ];
        $seq = 1;
        foreach ($outboundCallParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['OUTBOUND_CALL'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
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
