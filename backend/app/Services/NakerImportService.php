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

                // 2. Resolve Service
                $serviceId = null;
                if ($rawLayanan) {
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

                // 4. Resolve TL Employee
                $tlEmployeeId = null;
                if ($rawTeamTl && trim((string)$rawTeamTl) !== '') {
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
                }

                // 5. Resolve Trainer Employee
                $trainerEmployeeId = null;
                if ($rawTrainer && trim((string)$rawTrainer) !== '') {
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
