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
        DB::table('sites')->updateOrInsert(
            ['code' => 'JKT'],
            ['name' => 'JAKARTA & BANTEN', 'status' => true, 'updated_at' => now(), 'created_at' => now()]
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

        // 7. CA Parameters for All Services (Official CC ICONNET)
        // 7.1 Inbound (14 Parameters)
        $inboundParams = [
            '1' => ['name' => 'Salam Pembuka', 'weight' => 5.0],
            '2' => ['name' => 'Verifikasi Data Pelanggan/ Konfirmasi Data Non Pelanggan', 'weight' => 10.0],
            '3' => ['name' => 'Menyimak Permintaan Pelanggan atau Non Pelanggan', 'weight' => 5.0],
            '4' => ['name' => 'Probing', 'weight' => 10.0],
            '5' => ['name' => 'Intonasi, Volume, Kejelasan Ucapan & Kecepatan Berbicara', 'weight' => 10.0],
            '6' => ['name' => 'Penggunaan Kata & Kalimat', 'weight' => 5.0],
            '7' => ['name' => 'Magic Word', 'weight' => 5.0],
            '8' => ['name' => 'Akurasi Informasi / Solusi', 'weight' => 15.0],
            '9' => ['name' => 'Menyebut Nama Pelanggan atau Non Pelanggan', 'weight' => 5.0],
            '10' => ['name' => 'Akad Transaksi', 'weight' => 5.0],
            '11' => ['name' => 'Konfirmasi Kejelasan Informasi & Menawarkan Bantuan Berikutnya', 'weight' => 5.0],
            '12' => ['name' => 'Etika Berkomunikasi', 'weight' => 5.0],
            '13' => ['name' => 'Pencatatan CRM', 'weight' => 10.0],
            '14' => ['name' => 'Salam Penutup', 'weight' => 5.0]
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
            '1.1' => ['name' => 'Menggunakan Salam Pembuka Sesuai Standar', 'weight' => 5.0],
            '2.1' => ['name' => 'Pemilihan Kata', 'weight' => 5.0],
            '2.2' => ['name' => 'Pemilihan Kalimat', 'weight' => 5.0],
            '2.3' => ['name' => 'Penggunaan Tanda Baca', 'weight' => 5.0],
            '3.1' => ['name' => 'Konfirmasi Kejelasan Informasi & Menawarkan Bantuan Berikutnya Secara Terstruktur', 'weight' => 5.0],
            '4.1' => ['name' => 'Menggunakan Salam Penutup Sesuai Standar', 'weight' => 5.0],
            '5.1' => ['name' => 'Cepat dan Tanggap Menangani Pelanggan', 'weight' => 5.0],
            '5.2' => ['name' => 'Proses Hold Sesuai Ketentuan', 'weight' => 5.0],
            '5.3' => ['name' => 'Alur Transaksi Sesuai Ketentuan', 'weight' => 5.0],
            '6.1' => ['name' => 'Menunjukan Empati atau Apresiasi', 'weight' => 5.0],
            '6.2' => ['name' => 'Etika Pelayanan', 'weight' => 5.0],
            '7.1' => ['name' => 'Aktif Menyebutkan Nama Pelapor', 'weight' => 5.0],
            '8.1' => ['name' => 'Menanyakan Permasalahan Pelanggan, Data Inti dan/atau Data Pendukung', 'weight' => 10.0],
            '8.2' => ['name' => 'Menanyakan Secara Terstruktur', 'weight' => 5.0],
            '9.1' => ['name' => 'Verifikasi Data Sesuai Dengan Tahapan dan Ketentuan serta Menjaga Kerahasian Data', 'weight' => 10.0],
            '9.2' => ['name' => 'Akad Transaksi', 'weight' => 5.0],
            '10.1' => ['name' => 'Ketepatan Informasi/Solusi', 'weight' => 5.0],
            '10.2' => ['name' => 'Kesesuaian Pencatatan', 'weight' => 5.0]
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
            '1' => ['name' => 'Sapa Nama Pemilik Akun', 'weight' => 10.0],
            '2' => ['name' => 'Kreatifitas Kalimat', 'weight' => 10.0],
            '3' => ['name' => 'Kemampuan Menyimak', 'weight' => 15.0],
            '4' => ['name' => 'Memberikan Solusi Lengkap dan Akurat', 'weight' => 20.0],
            '5' => ['name' => 'Empati atau Apresiasi', 'weight' => 15.0],
            '6' => ['name' => 'Kemampuan Menulis', 'weight' => 10.0],
            '7' => ['name' => 'Melakukan Pencatatan CRM', 'weight' => 10.0],
            '8' => ['name' => 'Kesesuaian Pencatatan CRM', 'weight' => 10.0]
        ];
        $seq = 1;
        foreach ($socmedParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['SOCMED'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.4 Email Outbound (15 Parameters)
        $emailOutboundParams = [
            '1' => ['name' => 'Ketidaksesuaian prosedur Outbound (CSO sudah menghubungi pelanggan sebanyak 3 kali melalui telepon)', 'weight' => 10.0],
            '2' => ['name' => 'Sapa nama pelanggan', 'weight' => 5.0],
            '3' => ['name' => 'Salam Pembuka', 'weight' => 5.0],
            '4' => ['name' => 'Konfirmasi Laporan', 'weight' => 5.0],
            '5' => ['name' => 'Identifikasi Email (Nomor/ ID Tiket)', 'weight' => 5.0],
            '6' => ['name' => 'Penggunaan Bahasa yang Sesuai', 'weight' => 5.0],
            '7' => ['name' => 'Cara penulisan CSO', 'weight' => 10.0],
            '8' => ['name' => 'Informasi kanal lain', 'weight' => 5.0],
            '9' => ['name' => 'Salam penutup email', 'weight' => 5.0],
            '10' => ['name' => 'Emphaty/ Apreciation', 'weight' => 5.0],
            '11' => ['name' => 'Etika/ Kesopanan', 'weight' => 5.0],
            '12' => ['name' => 'Validasi data pelanggan', 'weight' => 10.0],
            '13' => ['name' => 'Kelengkapan Informasi/Solusi', 'weight' => 10.0],
            '14' => ['name' => 'Pencatatan CRM', 'weight' => 10.0],
            '15' => ['name' => 'Kesesuaian pengisian CRM', 'weight' => 5.0]
        ];
        $seq = 1;
        foreach ($emailOutboundParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['EMAIL_OUTBOUND'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.5 Back Office (3 Parameters)
        $boParams = [
            '1' => ['name' => 'Kesesuaian Analisa', 'weight' => 40.0],
            '2' => ['name' => 'Kesesuaian Pencatatan dan Ketepatan Bidang Eskalasi', 'weight' => 40.0],
            '3' => ['name' => 'Penggunaan Kalimat', 'weight' => 20.0]
        ];
        $seq = 1;
        foreach ($boParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['BACK_OFFICE'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.6 Email / Email Inbound (15 Parameters)
        $emailInboundParams = [
            '1' => ['name' => 'Sapa nama pelanggan', 'weight' => 5.0],
            '2' => ['name' => 'Salam Pembuka', 'weight' => 5.0],
            '3' => ['name' => 'Konfirmasi Email', 'weight' => 5.0],
            '4' => ['name' => 'Identifikasi Email (Nomor/ ID Tiket)', 'weight' => 5.0],
            '5' => ['name' => 'Penggunaan Bahasa yang Sesuai', 'weight' => 5.0],
            '6' => ['name' => 'Cara penulisan CSO dalam membalas e-mail', 'weight' => 10.0],
            '7' => ['name' => 'Informasi kanal lain', 'weight' => 5.0],
            '8' => ['name' => 'Salam penutup email', 'weight' => 5.0],
            '9' => ['name' => 'Emphaty/ Apreciation', 'weight' => 5.0],
            '10' => ['name' => 'Etika/kesopanan', 'weight' => 5.0],
            '11' => ['name' => 'Validasi data pelanggan', 'weight' => 10.0],
            '12' => ['name' => 'Akad Transaksi', 'weight' => 5.0],
            '13' => ['name' => 'Kemampuan Probing', 'weight' => 10.0],
            '14' => ['name' => 'Informasi/Solusi', 'weight' => 15.0],
            '15' => ['name' => 'Kesesuaian Pencatatan CRM', 'weight' => 10.0]
        ];
        $seq = 1;
        foreach ($emailInboundParams as $code => $item) {
            DB::table('ca_parameters')->updateOrInsert(
                ['service_id' => $serviceIds['EMAIL_INBOUND'], 'code' => (string)$code],
                ['name' => $item['name'], 'weight' => $item['weight'], 'sequence' => $seq++, 'status' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        // 7.7 Outbound Call (12 Parameters)
        $outboundCallParams = [
            '1' => ['name' => 'Salam Pembuka', 'weight' => 5.0],
            '2' => ['name' => 'Verifikasi Data Pelanggan/ Konfirmasi Data Non Pelanggan', 'weight' => 10.0],
            '3' => ['name' => 'Menyimak Informasi Pelanggan', 'weight' => 5.0],
            '4' => ['name' => 'Kemampuan Negosiasi atau Cara Konfirmasi', 'weight' => 10.0],
            '5' => ['name' => 'Intonasi, Volume, Kejelasan Ucapan & Kecepatan Berbicara', 'weight' => 10.0],
            '6' => ['name' => 'Penggunaan Kata & Kalimat', 'weight' => 5.0],
            '7' => ['name' => 'Etika Komunikasi', 'weight' => 5.0],
            '8' => ['name' => 'Kelengkapan Informasi', 'weight' => 15.0],
            '9' => ['name' => 'Menyebut Nama Pelanggan atau Non Pelanggan', 'weight' => 5.0],
            '10' => ['name' => 'Konfirmasi Kejelasan Informasi', 'weight' => 5.0],
            '11' => ['name' => 'Pencatatan CRM', 'weight' => 15.0],
            '12' => ['name' => 'Salam Penutup', 'weight' => 5.0]
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
