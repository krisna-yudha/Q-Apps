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
        $existingEmployeesByName = Employee::get()->keyBy(fn($e) => strtolower(trim($e->name)));

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
            $rawTeamTl = self::extractValue($row, ['TEAM TL', 'Team TL', 'TL', 'Nama TL', 'team_tl', 'TEAM_TL']);
            $rawTrainer = self::extractValue($row, ['TRAINER', 'Trainer', 'Nama Trainer', 'trainer']);
            $rawSite = self::extractValue($row, ['SITE', 'Site', 'Lokasi', 'site']);
            $rawIdSip = self::extractValue($row, ['ID SIP', 'ID_SIP', 'IDSIP', 'sip_id', 'ID', 'SIP ID', 'NIK']);

            $cleanName = $rawName ? trim((string)$rawName) : null;
            $cleanIdSip = $rawIdSip ? trim((string)$rawIdSip) : ($cleanName ? ('SIP-' . strtoupper(substr(md5($cleanName), 0, 8))) : null);

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
            $cleanGender = null;
            if ($rawJk) {
                $jkUpper = strtoupper(trim((string)$rawJk));
                if ($jkUpper === 'L' || $jkUpper === 'LAKI-LAKI' || $jkUpper === 'PRIA' || $jkUpper === 'M' || $jkUpper === 'MALE') {
                    $cleanGender = 'PRIA';
                } elseif ($jkUpper === 'P' || $jkUpper === 'PEREMPUAN' || $jkUpper === 'WANITA' || $jkUpper === 'F' || $jkUpper === 'FEMALE') {
                    $cleanGender = 'WANITA';
                }
            }

            $status = 'valid';
            $errorMsg = null;
            $warningMsg = null;

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
            } elseif (isset($existingEmployeesBySip[$cleanIdSip])) {
                $status = 'duplicate';
                $warningMsg = "Employee dengan ID SIP '{$cleanIdSip}' sudah terdaftar di database (akan diupdate).";
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
            'items' => $parsed
        ];
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

                $rawName = self::extractValue($row, ['NAMA', 'Nama', 'name', 'Nama Lengkap', 'Nama Karyawan', 'NAMA LENGKAP']);
                $rawJk = self::extractValue($row, ['JK', 'Jenis Kelamin', 'Gender', 'jk']);
                $rawLayanan = self::extractValue($row, ['LAYANAN', 'Layanan', 'Channel', 'service', 'layanan']);
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
                $cleanIdSip = $rawIdSip ? trim((string)$rawIdSip) : ('SIP-' . strtoupper(substr(md5($cleanName), 0, 8)));

                // Normalize Gender
                $cleanGender = null;
                if ($rawJk) {
                    $jkUpper = strtoupper(trim((string)$rawJk));
                    if (str_starts_with($jkUpper, 'P') || $jkUpper === 'L' || $jkUpper === 'LAKI-LAKI' || $jkUpper === 'M') {
                        $cleanGender = 'PRIA';
                    } elseif (str_starts_with($jkUpper, 'W') || $jkUpper === 'P' && $jkUpper === 'PEREMPUAN' || $jkUpper === 'F') {
                        $cleanGender = 'WANITA';
                    }
                }

                // 1. Create or Update Employee
                $employee = Employee::updateOrCreate(
                    ['sip_id' => $cleanIdSip],
                    [
                        'name' => $cleanName,
                        'gender' => $cleanGender,
                        'status' => 'active',
                    ]
                );

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
                        ServiceMapping::create([
                            'source_system' => 'NAKER',
                            'source_value' => $cleanLayanan,
                            'service_id' => $serviceId,
                        ]);
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
                    $tlEmp = Employee::firstOrCreate(
                        ['name' => $cleanTlName],
                        ['sip_id' => 'TL-' . strtoupper(substr(md5($cleanTlName), 0, 6)), 'status' => 'active']
                    );
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
                            'site_id' => $siteId,
                            'team_leader_id' => null,
                            'trainer_id' => null,
                            'status' => true,
                        ]
                    );

                    // Auto create/sync User account for TL
                    $cleanTlUsername = strtolower(trim((string)$tlEmp->sip_id));
                    $cleanTlUsername = preg_replace('/[^a-z0-9._-]/', '', $cleanTlUsername);
                    if (empty($cleanTlUsername)) {
                        $cleanTlUsername = 'tl.' . strtolower(str_replace(' ', '.', $cleanTlName));
                    }
                    $tlEmail = $cleanTlUsername . '@digiqa.id';

                    $userRecordTl = User::where('employee_id', $tlEmp->id)
                        ->orWhere('username', $cleanTlUsername)
                        ->orWhere('email', $tlEmail)
                        ->first();

                    if ($userRecordTl) {
                        $userRecordTl->update([
                            'employee_id' => $tlEmp->id,
                            'name' => $cleanTlName,
                            'role' => 'team_leader',
                            'department' => 'Team Leader Operasional',
                            'status' => 'active',
                        ]);
                    } else {
                        User::create([
                            'employee_id' => $tlEmp->id,
                            'name' => $cleanTlName,
                            'username' => $cleanTlUsername,
                            'email' => $tlEmail,
                            'password' => \Illuminate\Support\Facades\Hash::make('password'),
                            'role' => 'team_leader',
                            'department' => 'Team Leader Operasional',
                            'status' => 'active',
                        ]);
                    }
                }

                // 5. Resolve Trainer Employee (for non-QA, non-TL, non-Trainer rows)
                $trainerEmployeeId = null;
                if (!$isQa && !$isTl && !$isTrainer && $rawTrainer && trim((string)$rawTrainer) !== '') {
                    $cleanTrnName = trim((string)$rawTrainer);
                    $trnEmp = Employee::firstOrCreate(
                        ['name' => $cleanTrnName],
                        ['sip_id' => 'TRN-' . strtoupper(substr(md5($cleanTrnName), 0, 6)), 'status' => 'active']
                    );
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
                            'site_id' => $siteId,
                            'team_leader_id' => null,
                            'trainer_id' => null,
                            'status' => true,
                        ]
                    );

                    // Auto create/sync User account for Trainer
                    $cleanTrnUsername = strtolower(trim((string)$trnEmp->sip_id));
                    $cleanTrnUsername = preg_replace('/[^a-z0-9._-]/', '', $cleanTrnUsername);
                    if (empty($cleanTrnUsername)) {
                        $cleanTrnUsername = 'trn.' . strtolower(str_replace(' ', '.', $cleanTrnName));
                    }
                    $trnEmail = $cleanTrnUsername . '@digiqa.id';

                    $userRecordTrn = User::where('employee_id', $trnEmp->id)
                        ->orWhere('username', $cleanTrnUsername)
                        ->orWhere('email', $trnEmail)
                        ->first();

                    if ($userRecordTrn) {
                        $userRecordTrn->update([
                            'employee_id' => $trnEmp->id,
                            'name' => $cleanTrnName,
                            'role' => 'trainer',
                            'department' => 'Trainer Operasional & Coaching',
                            'status' => 'active',
                        ]);
                    } else {
                        User::create([
                            'employee_id' => $trnEmp->id,
                            'name' => $cleanTrnName,
                            'username' => $cleanTrnUsername,
                            'email' => $trnEmail,
                            'password' => \Illuminate\Support\Facades\Hash::make('password'),
                            'role' => 'trainer',
                            'department' => 'Trainer Operasional & Coaching',
                            'status' => 'active',
                        ]);
                    }

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
                        'site_id' => $siteId,
                        'team_leader_id' => $tlEmployeeId,
                        'trainer_id' => $trainerEmployeeId,
                        'status' => true,
                    ]
                );

                // 7. If QA: Auto Create/Sync User Account & EvaluatorSampling
                if ($isQa) {
                    $usernameSuggestion = strtolower(trim((string)$cleanIdSip));
                    $cleanUsername = preg_replace('/[^a-z0-9._-]/', '', $usernameSuggestion);
                    if (empty($cleanUsername)) {
                        $cleanUsername = 'qa.' . strtolower(str_replace(' ', '.', $cleanName));
                    }
                    $qaEmail = $cleanUsername . '@digiqa.id';

                    $userRecord = User::where('employee_id', $employee->id)
                        ->orWhere('username', $cleanUsername)
                        ->orWhere('email', $qaEmail)
                        ->first();

                    if ($userRecord) {
                        $userRecord->update([
                            'employee_id' => $employee->id,
                            'name' => $cleanName,
                            'role' => 'quality_assurance',
                            'department' => 'Middle Management Quality Assurance',
                            'status' => 'active',
                        ]);
                    } else {
                        User::create([
                            'employee_id' => $employee->id,
                            'name' => $cleanName,
                            'username' => $cleanUsername,
                            'email' => $qaEmail,
                            'password' => \Illuminate\Support\Facades\Hash::make('password'),
                            'role' => 'quality_assurance',
                            'department' => 'Middle Management Quality Assurance',
                            'status' => 'active',
                        ]);
                    }

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
                    $usernameSuggestion = strtolower(trim((string)$cleanIdSip));
                    $cleanUsername = preg_replace('/[^a-z0-9._-]/', '', $usernameSuggestion);
                    if (empty($cleanUsername)) {
                        $cleanUsername = 'tl.' . strtolower(str_replace(' ', '.', $cleanName));
                    }
                    $tlEmail = $cleanUsername . '@digiqa.id';

                    TeamLeader::firstOrCreate(
                        ['name' => $cleanName],
                        ['code' => 'TL-' . strtoupper(Str::random(4)), 'is_active' => true]
                    );

                    $userRecord = User::where('employee_id', $employee->id)
                        ->orWhere('username', $cleanUsername)
                        ->orWhere('email', $tlEmail)
                        ->first();

                    if ($userRecord) {
                        $userRecord->update([
                            'employee_id' => $employee->id,
                            'name' => $cleanName,
                            'role' => 'team_leader',
                            'department' => 'Team Leader Operasional',
                            'status' => 'active',
                        ]);
                    } else {
                        User::create([
                            'employee_id' => $employee->id,
                            'name' => $cleanName,
                            'username' => $cleanUsername,
                            'email' => $tlEmail,
                            'password' => \Illuminate\Support\Facades\Hash::make('password'),
                            'role' => 'team_leader',
                            'department' => 'Team Leader Operasional',
                            'status' => 'active',
                        ]);
                    }
                }

                // 9. If Trainer row itself: Auto Create/Sync Trainer User Account, Model & EvaluatorSampling
                if ($isTrainer) {
                    $usernameSuggestion = strtolower(trim((string)$cleanIdSip));
                    $cleanUsername = preg_replace('/[^a-z0-9._-]/', '', $usernameSuggestion);
                    if (empty($cleanUsername)) {
                        $cleanUsername = 'trn.' . strtolower(str_replace(' ', '.', $cleanName));
                    }
                    $trnEmail = $cleanUsername . '@digiqa.id';

                    Trainer::firstOrCreate(
                        ['name' => $cleanName],
                        ['code' => 'TRN-' . strtoupper(Str::random(4)), 'is_active' => true]
                    );

                    $userRecord = User::where('employee_id', $employee->id)
                        ->orWhere('username', $cleanUsername)
                        ->orWhere('email', $trnEmail)
                        ->first();

                    if ($userRecord) {
                        $userRecord->update([
                            'employee_id' => $employee->id,
                            'name' => $cleanName,
                            'role' => 'trainer',
                            'department' => 'Trainer Operasional & Coaching',
                            'status' => 'active',
                        ]);
                    } else {
                        User::create([
                            'employee_id' => $employee->id,
                            'name' => $cleanName,
                            'username' => $cleanUsername,
                            'email' => $trnEmail,
                            'password' => \Illuminate\Support\Facades\Hash::make('password'),
                            'role' => 'trainer',
                            'department' => 'Trainer Operasional & Coaching',
                            'status' => 'active',
                        ]);
                    }

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

                // Sync all agents with newly imported NAKER assignments
                QsfImportService::syncAllAgentsFromNaker();
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
        } catch (\Exception $e) {
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
