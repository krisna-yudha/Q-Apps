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
     * Konversi format tanggal excel atau text menjadi datetime valid
     */
    public static function parseDateTime($val): ?string
    {
        if ($val === null || $val === '') return null;
        
        // Handle Excel numeric serial timestamp (e.g. 45507 or 45507.45)
        if (is_numeric($val) && (float)$val > 30000 && (float)$val < 60000) {
            try {
                $seconds = ((float)$val - 25569) * 86400;
                return Carbon::createFromTimestampUTC((int)$seconds)->toDateTimeString();
            } catch (\Exception $e) {
                // fallback
            }
        }

        try {
            return Carbon::parse($val)->toDateTimeString();
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
            'Tgl Transaksi', 'Tanggal Transaksi', 'Transaction Date', 'tgl_transaksi', 'tanggal_transaksi',
            'waktulapor', 'waktu_lapor', 'waktugangguan', 'waktu_gangguan', 'tanggalinsiden', 'tanggal_insiden',
            'tgl_tx', 'tx_date', 'date', 'waktu_mulai', 'waktumulai', 'transaction_at'
        ];
        $msKeys = [
            'Tgl Ukur', 'Tanggal Ukur', 'Measurement Date', 'tgl_ukur', 'tanggal_ukur',
            'waktulaporanselesai', 'waktu_laporan_selesai', 'waktugangguanselesai', 'waktu_gangguan_selesai',
            'tgl_selesai', 'waktu_selesai', 'measurement_at'
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

        // 1. Email Outbound (Email Outbond)
        if (str_contains($lower, 'email outbound') || str_contains($lower, 'email outbond') || str_contains($lower, 'email_outbound') || str_contains($lower, 'email_outbond')) {
            return self::getOrCreateCanonicalService('EMAIL_OUTBOUND', 'Email Outbound', 'Email_Outbound');
        }

        // 2. Outbound Call (Outbond Call / Outbound Reguler)
        if (str_contains($lower, 'outbound call') || str_contains($lower, 'outbond call') || str_contains($lower, 'outbound_call') || str_contains($lower, 'outbond_call') || str_contains($lower, 'outbound reguler') || str_contains($lower, 'outbond reguler') || str_contains($lower, 'outbound') || str_contains($lower, 'outbond')) {
            return self::getOrCreateCanonicalService('OUTBOUND_CALL', 'Outbound Call', 'Outbound_Call');
        }

        // 3. Email (QSF - EMAIL.xlsx / Email Inbound)
        if (str_contains($lower, 'email')) {
            return self::getOrCreateCanonicalService('EMAIL_INBOUND', 'Email', 'Email_Inbound');
        }

        // 4. Back Office
        if (str_contains($lower, 'back office') || str_contains($lower, 'backoffice') || str_contains($lower, 'eskalasi bo') || str_contains($lower, 'eskalasi_bo') || str_contains($lower, 'back_office') || $lower === 'bo' || str_contains($lower, 'eskalasi')) {
            return self::getOrCreateCanonicalService('BACK_OFFICE', 'Back Office', 'Ketepatan Eskalasi BO');
        }

        // 5. Digilive
        if (str_contains($lower, 'digilive') || str_contains($lower, 'live chat') || str_contains($lower, 'livechat') || str_contains($lower, 'chat')) {
            return self::getOrCreateCanonicalService('DIGILIVE', 'Digilive', 'Digilive');
        }

        // 6. Socmed
        if (str_contains($lower, 'socmed') || str_contains($lower, 'sosmed') || str_contains($lower, 'social') || str_contains($lower, 'instagram') || str_contains($lower, 'whatsapp') || str_contains($lower, 'twitter') || str_contains($lower, 'facebook')) {
            return self::getOrCreateCanonicalService('SOCMED', 'Socmed', 'Socmed');
        }

        // 7. Inbound Call
        if (str_contains($lower, 'inbound') || str_contains($lower, 'inbond') || str_contains($lower, 'voice') || str_contains($lower, 'call') || str_contains($lower, 'retail')) {
            return self::getOrCreateCanonicalService('INBOUND', 'Inbound', 'Inbound');
        }

        // 8. Content inspection jika nama file umum (misal Report.xlsx)
        if (!empty($sampleRow)) {
            $ca = strtolower(trim((string)self::extractValue($sampleRow, ['CA', 'Layanan', 'Channel', 'service', 'namasumber'])));
            if (str_contains($ca, 'email outbound') || str_contains($ca, 'email outbond')) return self::getOrCreateCanonicalService('EMAIL_OUTBOUND', 'Email Outbound');
            if (str_contains($ca, 'outbound call') || str_contains($ca, 'outbond call') || str_contains($ca, 'outbound reguler') || str_contains($ca, 'outbond reguler') || str_contains($ca, 'outbound') || str_contains($ca, 'outbond')) return self::getOrCreateCanonicalService('OUTBOUND_CALL', 'Outbound Call');
            if (str_contains($ca, 'email')) return self::getOrCreateCanonicalService('EMAIL_INBOUND', 'Email');
            if (str_contains($ca, 'back office') || str_contains($ca, 'backoffice') || str_contains($ca, 'eskalasi') || str_contains($ca, 'bo')) return self::getOrCreateCanonicalService('BACK_OFFICE', 'Back Office');
            if (str_contains($ca, 'digilive') || str_contains($ca, 'chat')) return self::getOrCreateCanonicalService('DIGILIVE', 'Digilive');
            if (str_contains($ca, 'socmed') || str_contains($ca, 'sosmed')) return self::getOrCreateCanonicalService('SOCMED', 'Socmed');
            if (str_contains($ca, 'inbound') || str_contains($ca, 'inbond') || str_contains($ca, 'voice') || str_contains($ca, 'call')) return self::getOrCreateCanonicalService('INBOUND', 'Inbound');
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
    public function preview(array $rows, string $channelName = 'Inbound', string $fileName = 'Import.xlsx')
    {
        $service = self::detectService($channelName ?: $fileName);
        $site = Site::firstOrCreate(['code' => 'SMG'], ['name' => 'SEMARANG', 'status' => true]);
        $parameters = CaParameter::where('service_id', $service->id)->orderBy('sequence')->get();

        $existingIdcas = CaAssessment::pluck('id', 'idca')->toArray();
        $existingAgents = Agent::with(['teamLeader', 'trainer'])->get()->keyBy(function ($a) {
            return strtolower(trim($a->name));
        });

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
            $rawSourceCa      = self::extractValue($row, ['CA', 'ca', 'namakelompok']);
            $rawSourceLayanan = self::extractValue($row, ['Layanan', 'layanan', 'Service', 'Saluran', 'namasumber', 'nama_sumber', 'sumber', 'Channel', 'channel']);
            $rawHashtag       = self::extractValue($row, ['Hashtag', 'hashtag', 'Tag', '#']);
            $rawEverChanged   = self::extractValue($row, ['Pernah Diubah', 'pernah_diubah', 'Ever Changed', 'Changed']);
            $rawSite          = self::extractValue($row, ['Site', 'site', 'Lokasi', 'SITE', 'namasbu', 'nama_sbu', 'namakp']);
            $rawCustomer      = self::extractValue($row, ['Pelanggan', 'pelanggan', 'namapelanggan', 'nama_pelanggan', 'Customer', 'Customer Name']);
            $rawCategory      = self::extractValue($row, ['Kategori', 'category', 'Jenis', 'Topic', 'namakelompok', 'nama_kelompok', 'Kelompok'], 'GANGGUAN');
            $rawSubCategory   = self::extractValue($row, ['Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'namakondisi', 'nama_kondisi', 'Kondisi']);

            // Channel resolution from namasumber (Retail Ticketing)
            if ($rawSourceLayanan) {
                $sUpper = strtoupper(trim((string)$rawSourceLayanan));
                if ($sUpper === 'PHONE' || str_contains($sUpper, 'VOICE') || str_contains($sUpper, 'CALL')) $rawSourceLayanan = 'Inbound';
                elseif (str_contains($sUpper, 'LIVE CHAT') || str_contains($sUpper, 'CHATBOT') || str_contains($sUpper, 'MY ICON+')) $rawSourceLayanan = 'Digilive';
                elseif (str_contains($sUpper, 'INSTAGRAM') || str_contains($sUpper, 'WHATSAPP') || str_contains($sUpper, 'SOCMED')) $rawSourceLayanan = 'Socmed';
                elseif (str_contains($sUpper, 'EMAIL')) $rawSourceLayanan = 'Email';
                elseif (str_contains($sUpper, 'INTERNAL')) $rawSourceLayanan = 'Back Office';
            }

            // Clean agent name (strip CSO.02, BO.01 prefixes)
            $cleanName = $rawName ? preg_replace('/^(CSO\.\d+|BO\.\d+|KOOPS\.\d+|QA\.\d+|TL\.\d+)\s+/i', '', trim((string)$rawName)) : null;
            $cleanNik  = $rawNik ? trim((string)$rawNik) : ('AGT-' . strtoupper(substr(md5($cleanName ?: (string)$rowNum), 0, 6)));
            $cleanIdca = $rawIdca ? trim((string)$rawIdca) : ('CA_' . strtoupper(substr($service->code, 0, 3)) . '-' . date('YmdHis') . $rowNum);

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

            if (!$cleanName) {
                $isValid = false;
                $errMsg = 'Kolom Nama Agent kosong.';
            } elseif ($cleanCa < 0 || $cleanCa > 100) {
                $isValid = false;
                $errMsg = 'Score CA di luar batas 0-100%.';
            }

            // Check existing agent in DB for comparison
            $existing = $cleanName ? ($existingAgents[strtolower($cleanName)] ?? null) : null;
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

            // Resolve TL and Trainer fallback from NAKER for preview
            $previewTl = trim((string)$rawTl);
            $previewTrn = trim((string)$rawTrn);
            if (($previewTl === '' || $previewTl === 'TL Umum') || ($previewTrn === '' || $previewTrn === 'TRN Umum')) {
                $normName = strtolower(str_replace(['.', ' ', '-', '_'], '', (string)$cleanName));
                $emp = \App\Models\Employee::where('sip_id', $cleanName)
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
                'nik'                          => $cleanNik,
                'qa_name'                      => trim((string)$rawQa),
                'ca'                           => round($cleanCa, 1),
                'score_ca'                     => round($cleanCa, 1),
                'fcr'                          => $cleanFcr,
                'fcr_score'                    => ($cleanFcr === 'YA' ? 100 : 0),
                'channel'                      => $service->name,
                'service_name'                 => $service->name,
                'service_code'                 => $service->code,
                // Roadmap V2 §23 — traceability fields
                'source_ca'                    => $rawSourceCa,
                'source_layanan'               => $rawSourceLayanan,
                'hashtag'                      => $rawHashtag,
                'ever_changed'                 => in_array(strtoupper(trim((string)($rawEverChanged ?? ''))), ['YA', '1', 'TRUE', 'YES']),
                'site'                         => $rawSite ?? 'SMG',
                'tl'                           => $previewTl ?: ($existing?->teamLeader?->name ?? 'TL Umum'),
                'trainer'                      => $previewTrn ?: ($existing?->trainer?->name ?? 'TRN Umum'),
                'status'                       => $status,
                'category'                     => self::extractValue($row, ['Kategori', 'category', 'Jenis', 'Topic'], 'INFORMASI'),
                'sub_category'                 => self::extractValue($row, ['Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis']),
                'platform'                     => self::extractValue($row, ['Platform', 'platform', 'Channel', 'Media']),
                'customer_name'                => self::extractValue($row, ['Pelanggan', 'customer_name', 'Customer', 'Nama Pelanggan']),
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
                'code' => $service->code,
                'name' => $service->name,
                'parameter_count' => $parameters->count()
            ],
            'summary' => [
                'total_rows' => count($parsed),
                'new_count' => $newCount,
                'update_count' => $updateCount,
                'file_duplicate_count' => $dupCount,
                'invalid_count' => $invalidCount,
                'valid_count' => count($parsed) - $invalidCount
            ],
            'parameters' => $parameters->map(fn($p) => ['code' => $p->code, 'name' => $p->name]),
            'items' => $parsed
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
        $site = Site::where('code', 'SMG')->first() ?? Site::create(['code' => 'SMG', 'name' => 'SEMARANG', 'status' => true]);
        $parameters = CaParameter::where('service_id', $service->id)->get()->keyBy('code');

        // 1. Create or Find Staging Header
        if ($isFirstBatch || !$importId) {
            $staging = SipImport::create([
                'file_name' => $fileName,
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

        // In-memory model caches to avoid thousands of repetitive SQL queries per batch
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
        $allEmployees = \App\Models\Employee::all();
        foreach ($allEmployees as $e) {
            if ($e->sip_id) $empBySipCache[strtolower(trim($e->sip_id))] = $e;
            if ($e->name) {
                $norm = strtolower(str_replace(['.', ' ', '-', '_'], '', trim($e->name)));
                $empByNameCache[$norm] = $e;
            }
        }

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
            foreach ($rows as $idx => $row) {
                $rowNum = $idx + 1;

                // ── Skip baris tidak valid dari format QSF Excel ─────────────────
                $firstVal = trim((string)(reset($row) ?? ''));
                $agentVal = trim((string)(self::extractValue($row, ['Agent', 'agent']) ?? ''));
                if (strtolower($agentVal) === 'agent' || strtolower($firstVal) === 'no') continue;
                if (str_contains(strtolower($firstVal), 'rata') || str_contains(strtolower($firstVal), 'average') || str_contains(strtolower($firstVal), 'total')) continue;
                $rawAgentChk = self::extractValue($row, ['Agent', 'Nama Agent', 'Nama Lengkap', 'Nama']);
                $rawIdcaChk  = self::extractValue($row, ['IDCA', 'ID CA', 'ID_CA', 'idca']);
                if (!$rawAgentChk && !$rawIdcaChk && is_numeric($firstVal)) continue;
                // ────────────────────────────────────────────────────────────────

                $rawName    = self::extractValue($row, ['Agent', 'Nama Agent', 'Nama Lengkap', 'Nama', 'Agent Name', 'nama_agent', 'agent_name', 'Nama Petugas', 'User', 'Petugas', 'Karyawan', 'Pegawai', 'penerimalaporan', 'penerima_laporan', 'Penerima Laporan', 'Penerima', 'namapelapor']);
                $rawIdca    = self::extractValue($row, ['IDCA', 'ID CA', 'ID_CA', 'idca', 'No CA', 'No. CA', 'Kode CA', 'Assessment ID', 'ID_Assessment']);
                $rawTicket  = self::extractValue($row, ['ID Tiket', 'ID_Tiket', 'No Tiket', 'No. Tiket', 'Ticket ID', 'ticket_id', 'Ticket', 'Tiket', 'idtiket', 'id_tiket']);

                $rawNik     = self::extractValue($row, ['NIK', 'nik', 'employee_code', 'NIK Agent', 'ID Agent', 'NIP', 'idpelanggan', 'sidbaru']);
                $rawQa      = self::extractValue($row, ['QA', 'Nama QA', 'Evaluator', 'Auditor', 'Nama Evaluator', 'Trainer', 'qa_name', 'Penilai']);
                $rawTl      = self::extractValue($row, ['Team Leader', 'Team Leader (TL)', 'TL', 'Nama TL', 'Supervisor', 'SPV', 'team_leader']);
                $rawTrn     = self::extractValue($row, ['Trainer', 'Trainer Pengampu', 'Nama Trainer', 'trainer']);

                // Roadmap V2 §23 & Raw Ticketing — nilai asli dari kolom Excel untuk traceability
                $rawSourceCa      = self::extractValue($row, ['CA', 'ca', 'namakelompok']);
                $rawSourceLayanan = self::extractValue($row, ['Layanan', 'layanan', 'Service', 'Saluran', 'namasumber', 'nama_sumber', 'sumber', 'Channel', 'channel']);
                $rawHashtag       = self::extractValue($row, ['Hashtag', 'hashtag', 'Tag', '#']);
                $rawEverChanged   = self::extractValue($row, ['Pernah Diubah', 'pernah_diubah', 'Ever Changed', 'Changed']);
                $rawSiteCode      = self::extractValue($row, ['Site', 'site', 'Lokasi', 'SITE', 'namasbu', 'nama_sbu', 'namakp']);
                $rawCustomer      = self::extractValue($row, ['Pelanggan', 'pelanggan', 'namapelanggan', 'nama_pelanggan', 'Customer', 'Customer Name']);
                $rawCategory      = self::extractValue($row, ['Kategori', 'category', 'Jenis', 'Topic', 'namakelompok', 'nama_kelompok', 'Kelompok'], 'GANGGUAN');
                $rawSubCategory   = self::extractValue($row, ['Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis', 'namakondisi', 'nama_kondisi', 'Kondisi']);

                // Channel resolution from namasumber (Retail Ticketing)
                if ($rawSourceLayanan) {
                    $sUpper = strtoupper(trim((string)$rawSourceLayanan));
                    if ($sUpper === 'PHONE' || str_contains($sUpper, 'VOICE') || str_contains($sUpper, 'CALL')) $rawSourceLayanan = 'Inbound';
                    elseif (str_contains($sUpper, 'LIVE CHAT') || str_contains($sUpper, 'CHATBOT') || str_contains($sUpper, 'MY ICON+')) $rawSourceLayanan = 'Digilive';
                    elseif (str_contains($sUpper, 'INSTAGRAM') || str_contains($sUpper, 'WHATSAPP') || str_contains($sUpper, 'SOCMED')) $rawSourceLayanan = 'Socmed';
                    elseif (str_contains($sUpper, 'EMAIL')) $rawSourceLayanan = 'Email';
                    elseif (str_contains($sUpper, 'INTERNAL')) $rawSourceLayanan = 'Back Office';
                }

                if (!$rawName) {
                    $failedRows++;
                    continue;
                }

                $cleanName = NakerVerificationService::cleanCsoName($rawName);
                $cleanNik = $rawNik ? trim((string)$rawNik) : ('AGT-' . strtoupper(substr(md5($cleanName), 0, 6)));
                $cleanIdca = $rawIdca ? trim((string)$rawIdca) : ('CA_' . strtoupper(substr($service->code, 0, 3)) . '-' . date('YmdHis') . $rowNum);

                $csoClassRes = NakerVerificationService::classifyCso($rawName, $cleanNik);
                $csoClassification = $csoClassRes['classification'];
                $isNakerVerified = $csoClassRes['is_naker_verified'];

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
                }

                // Fallback ke Master Data NAKER jika TL atau Trainer belum terisi
                $resolvedEmployee = null;
                $normalizedAgentName = strtolower(str_replace(['.', ' ', '-', '_'], '', $cleanName));
                if (!$tl || !$trn) {
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

                if (!$agent) {
                    // Cek jika NIK atau Name sudah ada di database
                    if ($nikKey !== '' && !str_starts_with($cleanNik, 'AGT-') && Agent::whereRaw('LOWER(nik) = ?', [$nikKey])->exists()) {
                        $agent = Agent::whereRaw('LOWER(nik) = ?', [$nikKey])->first();
                    } elseif (Agent::where('name', $cleanName)->exists()) {
                        $agent = Agent::where('name', $cleanName)->first();
                    } else {
                        // Pastikan NIK yang akan di-insert belum pernah terpakai
                        $finalNik = $cleanNik;
                        if (Agent::where('nik', $finalNik)->exists()) {
                            $finalNik = 'AGT-' . strtoupper(substr(md5($cleanName . microtime()), 0, 8));
                        }
                        $agent = Agent::create([
                            'name' => $cleanName,
                            'nik' => $finalNik,
                            'channel' => $service->name,
                            'period_month' => '2026-08',
                            'team_leader_id' => $tl ? $tl->id : null,
                            'trainer_id' => $trn ? $trn->id : null,
                            'site_id' => $csoClassRes['site_id'] ?: $resolvedSiteId,
                            'cso_classification' => $csoClassification,
                            'is_naker_verified' => $isNakerVerified,
                            'ca_score' => 90.0,
                            'fcr_score' => 85.0,
                            'evaluation_count' => 1,
                            'status' => 'Meet Target',
                            'source_role' => 'supervisor',
                            'imported_by' => 'Supervisor'
                        ]);
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
                    $agentUpdates = [
                        'cso_classification' => $csoClassification,
                        'is_naker_verified'  => $isNakerVerified,
                        'site_id'            => $csoClassRes['site_id'] ?: ($agent->site_id ?: $resolvedSiteId),
                    ];
                    if ($tl && !$agent->team_leader_id) $agentUpdates['team_leader_id'] = $tl->id;
                    if ($trn && !$agent->trainer_id) $agentUpdates['trainer_id'] = $trn->id;
                    if ($resolvedEmployee && $resolvedEmployee->sip_id && str_starts_with($agent->nik, 'AGT-')) {
                        // Hanya update NIK jika SIP ID belum terpakai oleh agent lain
                        if (!Agent::where('nik', $resolvedEmployee->sip_id)->where('id', '!=', $agent->id)->exists()) {
                            $agentUpdates['nik'] = $resolvedEmployee->sip_id;
                        }
                    }
                    if (!empty($agentUpdates)) {
                        $agent->update($agentUpdates);
                    }
                }

                // Find or create Category & Sub Category (Cached)
                $catName = self::extractValue($row, ['Kategori', 'category', 'Jenis', 'Topic'], 'INFORMASI');
                $trimCat = trim((string)$catName);
                if (!isset($categoryCache[$trimCat])) {
                    $categoryCache[$trimCat] = Category::firstOrCreate(
                        ['service_id' => $service->id, 'name' => $trimCat],
                        ['code' => strtoupper(substr($trimCat, 0, 3)), 'status' => true]
                    );
                }
                $category = $categoryCache[$trimCat];

                $subCatId = null;
                $rawSubCat = self::extractValue($row, ['Sub Kategori', 'sub_category', 'Subkategori', 'Sub Jenis']);
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
                            ['service_id' => $service->id, 'status' => true]
                        );
                    }
                    $platId = $platCache[$trimPlat]->id;
                }

                // QA User (Cached)
                $cleanQa = trim((string)$rawQa) ?: 'QA.INBOUND';
                if (!isset($qaCache[$cleanQa])) {
                    $qaCache[$cleanQa] = User::firstOrCreate(
                        ['name' => $cleanQa],
                        [
                            'username' => Str::slug($cleanQa, '.'),
                            'email' => Str::slug($cleanQa, '.') . '@digiqa.id',
                            'password' => bcrypt('password'),
                            'role' => 'quality_assurance',
                            'status' => 'active'
                        ]
                    );
                }
                $qaUser = $qaCache[$cleanQa];

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

                // Lookup employee ID
                $resolvedEmployeeId = $resolvedEmployee?->id;
                if (!$resolvedEmployeeId) {
                    $matchedEmp = $empBySipCache[$normalizedAgentName] ?? ($empByNameCache[$normalizedAgentName] ?? null);
                    $resolvedEmployeeId = $matchedEmp?->id;
                }

                // Upsert Assessment Transaction Record
                $assessment = CaAssessment::updateOrCreate(
                    ['idca' => $cleanIdca],
                    [
                        'ticket_id'                    => $rawTicket,
                        'site_id'                      => $csoClassRes['site_id'] ?: $resolvedSiteId,
                        'service_id'                   => $service->id,
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
                        'customer_name'                => self::extractValue($row, ['Pelanggan', 'customer_name', 'Customer', 'Nama Pelanggan']),
                        'transaction_at'               => self::resolveRowDates($row, $cleanIdca)['transaction_at'],
                        'measurement_at'               => self::resolveRowDates($row, $cleanIdca)['measurement_at'],
                        'transaction_duration_seconds' => $transDuration,
                        'sampling_duration_seconds'    => $sampDuration,
                        'fcr'                          => $cleanFcr,
                        'fcr_note'                     => self::extractValue($row, ['Ket FCR', 'fcr_note', 'Catatan FCR']),
                        'source_ca'                    => $rawSourceCa,
                        'source_layanan'               => $rawSourceLayanan,
                        'hashtag'                      => $rawHashtag,
                        'ever_changed'                 => in_array(strtoupper(trim((string)($rawEverChanged ?? ''))), ['YA', '1', 'TRUE', 'YES']),
                        'score_ca'                     => $cleanCa,
                        'summary'                      => self::extractValue($row, ['Ket Summary', 'summary', 'Catatan', 'Kesimpulan']),
                        'recommendation'               => self::extractValue($row, ['Rekomendasi', 'recommendation', 'Saran']),
                        'recommendation_note'          => self::extractValue($row, ['Ket Rekomendasi', 'recommendation_note', 'Catatan Rekomendasi']),
                        'source'                       => 'SIP',
                        'source_file'                  => $fileName,
                        'imported_at'                  => now(),
                    ]
                );

                // Insert / Upsert Dynamic Parameter Scores
                foreach ($parameters as $paramCode => $paramModel) {
                    $scoreVal = self::extractValue($row, [$paramCode, 'Param ' . $paramCode, 'Parameter ' . $paramCode, 'Attribute ' . $paramCode]);
                    if ($scoreVal !== null && is_numeric($scoreVal)) {
                        CaAssessmentScore::updateOrCreate(
                            [
                                'assessment_id' => $assessment->id,
                                'parameter_id'  => $paramModel->id,
                            ],
                            [
                                'score' => floatval($scoreVal)
                            ]
                        );
                    }
                }

                $successRows++;
            }

            // Increment staging stats for this batch
            $staging->increment('success_rows', $successRows);
            $staging->increment('failed_rows', $failedRows);

            if ($isLastBatch) {
                // Recalculate Agent Rollup Scores with single aggregated query (Fast O(1) trip - strictly matang data)
                $agentAggregates = CaAssessment::selectRaw("
                    agent_id,
                    AVG(score_ca) as avg_ca,
                    COUNT(*) as total_eval,
                    SUM(CASE WHEN UPPER(TRIM(fcr)) = 'YA' THEN 1 ELSE 0 END) as fcr_yes_count
                ")
                ->whereNotNull('agent_id')
                ->where('qa_name', '!=', 'QA.INBOUND')
                ->whereNotNull('qa_name')
                ->where('qa_name', '!=', '')
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
                $distinctPeriods = CaAssessment::where('qa_name', '!=', 'QA.INBOUND')
                    ->whereNotNull('qa_name')
                    ->where('qa_name', '!=', '')
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

                // Auto-sync Sampling Distribution from real imported tickets
                try {
                    \App\Services\Sampling\AutoDistributionEngineService::runDistribution('2026-08');
                } catch (\Throwable $dE) {
                    \Illuminate\Support\Facades\Log::warning('Auto distribution trigger post-import error: ' . $dE->getMessage());
                }

                \App\Services\NotificationService::send([
                    'title'      => "ETL QSF [{$service->name}] Selesai",
                    'message'    => "Berhasil memproses {$staging->success_rows} assessment dan mendistribusikan tiket sampling untuk layanan {$service->name}.",
                    'type'       => 'import',
                    'action_url' => '/input-supervisor',
                ]);
            }

            DB::commit();

            return [
                'success'            => true,
                'message'            => $isLastBatch
                    ? "Berhasil menginjeksi seluruh batch ({$staging->success_rows} transaksi) assessment {$service->name} beserta detail parameter nilainya."
                    : "Batch {$batchIndex}/{$totalBatches} berhasil diinjeksi ({$successRows} baris).",
                'service'            => $service->name,
                'batch_index'        => $batchIndex,
                'total_batches'      => $totalBatches,
                'is_last_batch'      => $isLastBatch,
                'import_id'          => $staging->id,
                'batch_success_rows' => $successRows,
                'batch_failed_rows'  => $failedRows,
                'total_success_rows' => $staging->success_rows,
                'total_failed_rows'  => $staging->failed_rows,
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
        $employees = \App\Models\Employee::all();
        $assignments = \App\Models\EmployeeAssignment::where('status', true)
            ->with(['teamLeader', 'trainer'])
            ->get()
            ->keyBy('employee_id');

        $empBySip = [];
        $empByName = [];
        foreach ($employees as $emp) {
            if ($emp->sip_id) $empBySip[strtolower(trim($emp->sip_id))] = $emp;
            if ($emp->name) {
                $clean = strtolower(str_replace(['.', ' ', '-', '_'], '', trim($emp->name)));
                $empByName[$clean] = $emp;
            }
        }

        $tlCache = [];
        $trnCache = [];
        $agents = Agent::all();
        $syncedCount = 0;

        foreach ($agents as $agent) {
            $cleanName = trim((string)$agent->name);
            $norm = strtolower(str_replace(['.', ' ', '-', '_'], '', $cleanName));

            $emp = $empBySip[$norm] ?? ($empByName[$norm] ?? null);

            if ($emp) {
                $asn = $assignments->get($emp->id);

                $tlId = $agent->team_leader_id;
                if ($asn?->teamLeader?->name) {
                    $tlName = trim($asn->teamLeader->name);
                    if (!isset($tlCache[$tlName])) {
                        $tlCache[$tlName] = TeamLeader::firstOrCreate(
                            ['name' => $tlName],
                            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $tlId = $tlCache[$tlName]->id;
                }

                $trnId = $agent->trainer_id;
                if ($asn?->trainer?->name) {
                    $trnName = trim($asn->trainer->name);
                    if (!isset($trnCache[$trnName])) {
                        $trnCache[$trnName] = Trainer::firstOrCreate(
                            ['name' => $trnName],
                            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );
                    }
                    $trnId = $trnCache[$trnName]->id;
                }

                $nik = ($emp->sip_id && (str_starts_with($agent->nik, 'AGT-') || empty($agent->nik)))
                    ? $emp->sip_id
                    : $agent->nik;

                $agent->update([
                    'team_leader_id' => $tlId,
                    'trainer_id'     => $trnId,
                    'nik'            => $nik,
                ]);

                $syncedCount++;
            }
        }

        return $syncedCount;
    }
}
