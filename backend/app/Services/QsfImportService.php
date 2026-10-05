<?php

namespace App\Services;

use App\Models\Agent;
use App\Models\AgentAssignment;
use App\Models\CaAssessment;
use App\Models\CaAssessmentScore;
use App\Models\CaParameter;
use App\Models\Category;
use App\Models\MonthlyTrend;
use App\Models\Notification;
use App\Models\Platform;
use App\Models\Service;
use App\Models\SipImport;
use App\Models\SipImportRow;
use App\Models\Site;
use App\Models\SubCategory;
use App\Models\TeamLeader;
use App\Models\Trainer;
use App\Models\User;
use App\Services\Sampling\NakerVerificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QsfImportService
{
    /**
     * Konversi durasi format HH:MM:SS atau MM:SS atau Integer menjadi total detik
     */
    public static function parseDurationToSeconds($val): ?int
    {
        if ($val === null || $val === '') return null;
        if (is_numeric($val)) return (int)$val;

        $str = trim((string)$val);
        $parts = explode(':', $str);

        if (count($parts) === 3) {
            return ((int)$parts[0] * 3600) + ((int)$parts[1] * 60) + (int)$parts[2];
        } elseif (count($parts) === 2) {
            return ((int)$parts[0] * 60) + (int)$parts[1];
        }

        return (int)preg_replace('/[^0-9]/', '', $str) ?: null;
    }

    /**
     * Konversi format tanggal excel atau text menjadi datetime valid (Mendukung format Indonesia DD/MM/YYYY, Excel serial, dsb)
     */
    public static function parseDateTime($val): ?string
    {
        if ($val === null || $val === '') return null;
        
        $str = trim((string)$val);
        if ($str === '' || $str === '-' || strtolower($str) === 'null') return null;

        // 1. Handle Excel numeric serial timestamp (e.g. 45507 or 45507.45)
        if (is_numeric($str) && (float)$str > 30000 && (float)$str < 70000) {
            try {
                $seconds = ((float)$str - 25569) * 86400;
                return Carbon::createFromTimestampUTC((int)$seconds)->toDateTimeString();
            } catch (\Exception $e) {
                // fallback
            }
        }

        // 2. Normalize Indonesian month names if present (e.g. "15 Agustus 2026", "01-Agt-2026")
        $indoMonthMap = [
            'januari' => '01', 'jan' => '01',
            'februari' => '02', 'feb' => '02',
            'maret' => '03', 'mar' => '03',
            'april' => '04', 'apr' => '04',
            'mei' => '05', 'may' => '05',
            'juni' => '06', 'jun' => '06',
            'juli' => '07', 'jul' => '07',
            'agustus' => '08', 'agu' => '08', 'agt' => '08', 'aug' => '08',
            'september' => '09', 'sep' => '09',
            'oktober' => '10', 'okt' => '10', 'oct' => '10',
            'november' => '11', 'nov' => '11',
            'desember' => '12', 'des' => '12', 'dec' => '12',
        ];

        $lowerStr = strtolower($str);
        foreach ($indoMonthMap as $monthWord => $monthNum) {
            if (str_contains($lowerStr, $monthWord)) {
                $lowerStr = preg_replace('/\b' . preg_quote($monthWord, '/') . '\b/i', $monthNum, $lowerStr);
                $str = $lowerStr;
                break;
            }
        }

        // 3. Try standard explicit formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.)
        $formats = [
            'd/m/Y H:i:s', 'd/m/Y H:i', 'd/m/Y',
            'd-m-Y H:i:s', 'd-m-Y H:i', 'd-m-Y',
            'Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d',
            'Y/m/d H:i:s', 'Y/m/d H:i', 'Y/m/d',
            'd.m.Y H:i:s', 'd.m.Y H:i', 'd.m.Y',
            'm/d/Y H:i:s', 'm/d/Y H:i', 'm/d/Y',
        ];

        foreach ($formats as $fmt) {
            try {
                $dt = Carbon::createFromFormat($fmt, $str);
                if ($dt !== false && $dt->year >= 2000 && $dt->year <= 2099) {
                    return $dt->toDateTimeString();
                }
            } catch (\Exception $e) {
                // continue
            }
        }

        // 4. Regex parsing for DD/MM/YYYY or DD-MM-YYYY
        if (preg_match('/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/', $str, $m)) {
            try {
                $day = (int)$m[1];
                $mon = (int)$m[2];
                $yr  = (int)$m[3];
                $hr  = isset($m[4]) ? (int)$m[4] : 0;
                $min = isset($m[5]) ? (int)$m[5] : 0;
                $sec = isset($m[6]) ? (int)$m[6] : 0;

                if ($mon > 12 && $day <= 12) {
                    $tmp = $day; $day = $mon; $mon = $tmp;
                }

                if ($day >= 1 && $day <= 31 && $mon >= 1 && $mon <= 12 && $yr >= 2000 && $yr <= 2099) {
                    return Carbon::create($yr, $mon, $day, $hr, $min, $sec)->toDateTimeString();
                }
            } catch (\Exception $e) {}
        }

        // 5. Regex parsing for YYYY-MM-DD or YYYY/MM/DD
        if (preg_match('/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/', $str, $m)) {
            try {
                $yr  = (int)$m[1];
                $mon = (int)$m[2];
                $day = (int)$m[3];
                $hr  = isset($m[4]) ? (int)$m[4] : 0;
                $min = isset($m[5]) ? (int)$m[5] : 0;
                $sec = isset($m[6]) ? (int)$m[6] : 0;
                if ($day >= 1 && $day <= 31 && $mon >= 1 && $mon <= 12 && $yr >= 2000 && $yr <= 2099) {
                    return Carbon::create($yr, $mon, $day, $hr, $min, $sec)->toDateTimeString();
                }
            } catch (\Exception $e) {}
        }

        // 6. Generic Carbon parse fallback
        try {
            return Carbon::parse($str)->toDateTimeString();
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Helper untuk mengekstrak dan mem-parsing tanggal transaksi & ukur dengan fallback cerdas
     */
    public static function resolveRowDates(array $row, ?string $rawIdca = null): array
    {
        $txKeys = [
            'interaction_date', 'interaction_at', 'Interaction Date', 'Date', 'date', 'tgl_omni', 'tanggal_omni', 'omni_date', 'Omni Date',
            'Tgl Transaksi', 'Tanggal Transaksi', 'Transaction Date', 'tgl_transaksi', 'tanggal_transaksi',
            'waktulapor', 'waktu_lapor', 'waktugangguan', 'waktu_gangguan', 'tanggalinsiden', 'tanggal_insiden',
            'tgl_tx', 'tx_date', 'waktu_mulai', 'waktumulai', 'transaction_at', 'Tanggal', 'Tgl', 'Waktu', 'waktu'
        ];
        $msKeys = [
            'Tgl Ukur', 'Tanggal Ukur', 'Measurement Date', 'tgl_ukur', 'tanggal_ukur',
            'waktulaporanselesai', 'waktu_laporan_selesai', 'waktugangguanselesai', 'waktu_gangguan_selesai',
            'tgl_selesai', 'waktu_selesai', 'measurement_at', 'Tanggal Selesai', 'Tgl Selesai'
        ];

        $rawTx = self::extractValue($row, $txKeys);
        $rawMs = self::extractValue($row, $msKeys);

        $parsedTx = self::parseDateTime($rawTx);
        $parsedMs = self::parseDateTime($rawMs);

        // Fallbacks
        if (!$parsedTx && $parsedMs) {
            $parsedTx = $parsedMs;
        } elseif (!$parsedMs && $parsedTx) {
            $parsedMs = $parsedTx;
        }

        // If both still null, try extracting date from IDCA (e.g., CA_EM-xxx20260802154136 or CA_INB-202609081606351)
        if (!$parsedTx && !$parsedMs && $rawIdca) {
            if (preg_match('/(202\d{5})/', $rawIdca, $m)) {
                try {
                    $dt = Carbon::createFromFormat('Ymd', $m[1])->startOfDay()->toDateTimeString();
                    $parsedTx = $dt;
                    $parsedMs = $dt;
                } catch (\Exception $e) {}
            }
        }

        // Guaranteed fallback so period filtering always works
        if (!$parsedTx && !$parsedMs) {
            $defaultDate = '2026-08-01 00:00:00';
            $parsedTx = $defaultDate;
            $parsedMs = $defaultDate;
        }

        return [
            'raw_tx' => $rawTx,
            'raw_ms' => $rawMs,
            'transaction_at' => $parsedTx,
            'measurement_at' => $parsedMs,
        ];
    }

    /**
     * Helper untuk memastikan Service selalu ada di database
     */
    public static function getOrCreateCanonicalService(string $code, string $name, string $caLabel = ''): Service
    {
        return Service::firstOrCreate(
            ['code' => $code],
            [
                'name' => $name,
                'source_ca_label' => $caLabel ?: $name,
                'source_layanan_label' => $name,
                'status' => true,
                'description' => 'Layanan ' . $name
            ]
        );
    }

    /**
     * Deteksi Service dari nama file, label CA, atau sample row di Excel
     */
    public static function detectService($fileNameOrCaLabel, array $sampleRow = []): Service
    {
        $lower = strtolower(trim((string)$fileNameOrCaLabel));

        // 1. Email Outbound (Email Outbond / Outbound Reguler)
        if (str_contains($lower, 'email outbound') || str_contains($lower, 'email outbond') || str_contains($lower, 'email_outbound') || str_contains($lower, 'email_outbond') || str_contains($lower, 'outbound reguler') || str_contains($lower, 'outbond reguler')) {
            return self::getOrCreateCanonicalService('EMAIL_OUTBOUND', 'Email Outbound', 'Email_Outbound');
        }

        // 2. Outbound Call (Outbond Call / OBC)
        if (str_contains($lower, 'outbound call') || str_contains($lower, 'outbond call') || str_contains($lower, 'outbound_call') || str_contains($lower, 'outbond_call') || $lower === 'outbound' || $lower === 'outbond' || $lower === 'obc') {
            return self::getOrCreateCanonicalService('OUTBOUND_CALL', 'Outbound Call', 'Outbound_Call');
        }

        // 3. Socmed (WhatsApp, Instagram, Google Play, Social Media, Twitter, Facebook, Coster) - BEFORE generic chat!
        if (str_contains($lower, 'socmed') || str_contains($lower, 'sosmed') || str_contains($lower, 'social') || str_contains($lower, 'instagram') || str_contains($lower, 'whatsapp') || str_contains($lower, 'coster') || str_contains($lower, 'google play') || str_contains($lower, 'playstore') || str_contains($lower, 'play store') || str_contains($lower, 'twitter') || str_contains($lower, 'facebook')) {
            return self::getOrCreateCanonicalService('SOCMED', 'Socmed', 'Socmed');
        }

        // 4. Back Office
        if (str_contains($lower, 'back office') || str_contains($lower, 'backoffice') || str_contains($lower, 'eskalasi bo') || str_contains($lower, 'eskalasi_bo') || str_contains($lower, 'ketepatan eskalasi bo') || str_contains($lower, 'back_office') || $lower === 'bo' || str_contains($lower, 'eskalasi') || str_contains($lower, 'internal')) {
            return self::getOrCreateCanonicalService('BACK_OFFICE', 'Back Office', 'Ketepatan Eskalasi BO');
        }

        // 5. Digilive (Live Chat, Webhook, Portal, My Icon+, Botika, PLN Mobile, Ngaoss)
        if (str_contains($lower, 'digilive') || str_contains($lower, 'live chat') || str_contains($lower, 'livechat') || str_contains($lower, 'chatbot') || str_contains($lower, 'botika') || str_contains($lower, 'my icon') || str_contains($lower, 'myicon') || str_contains($lower, 'pln') || str_contains($lower, 'ngaoss') || str_contains($lower, 'ichat') || str_contains($lower, 'chat') || str_contains($lower, 'webhook') || str_contains($lower, 'portal')) {
            return self::getOrCreateCanonicalService('DIGILIVE', 'Digilive', 'Digilive');
        }

        // 6. Email (QSF - EMAIL.xlsx / Email Inbound)
        if (str_contains($lower, 'email') || str_contains($lower, 'mail')) {
            return self::getOrCreateCanonicalService('EMAIL_INBOUND', 'Email', 'Email_Inbound');
        }

        // 7. Inbound Call
        if (str_contains($lower, 'inbound') || str_contains($lower, 'inbond') || str_contains($lower, 'voice') || str_contains($lower, 'call') || str_contains($lower, 'phone') || str_contains($lower, 'retail')) {
            return self::getOrCreateCanonicalService('INBOUND', 'Inbound', 'Inbound');
        }

        // 8. Content inspection jika nama file umum (misal Report.xlsx)
        if (!empty($sampleRow)) {
            $ca = strtolower(trim((string)self::extractValue($sampleRow, ['CA', 'Layanan', 'Channel', 'service', 'namasumber'])));
            if (str_contains($ca, 'email outbound') || str_contains($ca, 'email outbond')) return self::getOrCreateCanonicalService('EMAIL_OUTBOUND', 'Email Outbound');
            if (str_contains($ca, 'outbound call') || str_contains($ca, 'outbond call') || str_contains($ca, 'outbound reguler') || str_contains($ca, 'outbond reguler') || $ca === 'outbound' || $ca === 'outbond') return self::getOrCreateCanonicalService('OUTBOUND_CALL', 'Outbound Call');
            if (str_contains($ca, 'socmed') || str_contains($ca, 'sosmed') || str_contains($ca, 'whatsapp') || str_contains($ca, 'instagram') || str_contains($ca, 'google play') || str_contains($ca, 'twitter') || str_contains($ca, 'facebook')) return self::getOrCreateCanonicalService('SOCMED', 'Socmed');
            if (str_contains($ca, 'back office') || str_contains($ca, 'backoffice') || str_contains($ca, 'eskalasi') || str_contains($ca, 'bo') || str_contains($ca, 'internal')) return self::getOrCreateCanonicalService('BACK_OFFICE', 'Back Office');
            if (str_contains($ca, 'digilive') || str_contains($ca, 'live chat') || str_contains($ca, 'my icon') || str_contains($ca, 'pln') || str_contains($ca, 'ngaoss') || str_contains($ca, 'chat') || str_contains($ca, 'webhook')) return self::getOrCreateCanonicalService('DIGILIVE', 'Digilive');
            if (str_contains($ca, 'email') || str_contains($ca, 'mail')) return self::getOrCreateCanonicalService('EMAIL_INBOUND', 'Email');
            if (str_contains($ca, 'inbound') || str_contains($ca, 'inbond') || str_contains($ca, 'voice') || str_contains($ca, 'call') || str_contains($ca, 'phone')) return self::getOrCreateCanonicalService('INBOUND', 'Inbound');
        }

        return self::getOrCreateCanonicalService('INBOUND', 'Inbound', 'Inbound');
    }

    /**
     * Ambil nilai dari row array dengan pencocokan case-insensitive, trim, dan alias
     */
    public static function extractValue(array $row, array $candidateKeys, $default = null)
    {
        // 1. Direct match
        foreach ($candidateKeys as $k) {
            if (isset($row[$k]) && $row[$k] !== null && trim((string)$row[$k]) !== '') {
                return trim((string)$row[$k]);
            }
        }

        // 2. Normalized clean keys lookup
        $normalizedRow = [];
        foreach ($row as $k => $v) {
            $cleanKey = strtolower(trim(preg_replace('/[^a-zA-Z0-9]/', '', (string)$k)));
            $normalizedRow[$cleanKey] = $v;
        }

        foreach ($candidateKeys as $k) {
            $cleanCandidate = strtolower(trim(preg_replace('/[^a-zA-Z0-9]/', '', (string)$k)));
            if (isset($normalizedRow[$cleanCandidate]) && $normalizedRow[$cleanCandidate] !== null && trim((string)$normalizedRow[$cleanCandidate]) !== '') {
                return trim((string)$normalizedRow[$cleanCandidate]);
            }
        }

        return $default;
    }

    /**
     * Dry Run Preview & Redundancy Audit
     */
    public function preview(array $rows, string $channelName = 'Auto', string $fileName = 'Import.xlsx', string $importType = 'QSF')
    {
        $isCrmRaw = ($importType === 'CRM_RAW') || str_contains(strtolower($fileName), 'listticketing') || str_contains(strtolower($fileName), 'ticketingretail') || str_contains(strtolower($fileName), 'ticket_summary') || str_contains(strtolower($fileName), 'omni') || (str_contains(strtolower($fileName), 'retail') && !str_contains(strtolower($fileName), 'qsf'));
        $isAuto = ($channelName === 'Auto' || $channelName === 'AUTO' || empty($channelName) || $channelName === 'ALL' || $channelName === 'Otomatis');
        $service = self::detectService($channelName ?: $fileName);
        $site = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $parameters = CaParameter::where('service_id', $service->id)->orderBy('sequence')->get();

        $existingIdcas = CaAssessment::pluck('id', 'idca')->toArray();
        $existingAgents = Agent::with(['teamLeader', 'trainer'])->get()->keyBy(function ($a) {
            return strtolower(trim($a->name));
        });
        $existingAgentsByNik = Agent::with(['teamLeader', 'trainer'])->get()->keyBy(function ($a) {
            return strtolower(trim((string)$a->nik));
        });
        $nakerCaches = NakerVerificationService::loadNakerCaches();
        $nakerCount = \App\Models\Employee::count();
        $isNakerAvailable = ($nakerCount > 0);
        $nakerWarning = null;
        if (!$isCrmRaw && !$isNakerAvailable) {
            $nakerWarning = 'Perhatian: Master Data NAKER belum diunggah di sistem. Seluruh nama agen dan NIK tidak dapat dicocokkan ke data resmi NAKER. Anda diwajibkan mengunggah data Master NAKER terlebih dahulu sebelum melakukan injeksi data QSF.';
        }

        $parsed = [];
        $seenIdcasInFile = [];
        $newCount = 0;
        $updateCount = 0;
        $dupCount = 0;
        $invalidCount = 0;

        foreach ($rows as $idx => $row) {
            $rowNum = $idx + 1;

            // ── Skip baris tidak valid dari format QSF Excel ─────────────────
            // 1. Skip baris header duplikat (row yang berisi 'Agent', 'No', 'Site' sebagai nilai)
            $firstVal = trim((string)(reset($row) ?? ''));
            $agentVal = trim((string)(self::extractValue($row, ['Agent', 'agent']) ?? ''));
            if (strtolower($agentVal) === 'agent' || strtolower($firstVal) === 'no') continue;
            // 2. Skip baris rata-rata / summary
            if (str_contains(strtolower($firstVal), 'rata') || str_contains(strtolower($firstVal), 'average') || str_contains(strtolower($firstVal), 'total')) continue;
            // 3. Skip baris yang hanya berisi nomor urut (No berisi angka, semua field kunci kosong)
            $rawAgent = self::extractValue($row, ['Agent', 'Nama Agent', 'Nama Lengkap', 'Nama']);
            $rawIdcaCheck = self::extractValue($row, ['IDCA', 'ID CA', 'ID_CA', 'idca']);
            if (!$rawAgent && !$rawIdcaCheck && is_numeric($firstVal)) continue;
            // ────────────────────────────────────────────────────────────────

            $rawName    = self::extractValue($row, ['Agent', 'Nama Agent', 'Nama Lengkap', 'Nama', 'Agent Name', 'nama_agent', 'agent_name', 'Nama Petugas', 'User', 'Petugas', 'Karyawan', 'Pegawai', 'penerimalaporan', 'penerima_laporan', 'Penerima Laporan', 'Penerima', 'namapelapor']);
            $rawIdca    = self::extractValue($row, ['IDCA', 'ID CA', 'ID_CA', 'idca', 'No CA', 'No. CA', 'Kode CA', 'Assessment ID', 'ID_Assessment']);
            $rawTicket  = self::extractValue($row, ['ID Tiket', 'ID_Tiket', 'No Tiket', 'No. Tiket', 'Ticket ID', 'ticket_id', 'Ticket', 'Tiket', 'idtiket', 'id_tiket']);
            $rawNik     = self::extractValue($row, ['NIK', 'nik', 'employee_code', 'NIK Agent', 'ID Agent', 'NIP', 'idpelanggan', 'sidbaru']);
            $rawQa      = self::extractValue($row, ['QA', 'Nama QA', 'Evaluator', 'Auditor', 'Nama Evaluator', 'Trainer', 'qa_name', 'Penilai']);
            $rawTl      = self::extractValue($row, ['Team Leader', 'Team Leader (TL)', 'TL', 'Nama TL', 'Supervisor', 'SPV', 'team_leader']);
            $rawTrn     = self::extractValue($row, ['Trainer', 'Trainer Pengampu', 'Nama Trainer', 'trainer']);

            // Roadmap V2 §23 & Raw Ticketing — nilai asli dari kolom Excel untuk traceability
            $rawSourceCa      = self::extractValue($row, ['CA', 'ca', 'IDCA', 'ID CA']);
            $rawSourceLayanan = self::extractValue($row, ['Layanan', 'layanan', 'Service', 'Saluran', 'namasumber', 'nama_sumber', 'sumber', 'Channel', 'channel']);
            $rawHashtag       = self::extractValue($row, ['Hashtag', 'hashtag', 'Tag', '#']);
            $rawEverChanged   = self::extractValue($row, ['Pernah Diubah', 'pernah_diubah', 'Ever Changed', 'Changed']);
            $rawSite          = self::extractValue($row, ['Site', 'site', 'Lokasi', 'SITE', 'namasbu', 'nama_sbu', 'namakp']);
            $rawCustomer      = self::extractValue($row, ['Pelanggan', 'pelanggan', 'namapelanggan', 'nama_pelanggan', 'Customer', 'Customer Name']);
            $rawCategory      = self::extractValue($row, ['namakelompok', 'nama_kelompok', 'Kelompok', 'Kategori', 'category', 'Jenis', 'Topic', 'Kelompok Gangguan'], 'GANGGUAN');
            $rawSubCategory   = self::extractValue($row, ['namakondisi', 'nama_kondisi', 'namaKondisi', 'Nama Kondisi', 'Kondisi', 'kondisi', 'Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'Sub Kategori Gangguan', 'Klasifikasi', 'klasifikasi', 'Subject', 'subject']);

            // Channel resolution from namasumber (Retail Ticketing)
            if ($rawSourceLayanan) {
                $rawSourceLayanan = \App\Services\Sampling\AutoDistributionEngineService::resolveChannel($rawSourceLayanan);
            }

            // Clean & match agent name against Master Data NAKER
            $cleanName = $rawName ? NakerVerificationService::cleanCsoName($rawName) : null;
            $cleanNik  = $rawNik ? trim((string)$rawNik) : ('AGT-' . strtoupper(substr(md5($cleanName ?: (string)$rowNum), 0, 6)));
            $cleanIdca = $rawIdca ? trim((string)$rawIdca) : ('CA_' . strtoupper(substr($service->code, 0, 3)) . '-' . date('YmdHis') . $rowNum);

            $csoClassRes = NakerVerificationService::classifyCso((string)($rawName ?: ''), $rawNik, $nakerCaches);
            if ($csoClassRes['is_naker_verified']) {
                $cleanName = $csoClassRes['clean_name'];
                $cleanNik  = $csoClassRes['nik'] ?: $cleanNik;
                $previewTl = $csoClassRes['team_leader_name'] ?: trim((string)$rawTl);
                $previewTrn = $csoClassRes['trainer_name'] ?: trim((string)$rawTrn);
                $rawSite   = $csoClassRes['site_name'] ?: ($rawSite ?? 'SMG');
            } else {
                $previewTl = trim((string)$rawTl);
                $previewTrn = trim((string)$rawTrn);
            }

            $rawCa = self::extractValue($row, ['Score CA', 'Nilai CA (%)', 'Nilai CA', 'CA Score', 'CA (%)', 'CA', 'score_ca', 'ca_score', 'Total Nilai CA', 'Nilai'], 90);
            $rawFcr = self::extractValue($row, ['FCR', 'Nilai FCR (%)', 'Nilai FCR', 'FCR (%)', 'fcr', 'First Call Resolution', 'Ket FCR'], 'YA');

            $cleanCa = is_numeric(str_replace(['%', ' ', ','], ['', '', '.'], (string)$rawCa))
                ? floatval(str_replace(['%', ' ', ','], ['', '', '.'], (string)$rawCa))
                : 90.0;

            $cleanFcr = strtoupper(trim((string)$rawFcr));
            if ($service->code === 'BACK_OFFICE' || $service->name === 'Back Office') {
                // Pada layanan Back Office (Eskalasi BO), FCR dinilai berdasarkan ketepatan eskalasi/SLA (CA >= 85%)
                if (!in_array($cleanFcr, ['YA', 'TIDAK']) || ($cleanFcr === 'TIDAK' && $cleanCa >= 85)) {
                    $cleanFcr = ($cleanCa >= 85) ? 'YA' : 'TIDAK';
                }
            } else {
                if (!in_array($cleanFcr, ['YA', 'TIDAK'])) {
                    $cleanFcr = ($cleanCa >= 85) ? 'YA' : 'TIDAK';
                }
            }

            // Duration
            $transDuration = self::parseDurationToSeconds(self::extractValue($row, ['Durasi Transaksi', 'durasi_transaksi', 'Transaction Duration', 'Durasi', 'AHT']));
            $sampDuration = self::parseDurationToSeconds(self::extractValue($row, ['Durasi Sampling', 'durasi_sampling', 'Sampling Duration', 'Durasi Observasi']));

            // Audit Validity
            $isValid = true;
            $errMsg = null;

            if ($isCrmRaw && self::isNoResponseCondition($rawSubCategory)) {
                $isValid = false;
                $errMsg = 'Kondisi: TIDAK ADA RESPON (Disaring, tidak perlu disampling).';
            } elseif (!$cleanName) {
                $isValid = false;
                $errMsg = 'Kolom Nama Agent kosong.';
            } elseif (!$isCrmRaw && ($cleanCa < 0 || $cleanCa > 100)) {
                $isValid = false;
                $errMsg = 'Score CA di luar batas 0-100%.';
            }

            // Check existing agent in DB for comparison
            $existing = $cleanNik ? ($existingAgentsByNik[strtolower($cleanNik)] ?? null) : null;
            if (!$existing && $cleanName) {
                $existing = $existingAgents[strtolower($cleanName)] ?? null;
            }
            $deltaCa = $existing ? round($cleanCa - (float)$existing->ca_score, 1) : null;
            $deltaFcr = $existing ? round((($cleanFcr === 'YA' ? 100 : 0) - (float)$existing->fcr_score), 1) : null;

            $status = 'Meet Target';
            if ($cleanCa >= 96) $status = 'Exceed Target';
            elseif ($cleanCa < 85) $status = 'Need Coaching';

            $rowType = 'new';
            $existingAssessmentId = $existingIdcas[$cleanIdca] ?? null;

            if (!$isValid) {
                $rowType = 'invalid';
                $invalidCount++;
            } elseif (in_array($cleanIdca, $seenIdcasInFile)) {
                $rowType = 'file_duplicate';
                $dupCount++;
            } elseif ($existingAssessmentId || $existing) {
                $rowType = 'update';
                $updateCount++;
            } else {
                $rowType = 'new';
                $newCount++;
            }

            $seenIdcasInFile[] = $cleanIdca;

            // Extract Dynamic Parameter Scores
            $parameterScores = [];
            foreach ($parameters as $param) {
                $paramVal = self::extractValue($row, [$param->code, 'Param ' . $param->code, 'Parameter ' . $param->code, 'Attribute ' . $param->code]);
                $numericScore = ($paramVal !== null && is_numeric($paramVal)) ? floatval($paramVal) : null;
                $parameterScores[$param->code] = [
                    'code' => $param->code,
                    'name' => $param->name,
                    'score' => $numericScore
                ];
            }

            // Resolve TL and Trainer fallback from NAKER for preview if not yet set
            if (($previewTl === '' || $previewTl === 'TL Umum') || ($previewTrn === '' || $previewTrn === 'TRN Umum')) {
                $normName = strtolower(str_replace(['.', ' ', '-', '_'], '', (string)$cleanName));
                $emp = \App\Models\Employee::where('sip_id', $cleanNik)
                    ->orWhere('sip_id', $cleanName)
                    ->orWhere('name', $cleanName)
                    ->orWhereRaw('REPLACE(REPLACE(LOWER(name), ".", ""), " ", "") = ?', [$normName])
                    ->orWhereRaw('REPLACE(REPLACE(LOWER(sip_id), ".", ""), " ", "") = ?', [$normName])
                    ->first();
                if ($emp) {
                    $asn = \App\Models\EmployeeAssignment::where('employee_id', $emp->id)->where('status', true)->with(['teamLeader', 'trainer'])->first();
                    if (($previewTl === '' || $previewTl === 'TL Umum') && $asn?->teamLeader?->name) {
                        $previewTl = $asn->teamLeader->name;
                    }
                    if (($previewTrn === '' || $previewTrn === 'TRN Umum') && $asn?->trainer?->name) {
                        $previewTrn = $asn->trainer->name;
                    }
                }
            }

            $parsed[] = [
                'row_index'                    => $rowNum,
                'idca'                         => $cleanIdca,
                'ticket_id'                    => $rawTicket,
                'name'                         => $cleanName ?: '(Tanpa Nama)',
                'agent_name'                   => $cleanName ?: '(Tanpa Nama)',
                'raw_agent'                    => $rawName ?: '(Tanpa Nama)',
                'nik'                          => $cleanNik,
                'is_naker_verified'            => $csoClassRes['is_naker_verified'],
                'cso_classification'           => $csoClassRes['classification'],
                'qa_name'                      => trim((string)$rawQa),
                'ca'                           => round($cleanCa, 1),
                'score_ca'                     => round($cleanCa, 1),
                'fcr'                          => $cleanFcr,
                'fcr_score'                    => ($cleanFcr === 'YA' ? 100 : 0),
                'channel'                      => ($isAuto && $rawSourceLayanan) ? $rawSourceLayanan : $service->name,
                'service_name'                 => ($isAuto && $rawSourceLayanan) ? $rawSourceLayanan : $service->name,
                'service_code'                 => $isAuto ? 'AUTO_CRM' : $service->code,
                // Roadmap V2 §23 — traceability fields
                'source_ca'                    => $rawSourceCa,
                'source_layanan'               => $rawSourceLayanan,
                'hashtag'                      => $rawHashtag,
                'ever_changed'                 => in_array(strtoupper(trim((string)($rawEverChanged ?? ''))), ['YA', '1', 'TRUE', 'YES']),
                'site'                         => $rawSite ?? 'SMG',
                'tl'                           => $previewTl ?: ($existing?->teamLeader?->name ?? 'TL Umum'),
                'trainer'                      => $previewTrn ?: ($existing?->trainer?->name ?? 'TRN Umum'),
                'status'                       => $status,
                'category'                     => $rawCategory,
                'sub_category'                 => $rawSubCategory,
                'platform'                     => self::extractValue($row, ['Platform', 'platform', 'Channel', 'Media']),
                'customer_name'                => $rawCustomer ?: self::extractValue($row, ['Pelanggan', 'customer_name', 'Customer', 'Nama Pelanggan', 'namapelanggan', 'nama_pelanggan']),
                'transaction_at'               => self::resolveRowDates($row, $cleanIdca)['transaction_at'],
                'measurement_at'               => self::resolveRowDates($row, $cleanIdca)['measurement_at'],
                'transaction_duration_seconds'  => $transDuration,
                'sampling_duration_seconds'     => $sampDuration,
                'recommendation'               => self::extractValue($row, ['Rekomendasi', 'recommendation', 'Saran']),
                'recommendation_note'           => self::extractValue($row, ['Ket Rekomendasi', 'recommendation_note', 'Catatan Rekomendasi']),
                'summary'                      => self::extractValue($row, ['Ket Summary', 'summary', 'Catatan', 'Kesimpulan']),
                'fcr_note'                     => self::extractValue($row, ['Ket FCR', 'fcr_note', 'Catatan FCR']),
                'row_type'                     => $rowType,
                'is_valid'                     => $isValid,
                'error_message'                => $errMsg,
                'delta_ca'                     => $deltaCa,
                'delta_fcr'                    => $deltaFcr,
                'existing_data'                => $existing ? [
                    'id'      => $existing->id,
                    'name'    => $existing->name,
                    'nik'     => $existing->nik,
                    'ca'      => (float)$existing->ca_score,
                    'fcr'     => (float)$existing->fcr_score,
                    'channel' => $existing->channel,
                    'tl'      => $existing->teamLeader ? $existing->teamLeader->name : 'TL Umum',
                    'trainer' => $existing->trainer ? $existing->trainer->name : 'TRN Umum',
                    'status'  => $existing->status,
                ] : null,
                'parameter_scores'             => $parameterScores
            ];
        }

        return [
            'success' => true,
            'service' => [
                'id' => $service->id,
                'code' => $isCrmRaw ? 'CRM_RAW' : ($isAuto ? 'AUTO_CRM' : $service->code),
                'name' => $isCrmRaw ? 'Tarikan CRM (Raw Ticketing)' : ($isAuto ? 'Auto (Multi-Channel CRM)' : $service->name),
                'parameter_count' => $parameters->count()
            ],
            'import_type' => $isCrmRaw ? 'CRM_RAW' : 'QSF',
            'naker_available' => $isNakerAvailable,
            'naker_count' => $nakerCount,
            'naker_warning' => $nakerWarning,
            'can_import' => $isCrmRaw || $isNakerAvailable,
            'summary' => [
                'total_rows' => count($parsed),
                'new_count' => $newCount,
                'update_count' => $updateCount,
                'file_duplicate_count' => $dupCount,
                'invalid_count' => $invalidCount,
                'valid_count' => count($parsed) - $invalidCount
            ],
            'parameters' => $parameters->map(fn($p) => ['code' => $p->code, 'name' => $p->name]),
            'items' => array_slice($parsed, 0, 100),
            'preview_items_count' => min(count($parsed), 100),
        ];
    }

    /**
     * Injeksi Data ke Database Relasional Sesuai Roadmap SQL (Mendukung Batch Processing)
     */
    public function import(array $rows, string $channelName = 'Inbound', string $fileName = 'Import.xlsx', string $importMode = 'upsert', $userId = null, array $batchOptions = [])
    {
        $isFirstBatch = $batchOptions['is_first_batch'] ?? true;
        $isLastBatch = $batchOptions['is_last_batch'] ?? true;
        $batchIndex = $batchOptions['batch_index'] ?? 1;
        $totalBatches = $batchOptions['total_batches'] ?? 1;
        $importId = $batchOptions['import_id'] ?? null;
        $totalExpectedRows = $batchOptions['total_expected_rows'] ?? count($rows);

        $service = self::detectService($channelName ?: $fileName);
        $isAutoChannel = ($channelName === 'Auto' || $channelName === 'AUTO' || empty($channelName) || $channelName === 'ALL' || $channelName === 'Otomatis');
        $importType = $batchOptions['import_type'] ?? (
            ($isAutoChannel || str_contains(strtolower($fileName), 'listticketing') || str_contains(strtolower($fileName), 'ticketingretail') || (str_contains(strtolower($fileName), 'retail') && !str_contains(strtolower($fileName), 'qsf')))
                ? 'CRM_RAW'
                : 'QSF'
        );
        $isCrmRaw = ($importType === 'CRM_RAW');

        // Validasi Wajib: Master Data NAKER harus sudah diunggah untuk impor QSF
        if (!$isCrmRaw && \App\Models\Employee::count() === 0) {
            throw new \InvalidArgumentException('Injeksi data QSF ditolak: Master Data NAKER belum diunggah ke sistem. Silakan unggah berkas Master NAKER terlebih dahulu pada menu Input/Setting sebelum mengimpor data QSF layanan.');
        }

        $site = Site::where('code', 'SMG')->first() ?? Site::create(['code' => 'SMG', 'name' => 'SEMARANG', 'status' => true]);
        $parameters = CaParameter::where('service_id', $service->id)->get()->keyBy('code');

        // 1. Create or Find Staging Header
        if ($isFirstBatch || !$importId) {
            $staging = SipImport::create([
                'file_name' => $fileName,
                'import_type' => $isCrmRaw ? 'CRM_RAW' : 'QSF',
                'service_id' => $service->id,
                'imported_by' => $userId,
                'total_rows' => $totalExpectedRows,
                'status' => 'processing',
                'started_at' => now(),
            ]);

            if ($importMode === 'replace_all') {
                DB::statement('SET FOREIGN_KEY_CHECKS=0;');
                CaAssessmentScore::truncate();
                CaAssessment::truncate();
                Agent::truncate();
                DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            } elseif ($importMode === 'replace_channel') {
                $assessIds = CaAssessment::where('service_id', $service->id)->pluck('id');
                CaAssessmentScore::whereIn('assessment_id', $assessIds)->delete();
                CaAssessment::where('service_id', $service->id)->delete();
                Agent::where('channel', $service->name)->delete();
            }
        } else {
            $staging = SipImport::find($importId) ?? SipImport::create([
                'file_name' => $fileName,
                'import_type' => $isCrmRaw ? 'CRM_RAW' : 'QSF',
                'service_id' => $service->id,
                'imported_by' => $userId,
                'total_rows' => $totalExpectedRows,
                'status' => 'processing',
                'started_at' => now(),
            ]);
        }

        $successRows = 0;
        $failedRows = 0;
        $updatedRows = 0;
        $distSummary = null;
        $autoDistMsg = '';

        // In-memory model caches to avoid thousands of repetitive SQL queries per batch
        $serviceCache = [];
        $tlCache = [];
        $trnCache = [];
        $categoryCache = [];
        $subCatCache = [];
        $platCache = [];
        $qaCache = [];
        $siteCache = [];
        $empBySipCache = [];
        $empByNameCache = [];
        $agentByNikCache = [];
        $agentByNameCache = [];
        $agentByNormNameCache = [];

        // Preload active employees for instant lookup
        $nakerCaches = NakerVerificationService::loadNakerCaches();
        $allEmployees = \App\Models\Employee::all();
        foreach ($allEmployees as $e) {
            if ($e->sip_id) $empBySipCache[strtolower(trim($e->sip_id))] = $e;
            if ($e->name) {
                $norm = strtolower(str_replace(['.', ' ', '-', '_'], '', trim($e->name)));
                $empByNameCache[$norm] = $e;
            }
        }

        $hasAgentSubChannel = \Illuminate\Support\Facades\Schema::hasColumn('agents', 'sub_channel');

        // Preload active agents for instant lookup and zero duplicate NIK violations
        $allAgents = Agent::with(['teamLeader', 'trainer'])->get();
        foreach ($allAgents as $a) {
            if ($a->nik) $agentByNikCache[strtolower(trim((string)$a->nik))] = $a;
            if ($a->name) {
                $agentByNameCache[strtolower(trim((string)$a->name))] = $a;
                $norm = strtolower(str_replace(['.', ' ', '-', '_'], '', trim((string)$a->name)));
                $agentByNormNameCache[$norm] = $a;
            }
        }

        DB::beginTransaction();
        try {
            $now = now();
            $paramScoresToUpsert = [];
            foreach ($rows as $idx => $row) {
                $rowNum = $idx + 1;

                // ── Skip baris tidak valid dari format QSF Excel ─────────────────
                $firstVal = trim((string)(reset($row) ?? ''));
                $agentVal = trim((string)(self::extractValue($row, ['Agent', 'agent', 'agent_name', 'Handling', 'handling', 'penerimalaporan']) ?? ''));
                if (strtolower($agentVal) === 'agent' || strtolower($firstVal) === 'no') continue;
                if (str_contains(strtolower($firstVal), 'rata') || str_contains(strtolower($firstVal), 'average') || str_contains(strtolower($firstVal), 'total')) continue;
                
                // Hanya periksa summary rows pada berkas QSF evaluasi (jangan skip pada raw CRM/Omni)
                if (!$isCrmRaw) {
                    $rawAgentChk = self::extractValue($row, ['Agent', 'Nama Agent', 'Nama Lengkap', 'Nama', 'agent_name', 'Handling', 'handling', 'penerimalaporan']);
                    $rawIdcaChk  = self::extractValue($row, ['IDCA', 'ID CA', 'ID_CA', 'idca', 'ticket_id', 'ticket', 'source_ca']);
                    if (!$rawAgentChk && !$rawIdcaChk && is_numeric($firstVal)) continue;
                }
                // ────────────────────────────────────────────────────────────────

                $rawName    = self::extractValue($row, ['agent_name', 'Agent', 'Nama Agent', 'Nama Lengkap', 'Nama', 'Agent Name', 'nama_agent', 'Handling', 'handling', 'raw_handling', 'Nama Petugas', 'User', 'Petugas', 'Karyawan', 'Pegawai', 'penerimalaporan', 'penerima_laporan', 'Penerima Laporan', 'Penerima', 'namapelapor']);
                $rawIdca    = self::extractValue($row, ['idca', 'IDCA', 'ID CA', 'ID_CA', 'No CA', 'No. CA', 'Kode CA', 'Assessment ID', 'ID_Assessment']);
                $rawTicket  = self::extractValue($row, ['ticket_id', 'Ticket', 'ticket', 'Ticket ID', 'ID Tiket', 'ID_Tiket', 'No Tiket', 'No. Tiket', 'Tiket', 'idtiket', 'id_tiket']);

                $rawNik     = self::extractValue($row, ['agent_nik', 'nik', 'NIK', 'employee_code', 'NIK Agent', 'ID Agent', 'NIP', 'idpelanggan', 'sidbaru']);
                $rawQa      = self::extractValue($row, ['qa_name', 'QA', 'Nama QA', 'Evaluator', 'Auditor', 'Nama Evaluator', 'Trainer', 'Penilai']);
                $rawTl      = self::extractValue($row, ['team_leader', 'Team Leader', 'Team Leader (TL)', 'TL', 'Nama TL', 'Supervisor', 'SPV']);
                $rawTrn     = self::extractValue($row, ['trainer', 'Trainer', 'Trainer Pengampu', 'Nama Trainer']);

                // Roadmap V2 §23 & Raw Ticketing — nilai asli dari kolom Excel untuk traceability
                $rawSourceCa      = self::extractValue($row, ['source_ca', 'icrm_ticket_id', 'icrm_ticket', 'idtiket', 'id_tiket', 'Note', 'note', 'CA', 'ca', 'IDCA', 'ID CA']);
                $rawSourceLayanan = self::extractValue($row, ['channel', 'Layanan', 'layanan', 'Service', 'Saluran', 'namasumber', 'nama_sumber', 'sumber', 'Channel']);
                $rawHashtag       = self::extractValue($row, ['Hashtag', 'hashtag', 'Tag', '#', 'Tags', 'tags']);
                $rawEverChanged   = self::extractValue($row, ['Pernah Diubah', 'pernah_diubah', 'Ever Changed', 'Changed']);
                $rawSiteCode      = self::extractValue($row, ['site_code', 'Site', 'site', 'Lokasi', 'SITE', 'namasbu', 'nama_sbu', 'namakp']);
                $rawCustomer      = self::extractValue($row, ['customer_name', 'Pelanggan', 'pelanggan', 'namapelanggan', 'nama_pelanggan', 'Customer', 'Customer Name', 'User', 'user', 'Name', 'name']);
                $rawPhone         = self::extractValue($row, ['customer_phone', 'Phone', 'phone', 'telppelanggan', 'telepon', 'Telepon', 'No Telepon', 'no_telepon', 'No. Telepon', 'No HP', 'no_hp']);
                $rawCategory      = self::extractValue($row, ['category', 'Category', 'namakelompok', 'nama_kelompok', 'Kelompok', 'Kategori', 'Jenis', 'Topic', 'Kelompok Gangguan'], 'GANGGUAN');
                $rawSubCategory   = self::extractValue($row, ['sub_category', 'namakondisi', 'nama_kondisi', 'namaKondisi', 'Nama Kondisi', 'Kondisi', 'kondisi', 'Sub Kategori', 'Subkategori', 'Sub Jenis', 'Sub Kategori Gangguan', 'Subject', 'subject', 'Klasifikasi', 'klasifikasi']);
                $rawSummary       = self::extractValue($row, ['issue_description', 'notes', 'Note', 'note', 'isiLaporan', 'keluhan', 'Ket Summary', 'summary', 'Catatan', 'Kesimpulan']);

                // Normalize Category prefix
                $catUpper = strtoupper(trim((string)$rawCategory));
                if (str_starts_with($catUpper, 'INFORMASI') || str_contains($catUpper, 'INFO')) $rawCategory = 'INFORMASI';
                elseif (str_starts_with($catUpper, 'GANGGUAN') || str_contains($catUpper, 'GGN') || str_contains($catUpper, 'INCIDENT')) $rawCategory = 'GANGGUAN';
                elseif (str_starts_with($catUpper, 'KELUHAN') || str_contains($catUpper, 'KOMPLAIN') || str_contains($catUpper, 'COMPLAINT')) $rawCategory = 'KELUHAN';
                elseif (str_starts_with($catUpper, 'PERMOHONAN') || str_contains($catUpper, 'REQUEST') || str_contains($catUpper, 'REGISTRASI')) $rawCategory = 'PERMOHONAN';

                // Channel resolution from namasumber / channel (Retail Ticketing & Omni)
                if ($rawSourceLayanan) {
                    $rawSourceLayanan = \App\Services\Sampling\AutoDistributionEngineService::resolveChannel($rawSourceLayanan);
                }

                $rowService = $service;
                if ($isAutoChannel && $rawSourceLayanan) {
                    $normLayanan = strtoupper(trim((string)$rawSourceLayanan));
                    if (!isset($serviceCache[$normLayanan])) {
                        $serviceCache[$normLayanan] = self::detectService($rawSourceLayanan);
                    }
                    $rowService = $serviceCache[$normLayanan];
                }

                if ($isCrmRaw && self::isNoResponseCondition($rawSubCategory)) {
                    $failedRows++;
                    continue;
                }

                if (!$rawName) {
                    $failedRows++;
                    continue;
                }

                // Resolve Site dari kolom Excel (Cached)
                $resolvedSiteId = $site->id;
                if ($rawSiteCode) {
                    $cleanSiteCode = strtoupper(trim((string)$rawSiteCode));
                    if (!isset($siteCache[$cleanSiteCode])) {
                        $siteCache[$cleanSiteCode] = Site::firstOrCreate(
                            ['code' => $cleanSiteCode],
                            ['name' => $cleanSiteCode, 'status' => true]
                        );
                    }
                    $resolvedSiteId = $siteCache[$cleanSiteCode]->id;
                }

                $cleanName = NakerVerificationService::cleanCsoName($rawName);
                $cleanNik = $rawNik ? trim((string)$rawNik) : ('AGT-' . strtoupper(substr(md5($cleanName), 0, 6)));
                $cleanIdca = $rawIdca ? trim((string)$rawIdca) : ('CA_' . strtoupper(substr($rowService->code, 0, 3)) . '-' . date('YmdHis') . $rowNum);

                $csoClassRes = NakerVerificationService::classifyCso($rawName, $cleanNik, $nakerCaches);
                $csoClassification = $csoClassRes['classification'];
                $isNakerVerified = $csoClassRes['is_naker_verified'];
                $finalSiteId = $csoClassRes['site_id'] ?: $resolvedSiteId;

                // Jika terverifikasi NAKER, standarisasi nama & NIK ke data resmi NAKER
                if ($isNakerVerified && !empty($csoClassRes['clean_name'])) {
                    $cleanName = $csoClassRes['clean_name'];
                    if (!empty($csoClassRes['nik'])) {
                        $cleanNik = $csoClassRes['nik'];
                    }
                }

                // Resolve TL & Trainer dari kolom Excel atau fallback ke Master Data NAKER
                $tl = null;
                $cleanTl = trim((string)$rawTl);
                if ($cleanTl !== '' && $cleanTl !== 'TL Umum') {
                    if (!isset($tlCache[$cleanTl])) {
                        $tlCache[$cleanTl] = TeamLeader::firstOrCreate(
                            ['name' => $cleanTl],
                            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $tl = $tlCache[$cleanTl];
                } elseif ($csoClassRes['team_leader_name'] && $csoClassRes['team_leader_name'] !== 'TL Umum') {
                    $tlName = trim($csoClassRes['team_leader_name']);
                    if (!isset($tlCache[$tlName])) {
                        $tlCache[$tlName] = TeamLeader::firstOrCreate(
                            ['name' => $tlName],
                            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $tl = $tlCache[$tlName];
                }

                $trn = null;
                $cleanTrn = trim((string)$rawTrn);
                if ($cleanTrn !== '' && $cleanTrn !== 'TRN Umum') {
                    if (!isset($trnCache[$cleanTrn])) {
                        $trnCache[$cleanTrn] = Trainer::firstOrCreate(
                            ['name' => $cleanTrn],
                            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $trn = $trnCache[$cleanTrn];
                } elseif ($csoClassRes['trainer_name'] && $csoClassRes['trainer_name'] !== 'TRN Umum') {
                    $trnName = trim($csoClassRes['trainer_name']);
                    if (!isset($trnCache[$trnName])) {
                        $trnCache[$trnName] = Trainer::firstOrCreate(
                            ['name' => $trnName],
                            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $trn = $trnCache[$trnName];
                }

                // Fallback ke Master Data NAKER jika TL atau Trainer belum terisi
                $resolvedEmployee = $csoClassRes['employee'] ?? null;
                $normalizedAgentName = strtolower(str_replace(['.', ' ', '-', '_'], '', $cleanName));
                if ((!$tl || !$trn) && !$resolvedEmployee) {
                    $resolvedEmployee = $empBySipCache[$normalizedAgentName] ?? ($empByNameCache[$normalizedAgentName] ?? null);

                    if ($resolvedEmployee) {
                        $nakerAssign = \App\Models\EmployeeAssignment::where('employee_id', $resolvedEmployee->id)
                            ->where('status', true)
                            ->with(['teamLeader', 'trainer'])
                            ->first();

                        if (!$tl && $nakerAssign?->teamLeader?->name) {
                            $tlName = trim($nakerAssign->teamLeader->name);
                            if (!isset($tlCache[$tlName])) {
                                $tlCache[$tlName] = TeamLeader::firstOrCreate(
                                    ['name' => $tlName],
                                    ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                                );
                            }
                            $tl = $tlCache[$tlName];
                        }

                        if (!$trn && $nakerAssign?->trainer?->name) {
                            $trnName = trim($nakerAssign->trainer->name);
                            if (!isset($trnCache[$trnName])) {
                                $trnCache[$trnName] = Trainer::firstOrCreate(
                                    ['name' => $trnName],
                                    ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                                );
                            }
                            $trn = $trnCache[$trnName];
                        }

                        if ($resolvedEmployee->sip_id && (str_starts_with($cleanNik, 'AGT-') || empty($cleanNik))) {
                            $cleanNik = $resolvedEmployee->sip_id;
                        }
                    }
                }

                // Find or create Agent safely (Zero Duplicate NIK error)
                $agent = null;
                $nikKey = strtolower(trim((string)$cleanNik));
                $nameKey = strtolower(trim((string)$cleanName));
                $normNameKey = strtolower(str_replace(['.', ' ', '-', '_'], '', trim((string)$cleanName)));

                if ($nikKey !== '' && !str_starts_with($cleanNik, 'AGT-') && isset($agentByNikCache[$nikKey])) {
                    $agent = $agentByNikCache[$nikKey];
                }
                if (!$agent && isset($agentByNameCache[$nameKey])) {
                    $agent = $agentByNameCache[$nameKey];
                }
                if (!$agent && isset($agentByNormNameCache[$normNameKey])) {
                    $agent = $agentByNormNameCache[$normNameKey];
                }

                $resolvedRowDates = self::resolveRowDates($row, $cleanIdca);
                $rowPeriodMonth = substr($resolvedRowDates['measurement_at'] ?? $resolvedRowDates['transaction_at'] ?? '2026-08', 0, 7);

                if (!$agent) {
                    // Cek jika NIK atau Name sudah ada di database
                    if ($nikKey !== '' && !str_starts_with($cleanNik, 'AGT-') && Agent::whereRaw('LOWER(nik) = ?', [$nikKey])->exists()) {
                        $agent = Agent::whereRaw('LOWER(nik) = ?', [$nikKey])->first();
                    } elseif (Agent::where('name', $cleanName)->exists()) {
                        $agent = Agent::where('name', $cleanName)->first();
                    } elseif ($normNameKey !== '' && Agent::whereRaw('REPLACE(REPLACE(LOWER(name), ".", ""), " ", "") = ?', [$normNameKey])->exists()) {
                        $agent = Agent::whereRaw('REPLACE(REPLACE(LOWER(name), ".", ""), " ", "") = ?', [$normNameKey])->first();
                    } else {
                        // Pastikan NIK yang akan di-insert belum pernah terpakai
                        $finalNik = $cleanNik;
                        if (Agent::where('nik', $finalNik)->exists()) {
                            $finalNik = 'AGT-' . strtoupper(substr(md5($cleanName . microtime()), 0, 8));
                        }
                        $subChannel = $resolvedEmployee?->currentAssignment?->sub_service ?? $resolvedEmployee?->sub_service;
                        $agentPayload = [
                            'name'               => $cleanName,
                            'nik'                => $finalNik,
                            'channel'            => $rowService->name,
                            'period_month'       => $rowPeriodMonth,
                            'team_leader_id'     => $tl ? $tl->id : null,
                            'trainer_id'         => $trn ? $trn->id : null,
                            'site_id'            => $finalSiteId,
                            'cso_classification' => $csoClassification,
                            'is_naker_verified'  => $isNakerVerified,
                            'ca_score'           => 90.0,
                            'fcr_score'          => 85.0,
                            'evaluation_count'   => 1,
                            'status'             => 'Meet Target',
                            'source_role'        => 'supervisor',
                            'imported_by'        => 'Supervisor'
                        ];
                        if ($hasAgentSubChannel && $subChannel) {
                            $agentPayload['sub_channel'] = $subChannel;
                        }
                        $agent = Agent::create($agentPayload);
                    }

                    if ($agent) {
                        if ($agent->nik) $agentByNikCache[strtolower(trim((string)$agent->nik))] = $agent;
                        if ($agent->name) {
                            $agentByNameCache[strtolower(trim((string)$agent->name))] = $agent;
                            $agentByNameCache[$nameKey] = $agent;
                            $agentByNormNameCache[$normNameKey] = $agent;
                        }
                    }
                }

                if ($agent) {
                    $subChannel = $resolvedEmployee?->currentAssignment?->sub_service ?? $resolvedEmployee?->sub_service;
                    $agentUpdates = [
                        'cso_classification' => $csoClassification,
                        'is_naker_verified'  => $isNakerVerified,
                        'site_id'            => $finalSiteId ?: $agent->site_id,
                    ];
                    if ($isNakerVerified && !empty($cleanName) && $agent->name !== $cleanName) {
                        $agentUpdates['name'] = $cleanName;
                    }
                    if ($isNakerVerified && !empty($cleanNik) && !str_starts_with($cleanNik, 'AGT-') && $agent->nik !== $cleanNik) {
                        // Jika NIK belum dipakai agent lain, update
                        if (!Agent::where('nik', $cleanNik)->where('id', '!=', $agent->id)->exists()) {
                            $agentUpdates['nik'] = $cleanNik;
                        }
                    }
                    if ($hasAgentSubChannel && $subChannel && !($agent->sub_channel ?? null)) {
                        $agentUpdates['sub_channel'] = $subChannel;
                    }
                    if ($tl && $agent->team_leader_id !== $tl->id) {
                        $agentUpdates['team_leader_id'] = $tl->id;
                    }
                    if ($trn && $agent->trainer_id !== $trn->id) {
                        $agentUpdates['trainer_id'] = $trn->id;
                    }
                    if ($resolvedEmployee && $resolvedEmployee->sip_id && str_starts_with((string)$agent->nik, 'AGT-')) {
                        if (!Agent::where('nik', $resolvedEmployee->sip_id)->where('id', '!=', $agent->id)->exists()) {
                            $agentUpdates['nik'] = $resolvedEmployee->sip_id;
                        }
                    }
                    if (!empty($agentUpdates)) {
                        $agent->update($agentUpdates);
                    }
                }

                // Find or create Category & Sub Category (Cached)
                $catName = $rawCategory ?: self::extractValue($row, ['namakelompok', 'nama_kelompok', 'Kelompok', 'Kategori', 'category', 'Jenis', 'Topic', 'Kelompok Gangguan'], 'GANGGUAN');
                $trimCat = trim((string)$catName);
                if (!isset($categoryCache[$trimCat])) {
                    $categoryCache[$trimCat] = Category::firstOrCreate(
                        ['service_id' => $rowService->id, 'name' => $trimCat],
                        ['code' => strtoupper(substr($trimCat, 0, 3)), 'status' => true]
                    );
                }
                $category = $categoryCache[$trimCat];

                $subCatId = null;
                $rawSubCat = $rawSubCategory ?: self::extractValue($row, ['namakondisi', 'nama_kondisi', 'Kondisi', 'Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'Sub Kategori Gangguan']);
                if ($rawSubCat) {
                    $trimSubCat = trim((string)$rawSubCat);
                    $subKey = $category->id . '_' . $trimSubCat;
                    if (!isset($subCatCache[$subKey])) {
                        $subCatCache[$subKey] = SubCategory::firstOrCreate(
                            ['category_id' => $category->id, 'name' => $trimSubCat],
                            ['status' => true]
                        );
                    }
                    $subCatId = $subCatCache[$subKey]->id;
                }

                // Platform (Cached)
                $platId = null;
                $rawPlat = self::extractValue($row, ['Platform', 'platform', 'Channel', 'Media']);
                if ($rawPlat) {
                    $trimPlat = trim((string)$rawPlat);
                    if (!isset($platCache[$trimPlat])) {
                        $platCache[$trimPlat] = Platform::firstOrCreate(
                            ['name' => $trimPlat],
                            ['service_id' => $rowService->id, 'status' => true]
                        );
                    }
                    $platId = $platCache[$trimPlat]->id;
                }

                // QA User (Cached with smart alias & zero-duplicate-key safety)
                $cleanQa = trim((string)$rawQa) ?: 'QA.INBOUND';
                $qaKey = strtolower(preg_replace('/[^a-z0-9]/', '', $cleanQa));

                if (!isset($qaCache[$qaKey])) {
                    $qaNameDots = str_replace(' ', '.', $cleanQa);
                    $qaNameSpaces = str_replace('.', ' ', $cleanQa);
                    $qaUsername = strtolower(Str::slug($cleanQa, '.'));
                    $qaUsernameNoDots = strtolower(preg_replace('/[^a-z0-9]/', '', $cleanQa));
                    $qaEmail = ($qaUsername ?: 'qa.' . $qaKey) . '@digiqa.id';

                    // 1. Look up existing user by name (exact, with dots, or with spaces), username, or email
                    $qaUser = User::where('name', $cleanQa)
                        ->orWhere('name', $qaNameDots)
                        ->orWhere('name', $qaNameSpaces)
                        ->orWhere('username', $qaUsername)
                        ->orWhere('username', $qaUsernameNoDots)
                        ->orWhere('email', $qaEmail)
                        ->orWhereRaw('REPLACE(REPLACE(REPLACE(LOWER(name), ".", ""), " ", ""), "_", "") = ?', [$qaKey])
                        ->first();

                    if ($qaUser) {
                        if (!in_array($qaUser->role, ['quality_assurance', 'supervisor', 'admin'])) {
                            $qaUser->update(['role' => 'quality_assurance']);
                        }
                    } else {
                        $finalUsername = $qaUsername ?: ('qa.' . $qaKey);
                        $counter = 1;
                        while (User::where('username', $finalUsername)->orWhere('email', $finalUsername . '@digiqa.id')->exists()) {
                            $finalUsername = ($qaUsername ?: ('qa.' . $qaKey)) . $counter;
                            $counter++;
                        }
                        $finalEmail = $finalUsername . '@digiqa.id';

                        $qaUser = User::create([
                            'name'     => $cleanQa,
                            'username' => $finalUsername,
                            'email'    => $finalEmail,
                            'password' => \Illuminate\Support\Facades\Hash::make('password'),
                            'role'     => 'quality_assurance',
                            'status'   => 'active'
                        ]);
                    }

                    $qaCache[$qaKey] = $qaUser;
                    $qaCache[$cleanQa] = $qaUser;
                    $qaCache[strtolower($cleanQa)] = $qaUser;
                    $qaCache[strtolower($qaNameDots)] = $qaUser;
                    $qaCache[strtolower($qaNameSpaces)] = $qaUser;
                }
                $qaUser = $qaCache[$qaKey];

                // Scores & Durations
                $rawCa = self::extractValue($row, ['Score CA', 'Nilai CA (%)', 'Nilai CA', 'CA Score', 'CA (%)', 'CA', 'score_ca', 'ca_score', 'Total Nilai CA', 'Nilai'], 90);
                $cleanCa = is_numeric(str_replace(['%', ' ', ','], ['', '', '.'], (string)$rawCa))
                    ? floatval(str_replace(['%', ' ', ','], ['', '', '.'], (string)$rawCa))
                    : 90.0;

                $rawFcr = self::extractValue($row, ['FCR', 'Nilai FCR (%)', 'Nilai FCR', 'FCR (%)', 'fcr', 'First Call Resolution', 'Ket FCR'], 'YA');
                $cleanFcr = strtoupper(trim((string)$rawFcr));
                if (!in_array($cleanFcr, ['YA', 'TIDAK'])) {
                    $cleanFcr = ($cleanCa >= 85) ? 'YA' : 'TIDAK';
                }

                $transDuration = self::parseDurationToSeconds(self::extractValue($row, ['Durasi Transaksi', 'durasi_transaksi', 'Transaction Duration', 'Durasi', 'AHT']));
                $sampDuration = self::parseDurationToSeconds(self::extractValue($row, ['Durasi Sampling', 'durasi_sampling', 'Sampling Duration', 'Durasi Observasi']));

                // Lookup employee ID
                $resolvedEmployeeId = $resolvedEmployee?->id;
                if (!$resolvedEmployeeId) {
                    $matchedEmp = $empBySipCache[$normalizedAgentName] ?? ($empByNameCache[$normalizedAgentName] ?? null);
                    $resolvedEmployeeId = $matchedEmp?->id;
                }

                if (!$rawIdca && $rawTicket) {
                    $cleanIdca = 'CA-' . $rawTicket;
                }

                // Upsert Assessment Transaction Record
                $matchKey = ['idca' => $cleanIdca];
                if ($rawTicket) {
                    $existingTkt = CaAssessment::where('ticket_id', $rawTicket)->first();
                    if ($existingTkt) {
                        $matchKey = ['id' => $existingTkt->id];
                    } elseif ($isCrmRaw) {
                        $matchKey = ['ticket_id' => $rawTicket];
                    }
                }

                $assessment = CaAssessment::updateOrCreate(
                    $matchKey,
                    [
                        'idca'                         => $cleanIdca,
                        'ticket_id'                    => $rawTicket,
                        'site_id'                      => $finalSiteId,
                        'service_id'                   => $rowService->id,
                        'category_id'                  => $category->id,
                        'sub_category_id'              => $subCatId,
                        'platform_id'                  => $platId,
                        'agent_id'                     => $agent->id,
                        'employee_id'                  => $csoClassRes['employee_id'] ?: $resolvedEmployeeId,
                        'cso_classification'           => $csoClassification,
                        'is_naker_verified'            => $isNakerVerified,
                        'qa_id'                        => $qaUser->id,
                        'agent_name'                   => $agent->name,
                        'qa_name'                      => $qaUser->name,
                        'customer_name'                => $rawCustomer ?: self::extractValue($row, ['Pelanggan', 'customer_name', 'Customer', 'Nama Pelanggan', 'namapelanggan', 'nama_pelanggan']),
                        'transaction_at'               => $resolvedRowDates['transaction_at'],
                        'measurement_at'               => $resolvedRowDates['measurement_at'],
                        'transaction_duration_seconds' => $transDuration,
                        'sampling_duration_seconds'    => $sampDuration,
                        'fcr'                          => $isCrmRaw ? null : $cleanFcr,
                        'fcr_note'                     => self::extractValue($row, ['Ket FCR', 'fcr_note', 'Catatan FCR']),
                        'source_ca'                    => $rawSourceCa,
                        'source_layanan'               => $rawSourceLayanan,
                        'hashtag'                      => $rawHashtag,
                        'ever_changed'                 => in_array(strtoupper(trim((string)($rawEverChanged ?? ''))), ['YA', '1', 'TRUE', 'YES']),
                        'score_ca'                     => $isCrmRaw ? null : $cleanCa,
                        'summary'                      => $rawSummary ?: self::extractValue($row, ['Ket Summary', 'summary', 'Catatan', 'Kesimpulan']),
                        'recommendation'               => self::extractValue($row, ['Rekomendasi', 'recommendation', 'Saran']),
                        'recommendation_note'          => self::extractValue($row, ['Ket Rekomendasi', 'recommendation_note', 'Catatan Rekomendasi']),
                        'source'                       => $isCrmRaw ? 'CRM_RAW' : 'QSF',
                        'source_system'                => $isCrmRaw ? 'CRM_RAW' : 'QSF',
                        'source_file'                  => $fileName,
                        'imported_at'                  => now(),
                    ]
                );

                // Collect Dynamic Parameter Scores for bulk upsert (only for evaluated QSF)
                if (!$isCrmRaw) {
                    foreach ($parameters as $paramCode => $paramModel) {
                        $scoreVal = self::extractValue($row, [$paramCode, 'Param ' . $paramCode, 'Parameter ' . $paramCode, 'Attribute ' . $paramCode]);
                        if ($scoreVal !== null && is_numeric($scoreVal)) {
                            $paramScoresToUpsert[] = [
                                'assessment_id' => $assessment->id,
                                'parameter_id'  => $paramModel->id,
                                'score'         => floatval($scoreVal),
                                'note'          => null,
                                'created_at'    => $now,
                                'updated_at'    => $now,
                            ];
                        }
                    }
                }

                $successRows++;
            }

            // Bulk upsert all collected parameter scores in chunks (O(1) database trips)
            if (!empty($paramScoresToUpsert)) {
                foreach (array_chunk($paramScoresToUpsert, 500) as $scoreChunk) {
                    CaAssessmentScore::upsert(
                        $scoreChunk,
                        ['assessment_id', 'parameter_id'],
                        ['score', 'note', 'updated_at']
                    );
                }
            }

            // Increment staging stats for this batch
            $staging->increment('success_rows', $successRows);
            $staging->increment('failed_rows', $failedRows);

            if ($isLastBatch) {
                // Recalculate Agent Rollup Scores with single aggregated query (Fast O(1) trip - strictly matang QSF data)
                $agentAggregates = CaAssessment::selectRaw("
                    agent_id,
                    AVG(score_ca) as avg_ca,
                    COUNT(*) as total_eval,
                    SUM(CASE WHEN UPPER(TRIM(fcr)) = 'YA' THEN 1 ELSE 0 END) as fcr_yes_count
                ")
                ->where('source', 'QSF')
                ->whereNotNull('score_ca')
                ->whereNotNull('agent_id')
                ->where(function ($q) {
                    $q->whereNotNull('measurement_at')
                      ->orWhereNotNull('transaction_at');
                })
                ->groupBy('agent_id')
                ->get();

                foreach ($agentAggregates as $agg) {
                    $avgCa = (float)$agg->avg_ca;
                    $totalEval = (int)$agg->total_eval;
                    $avgFcr = $totalEval > 0 ? (($agg->fcr_yes_count / $totalEval) * 100) : 0;

                    $status = 'Meet Target';
                    if ($avgCa >= 96) $status = 'Exceed Target';
                    elseif ($avgCa < 85) $status = 'Need Coaching';

                    Agent::where('id', $agg->agent_id)->update([
                        'ca_score'         => round($avgCa, 1),
                        'fcr_score'        => round($avgFcr, 1),
                        'evaluation_count' => $totalEval,
                        'status'           => $status
                    ]);
                }

                // Reset agents without evaluations
                Agent::whereNotIn('id', $agentAggregates->pluck('agent_id'))->update([
                    'evaluation_count' => 0
                ]);

                // Recalculate Monthly Trends dynamically per period strictly from matang assessments
                $distinctPeriods = CaAssessment::where('source', 'QSF')
                    ->whereNotNull('score_ca')
                    ->where(function ($q) {
                        $q->whereNotNull('measurement_at')
                          ->orWhereNotNull('transaction_at');
                    })
                    ->selectRaw("
                        LEFT(COALESCE(measurement_at, transaction_at), 7) as period,
                        COUNT(id) as total_calls,
                        ROUND(AVG(score_ca), 1) as avg_ca,
                        ROUND(SUM(CASE WHEN UPPER(fcr) = 'YA' THEN 100 ELSE 0 END) / NULLIF(SUM(CASE WHEN UPPER(fcr) IN ('YA', 'TIDAK') THEN 1 ELSE 0 END), 0), 1) as avg_fcr
                    ")
                    ->groupBy(DB::raw("LEFT(COALESCE(measurement_at, transaction_at), 7)"))
                    ->get();

                $monthNamesMap = [
                    1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr',
                    5 => 'Mei', 6 => 'Jun', 7 => 'Jul', 8 => 'Agu',
                    9 => 'Sep', 10 => 'Okt', 11 => 'Nov', 12 => 'Des'
                ];

                foreach ($distinctPeriods as $dp) {
                    if (!$dp->period) continue;
                    $parts = explode('-', $dp->period);
                    $y = (int)($parts[0] ?? 2026);
                    $m = (int)($parts[1] ?? 8);

                    MonthlyTrend::updateOrCreate(
                        ['year' => $y, 'month_num' => $m],
                        [
                            'month_name'  => $monthNamesMap[$m] ?? "M$m",
                            'ca_score'    => (float)$dp->avg_ca,
                            'fcr_score'   => $dp->avg_fcr !== null ? (float)$dp->avg_fcr : 0.0,
                            'total_calls' => (int)$dp->total_calls,
                        ]
                    );
                }

                // Complete Staging Header
                $staging->update([
                    'status'       => 'completed',
                    'completed_at' => now(),
                ]);

                // Auto-sync any unlinked agent TL & Trainer from NAKER data
                self::syncAllAgentsFromNaker();
                \App\Services\Sampling\NakerVerificationService::syncAllAssessmentsClassification();

                \App\Services\NotificationService::send([
                    'title'      => "ETL QSF [{$service->name}] Selesai",
                    'message'    => "Berhasil memproses {$staging->success_rows} assessment. Data tersimpan di pool cadangan dan siap didistribusikan melalui menu Auto Distribution.",
                    'type'       => 'import',
                    'action_url' => '/auto-distribution',
                ]);
            }

            DB::commit();

            $finalMessage = $isLastBatch
                ? "Berhasil menginjeksi seluruh batch ({$staging->success_rows} transaksi) assessment {$service->name}. Data siap dialokasikan melalui menu Auto Distribution."
                : "Batch {$batchIndex}/{$totalBatches} berhasil diinjeksi ({$successRows} baris).";

            return [
                'success'            => true,
                'message'            => $finalMessage,
                'service'            => $service->name,
                'batch_index'        => $batchIndex,
                'total_batches'      => $totalBatches,
                'is_last_batch'      => $isLastBatch,
                'import_id'          => $staging->id,
                'batch_success_rows' => $successRows,
                'batch_failed_rows'  => $failedRows,
                'total_success_rows' => $staging->success_rows,
                'total_failed_rows'  => $staging->failed_rows,
                'auto_distribution'  => $distSummary,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            $staging->update([
                'status'       => 'failed',
                'completed_at' => now(),
            ]);

            throw $e;
        }
    }

    /**
     * Sinkronisasi seluruh Agen dengan Master Data Penugasan NAKER (TL & Trainer)
     */
    public static function syncAllAgentsFromNaker(): int
    {
        return \App\Services\Sampling\NakerVerificationService::syncAllAgentsFromNaker();
    }

    /**
     * Helper untuk mendeteksi kondisi tiket 'TIDAK ADA RESPON'
     */
    public static function isNoResponseCondition(?string $val): bool
    {
        if (!$val) return false;
        $str = strtoupper(trim($val));
        return $str === 'TIDAK ADA RESPON'
            || str_contains($str, 'TIDAK ADA RESPON')
            || str_contains($str, 'NO RESPONSE')
            || str_contains($str, 'NO RESPON')
            || str_contains($str, 'TIDAK RESPON')
            || str_contains($str, 'TIDAK DIRESPON')
            || str_contains($str, 'TIDAK_ADA_RESPON')
            || str_contains($str, 'UNRESPONSIVE');
    }
}
