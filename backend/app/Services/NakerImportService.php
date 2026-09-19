<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAssignment;
use App\Models\ImportBatch;
use App\Models\ImportLog;
use App\Models\ImportProfile;
use App\Models\ImportRow;
use App\Models\Service;
use App\Models\ServiceMapping;
use App\Models\Site;
use App\Models\TeamLeader;
use App\Models\Trainer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NakerImportService
{
    /**
     * Helper fleksibel untuk ekstrak nilai dari array row
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
     * Cek apakah baris NAKER termasuk klasifikasi Middle Management Quality Assurance
     */
    public static function isQaClassification(?string $layanan): bool
    {
        if (!$layanan) return false;
        $upper = strtoupper(trim((string)$layanan));
        return str_contains($upper, 'QUALITY ASSURANCE')
            || str_contains($upper, 'MIDDLE MANAGEMENT QUALITY ASSURANCE')
            || str_contains($upper, 'NON CSO - MIDDLE MANAGEMENT')
            || str_contains($upper, 'NON CSO - QA')
            || str_contains($upper, 'MIDDLE MANAGEMENT QA')
            || $upper === 'QA'
            || $upper === 'QUALITY_ASSURANCE';
    }

    /**
     * Resolusi Sub Kategori Layanan (Myicon+, DM Instagram, WhatsApp, Sosmed, Inbound Call, Email Inbound, dll)
     */
    public static function resolveSubCategory(?string $explicitSubLayanan, ?string $layananText): ?string
    {
        if ($explicitSubLayanan && trim($explicitSubLayanan) !== '') {
            return strtoupper(trim($explicitSubLayanan));
        }

        if (!$layananText || trim($layananText) === '') {
            return null;
        }

        $upper = strtoupper(trim($layananText));

        // Middle Management
        if (self::isQaClassification($upper)) return 'QUALITY ASSURANCE';
        if (self::isTlClassification($upper)) return 'TEAM LEADER';
        if (self::isTrainerClassification($upper)) return 'TRAINER';

        // Specific sub categories
        if (str_contains($upper, 'MY ICON') || str_contains($upper, 'MYICON') || str_contains($upper, 'MY ICON+')) {
            return 'MY ICON+';
        }
        if (str_contains($upper, 'DM INSTAGRAM') || str_contains($upper, 'INSTAGRAM') || str_contains($upper, 'IG')) {
            return 'DM INSTAGRAM';
        }
        if (str_contains($upper, 'WHATSAPP') || str_contains($upper, 'WA')) {
            return 'WHATSAPP';
        }
        if (str_contains($upper, 'TWITTER') || str_contains($upper, ' X ') || str_ends_with($upper, '- X') || str_contains($upper, 'X/TWITTER')) {
            return 'TWITTER';
        }
        if (str_contains($upper, 'FACEBOOK') || str_contains($upper, ' FB ')) {
            return 'FACEBOOK';
        }
        if (str_contains($upper, 'DIGILIVE') || str_contains($upper, 'LIVE CHAT')) {
            return 'DIGILIVE CHAT';
        }
        if (str_contains($upper, 'SOCIAL MEDIA') || str_contains($upper, 'SOCMED') || str_contains($upper, 'SOSMED')) {
            return 'SOSMED';
        }
        if (str_contains($upper, 'EMAIL OUTBOUND') || str_contains($upper, 'OUTBOUND EMAIL')) {
            return 'EMAIL OUTBOUND';
        }
        if (str_contains($upper, 'EMAIL INBOUND') || str_contains($upper, 'EMAIL')) {
            return 'EMAIL INBOUND';
        }
        if (str_contains($upper, 'OUTBOUND CALL') || str_contains($upper, 'OUTBOUND')) {
            return 'OUTBOUND CALL';
        }
        if (str_contains($upper, 'INBOUND CALL') || str_contains($upper, 'INBOUND')) {
            return 'INBOUND CALL';
        }
        if (str_contains($upper, 'BACK OFFICE') || str_contains($upper, 'ESKALASI') || str_contains($upper, 'BO')) {
            return 'ESKALASI BO';
        }

        // Delimiter parsing like " - "
        if (str_contains($upper, ' - ')) {
            $parts = explode(' - ', $upper);
            return trim(end($parts));
        }

        return $upper;
    }

    /**
     * Cek apakah baris NAKER termasuk klasifikasi Team Leader (TL)
     */
    public static function isTlClassification(?string $layanan): bool
    {
        if (!$layanan) return false;
        $upper = strtoupper(trim((string)$layanan));
        return str_contains($upper, 'TEAM LEADER')
            || str_contains($upper, 'TEAM_LEADER')
            || str_contains($upper, 'NON CSO - TL')
            || str_contains($upper, 'NON CSO - TEAM LEADER')
            || str_contains($upper, 'MIDDLE MANAGEMENT TEAM LEADER')
            || str_contains($upper, 'MIDDLE MANAGEMENT TL')
            || $upper === 'TL'
            || $upper === 'TEAM LEADER';
    }

    /**
     * Cek apakah baris NAKER termasuk klasifikasi Trainer (Pengampu Pelatihan)
     */
    public static function isTrainerClassification(?string $layanan): bool
    {
        if (!$layanan) return false;
        $upper = strtoupper(trim((string)$layanan));
        return str_contains($upper, 'TRAINER')
            || str_contains($upper, 'TRAINNER')
            || str_contains($upper, 'NON CSO - TRAINER')
            || str_contains($upper, 'NON CSO - TRAINNER')
            || str_contains($upper, 'MIDDLE MANAGEMENT TRAINER')
            || str_contains($upper, 'PENGAMPU')
            || $upper === 'TRN'
            || $upper === 'TRAINER';
    }

    /**
     * Normalisasi Nama Lengkap untuk pencocokan akurat tanpa terpengaruh spasi, titik, atau kapitalisasi
     */
    public static function normalizePersonName(?string $name): string
    {
        if (!$name) return '';
        return strtolower(preg_replace('/[^a-zA-Z0-9]/', '', (string)$name));
    }

    /**
     * Normalisasi Jenis Kelamin (PRIA / WANITA)
     */
    public static function normalizeGender(?string $rawJk): ?string
    {
        if (!$rawJk) return null;
        $jkUpper = strtoupper(trim((string)$rawJk));
        if ($jkUpper === 'L' || $jkUpper === 'LAKI-LAKI' || $jkUpper === 'PRIA' || $jkUpper === 'M' || $jkUpper === 'MALE') {
            return 'PRIA';
        }
        if ($jkUpper === 'P' || $jkUpper === 'PEREMPUAN' || $jkUpper === 'WANITA' || $jkUpper === 'F' || $jkUpper === 'FEMALE') {
            return 'WANITA';
        }
        return null;
    }

    /**
     * Service Canonical untuk Middle Management Quality Assurance
     */
    public static function getOrCreateQaService(): Service
    {
        return Service::firstOrCreate(
            ['code' => 'QUALITY_ASSURANCE'],
            [
                'name' => 'Quality Assurance',
                'source_ca_label' => 'Quality Assurance',
                'source_layanan_label' => 'NON CSO - MIDDLE MANAGEMENT QUALITY ASSURANCE',
                'status' => true,
                'description' => 'Middle Management Quality Assurance (Akun QA Evaluator)'
            ]
        );
    }

    /**
     * Service Canonical untuk Team Leader (TL)
     */
    public static function getOrCreateTlService(): Service
    {
        return Service::firstOrCreate(
            ['code' => 'TEAM_LEADER'],
            [
                'name' => 'Team Leader',
                'source_ca_label' => 'Team Leader',
                'source_layanan_label' => 'NON CSO - TEAM LEADER',
                'status' => true,
                'description' => 'Team Leader Operasional & Pengawasan'
            ]
        );
    }

    /**
     * Service Canonical untuk Trainer
     */
    public static function getOrCreateTrainerService(): Service
    {
        return Service::firstOrCreate(
            ['code' => 'TRAINER'],
            [
                'name' => 'Trainer',
                'source_ca_label' => 'Trainer',
                'source_layanan_label' => 'NON CSO - TRAINER',
                'status' => true,
                'description' => 'Trainer Pengampu & Coaching Pelatihan'
            ]
        );
    }

    /**
     * Preview NAKER Excel & Validation
     */
    public function preview(array $rows, string $fileName = 'DATABASE ALL NAKER.xlsx')
    {
        $existingEmployeesBySip = Employee::pluck('id', 'sip_id')->toArray();
        $existingEmployeesByName = Employee::get()->keyBy(fn($e) => self::normalizePersonName($e->name));

        $sites = Site::pluck('id', 'code')->toArray();
        $serviceMappings = ServiceMapping::pluck('service_id', 'source_value')->toArray();
        $services = Service::pluck('id', 'code')->toArray();

        $parsed = [];
        $seenSipInFile = [];
        $validCount = 0;
        $warningCount = 0;
        $duplicateCount = 0;
        $errorCount = 0;
        $qaCount = 0;
        $tlCount = 0;
        $trainerCount = 0;
        $csoCount = 0;

        foreach ($rows as $idx => $row) {
            $rowNum = $idx + 1;

            $rawName = self::extractValue($row, ['NAMA', 'Nama', 'name', 'Nama Lengkap', 'Nama Karyawan', 'NAMA LENGKAP']);
            $rawJk = self::extractValue($row, ['JK', 'Jenis Kelamin', 'Gender', 'jk']);
            $rawLayanan = self::extractValue($row, ['LAYANAN', 'Layanan', 'Channel', 'service', 'layanan']);
            $rawSubLayanan = self::extractValue($row, ['SUB LAYANAN', 'SUB KATEGORI', 'SUB KATEGORI LAYANAN', 'SUB_LAYANAN', 'SUB_KATEGORI', 'SUB SERVICE', 'MEDIA', 'PLATFORM', 'CHANNEL DETAIL', 'sub_layanan', 'sub_service']);
            $rawTeamTl = self::extractValue($row, ['TEAM TL', 'Team TL', 'TL', 'Nama TL', 'team_tl', 'TEAM_TL']);
            $rawTrainer = self::extractValue($row, ['TRAINER', 'Trainer', 'Nama Trainer', 'trainer']);
            $rawSite = self::extractValue($row, ['SITE', 'Site', 'Lokasi', 'site']);
            $rawIdSip = self::extractValue($row, ['ID SIP', 'ID_SIP', 'IDSIP', 'sip_id', 'ID', 'SIP ID', 'NIK']);

            $cleanName = $rawName ? trim((string)$rawName) : null;
            $cleanIdSip = $rawIdSip ? trim((string)$rawIdSip) : ($cleanName ? ('SIP-' . strtoupper(substr(md5($cleanName), 0, 8))) : null);
            $cleanSubLayanan = self::resolveSubCategory($rawSubLayanan, $rawLayanan);

            // Klasifikasi QA vs TL vs Trainer vs CSO
            $isQa = self::isQaClassification($rawLayanan);
            $isTl = self::isTlClassification($rawLayanan);
            $isTrainer = self::isTrainerClassification($rawLayanan);

            if ($isQa) {
                $qaCount++;
            } elseif ($isTl) {
                $tlCount++;
            } elseif ($isTrainer) {
                $trainerCount++;
            } else {
                $csoCount++;
            }

            // Normalize Gender (L = PRIA, P = WANITA)
            $cleanGender = self::normalizeGender($rawJk);

            $status = 'valid';
            $errorMsg = null;
            $warningMsg = null;

            $normName = self::normalizePersonName($cleanName);
            $isExistingInDb = isset($existingEmployeesBySip[$cleanIdSip]) || (isset($existingEmployeesByName[$normName]));

            // Required validations
            if (!$cleanName) {
                $status = 'failed';
                $errorMsg = 'Kolom NAMA tidak boleh kosong.';
                $errorCount++;
            } elseif (!$cleanIdSip) {
                $status = 'failed';
                $errorMsg = 'Kolom ID SIP tidak boleh kosong.';
                $errorCount++;
            } elseif (in_array($cleanIdSip, $seenSipInFile)) {
                $status = 'duplicate';
                $warningMsg = "ID SIP '{$cleanIdSip}' duplikat di dalam file.";
                $duplicateCount++;
            } elseif ($isExistingInDb) {
                $status = 'duplicate';
                $warningMsg = "Employee '{$cleanName}' ({$cleanIdSip}) sudah terdaftar di database (akan diupdate).";
                $duplicateCount++;
            } else {
                if (!$rawLayanan) {
                    $status = 'warning';
                    $warningMsg = 'Kolom LAYANAN kosong.';
                    $warningCount++;
                } else {
                    $validCount++;
                }
            }

            if ($cleanIdSip) {
                $seenSipInFile[] = $cleanIdSip;
            }

            $usernameSuggestion = strtolower(trim((string)$cleanIdSip));
            $defaultPrefix = $isQa ? 'qa.' : ($isTl ? 'tl.' : ($isTrainer ? 'trn.' : ''));
            $cleanUsername = preg_replace('/[^a-z0-9._-]/', '', $usernameSuggestion) ?: ($defaultPrefix . strtolower(str_replace(' ', '.', (string)$cleanName)));

            $parsed[] = [
                'row_index' => $rowNum,
                'name' => $cleanName ?: '(Tanpa Nama)',
                'sip_id' => $cleanIdSip ?: '-',
                'gender' => $cleanGender ?: ($rawJk ?: '-'),
                'layanan' => $rawLayanan ?: '-',
                'sub_layanan' => $cleanSubLayanan ?: '-',
                'sub_service' => $cleanSubLayanan ?: '-',
                'team_tl' => $rawTeamTl ?: '-',
                'trainer' => $rawTrainer ?: '-',
                'site' => $rawSite ?: '-',
                'status' => $status,
                'error_message' => $errorMsg,
                'warning_message' => $warningMsg,
                'is_existing' => isset($existingEmployeesBySip[$cleanIdSip]),
                'is_qa' => $isQa,
                'is_tl' => $isTl,
                'is_trainer' => $isTrainer,
                'classification' => $isQa ? 'QUALITY_ASSURANCE' : ($isTl ? 'TEAM_LEADER' : ($isTrainer ? 'TRAINER' : 'CSO')),
                'classification_label' => $isQa ? 'NON CSO - QA (Middle Management)' : ($isTl ? 'NON CSO - TL (Team Leader)' : ($isTrainer ? 'NON CSO - Trainer (Pengampu)' : 'CSO Agent Operasional')),
                'target_role' => $isQa ? 'quality_assurance' : ($isTl ? 'team_leader' : ($isTrainer ? 'trainer' : 'agent')),
                'will_create_account' => ($isQa || $isTl || $isTrainer),
                'account_email' => ($isQa || $isTl || $isTrainer) ? ($cleanUsername . '@digiqa.id') : null,
            ];
        }

        return [
            'success' => true,
            'import_type' => 'NAKER',
            'summary' => [
                'total_rows' => count($parsed),
                'valid_count' => $validCount,
                'warning_count' => $warningCount,
                'duplicate_count' => $duplicateCount,
                'error_count' => $errorCount,
                'cso_count' => $csoCount,
                'qa_count' => $qaCount,
                'tl_count' => $tlCount,
                'trainer_count' => $trainerCount,
            ],
            'items' => array_slice($parsed, 0, 100),
            'preview_items_count' => min(count($parsed), 100),
        ];
    }

    /**
     * Helper aman untuk membuat atau menyinkronkan user tanpa risiko duplicate key violation
     */
    public static function createOrUpdateUniqueUser(int $employeeId, string $name, string $suggestedUsername, string $role, string $department): User
    {
        $cleanUsername = strtolower(preg_replace('/[^a-z0-9._-]/', '', $suggestedUsername));
        if (empty($cleanUsername)) {
            $cleanUsername = strtolower(Str::slug($name, '.'));
        }
        $email = $cleanUsername . '@digiqa.id';
        $normName = strtolower(str_replace(['.', ' ', '-', '_'], '', $name));

        $user = User::where('employee_id', $employeeId)
            ->orWhere('username', $cleanUsername)
            ->orWhere('email', $email)
            ->orWhere('name', $name)
            ->orWhereRaw('REPLACE(REPLACE(REPLACE(LOWER(name), ".", ""), " ", ""), "_", "") = ?', [$normName])
            ->first();

        if ($user) {
            $user->update([
                'employee_id' => $employeeId,
                'name'        => $name,
                'role'        => $role,
                'department'  => $department,
                'status'      => 'active',
            ]);
            return $user;
        }

        // Generate unique username & email if collision
        $finalUsername = $cleanUsername;
        $counter = 1;
        while (User::where('username', $finalUsername)->orWhere('email', $finalUsername . '@digiqa.id')->exists()) {
            $finalUsername = $cleanUsername . $counter;
            $counter++;
        }
        $finalEmail = $finalUsername . '@digiqa.id';

        return User::create([
            'employee_id' => $employeeId,
            'name'        => $name,
            'username'    => $finalUsername,
            'email'       => $finalEmail,
            'password'    => \Illuminate\Support\Facades\Hash::make('password'),
            'role'        => $role,
            'department'  => $department,
            'status'      => 'active',
        ]);
    }

    /**
     * Injeksi Data NAKER ke Database (Mendukung Batch Processing)
     */
    public function import(array $rows, string $fileName = 'DATABASE ALL NAKER.xlsx', string $importMode = 'upsert', $userId = null, array $batchOptions = [])
    {
        $isFirstBatch = $batchOptions['is_first_batch'] ?? true;
        $isLastBatch = $batchOptions['is_last_batch'] ?? true;
        $batchIndex = $batchOptions['batch_index'] ?? 1;
        $totalBatches = $batchOptions['total_batches'] ?? 1;
        $batchId = $batchOptions['batch_id'] ?? null;
        $totalExpectedRows = $batchOptions['total_expected_rows'] ?? count($rows);

        if ($isFirstBatch || !$batchId) {
            $profile = ImportProfile::firstOrCreate(
                ['code' => 'NAKER_AUGUST_2026'],
                [
                    'name' => 'Database NAKER (Tenaga Kerja)',
                    'import_type' => 'NAKER',
                    'sheet_name' => 'PLOTTING',
                    'header_row' => 1,
                    'data_start_row' => 2,
                    'version' => '1.0',
                    'status' => true,
                ]
            );

            $batch = ImportBatch::create([
                'import_profile_id' => $profile->id,
                'uploaded_by' => $userId,
                'original_filename' => $fileName,
                'total_rows' => $totalExpectedRows,
                'status' => 'processing',
                'started_at' => now(),
            ]);

            ImportLog::create([
                'import_batch_id' => $batch->id,
                'action' => 'IMPORT_STARTED',
                'description' => "Memulai import NAKER dari berkas {$fileName} sebanyak {$totalExpectedRows} baris (Total {$totalBatches} batch).",
                'created_by' => $userId,
            ]);
        } else {
            $batch = ImportBatch::find($batchId) ?? ImportBatch::create([
                'import_profile_id' => 1,
                'uploaded_by' => $userId,
                'original_filename' => $fileName,
                'total_rows' => $totalExpectedRows,
                'status' => 'processing',
                'started_at' => now(),
            ]);
        }

        $siteSmg = Site::where('code', 'SMG')->first() ?? Site::create(['code' => 'SMG', 'name' => 'SEMARANG', 'status' => true]);
        $serviceMappings = ServiceMapping::pluck('service_id', 'source_value')->toArray();
        $defaultInboundService = Service::where('code', 'INBOUND')->first();

        // =========================================================================
        // PASS 1: PRE-SCAN SEMUA BARIS DALAM FILE
        // Mengindeks data resmi (TL, Trainer, QA, CSO) untuk menghindari duplikasi
        // saat baris CSO agent mereferensikan nama TL / Trainer.
        // =========================================================================
        $preScannedPeople = [];
        foreach ($rows as $r) {
            $nm = self::extractValue($r, ['NAMA', 'Nama', 'name', 'Nama Lengkap', 'Nama Karyawan', 'NAMA LENGKAP']);
            $sip = self::extractValue($r, ['ID SIP', 'ID_SIP', 'IDSIP', 'sip_id', 'ID', 'SIP ID', 'NIK']);
            $jk = self::extractValue($r, ['JK', 'Jenis Kelamin', 'Gender', 'jk']);
            $lay = self::extractValue($r, ['LAYANAN', 'Layanan', 'Channel', 'service', 'layanan']);
            $sub = self::extractValue($r, ['SUB LAYANAN', 'SUB KATEGORI', 'SUB KATEGORI LAYANAN', 'SUB_LAYANAN', 'SUB_KATEGORI', 'SUB SERVICE', 'MEDIA', 'PLATFORM', 'CHANNEL DETAIL', 'sub_layanan', 'sub_service']);
            $st = self::extractValue($r, ['SITE', 'Site', 'Lokasi', 'site']);

            if ($nm && trim((string)$nm) !== '') {
                $cName = trim((string)$nm);
                $norm = self::normalizePersonName($cName);
                $isTl = self::isTlClassification($lay);
                $isTrn = self::isTrainerClassification($lay);
                $isQa = self::isQaClassification($lay);
                $cleanSip = $sip ? trim((string)$sip) : null;
                $cleanGend = self::normalizeGender($jk);

                $preScannedPeople[$norm] = [
                    'name' => $cName,
                    'sip_id' => $cleanSip,
                    'gender' => $cleanGend,
                    'layanan' => $lay,
                    'sub_service' => self::resolveSubCategory($sub, $lay),
                    'site' => $st,
                    'is_tl' => $isTl,
                    'is_trainer' => $isTrn,
                    'is_qa' => $isQa,
                ];
            }
        }

        $successRows = 0;
        $warningRows = 0;
        $failedRows = 0;

        DB::beginTransaction();
        try {
            foreach ($rows as $idx => $row) {
                $rowNum = $idx + 1;

                $importRow = ImportRow::create([
                    'import_batch_id' => $batch->id,
                    'row_number' => $rowNum,
                    'raw_data' => $row,
                    'status' => 'pending',
                ]);

                try {
                    $rawName = self::extractValue($row, ['NAMA', 'Nama', 'name', 'Nama Lengkap', 'Nama Karyawan', 'NAMA LENGKAP']);
                    $rawJk = self::extractValue($row, ['JK', 'Jenis Kelamin', 'Gender', 'jk']);
                    $rawLayanan = self::extractValue($row, ['LAYANAN', 'Layanan', 'Channel', 'service', 'layanan']);
                    $rawSubLayanan = self::extractValue($row, ['SUB LAYANAN', 'SUB KATEGORI', 'SUB KATEGORI LAYANAN', 'SUB_LAYANAN', 'SUB_KATEGORI', 'SUB SERVICE', 'MEDIA', 'PLATFORM', 'CHANNEL DETAIL', 'sub_layanan', 'sub_service']);
                    $rawTeamTl = self::extractValue($row, ['TEAM TL', 'Team TL', 'TL', 'Nama TL', 'team_tl', 'TEAM_TL']);
                    $rawTrainer = self::extractValue($row, ['TRAINER', 'Trainer', 'Nama Trainer', 'trainer']);
                    $rawSite = self::extractValue($row, ['SITE', 'Site', 'Lokasi', 'site']);
                    $rawIdSip = self::extractValue($row, ['ID SIP', 'ID_SIP', 'IDSIP', 'sip_id', 'ID', 'SIP ID', 'NIK']);

                    if (!$rawName) {
                        $failedRows++;
                        $importRow->update(['status' => 'failed', 'error_message' => 'NAMA tidak boleh kosong.']);
                        continue;
                    }

                    $cleanName = trim((string)$rawName);
                    $cleanIdSip = $rawIdSip ? trim((string)$rawIdSip) : null;
                    $cleanSubLayanan = self::resolveSubCategory($rawSubLayanan, $rawLayanan);
                    $cleanGender = self::normalizeGender($rawJk);
                    $normName = self::normalizePersonName($cleanName);

                    // 1. Intelligent Matching: Cari apakah employee sudah ada di database (by SIP atau by Name)
                    $employee = null;
                    if ($cleanIdSip && !str_starts_with($cleanIdSip, 'SIP-') && !str_starts_with($cleanIdSip, 'TL-') && !str_starts_with($cleanIdSip, 'TRN-')) {
                        $employee = Employee::where('sip_id', $cleanIdSip)->first();
                    }
                    if (!$employee) {
                        $employee = Employee::whereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanName)])
                            ->orWhereRaw("LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '.', ''), '-', '')) = ?", [$normName])
                            ->first();
                    }

                    $finalSipId = $cleanIdSip ?: ($employee?->sip_id ?: ('SIP-' . strtoupper(substr(md5($cleanName), 0, 8))));

                    if ($employee) {
                        $updatePayload = [
                            'name' => $cleanName,
                            'status' => 'active',
                        ];
                        if ($cleanGender) {
                            $updatePayload['gender'] = $cleanGender;
                        }
                        if ($cleanSubLayanan) {
                            $updatePayload['sub_service'] = $cleanSubLayanan;
                        }
                        // Jika sebelumnya memiliki dummy SIP (TL-xxx / TRN-xxx / SIP-xxx) dan sekarang ada real SIP, upgrade SIP
                        if ($cleanIdSip && (str_starts_with($employee->sip_id, 'TL-') || str_starts_with($employee->sip_id, 'TRN-') || str_starts_with($employee->sip_id, 'SIP-'))) {
                            if (!Employee::where('sip_id', $cleanIdSip)->where('id', '!=', $employee->id)->exists()) {
                                $updatePayload['sip_id'] = $cleanIdSip;
                            }
                        }
                        $employee->update($updatePayload);
                    } else {
                        $uniqueSip = $finalSipId;
                        $c = 1;
                        while (Employee::where('sip_id', $uniqueSip)->exists()) {
                            $uniqueSip = $finalSipId . '-' . $c;
                            $c++;
                        }
                        $employee = Employee::create([
                            'sip_id' => $uniqueSip,
                            'name' => $cleanName,
                            'gender' => $cleanGender,
                            'sub_service' => $cleanSubLayanan,
                            'status' => 'active',
                        ]);
                    }

                    // Check QA, TL & Trainer classification
                    $isQa = self::isQaClassification($rawLayanan);
                    $isTl = self::isTlClassification($rawLayanan);
                    $isTrainer = self::isTrainerClassification($rawLayanan);

                    // 2. Resolve Service
                    $serviceId = null;
                    if ($isQa) {
                        $qaService = self::getOrCreateQaService();
                        $serviceId = $qaService->id;
                    } elseif ($isTl) {
                        $tlService = self::getOrCreateTlService();
                        $serviceId = $tlService->id;
                    } elseif ($isTrainer) {
                        $trainerService = self::getOrCreateTrainerService();
                        $serviceId = $trainerService->id;
                    } elseif ($rawLayanan) {
                        $cleanLayanan = trim((string)$rawLayanan);
                        if (isset($serviceMappings[$cleanLayanan])) {
                            $serviceId = $serviceMappings[$cleanLayanan];
                        } else {
                            // Dynamic detection
                            $svc = QsfImportService::detectService($cleanLayanan);
                            $serviceId = $svc->id;
                            ServiceMapping::firstOrCreate(
                                ['source_system' => 'NAKER', 'source_value' => $cleanLayanan],
                                ['service_id' => $serviceId]
                            );
                            $serviceMappings[$cleanLayanan] = $serviceId;
                        }
                    }

                    // 3. Resolve Site
                    $siteId = null;
                    if ($rawSite) {
                        $cleanSite = strtoupper(trim((string)$rawSite));
                        $site = Site::firstOrCreate(['code' => $cleanSite], ['name' => $cleanSite, 'status' => true]);
                        $siteId = $site->id;
                    }

                    // 4. Resolve TL Employee (for non-QA, non-TL, non-Trainer rows)
                    $tlEmployeeId = null;
                    if (!$isQa && !$isTl && !$isTrainer && $rawTeamTl && trim((string)$rawTeamTl) !== '') {
                        $cleanTlName = trim((string)$rawTeamTl);
                        $normTlName = self::normalizePersonName($cleanTlName);

                        // Cek di pre-scanned people
                        $preTl = $preScannedPeople[$normTlName] ?? null;
                        $tlSipCandidate = $preTl['sip_id'] ?? null;
                        $tlGenderCandidate = $preTl['gender'] ?? null;

                        // Cari employee TL yang sudah ada di DB
                        $tlEmp = null;
                        if ($tlSipCandidate) {
                            $tlEmp = Employee::where('sip_id', $tlSipCandidate)->first();
                        }
                        if (!$tlEmp) {
                            $tlEmp = Employee::whereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanTlName)])
                                ->orWhereRaw("LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '.', ''), '-', '')) = ?", [$normTlName])
                                ->first();
                        }

                        if ($tlEmp) {
                            $tlUpdates = ['status' => 'active'];
                            if ($tlSipCandidate && (str_starts_with($tlEmp->sip_id, 'TL-') || str_starts_with($tlEmp->sip_id, 'SIP-'))) {
                                if (!Employee::where('sip_id', $tlSipCandidate)->where('id', '!=', $tlEmp->id)->exists()) {
                                    $tlUpdates['sip_id'] = $tlSipCandidate;
                                }
                            }
                            if ($tlGenderCandidate && !$tlEmp->gender) {
                                $tlUpdates['gender'] = $tlGenderCandidate;
                            }
                            $tlEmp->update($tlUpdates);
                        } else {
                            $finalTlSip = $tlSipCandidate ?: ('TL-' . strtoupper(substr(md5($cleanTlName), 0, 6)));
                            $uniqueTlSip = $finalTlSip;
                            $c = 1;
                            while (Employee::where('sip_id', $uniqueTlSip)->exists()) {
                                $uniqueTlSip = $finalTlSip . '-' . $c;
                                $c++;
                            }
                            $tlEmp = Employee::create([
                                'name' => $cleanTlName,
                                'sip_id' => $uniqueTlSip,
                                'gender' => $tlGenderCandidate,
                                'sub_service' => 'TEAM LEADER',
                                'status' => 'active',
                            ]);
                        }
                        $tlEmployeeId = $tlEmp->id;

                        TeamLeader::firstOrCreate(
                            ['name' => $cleanTlName],
                            ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );

                        // Ensure TL has an assignment with Team Leader service
                        EmployeeAssignment::updateOrCreate(
                            [
                                'employee_id' => $tlEmp->id,
                                'start_date' => '2026-08-01',
                            ],
                            [
                                'service_id' => self::getOrCreateTlService()->id,
                                'sub_service' => 'TEAM LEADER',
                                'site_id' => $siteId,
                                'team_leader_id' => null,
                                'trainer_id' => null,
                                'status' => true,
                            ]
                        );

                        // Auto create/sync User account for TL
                        self::createOrUpdateUniqueUser(
                            $tlEmp->id,
                            $cleanTlName,
                            (string)$tlEmp->sip_id,
                            'team_leader',
                            'Team Leader Operasional'
                        );
                    }

                    // 5. Resolve Trainer Employee (for non-QA, non-TL, non-Trainer rows)
                    $trainerEmployeeId = null;
                    if (!$isQa && !$isTl && !$isTrainer && $rawTrainer && trim((string)$rawTrainer) !== '') {
                        $cleanTrnName = trim((string)$rawTrainer);
                        $normTrnName = self::normalizePersonName($cleanTrnName);

                        // Cek di pre-scanned people
                        $preTrn = $preScannedPeople[$normTrnName] ?? null;
                        $trnSipCandidate = $preTrn['sip_id'] ?? null;
                        $trnGenderCandidate = $preTrn['gender'] ?? null;

                        // Cari employee Trainer yang sudah ada di DB
                        $trnEmp = null;
                        if ($trnSipCandidate) {
                            $trnEmp = Employee::where('sip_id', $trnSipCandidate)->first();
                        }
                        if (!$trnEmp) {
                            $trnEmp = Employee::whereRaw('LOWER(TRIM(name)) = ?', [strtolower($cleanTrnName)])
                                ->orWhereRaw("LOWER(REPLACE(REPLACE(REPLACE(name, ' ', ''), '.', ''), '-', '')) = ?", [$normTrnName])
                                ->first();
                        }

                        if ($trnEmp) {
                            $trnUpdates = ['status' => 'active'];
                            if ($trnSipCandidate && (str_starts_with($trnEmp->sip_id, 'TRN-') || str_starts_with($trnEmp->sip_id, 'SIP-'))) {
                                if (!Employee::where('sip_id', $trnSipCandidate)->where('id', '!=', $trnEmp->id)->exists()) {
                                    $trnUpdates['sip_id'] = $trnSipCandidate;
                                }
                            }
                            if ($trnGenderCandidate && !$trnEmp->gender) {
                                $trnUpdates['gender'] = $trnGenderCandidate;
                            }
                            $trnEmp->update($trnUpdates);
                        } else {
                            $finalTrnSip = $trnSipCandidate ?: ('TRN-' . strtoupper(substr(md5($cleanTrnName), 0, 6)));
                            $uniqueTrnSip = $finalTrnSip;
                            $c = 1;
                            while (Employee::where('sip_id', $uniqueTrnSip)->exists()) {
                                $uniqueTrnSip = $finalTrnSip . '-' . $c;
                                $c++;
                            }
                            $trnEmp = Employee::create([
                                'name' => $cleanTrnName,
                                'sip_id' => $uniqueTrnSip,
                                'gender' => $trnGenderCandidate,
                                'sub_service' => 'TRAINER',
                                'status' => 'active',
                            ]);
                        }
                        $trainerEmployeeId = $trnEmp->id;

                        Trainer::firstOrCreate(
                            ['name' => $cleanTrnName],
                            ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                        );

                        // Ensure Trainer has an assignment with Trainer service
                        EmployeeAssignment::updateOrCreate(
                            [
                                'employee_id' => $trnEmp->id,
                                'start_date' => '2026-08-01',
                            ],
                            [
                                'service_id' => self::getOrCreateTrainerService()->id,
                                'sub_service' => 'TRAINER',
                                'site_id' => $siteId,
                                'team_leader_id' => null,
                                'trainer_id' => null,
                                'status' => true,
                            ]
                        );

                        // Auto create/sync User account for Trainer
                        self::createOrUpdateUniqueUser(
                            $trnEmp->id,
                            $cleanTrnName,
                            (string)$trnEmp->sip_id,
                            'trainer',
                            'Trainer Operasional & Coaching'
                        );

                        // EvaluatorSampling for Trainer
                        \App\Models\EvaluatorSampling::firstOrCreate(
                            [
                                'evaluator_name' => $cleanTrnName,
                                'period_month' => '2026-08',
                            ],
                            [
                                'type' => 'Trainer',
                                'quota' => 370,
                                'actual' => 0,
                                'avg_score' => 90.00,
                                'status' => 'Aktif',
                            ]
                        );
                    }

                    // 6. Save Employee Assignment (History)
                    EmployeeAssignment::updateOrCreate(
                        [
                            'employee_id' => $employee->id,
                            'start_date' => '2026-08-01',
                        ],
                        [
                            'service_id' => $serviceId,
                            'sub_service' => $cleanSubLayanan,
                            'site_id' => $siteId,
                            'team_leader_id' => $tlEmployeeId,
                            'trainer_id' => $trainerEmployeeId,
                            'status' => true,
                        ]
                    );

                    // 7. If QA: Auto Create/Sync User Account & EvaluatorSampling
                    if ($isQa) {
                        self::createOrUpdateUniqueUser(
                            $employee->id,
                            $cleanName,
                            (string)$cleanIdSip,
                            'quality_assurance',
                            'Middle Management Quality Assurance'
                        );

                        // EvaluatorSampling for QA
                        \App\Models\EvaluatorSampling::firstOrCreate(
                            [
                                'evaluator_name' => $cleanName,
                                'period_month' => '2026-08',
                            ],
                            [
                                'type' => 'QA',
                                'quota' => 370,
                                'actual' => 0,
                                'avg_score' => 90.00,
                                'status' => 'Aktif',
                            ]
                        );
                    }

                    // 8. If TL row itself: Auto Create/Sync TL User Account & Model
                    if ($isTl) {
                        self::createOrUpdateUniqueUser(
                            $employee->id,
                            $cleanName,
                            (string)$cleanIdSip,
                            'team_leader',
                            'Team Leader Operasional'
                        );
                    }

                    // 9. If Trainer row itself: Auto Create/Sync Trainer User Account, Model & EvaluatorSampling
                    if ($isTrainer) {
                        self::createOrUpdateUniqueUser(
                            $employee->id,
                            $cleanName,
                            (string)$cleanIdSip,
                            'trainer',
                            'Trainer Operasional & Coaching'
                        );

                        // EvaluatorSampling for Trainer
                        \App\Models\EvaluatorSampling::firstOrCreate(
                            [
                                'evaluator_name' => $cleanName,
                                'period_month' => '2026-08',
                            ],
                            [
                                'type' => 'Trainer',
                                'quota' => 370,
                                'actual' => 0,
                                'avg_score' => 90.00,
                                'status' => 'Aktif',
                            ]
                        );
                    }

                    $successRows++;
                    $importRow->update(['status' => 'processed']);
                } catch (\Throwable $rowEx) {
                    $failedRows++;
                    $importRow->update([
                        'status' => 'failed',
                        'error_message' => $rowEx->getMessage(),
                    ]);
                    \Illuminate\Support\Facades\Log::warning("NAKER import row {$rowNum} failed: " . $rowEx->getMessage());
                }
            }

            // Increment batch stats
            $batch->increment('success_rows', $successRows);
            $batch->increment('failed_rows', $failedRows);

            if ($isLastBatch) {
                $batch->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                ]);

                ImportLog::create([
                    'import_batch_id' => $batch->id,
                    'action' => 'IMPORT_COMPLETED',
                    'description' => "Berhasil menginjeksi total {$batch->success_rows} data master tenaga kerja (NAKER).",
                    'created_by' => $userId,
                ]);

                // Sync all agents with newly imported NAKER assignments safely
                try {
                    QsfImportService::syncAllAgentsFromNaker();
                } catch (\Throwable $syncEx) {
                    \Illuminate\Support\Facades\Log::warning("NAKER agent sync warning: " . $syncEx->getMessage());
                }
            }

            DB::commit();

            return [
                'success' => true,
                'message' => $isLastBatch
                    ? "Berhasil memproses seluruh batch ({$batch->success_rows} data master NAKER) ke dalam database."
                    : "Batch {$batchIndex}/{$totalBatches} berhasil diproses ({$successRows} baris NAKER).",
                'batch_id' => $batch->id,
                'batch_index' => $batchIndex,
                'total_batches' => $totalBatches,
                'is_last_batch' => $isLastBatch,
                'batch_success_rows' => $successRows,
                'batch_failed_rows' => $failedRows,
                'total_success_rows' => $batch->success_rows,
                'total_failed_rows' => $batch->failed_rows,
            ];
        } catch (\Throwable $e) {
            DB::rollBack();
            $batch->update([
                'status' => 'failed',
                'completed_at' => now(),
            ]);

            ImportLog::create([
                'import_batch_id' => $batch->id,
                'action' => 'IMPORT_FAILED',
                'description' => 'Gagal import NAKER: ' . $e->getMessage(),
                'created_by' => $userId,
            ]);

            throw $e;
        }
    }
}
